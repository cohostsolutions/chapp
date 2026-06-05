import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createInternalAuthErrorResponse, isAuthorizedInternalRequest } from "../_shared/internal-auth.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface UserWithPreferences {
  id: string;
  email: string;
  full_name: string | null;
  organization_id: string | null;
}

interface Communication {
  id: string;
  channel: string;
  content: string | null;
  subject: string | null;
  created_at: string;
  lead_id: string | null;
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req, 'x-internal-function-secret');
  
  // Handle CORS preflight requests
  const corsResponse = handleCorsPreflightRequest(req, 'x-internal-function-secret');
  if (corsResponse) return corsResponse;

  try {
    if (!isAuthorizedInternalRequest(req)) {
      return createInternalAuthErrorResponse(corsHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting email digest job...");

    // Get all users with email notifications enabled
    const { data: preferences, error: prefError } = await supabase
      .from("notification_preferences")
      .select("user_id")
      .eq("email_notifications_enabled", true);

    if (prefError) {
      console.error("Error fetching preferences:", prefError);
      throw prefError;
    }

    if (!preferences || preferences.length === 0) {
      console.log("No users with email notifications enabled");
      return new Response(
        JSON.stringify({ message: "No users to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = preferences.map((p) => p.user_id);
    console.log(`Found ${userIds.length} users with email notifications enabled`);

    // Get user profiles
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, email, full_name, organization_id")
      .in("id", userIds);

    if (usersError) {
      console.error("Error fetching users:", usersError);
      throw usersError;
    }

    const emailsSent: string[] = [];
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - 24); // Last 24 hours

    for (const user of users as UserWithPreferences[]) {
      if (!user.organization_id) continue;

      // Get unread communications from the last 24 hours
      const { data: communications, error: commError } = await supabase
        .from("communications")
        .select("id, channel, content, subject, created_at, lead_id")
        .eq("organization_id", user.organization_id)
        .eq("direction", "inbound")
        .or("status.is.null,status.eq.unread")
        .gte("created_at", cutoffTime.toISOString())
        .order("created_at", { ascending: false })
        .limit(20);

      if (commError) {
        console.error(`Error fetching communications for user ${user.id}:`, commError);
        continue;
      }

      if (!communications || communications.length === 0) {
        console.log(`No unread communications for user ${user.email}`);
        continue;
      }

      console.log(`Sending digest to ${user.email} with ${communications.length} communications`);

      // Build email content
      const channelLabels: Record<string, string> = {
        sms: "SMS",
        email: "Email",
        call: "Call",
        whatsapp: "WhatsApp",
      };

      const communicationRows = (communications as Communication[])
        .map((c) => {
          const channelLabel = channelLabels[c.channel] || c.channel;
          const preview = c.subject || c.content?.slice(0, 80) || "New message";
          const time = new Date(c.created_at).toLocaleString();
          return `
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #eee;">
                <strong>${channelLabel}</strong>
              </td>
              <td style="padding: 12px; border-bottom: 1px solid #eee;">
                ${preview}${c.content && c.content.length > 80 ? "..." : ""}
              </td>
              <td style="padding: 12px; border-bottom: 1px solid #eee; color: #666;">
                ${time}
              </td>
            </tr>
          `;
        })
        .join("");

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Communication Digest</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #333; margin-bottom: 8px;">Communication Digest</h1>
            <p style="color: #666; margin-bottom: 24px;">
              Hi ${user.full_name || "there"}, you have ${communications.length} unread communication${communications.length > 1 ? "s" : ""} from the last 24 hours.
            </p>
            
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f8f9fa;">
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Channel</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Message</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Time</th>
                </tr>
              </thead>
              <tbody>
                ${communicationRows}
              </tbody>
            </table>
            
            <div style="margin-top: 24px; text-align: center;">
              <a href="https://alcornexus.com/communications" 
                 style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px;">
                View All Communications
              </a>
            </div>
            
            <p style="color: #999; font-size: 12px; margin-top: 24px; text-align: center;">
              You're receiving this email because you have email notifications enabled. 
              <br>You can change this in your notification settings.
            </p>
          </div>
        </body>
        </html>
      `;

      try {
        const { error: emailError } = await resend.emails.send({
          from: "AlCor CRM <onboarding@resend.dev>",
          to: [user.email],
          subject: `📬 You have ${communications.length} unread communication${communications.length > 1 ? "s" : ""}`,
          html: emailHtml,
        });

        if (emailError) {
          console.error(`Error sending email to ${user.email}:`, emailError);
        } else {
          emailsSent.push(user.email);
          console.log(`Email sent successfully to ${user.email}`);
        }
      } catch (emailErr) {
        console.error(`Failed to send email to ${user.email}:`, emailErr);
      }
    }

    console.log(`Email digest job completed. Sent ${emailsSent.length} emails.`);

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent: emailsSent.length,
        recipients: emailsSent,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in send-email-digest function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
