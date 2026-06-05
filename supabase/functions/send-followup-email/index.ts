import { serve } from "std/http/server";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createLogger } from "../_shared/logger.ts";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createInternalAuthErrorResponse, isAuthorizedInternalRequest } from "../_shared/internal-auth.ts";

serve(async (req) => {
  const logger = createLogger(req, 'send-followup-email');
  const startTime = Date.now();
  const corsHeaders = createCorsHeaders(req, 'x-internal-function-secret');
  
  const corsResponse = handleCorsPreflightRequest(req, 'x-internal-function-secret');
  if (corsResponse) {
    await logger.logRequest({ responseStatus: 200, responseTimeMs: Date.now() - startTime });
    return corsResponse;
  }

  try {
    if (!isAuthorizedInternalRequest(req)) {
      await logger.logRequest({ responseStatus: 401, responseTimeMs: Date.now() - startTime });
      return createInternalAuthErrorResponse(corsHeaders);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(resendApiKey);

    // Find leads who skipped booking more than 48 hours ago and haven't received a follow-up
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    const { data: skippedLeads, error: fetchError } = await supabase
      .from('demo_requests')
      .select('*')
      .eq('status', 'skipped')
      .lte('updated_at', fortyEightHoursAgo)
      .is('message', null) // Using message field to track if follow-up was sent (will update with marker)
      .or(`message.not.ilike.%[FOLLOWUP_SENT]%`);

    if (fetchError) {
      console.error('Error fetching skipped leads:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch leads' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Also check leads that have messages but haven't been followed up
    const { data: skippedLeadsWithMessages, error: fetchError2 } = await supabase
      .from('demo_requests')
      .select('*')
      .eq('status', 'skipped')
      .lte('updated_at', fortyEightHoursAgo)
      .not('message', 'is', null)
      .not('message', 'ilike', '%[FOLLOWUP_SENT]%');

    if (fetchError2) {
      console.error('Error fetching skipped leads with messages:', fetchError2);
    }

    const allSkippedLeads = [...(skippedLeads || []), ...(skippedLeadsWithMessages || [])];
    
    console.log(`Found ${allSkippedLeads.length} leads to send follow-up emails`);

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const lead of allSkippedLeads) {
      try {
        const businessTypeLabels: Record<string, string> = {
          sales: 'Sales & Lead Generation (Jay AI)',
          food: 'Food & Restaurant (May AI)',
          hospitality: 'Hotels & Hospitality (Cece AI)',
          other: 'Custom AI Agent',
        };

        const firstName = lead.name.split(' ')[0];

        await resend.emails.send({
          from: 'AlCor Nexus <onboarding@resend.dev>',
          to: [lead.email],
          subject: `Still interested in AI for your business, ${firstName}?`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="color: #0d9488; font-size: 28px; margin: 0;">AlCor Nexus</h1>
                <p style="color: #64748b; font-size: 14px; margin-top: 8px;">AI-Powered Business Solutions</p>
              </div>
              
              <div style="background: linear-gradient(135deg, #f0fdfa 0%, #f8fafc 100%); border-radius: 12px; padding: 32px; margin-bottom: 24px;">
                <h2 style="color: #1e293b; font-size: 22px; margin: 0 0 16px 0;">Hi ${firstName},</h2>
                <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                  We noticed you expressed interest in <strong>${businessTypeLabels[lead.business_type] || lead.business_type}</strong> but didn't get a chance to schedule a demo call.
                </p>
                <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0;">
                  No worries! We understand things get busy. Our team is still here to help you discover how AI can transform your business operations.
                </p>
              </div>
              
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="https://alcornexus.com" style="display: inline-block; background: linear-gradient(135deg, #0d9488, #0891b2); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Schedule Your Demo Now
                </a>
              </div>
              
              <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <h3 style="color: #1e293b; font-size: 16px; margin: 0 0 12px 0;">Why schedule a demo?</h3>
                <ul style="color: #475569; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>See our AI agents handle real conversations</li>
                  <li>Get a personalized solution for your specific needs</li>
                  <li>Ask questions and get expert guidance</li>
                  <li>No commitment, just a friendly conversation</li>
                </ul>
              </div>
              
              <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="color: #92400e; font-size: 14px; margin: 0; text-align: center;">
                  <strong>Limited Time:</strong> Book this week and get a free consultation on AI implementation strategy!
                </p>
              </div>
              
              <div style="text-align: center; padding: 24px 0; border-top: 1px solid #e2e8f0;">
                <p style="color: #64748b; font-size: 14px; margin: 0 0 8px 0;">
                  Questions? Simply reply to this email—we'd love to hear from you!
                </p>
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                  © ${new Date().getFullYear()} AlCor Nexus. All rights reserved.
                </p>
              </div>
            </div>
          `,
        });

        // Mark as follow-up sent by updating the message field
        const existingMessage = lead.message || '';
        await supabase
          .from('demo_requests')
          .update({
            message: existingMessage + '\n[FOLLOWUP_SENT:' + new Date().toISOString() + ']',
          })
          .eq('id', lead.id);

        console.log(`Follow-up email sent to: ${lead.email}`);
        results.sent++;
      } catch (emailError: unknown) {
        const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
        console.error(`Failed to send follow-up to ${lead.email}:`, emailError);
        results.failed++;
        results.errors.push(`${lead.email}: ${errorMessage}`);
      }
    }

    console.log(`Follow-up emails completed: ${results.sent} sent, ${results.failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${results.sent} follow-up emails`,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error in send-followup-email function:', error);
    await logger.logRequest({ responseStatus: 500, responseTimeMs: Date.now() - startTime });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
