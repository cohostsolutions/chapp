import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Helper to safely extract Zod validation errors
function getValidationErrors(result: unknown): z.ZodIssue[] {
  if (typeof result !== 'object' || result === null) return [];
  const r = result as { success?: boolean; error?: { issues?: z.ZodIssue[] } };
  return r.success ? [] : r.error?.issues || [];
}
import { createLogger } from "../_shared/logger.ts";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Rate limiting: 30 requests per user per 5 minutes
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetIn: userLimit.resetTime - now };
  }

  userLimit.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - userLimit.count, resetIn: userLimit.resetTime - now };
}

// Input validation schemas
const createUserSchema = z.object({
  email: z.string().email("Invalid email format").max(255, "Email too long"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password too long"),
  fullName: z.string().max(100, "Name too long").optional(),
  role: z.enum(["super_admin", "client_admin", "agent"], { errorMap: () => ({ message: "Invalid role" }) }),
  organizationId: z.string().uuid("Invalid organization ID").optional().nullable(),
});

const updateUserSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  fullName: z.string().max(100, "Name too long").optional(),
  role: z.enum(["super_admin", "client_admin", "agent"]).optional(),
  organizationId: z.string().uuid("Invalid organization ID").optional().nullable(),
});

const toggleActiveSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  isActive: z.boolean(),
});

const resetPasswordSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(128, "Password too long"),
});

const deleteUserSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});

// Helper function to log audit events
async function logAuditEvent(
  supabaseAdmin: SupabaseClient<any, "public", any>,
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  details: Record<string, unknown>,
  req: Request
) {
  try {
    // Sanitize details to remove sensitive info
    const sanitizedDetails = { ...details };
    delete sanitizedDetails.password;
    delete sanitizedDetails.newPassword;
    delete sanitizedDetails.tempPassword;

    await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details: sanitizedDetails,
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null,
      user_agent: req.headers.get("user-agent") || null,
    });
    console.log(`Audit log created: ${action} on ${resourceType}/${resourceId}`);
  } catch (error) {
    console.error("Failed to create audit log:", error);
    // Don't throw - audit log failure shouldn't block the operation
  }
}

// Helper function to send welcome email
async function sendWelcomeEmail(
  supabaseUrl: string,
  serviceKey: string,
  email: string,
  fullName: string,
  tempPassword: string,
  role: string,
  organizationId?: string
) {
  try {
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    
    // Get organization name if provided
    let organizationName: string | undefined;
    if (organizationId) {
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("name")
        .eq("id", organizationId)
        .single();
      organizationName = org?.name;
    }

    // Call the send-welcome-email function
    const response = await fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        email,
        fullName,
        tempPassword,
        organizationName,
        role,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("Failed to send welcome email:", result);
    } else {
      console.log("Welcome email sent successfully");
    }
  } catch (error) {
    console.error("Error sending welcome email:", error);
    // Don't throw - email failure shouldn't block user creation
  }
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  const logger = createLogger(req, 'manage-user');
  const startTime = Date.now();
  
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) {
    await logger.logRequest({ responseStatus: 200, responseTimeMs: Date.now() - startTime });
    return preflightResponse;
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the calling user
    const { data: { user: callingUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !callingUser) {
      console.log("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check rate limit
    const rateLimit = checkRateLimit(callingUser.id);
    if (!rateLimit.allowed) {
      console.log(`Rate limit exceeded for user ${callingUser.id}`);
      return new Response(JSON.stringify({ 
        error: "Too many requests. Please try again later.",
        retryAfter: Math.ceil(rateLimit.resetIn / 1000)
      }), {
        status: 429,
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000))
        },
      });
    }

    // Check caller's roles
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id);

    const isSuperAdmin = callerRoles?.some((r) => r.role === "super_admin");
    const isClientAdmin = callerRoles?.some((r) => r.role === "client_admin");

    if (!isSuperAdmin && !isClientAdmin) {
      return new Response(JSON.stringify({ error: "Only super admins and client admins can manage users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get caller's organization if client admin
    let callerOrgId: string | null = null;
    if (isClientAdmin && !isSuperAdmin) {
      const { data: callerProfile } = await supabaseAdmin
        .from("profiles")
        .select("organization_id")
        .eq("id", callingUser.id)
        .single();
      callerOrgId = callerProfile?.organization_id || null;
    }

    const { action, ...params } = await req.json();
    console.log("Action:", action, "Params:", JSON.stringify(params));

    switch (action) {
      case "create": {
        const validation = createUserSchema.safeParse(params);
        if (!validation.success) {
          const errorMessage = getValidationErrors(validation).map(e => e.message).join(", ");
          return new Response(JSON.stringify({ error: errorMessage }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { email, password, fullName, role, organizationId } = validation.data;

        if ((role === "super_admin" || role === "client_admin") && !isSuperAdmin) {
          return new Response(JSON.stringify({ error: "Only super admins can create admin users" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const targetOrgId = isClientAdmin && !isSuperAdmin ? callerOrgId : organizationId;

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });

        if (createError) {
          console.error("Create user error:", createError);
          return new Response(JSON.stringify({ error: createError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role });

        if (targetOrgId) {
          await supabaseAdmin.from("profiles").update({ organization_id: targetOrgId }).eq("id", newUser.user.id);
        }

        // Log audit event
        await logAuditEvent(
          supabaseAdmin,
          callingUser.id,
          "user_created",
          "user",
          newUser.user.id,
          { email, role, organizationId: targetOrgId, fullName },
          req
        );

        // Send welcome email with login credentials (in background)
        sendWelcomeEmail(
          supabaseUrl,
          supabaseServiceKey,
          email,
          fullName || email,
          password,
          role,
          targetOrgId || undefined
        );

        console.log("User created successfully:", newUser.user.id);
        return new Response(
          JSON.stringify({ success: true, user: { id: newUser.user.id, email: newUser.user.email } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update": {
        const validation = updateUserSchema.safeParse(params);
        if (!validation.success) {
          const errorMessage = getValidationErrors(validation).map(e => e.message).join(", ");
          return new Response(JSON.stringify({ error: errorMessage }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { userId, fullName, role, organizationId } = validation.data;

        // Get original values for audit log
        const { data: originalProfile } = await supabaseAdmin
          .from("profiles")
          .select("full_name, organization_id")
          .eq("id", userId)
          .single();

        const { data: originalRole } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .single();

        // Verify client admin can only update users in their org
        if (isClientAdmin && !isSuperAdmin) {
          if (originalProfile?.organization_id !== callerOrgId) {
            return new Response(JSON.stringify({ error: "Cannot update users outside your organization" }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        // Update profile
        const profileUpdate: Record<string, unknown> = {};
        if (fullName !== undefined) profileUpdate.full_name = fullName;
        if (organizationId !== undefined && isSuperAdmin) profileUpdate.organization_id = organizationId;

        if (Object.keys(profileUpdate).length > 0) {
          const { error: profileError } = await supabaseAdmin
            .from("profiles")
            .update(profileUpdate)
            .eq("id", userId);
          if (profileError) console.error("Profile update error:", profileError);
        }

        // Update role if provided and authorized
        if (role) {
          if ((role === "super_admin" || role === "client_admin") && !isSuperAdmin) {
            return new Response(JSON.stringify({ error: "Only super admins can assign admin roles" }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Remove existing roles and add new one
          await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
          await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
        }

        // Log audit event
        await logAuditEvent(
          supabaseAdmin,
          callingUser.id,
          "user_updated",
          "user",
          userId,
          {
            changes: {
              fullName: fullName !== originalProfile?.full_name ? { from: originalProfile?.full_name, to: fullName } : undefined,
              role: role !== originalRole?.role ? { from: originalRole?.role, to: role } : undefined,
              organizationId: organizationId !== originalProfile?.organization_id ? { from: originalProfile?.organization_id, to: organizationId } : undefined,
            }
          },
          req
        );

        console.log("User updated successfully:", userId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "toggle_active": {
        const validation = toggleActiveSchema.safeParse(params);
        if (!validation.success) {
          const errorMessage = getValidationErrors(validation).map(e => e.message).join(", ");
          return new Response(JSON.stringify({ error: errorMessage }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { userId, isActive } = validation.data;

        // Verify client admin can only manage users in their org
        if (isClientAdmin && !isSuperAdmin) {
          const { data: targetProfile } = await supabaseAdmin
            .from("profiles")
            .select("organization_id")
            .eq("id", userId)
            .single();
          
          if (targetProfile?.organization_id !== callerOrgId) {
            return new Response(JSON.stringify({ error: "Cannot manage users outside your organization" }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        // Prevent self-deactivation
        if (userId === callingUser.id && !isActive) {
          return new Response(JSON.stringify({ error: "Cannot deactivate your own account" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await supabaseAdmin.from("profiles").update({ is_active: isActive }).eq("id", userId);
        
        if (error) {
          console.error("Toggle active error:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Log audit event
        await logAuditEvent(
          supabaseAdmin,
          callingUser.id,
          isActive ? "user_activated" : "user_deactivated",
          "user",
          userId,
          { isActive },
          req
        );

        console.log("User active status updated:", userId, isActive);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reset_password": {
        const validation = resetPasswordSchema.safeParse(params);
        if (!validation.success) {
          const errorMessage = getValidationErrors(validation).map(e => e.message).join(", ");
          return new Response(JSON.stringify({ error: errorMessage }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { userId, newPassword } = validation.data;

        // Verify client admin can only reset passwords for users in their org
        if (isClientAdmin && !isSuperAdmin) {
          const { data: targetProfile } = await supabaseAdmin
            .from("profiles")
            .select("organization_id")
            .eq("id", userId)
            .single();
          
          if (targetProfile?.organization_id !== callerOrgId) {
            return new Response(JSON.stringify({ error: "Cannot reset password for users outside your organization" }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
        
        if (error) {
          console.error("Password reset error:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Log audit event
        await logAuditEvent(
          supabaseAdmin,
          callingUser.id,
          "password_reset_by_admin",
          "user",
          userId,
          { resetBy: callingUser.email },
          req
        );

        console.log("Password reset successfully for user:", userId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        const validation = deleteUserSchema.safeParse(params);
        if (!validation.success) {
          const errorMessage = getValidationErrors(validation).map(e => e.message).join(", ");
          return new Response(JSON.stringify({ error: errorMessage }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { userId } = validation.data;

        // Prevent self-deletion
        if (userId === callingUser.id) {
          return new Response(JSON.stringify({ error: "Cannot delete your own account" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get target user info for validation and audit
        const { data: targetProfile } = await supabaseAdmin
          .from("profiles")
          .select("organization_id, email, full_name")
          .eq("id", userId)
          .single();

        if (!targetProfile) {
          return new Response(JSON.stringify({ error: "User not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Verify client admin can only delete users in their org
        if (isClientAdmin && !isSuperAdmin) {
          if (targetProfile.organization_id !== callerOrgId) {
            return new Response(JSON.stringify({ error: "Cannot delete users outside your organization" }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        // Check if target user is a super_admin - only super_admins can delete super_admins
        const { data: targetRoles } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        const targetIsSuperAdmin = targetRoles?.some((r) => r.role === "super_admin");
        if (targetIsSuperAdmin && !isSuperAdmin) {
          return new Response(JSON.stringify({ error: "Only super admins can delete super admin accounts" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Delete user from auth (this will cascade to profiles via trigger)
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        
        if (error) {
          console.error("Delete user error:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Log audit event
        await logAuditEvent(
          supabaseAdmin,
          callingUser.id,
          "user_deleted",
          "user",
          userId,
          { 
            deletedUserEmail: targetProfile.email,
            deletedUserName: targetProfile.full_name,
            deletedUserOrg: targetProfile.organization_id
          },
          req
        );

        console.log("User deleted successfully:", userId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Error in manage-user function:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});