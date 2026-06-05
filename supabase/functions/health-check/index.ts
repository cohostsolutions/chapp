import { serve } from "std/http/server";
import { createClient } from "@supabase/supabase-js";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createInternalAuthErrorResponse, isAuthorizedInternalRequest } from "../_shared/internal-auth.ts";

interface HealthCheckResult {
  check: string;
  status: "healthy" | "warning" | "critical";
  message: string;
  duration?: number;
  details?: Record<string, unknown>;
}

interface HealthReport {
  timestamp: string;
  overallStatus: "healthy" | "warning" | "critical";
  healthScore: number;
  checks: HealthCheckResult[];
  alertsSent: boolean;
}

interface Threshold {
  threshold_name: string;
  warning_value: number;
  critical_value: number;
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req, 'x-internal-function-secret');
  
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req, 'x-internal-function-secret');
  if (corsResponse) return corsResponse;

  if (!isAuthorizedInternalRequest(req)) {
    return createInternalAuthErrorResponse(corsHeaders);
  }

  console.log("Starting health check...");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const adminEmail = "acornilla@canvascapitalco.com"; // Super admin email

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const checks: HealthCheckResult[] = [];

  // Fetch configurable thresholds
  const { data: thresholdsData } = await supabase
    .from("health_check_thresholds")
    .select("*");

  const thresholds: Record<string, Threshold> = {};
  (thresholdsData || []).forEach((t: Threshold) => {
    thresholds[t.threshold_name] = t;
  });

  // Default thresholds if not configured
  const getThreshold = (name: string, defaultWarning: number, defaultCritical: number) => {
    const t = thresholds[name];
    return {
      warning: t?.warning_value ?? defaultWarning,
      critical: t?.critical_value ?? defaultCritical,
    };
  };

  let healthScore = 100;
  let failedLoginsCount = 0;
  let overdueSecretsCount = 0;
  let processingBacklogCount = 0;
  const tableSizes: Record<string, number> = {};

  // 1. Database connectivity check
  const queryThreshold = getThreshold("query_duration_ms", 2000, 5000);
  try {
    const start = performance.now();
    const { error } = await supabase.from("profiles").select("id").limit(1);
    const duration = performance.now() - start;

    if (error) {
      checks.push({
        check: "Database Connectivity",
        status: "critical",
        message: `Database query failed: ${error.message}`,
        duration: Math.round(duration),
      });
      healthScore -= 30;
    } else if (duration > queryThreshold.critical) {
      checks.push({
        check: "Database Connectivity",
        status: "critical",
        message: `Database responding very slowly: ${Math.round(duration)}ms`,
        duration: Math.round(duration),
      });
      healthScore -= 25;
    } else if (duration > queryThreshold.warning) {
      checks.push({
        check: "Database Connectivity",
        status: "warning",
        message: `Database responding slowly: ${Math.round(duration)}ms`,
        duration: Math.round(duration),
      });
      healthScore -= 10;
    } else {
      checks.push({
        check: "Database Connectivity",
        status: "healthy",
        message: `Database responding normally: ${Math.round(duration)}ms`,
        duration: Math.round(duration),
      });
    }
  } catch (err) {
    checks.push({
      check: "Database Connectivity",
      status: "critical",
      message: `Database unreachable: ${err}`,
    });
    healthScore -= 40;
  }

  // 2. Check for failed login attempts (security)
  const loginThreshold = getThreshold("failed_logins_24h", 20, 50);
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: failedLogins, error } = await supabase
      .from("login_attempts")
      .select("id")
      .eq("was_successful", false)
      .gte("attempted_at", twentyFourHoursAgo);

    if (error) {
      checks.push({
        check: "Security - Failed Logins",
        status: "warning",
        message: `Could not check failed logins: ${error.message}`,
      });
      healthScore -= 5;
    } else {
      failedLoginsCount = failedLogins?.length || 0;
      if (failedLoginsCount > loginThreshold.critical) {
        checks.push({
          check: "Security - Failed Logins",
          status: "critical",
          message: `High number of failed logins (${failedLoginsCount}) in last 24h - possible brute force attack`,
          details: { count: failedLoginsCount },
        });
        healthScore -= 20;
      } else if (failedLoginsCount > loginThreshold.warning) {
        checks.push({
          check: "Security - Failed Logins",
          status: "warning",
          message: `Elevated failed logins (${failedLoginsCount}) in last 24h`,
          details: { count: failedLoginsCount },
        });
        healthScore -= 10;
      } else {
        checks.push({
          check: "Security - Failed Logins",
          status: "healthy",
          message: `Normal failed login count (${failedLoginsCount}) in last 24h`,
          details: { count: failedLoginsCount },
        });
      }
    }
  } catch (err) {
    checks.push({
      check: "Security - Failed Logins",
      status: "warning",
      message: `Check failed: ${err}`,
    });
    healthScore -= 5;
  }

  // 3. Check secret rotation status
  const secretThreshold = getThreshold("overdue_secrets", 1, 3);
  try {
    const { data: secrets, error } = await supabase
      .from("secret_rotation_tracking")
      .select("*");

    if (error) {
      checks.push({
        check: "Secret Rotation",
        status: "warning",
        message: `Could not check secrets: ${error.message}`,
      });
      healthScore -= 5;
    } else {
      const now = new Date();
      const overdueSecrets = (secrets || []).filter((s: { last_rotated_at: string | null; rotation_interval_days: number }) => {
        if (!s.last_rotated_at) return true;
        const lastRotated = new Date(s.last_rotated_at);
        const daysSince = (now.getTime() - lastRotated.getTime()) / (1000 * 60 * 60 * 24);
        return daysSince > s.rotation_interval_days;
      });

      overdueSecretsCount = overdueSecrets.length;

      if (overdueSecretsCount >= secretThreshold.critical) {
        checks.push({
          check: "Secret Rotation",
          status: "critical",
          message: `${overdueSecretsCount} secret(s) critically overdue for rotation`,
          details: { overdueSecrets: overdueSecrets.map((s: { secret_name: string }) => s.secret_name) },
        });
        healthScore -= 15;
      } else if (overdueSecretsCount >= secretThreshold.warning) {
        checks.push({
          check: "Secret Rotation",
          status: "warning",
          message: `${overdueSecretsCount} secret(s) overdue for rotation`,
          details: { overdueSecrets: overdueSecrets.map((s: { secret_name: string }) => s.secret_name) },
        });
        healthScore -= 8;
      } else {
        checks.push({
          check: "Secret Rotation",
          status: "healthy",
          message: "All secrets are within rotation schedule",
        });
      }
    }
  } catch (err) {
    checks.push({
      check: "Secret Rotation",
      status: "warning",
      message: `Check failed: ${err}`,
    });
    healthScore -= 5;
  }

  // 4. Check table sizes (potential performance issues)
  const tableThreshold = getThreshold("table_row_count", 100000, 500000);
  try {
    const tablesToCheck = ["leads", "communications", "audit_logs"];

    for (const table of tablesToCheck) {
      try {
        const { count } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });
        tableSizes[table] = count || 0;
      } catch {
        // Skip tables we can't access
      }
    }

    const criticalTables = Object.entries(tableSizes).filter(([_, count]) => count > tableThreshold.critical);
    const largeTables = Object.entries(tableSizes).filter(([_, count]) => count > tableThreshold.warning && count <= tableThreshold.critical);
    
    if (criticalTables.length > 0) {
      checks.push({
        check: "Table Sizes",
        status: "critical",
        message: `Very large tables detected: ${criticalTables.map(([t, c]) => `${t}(${c})`).join(", ")}`,
        details: tableSizes,
      });
      healthScore -= 15;
    } else if (largeTables.length > 0) {
      checks.push({
        check: "Table Sizes",
        status: "warning",
        message: `Large tables detected: ${largeTables.map(([t, c]) => `${t}(${c})`).join(", ")}`,
        details: tableSizes,
      });
      healthScore -= 8;
    } else {
      checks.push({
        check: "Table Sizes",
        status: "healthy",
        message: "All monitored tables within normal size",
        details: tableSizes,
      });
    }
  } catch (err) {
    checks.push({
      check: "Table Sizes",
      status: "warning",
      message: `Check failed: ${err}`,
    });
    healthScore -= 5;
  }

  // 5. Check for stale data (unprocessed items)
  const backlogThreshold = getThreshold("processing_backlog", 10, 50);
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: staleMessages, error } = await supabase
      .from("message_buffer")
      .select("id")
      .eq("processed", false)
      .lt("received_at", oneHourAgo);

    if (error) {
      checks.push({
        check: "Message Processing",
        status: "warning",
        message: `Could not check message buffer: ${error.message}`,
      });
      healthScore -= 5;
    } else {
      processingBacklogCount = staleMessages?.length || 0;
      if (processingBacklogCount >= backlogThreshold.critical) {
        checks.push({
          check: "Message Processing",
          status: "critical",
          message: `${processingBacklogCount} unprocessed message(s) older than 1 hour - critical backlog`,
          details: { count: processingBacklogCount },
        });
        healthScore -= 15;
      } else if (processingBacklogCount >= backlogThreshold.warning) {
        checks.push({
          check: "Message Processing",
          status: "warning",
          message: `${processingBacklogCount} unprocessed message(s) older than 1 hour`,
          details: { count: processingBacklogCount },
        });
        healthScore -= 8;
      } else {
        checks.push({
          check: "Message Processing",
          status: "healthy",
          message: "No stale unprocessed messages",
        });
      }
    }
  } catch (err) {
    checks.push({
      check: "Message Processing",
      status: "warning",
      message: `Check failed: ${err}`,
    });
    healthScore -= 5;
  }

  // Ensure health score is within bounds
  healthScore = Math.max(0, Math.min(100, healthScore));

  // Determine overall status based on health score threshold
  const scoreThreshold = getThreshold("health_score", 70, 50);
  const hasCritical = checks.some((c) => c.status === "critical");
  const hasWarning = checks.some((c) => c.status === "warning");
  
  let overallStatus: "healthy" | "warning" | "critical" = "healthy";
  if (hasCritical || healthScore < scoreThreshold.critical) {
    overallStatus = "critical";
  } else if (hasWarning || healthScore < scoreThreshold.warning) {
    overallStatus = "warning";
  }

  // Store health check result in history
  try {
    await supabase.from("health_check_history").insert({
      overall_status: overallStatus,
      health_score: healthScore,
      failed_logins: failedLoginsCount,
      overdue_secrets: overdueSecretsCount,
      table_sizes: tableSizes,
      processing_backlog: processingBacklogCount,
      alerts_sent: false,
      check_details: checks,
    });
    console.log("Health check result stored in history");
  } catch (err) {
    console.error("Failed to store health check history:", err);
  }

  // Send email alert for critical issues using fetch
  let alertsSent = false;
  if (overallStatus === "critical" && resendApiKey) {
    try {
      const criticalChecks = checks.filter((c) => c.status === "critical");
      const warningChecks = checks.filter((c) => c.status === "warning");

      const emailHtml = `
        <h1 style="color: #dc2626;">
          🚨 Database Health Alert - CRITICAL
        </h1>
        <p><strong>Health Score:</strong> ${healthScore}%</p>
        <p>Automated health check detected critical issues at ${new Date().toISOString()}</p>
        
        ${criticalChecks.length > 0 ? `
          <h2 style="color: #dc2626;">Critical Issues (${criticalChecks.length})</h2>
          <ul>
            ${criticalChecks.map((c) => `
              <li><strong>${c.check}:</strong> ${c.message}</li>
            `).join("")}
          </ul>
        ` : ""}
        
        ${warningChecks.length > 0 ? `
          <h2 style="color: #f59e0b;">Warnings (${warningChecks.length})</h2>
          <ul>
            ${warningChecks.map((c) => `
              <li><strong>${c.check}:</strong> ${c.message}</li>
            `).join("")}
          </ul>
        ` : ""}
        
        <p style="margin-top: 20px;">
          <a href="https://canvascapitalco.com/dashboard" style="background-color: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            View Admin Dashboard
          </a>
        </p>
        
        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
          This is an automated message from AlCor CRM Health Monitor.
          You can configure alert thresholds in the Admin Dashboard.
        </p>
      `;

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "AlCor CRM <onboarding@resend.dev>",
          to: [adminEmail],
          subject: `🚨 [CRITICAL] AlCor CRM Health Alert - Score: ${healthScore}%`,
          html: emailHtml,
        }),
      });

      if (emailResponse.ok) {
        alertsSent = true;
        console.log("Critical alert email sent successfully");

        // Update history record with alertsSent = true
        await supabase
          .from("health_check_history")
          .update({ alerts_sent: true })
          .order("timestamp", { ascending: false })
          .limit(1);
      } else {
        console.error("Failed to send email:", await emailResponse.text());
      }
    } catch (emailErr) {
      console.error("Failed to send alert email:", emailErr);
    }
  }

  const report: HealthReport = {
    timestamp: new Date().toISOString(),
    overallStatus,
    healthScore,
    checks,
    alertsSent,
  };

  console.log("Health check complete:", JSON.stringify(report, null, 2));

  return new Response(JSON.stringify(report), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
