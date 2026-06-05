import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY');

// Log on startup to verify credentials are configured
console.log(`[send-email] Function initialized. Resend API key configured: ${!!resendApiKey}`);

interface SendEmailRequest {
  to: string;
  subject: string;
  message: string;
  organizationId: string;
  leadId?: string;
  fromName?: string;
}

interface EmailCredentials {
  smtp_host: string;
  smtp_port?: string;
  smtp_username: string;
  smtp_password: string;
  email_address?: string;
}

async function sendViaSmtp(params: {
  credentials: EmailCredentials;
  to: string;
  subject: string;
  message: string;
}): Promise<void> {
  const client = new SmtpClient();
  try {
    await client.connectTLS({
      hostname: params.credentials.smtp_host,
      port: parseInt(params.credentials.smtp_port || '587'),
      username: params.credentials.smtp_username,
      password: params.credentials.smtp_password,
    });

    await client.send({
      from: params.credentials.email_address || params.credentials.smtp_username,
      to: params.to,
      subject: params.subject,
      content: params.message,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="white-space: pre-wrap;">${params.message.replace(/\n/g, '<br>')}</div>
        </div>
      `,
    });
  } finally {
    await client.close();
  }
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    console.log('[send-email] Starting email send process');

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

    const { to, subject, message, organizationId, leadId, fromName }: SendEmailRequest = await req.json();

    console.log(`[send-email] Preparing to send email to ${to} for org ${organizationId}`);

    // Get organization name for sender
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single();

    const senderName = fromName || org?.name || 'Canvas Capital';

    let provider: 'smtp' | 'resend' | null = null;
    let messageId: string | null = null;
    let fromEmail: string | null = null;
    let metadata: Record<string, unknown> = {};

    const { data: emailIntegration } = await supabase
        .from('social_platforms')
        .select('id, credentials')
        .eq('organization_id', organizationId)
        .eq('platform', 'email')
        .eq('is_enabled', true)
        .limit(1)
        .maybeSingle();

      const smtpCredentials = emailIntegration?.credentials as EmailCredentials | null;
      if (smtpCredentials?.smtp_host && smtpCredentials?.smtp_username && smtpCredentials?.smtp_password) {
        await sendViaSmtp({ credentials: smtpCredentials, to, subject, message });
        provider = 'smtp';
        fromEmail = smtpCredentials.email_address || smtpCredentials.smtp_username;
        metadata = {
          smtp_integration_id: emailIntegration?.id,
          from_email: fromEmail,
        };
        console.log('[send-email] Email sent successfully via SMTP:', { to, fromEmail });
      } else {
        if (!resendApiKey) {
          console.error('[send-email] No SMTP integration or RESEND_API_KEY available');
          return new Response(JSON.stringify({
            error: 'Email service is not configured. Configure SMTP or add RESEND_API_KEY.',
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const resend = new Resend(resendApiKey);
        const { data: emailData, error: emailError } = await resend.emails.send({
          from: `${senderName} <onboarding@resend.dev>`,
          to: [to],
          subject,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="white-space: pre-wrap;">${message.replace(/\n/g, '<br>')}</div>
              <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 12px;">Sent via Canvas Capital CRM</p>
            </div>
          `,
        });

        if (emailError) {
          console.error('[send-email] Resend API error:', {
            name: emailError.name,
            message: emailError.message,
          });
          return new Response(JSON.stringify({ error: emailError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        provider = 'resend';
        messageId = emailData?.id ?? null;
        fromEmail = 'onboarding@resend.dev';
        metadata = {
          from_email: fromEmail,
        };
        console.log('[send-email] Email sent successfully via Resend:', { id: messageId, to });
      }

    // Get user name for agent attribution
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();
    
    const agentName = profile?.full_name || profile?.email || 'Agent';

    // Log communication in database - role is 'agent' for human-sent messages
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
        external_id: messageId,
        user_id: user.id,
        metadata: {
          sender_name: agentName,
          sent_by_agent: true,
          provider,
          ...metadata,
        },
      });

    if (logError) {
      console.error('Failed to log communication:', logError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      messageId,
      provider,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error sending email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
