import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface SendEmailRequest {
  to: string;
  subject: string;
  message: string;
  organizationId: string;
  leadId?: string;
  emailIntegrationId?: string; // ID of the email integration to use
}

interface EmailCredentials {
  smtp_host: string;
  smtp_port?: string;
  smtp_username: string;
  smtp_password: string;
  email_address?: string;
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { to, subject, message, organizationId, leadId, emailIntegrationId }: SendEmailRequest = await req.json();

    console.log(`[send-email-smtp] Preparing to send email to ${to} for org ${organizationId}`);

    // Get email integration credentials
    let emailIntegration;
    if (emailIntegrationId) {
      const { data } = await supabase
        .from('social_platforms')
        .select('*')
        .eq('id', emailIntegrationId)
        .eq('platform', 'email')
        .eq('is_enabled', true)
        .single();
      emailIntegration = data;
    } else {
      // Get the first enabled email integration for this organization
      const { data } = await supabase
        .from('social_platforms')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('platform', 'email')
        .eq('is_enabled', true)
        .limit(1)
        .single();
      emailIntegration = data;
    }

    if (!emailIntegration || !emailIntegration.credentials) {
      return new Response(JSON.stringify({ 
        error: 'No email integration configured. Please configure email settings in the Integrations tab.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const credentials = emailIntegration.credentials as EmailCredentials;
    const smtpHost = credentials.smtp_host;
    const smtpPort = parseInt(credentials.smtp_port || '587');
    const smtpUsername = credentials.smtp_username;
    const smtpPassword = credentials.smtp_password;
    const fromEmail = credentials.email_address || smtpUsername;

    if (!smtpHost || !smtpUsername || !smtpPassword) {
      return new Response(JSON.stringify({ 
        error: 'Email integration is incomplete. Please check SMTP settings.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send email via SMTP
    const client = new SmtpClient();

    try {
      await client.connectTLS({
        hostname: smtpHost,
        port: smtpPort,
        username: smtpUsername,
        password: smtpPassword,
      });

      await client.send({
        from: fromEmail,
        to: to,
        subject: subject,
        content: message,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="white-space: pre-wrap;">${message.replace(/\n/g, '<br>')}</div>
          </div>
        `,
      });

      await client.close();

      console.log('[send-email-smtp] Email sent successfully via SMTP');

      // Get user name for agent attribution
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single();
      
      const agentName = profile?.full_name || profile?.email || 'Agent';

      // Log communication in database
      const { error: logError } = await supabase
        .from('communications')
        .insert({
          organization_id: organizationId,
          lead_id: leadId || null,
          channel: 'email',
          direction: 'outbound',
          role: 'agent',
          subject: subject,
          content: message,
          status: 'sent',
          user_id: user.id,
          metadata: { 
            sender_name: agentName, 
            sent_by_agent: true,
            smtp_integration_id: emailIntegration.id,
            from_email: fromEmail
          },
        });

      if (logError) {
        console.error('[send-email-smtp] Failed to log communication:', logError);
      }

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Email sent successfully'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (smtpError) {
      console.error('[send-email-smtp] SMTP error:', smtpError);
      await client.close();
      
      return new Response(JSON.stringify({ 
        error: 'Failed to send email via SMTP: ' + (smtpError instanceof Error ? smtpError.message : 'Unknown error')
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('[send-email-smtp] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
