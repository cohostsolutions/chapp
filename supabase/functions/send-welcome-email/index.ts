import { serve } from "std/http/server";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface WelcomeEmailRequest {
  email: string;
  fullName: string;
  tempPassword: string;
  organizationName?: string;
  role: string;
  loginUrl?: string;
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const { email, fullName, tempPassword, organizationName, role, loginUrl }: WelcomeEmailRequest = await req.json();

    console.log("Sending welcome email to:", email);

    const roleName = role === 'super_admin' ? 'Super Admin' 
                   : role === 'client_admin' ? 'Client Admin' 
                   : 'Agent';

    const appUrl = loginUrl || Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovable.app') || 'https://your-app.lovable.app';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to AlCor Nexus</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td>
        <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #18181b; font-size: 24px; font-weight: bold; margin: 0;">
              Welcome to AlCor Nexus
            </h1>
          </div>
          
          <!-- Greeting -->
          <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            Hi ${fullName || 'there'},
          </p>
          
          <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            Your account has been created${organizationName ? ` for <strong>${organizationName}</strong>` : ''}. 
            You've been assigned the role of <strong>${roleName}</strong>.
          </p>
          
          <!-- Login Credentials Box -->
          <div style="background-color: #f4f4f5; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
            <h2 style="color: #18181b; font-size: 16px; font-weight: 600; margin: 0 0 16px 0;">
              Your Login Credentials
            </h2>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding: 8px 0;">
                  <span style="color: #71717a; font-size: 14px;">Email:</span>
                </td>
                <td style="padding: 8px 0;">
                  <strong style="color: #18181b; font-size: 14px;">${email}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">
                  <span style="color: #71717a; font-size: 14px;">Temporary Password:</span>
                </td>
                <td style="padding: 8px 0;">
                  <code style="background-color: #e4e4e7; padding: 4px 8px; border-radius: 4px; color: #18181b; font-size: 14px; font-family: monospace;">${tempPassword}</code>
                </td>
              </tr>
            </table>
          </div>
          
          <!-- Warning -->
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
            <p style="color: #92400e; font-size: 14px; margin: 0;">
              <strong>Important:</strong> Please change your password immediately after your first login for security purposes.
            </p>
          </div>
          
          <!-- CTA Button -->
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${appUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Log In to Your Account
            </a>
          </div>
          
          <!-- Footer -->
          <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;" />
          
          <p style="color: #71717a; font-size: 14px; line-height: 1.5; text-align: center; margin: 0;">
            If you have any questions, please contact your administrator.
          </p>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const { data, error } = await resend.emails.send({
      from: "AlCor Nexus <onboarding@resend.dev>",
      to: [email],
      subject: "Welcome to AlCor Nexus - Your Account Details",
      html: htmlContent,
    });

    if (error) {
      console.error("Resend error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Welcome email sent successfully:", data);
    return new Response(
      JSON.stringify({ success: true, messageId: data?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending welcome email:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
