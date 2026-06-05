import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const corsHeaders = createCorsHeaders(req);
  
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, platformId, organizationId } = await req.json();

    if (action === 'get-health') {
      // Get webhook health for a specific platform or all platforms in an org
      let query = supabaseClient
        .from('webhook_health')
        .select('*, social_platforms(display_name, platform, is_enabled)');

      if (platformId) {
        query = query.eq('platform_id', platformId);
      } else if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching webhook health:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Calculate status based on last webhook time
      const now = new Date();
      const healthWithStatus = (data || []).map(record => {
        const lastWebhook = record.last_webhook_at ? new Date(record.last_webhook_at) : null;
        const hoursSinceLastWebhook = lastWebhook 
          ? (now.getTime() - lastWebhook.getTime()) / (1000 * 60 * 60)
          : null;

        let calculatedStatus = 'unknown';
        if (!lastWebhook) {
          calculatedStatus = 'no_data';
        } else if (hoursSinceLastWebhook! > 24) {
          calculatedStatus = 'inactive';
        } else if (hoursSinceLastWebhook! > 6) {
          calculatedStatus = 'warning';
        } else if (record.errors_24h > 10) {
          calculatedStatus = 'degraded';
        } else {
          calculatedStatus = 'healthy';
        }

        return {
          ...record,
          calculated_status: calculatedStatus,
          hours_since_last_webhook: hoursSinceLastWebhook,
        };
      });

      return new Response(JSON.stringify({ health: healthWithStatus }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'test-webhook') {
      // Send a test ping to verify webhook is configured correctly
      if (!platformId) {
        return new Response(JSON.stringify({ error: 'platformId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get the platform details
      const { data: platform, error: platformError } = await supabaseClient
        .from('social_platforms')
        .select('*, organizations(name)')
        .eq('id', platformId)
        .maybeSingle();

      if (platformError || !platform) {
        return new Response(JSON.stringify({ error: 'Platform not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if webhook health record exists
      const { data: healthRecord } = await supabaseClient
        .from('webhook_health')
        .select('*')
        .eq('platform_id', platformId)
        .maybeSingle();

      const now = new Date();
      const testResult = {
        platform_configured: true,
        has_webhook_record: !!healthRecord,
        last_webhook_received: healthRecord?.last_webhook_at || null,
        webhooks_24h: healthRecord?.webhooks_received_24h || 0,
        messages_24h: healthRecord?.messages_processed_24h || 0,
        errors_24h: healthRecord?.errors_24h || 0,
        last_error: healthRecord?.last_error || null,
        status: 'unknown',
        recommendation: '',
      };

      // Determine status and recommendation
      if (!healthRecord) {
        testResult.status = 'no_data';
        testResult.recommendation = 'No webhook activity recorded yet. Ensure Meta webhook is configured with the correct URL and verify token.';
      } else if (!healthRecord.last_webhook_at) {
        testResult.status = 'waiting';
        testResult.recommendation = 'Webhook record exists but no messages received yet. Send a test message from Facebook/Instagram/WhatsApp.';
      } else {
        const hoursSince = (now.getTime() - new Date(healthRecord.last_webhook_at).getTime()) / (1000 * 60 * 60);
        
        if (hoursSince > 24) {
          testResult.status = 'inactive';
          testResult.recommendation = 'No webhook activity in 24+ hours. Check Meta webhook configuration and subscription status.';
        } else if (hoursSince > 6) {
          testResult.status = 'warning';
          testResult.recommendation = 'Low webhook activity. This may be normal if no messages were sent recently.';
        } else if (healthRecord.errors_24h > 10) {
          testResult.status = 'degraded';
          testResult.recommendation = `High error rate (${healthRecord.errors_24h} errors in 24h). Check the last error: ${healthRecord.last_error}`;
        } else {
          testResult.status = 'healthy';
          testResult.recommendation = 'Webhook is receiving messages normally.';
        }
      }

      return new Response(JSON.stringify(testResult), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'record-activity') {
      // Internal action to record webhook activity (called by social-webhook)
      const { platform_id, organization_id, platform, is_message, is_error, error_message } = await req.json();

      if (!platform_id) {
        return new Response(JSON.stringify({ error: 'platform_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const now = new Date().toISOString();

      // Upsert webhook health record
      const { error: upsertError } = await supabaseClient
        .from('webhook_health')
        .upsert({
          platform_id,
          organization_id,
          platform,
          last_webhook_at: now,
          last_message_at: is_message ? now : undefined,
          last_error: is_error ? error_message : undefined,
          last_error_at: is_error ? now : undefined,
          status: is_error ? 'error' : 'healthy',
          updated_at: now,
        }, {
          onConflict: 'platform_id',
        });

      if (upsertError) {
        console.error('Error upserting webhook health:', upsertError);
      }

      // Increment the appropriate counter directly
      try {
        const { data: currentHealth } = await supabaseClient
          .from('webhook_health')
          .select('webhooks_received_24h, messages_processed_24h, errors_24h')
          .eq('platform_id', platform_id)
          .maybeSingle();

        if (currentHealth) {
          const updates: Record<string, number> = {};
          if (is_error) {
            updates.errors_24h = (currentHealth.errors_24h || 0) + 1;
          } else if (is_message) {
            updates.messages_processed_24h = (currentHealth.messages_processed_24h || 0) + 1;
          } else {
            updates.webhooks_received_24h = (currentHealth.webhooks_received_24h || 0) + 1;
          }

          await supabaseClient
            .from('webhook_health')
            .update(updates)
            .eq('platform_id', platform_id);
        }
      } catch (err) {
        console.error('Error incrementing counter:', err);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'reset-counters') {
      // Reset 24h counters (should be called by a daily cron)
      const { error } = await supabaseClient
        .from('webhook_health')
        .update({
          webhooks_received_24h: 0,
          messages_processed_24h: 0,
          errors_24h: 0,
        })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all

      if (error) {
        console.error('Error resetting counters:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, message: 'Counters reset' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in webhook-health-check:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
