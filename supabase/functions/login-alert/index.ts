import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const FAILED_ATTEMPTS_THRESHOLD = 5;
const TIME_WINDOW_MINUTES = 15;
const AUTO_BLOCK_THRESHOLD = 10; // Auto-block after 10 failed attempts
const AUTO_BLOCK_DURATION_HOURS = 24; // Block for 24 hours
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const fallbackRateLimitStore = new Map<string, { count: number; resetTime: number }>();

interface GeoLocation {
  country: string;
  countryCode: string;
  city: string;
  region: string;
  lat: number;
  lon: number;
  isp: string;
}

function getClientIp(req: Request): string | null {
  return req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null;
}

function checkFallbackRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = fallbackRateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    fallbackRateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - record.count) };
}

async function lookupIP(ip: string): Promise<GeoLocation | null> {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,city,lat,lon,isp`);
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        country: data.country,
        countryCode: data.countryCode,
        city: data.city || 'Unknown',
        region: data.region || 'Unknown',
        lat: data.lat,
        lon: data.lon,
        isp: data.isp || 'Unknown',
      };
    }
    return null;
  } catch (error) {
    console.error(`Error looking up IP ${ip}:`, error);
    return null;
  }
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  
  // Handle CORS preflight requests
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, login_attempt_id, check_block_only } = await req.json();
    const clientIp = getClientIp(req);

    // Check if IP is blocked (for pre-login check)
    if (check_block_only) {
      if (!clientIp) {
        return new Response(
          JSON.stringify({ blocked: false, reason: 'Client IP unavailable' }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const { data: isBlocked } = await supabase.rpc('is_ip_blocked', { p_ip_address: clientIp });
      
      if (isBlocked) {
        // Get block details
        const { data: blockInfo } = await supabase
          .from('ip_blocklist')
          .select('reason, expires_at, auto_blocked')
          .eq('ip_address', clientIp)
          .eq('is_active', true)
          .eq('list_type', 'block')
          .single();
          
        return new Response(
          JSON.stringify({ 
            blocked: true, 
            reason: blockInfo?.reason || 'IP address has been blocked due to suspicious activity',
            expires_at: blockInfo?.expires_at,
            auto_blocked: blockInfo?.auto_blocked
          }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      return new Response(
        JSON.stringify({ blocked: false }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    // Lookup geolocation for the IP address
    let geoLocation: GeoLocation | null = null;
    if (clientIp) {
      // First check if IP is blocked
      const { data: isBlocked } = await supabase.rpc('is_ip_blocked', { p_ip_address: clientIp });
      if (isBlocked) {
        console.log(`IP ${clientIp} is blocked, rejecting request`);
        return new Response(
          JSON.stringify({ error: 'IP address is blocked', blocked: true }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      geoLocation = await lookupIP(clientIp);
      console.log(`Geolocation for ${clientIp}:`, geoLocation);
      
      // Update the login attempt with geolocation data
      if (geoLocation && login_attempt_id) {
        const { error: geoError } = await supabase
          .from('login_attempts')
          .update({
            country: geoLocation.country,
            country_code: geoLocation.countryCode,
            city: geoLocation.city,
            region: geoLocation.region,
            latitude: geoLocation.lat,
            longitude: geoLocation.lon,
            isp: geoLocation.isp,
          })
          .eq('id', login_attempt_id);
          
        if (geoError) {
          console.error('Error updating login attempt with geolocation:', geoError);
        }
      }
    }

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Checking failed login attempts for: ${email}`);

    // Rate limiting: allow max 10 requests per email per hour
    try {
      const hourWindow = new Date();
      hourWindow.setMinutes(0, 0, 0);
      const windowStartIso = hourWindow.toISOString();
      const rlKey = `login_alert:${email.toLowerCase()}`;

      const { data: rlData, error: rlError } = await supabase.rpc('increment_rate_limit', {
        p_key: rlKey,
        p_window_start: windowStartIso,
        p_increment: 1,
      });

      if (rlError) {
        console.error('Rate limit RPC error:', rlError);
        const fallbackResult = checkFallbackRateLimit(rlKey);
        if (!fallbackResult.allowed) {
          return new Response(
            JSON.stringify({ error: 'Too many requests for this email. Please try again later.' }),
            { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      } else {
        const currentCount = Array.isArray(rlData) ? rlData[0] : rlData;
        const countValue = typeof currentCount === 'number' ? currentCount : (currentCount?.count ?? currentCount);
        if (typeof countValue === 'number' && countValue > 10) {
          return new Response(
            JSON.stringify({ error: 'Too many requests for this email. Please try again later.' }),
            { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }
    } catch (e) {
      console.error('Rate limit check failed:', e);
      const fallbackResult = checkFallbackRateLimit(`login_alert:${email.toLowerCase()}`);
      if (!fallbackResult.allowed) {
        return new Response(
          JSON.stringify({ error: 'Too many requests for this email. Please try again later.' }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Count recent failed attempts for this email
    const timeWindowStart = new Date(Date.now() - TIME_WINDOW_MINUTES * 60 * 1000).toISOString();
    
    const { count, error: countError } = await supabase
      .from("login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("email", email.toLowerCase())
      .eq("was_successful", false)
      .gte("attempted_at", timeWindowStart);

    if (countError) {
      console.error("Error counting failed attempts:", countError);
      throw countError;
    }

    const failedCount = count || 0;
    console.log(`Failed attempts in last ${TIME_WINDOW_MINUTES} minutes: ${failedCount}`);

    // Only send alert if threshold is reached exactly (to avoid spamming)
    if (failedCount === FAILED_ATTEMPTS_THRESHOLD) {
      console.log(`Threshold reached for ${email}, sending alert email`);

      // Get super admin emails to notify
      const { data: superAdmins, error: adminsError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");

      if (adminsError) {
        console.error("Error fetching super admins:", adminsError);
        throw adminsError;
      }

      if (superAdmins && superAdmins.length > 0) {
        // Get email addresses for super admins
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("email")
          .in("id", superAdmins.map(sa => sa.user_id));

        if (profilesError) {
          console.error("Error fetching admin profiles:", profilesError);
          throw profilesError;
        }

        const adminEmails = profiles?.map(p => p.email).filter(Boolean) || [];

        if (adminEmails.length > 0) {
          const alertHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Security Alert</h1>
              </div>
              <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
                <h2 style="color: #1f2937; margin-top: 0;">Multiple Failed Login Attempts Detected</h2>
                <p style="color: #4b5563; line-height: 1.6;">
                  We detected <strong>${failedCount} failed login attempts</strong> for the following account within the last ${TIME_WINDOW_MINUTES} minutes:
                </p>
            <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  <p style="margin: 0; color: #374151;"><strong>Email:</strong> ${email}</p>
                  ${clientIp ? `<p style="margin: 8px 0 0 0; color: #374151;"><strong>IP Address:</strong> ${clientIp}</p>` : ''}
                  ${geoLocation ? `
                    <p style="margin: 8px 0 0 0; color: #374151;"><strong>Location:</strong> ${geoLocation.city}, ${geoLocation.region}, ${geoLocation.country}</p>
                    <p style="margin: 8px 0 0 0; color: #374151;"><strong>ISP:</strong> ${geoLocation.isp}</p>
                  ` : ''}
                  <p style="margin: 8px 0 0 0; color: #374151;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                </div>
                <p style="color: #4b5563; line-height: 1.6;">
                  This could indicate a brute force attack or unauthorized access attempt. The account has been temporarily locked for security.
                </p>
                <h3 style="color: #1f2937;">Recommended Actions:</h3>
                <ul style="color: #4b5563; line-height: 1.8;">
                  <li>Review the login attempts in the Security Dashboard</li>
                  <li>Verify if this is a legitimate user having trouble logging in</li>
                  <li>Consider resetting the user's password if unauthorized access is suspected</li>
                  <li>Check for similar patterns from the same IP address</li>
                </ul>
                <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #6b7280; font-size: 14px; margin: 0;">
                    This is an automated security alert from AlCor Nexus.
                  </p>
                </div>
              </div>
            </div>
          `;

          const emailResponse = await resend.emails.send({
            from: "AlCor Nexus Security <onboarding@resend.dev>",
            to: adminEmails,
            subject: `🚨 Security Alert: Multiple Failed Login Attempts for ${email}`,
            html: alertHtml,
          });

          console.log("Alert email sent:", emailResponse);
        }
      }
    }

    // Auto-block IP if exceeded auto-block threshold
    let autoBlocked = false;
    if (clientIp && failedCount >= AUTO_BLOCK_THRESHOLD) {
      console.log(`Auto-blocking IP ${clientIp} after ${failedCount} failed attempts`);
      
      const expiresAt = new Date(Date.now() + AUTO_BLOCK_DURATION_HOURS * 60 * 60 * 1000);
      const locationInfo = geoLocation 
        ? `${geoLocation.city}, ${geoLocation.country}` 
        : 'Unknown location';
      
      // Upsert into ip_blocklist
      const { error: blockError } = await supabase
        .from('ip_blocklist')
        .upsert({
          ip_address: clientIp,
          list_type: 'block',
          reason: `Auto-blocked after ${failedCount} failed login attempts for ${email} from ${locationInfo}`,
          expires_at: expiresAt.toISOString(),
          is_active: true,
          auto_blocked: true,
          blocked_email: email,
          failed_attempts: failedCount,
        }, { 
          onConflict: 'ip_address',
          ignoreDuplicates: false 
        });
      
      if (blockError) {
        console.error('Error auto-blocking IP:', blockError);
      } else {
        autoBlocked = true;
        console.log(`IP ${clientIp} auto-blocked until ${expiresAt.toISOString()}`);
        
        // Send notification about auto-block
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "super_admin");

        if (adminRoles && adminRoles.length > 0) {
          const { data: adminProfiles } = await supabase
            .from("profiles")
            .select("email")
            .in("id", adminRoles.map((sa: { user_id: string }) => sa.user_id));
          
          const adminEmails = adminProfiles?.map(p => p.email).filter(Boolean) || [];
          
          if (adminEmails.length > 0) {
            await resend.emails.send({
              from: "AlCor Nexus Security <onboarding@resend.dev>",
              to: adminEmails,
              subject: `🛡️ IP Auto-Blocked: ${clientIp}`,
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">🛡️ IP Address Auto-Blocked</h1>
                  </div>
                  <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
                    <p style="color: #4b5563;">An IP address has been automatically blocked due to repeated failed login attempts.</p>
                    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                      <p style="margin: 0; color: #374151;"><strong>IP Address:</strong> ${clientIp}</p>
                      <p style="margin: 8px 0 0 0; color: #374151;"><strong>Location:</strong> ${locationInfo}</p>
                      <p style="margin: 8px 0 0 0; color: #374151;"><strong>Target Email:</strong> ${email}</p>
                      <p style="margin: 8px 0 0 0; color: #374151;"><strong>Failed Attempts:</strong> ${failedCount}</p>
                      <p style="margin: 8px 0 0 0; color: #374151;"><strong>Block Expires:</strong> ${expiresAt.toLocaleString()}</p>
                    </div>
                    <p style="color: #4b5563;">You can manage blocked IPs in the Security Dashboard.</p>
                  </div>
                </div>
              `,
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        failed_count: failedCount,
        threshold: FAILED_ATTEMPTS_THRESHOLD,
        alert_sent: failedCount === FAILED_ATTEMPTS_THRESHOLD,
        auto_blocked: autoBlocked,
        geolocation: geoLocation
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error in login-alert function:", error);
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
