import { serve } from "std/http/server";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { initVault, vaultDecrypt } from "../_shared/vault.ts";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  const logger = createLogger(req, 'subscribe-facebook-webhook');
  const startTime = Date.now();
  
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) {
    await logger.logRequest({ responseStatus: 200, responseTimeMs: Date.now() - startTime });
    return preflightResponse;
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize vault encryption
    const vaultEnabled = await initVault(supabaseAdmin);
    console.log('[Subscribe Facebook Webhook] Vault encryption:', vaultEnabled ? 'enabled' : 'disabled');

    // Get calling user
    const { data: { user: callingUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !callingUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Basic role check: allow client admins and super admins
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id);

    const isSuperAdmin = callerRoles?.some((r) => r.role === "super_admin");
    const isClientAdmin = callerRoles?.some((r) => r.role === "client_admin");

    if (!isSuperAdmin && !isClientAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get caller's organization id from profiles
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("id", callingUser.id)
      .single();

    const organizationId = callerProfile?.organization_id;
    if (!organizationId) {
      return new Response(JSON.stringify({ error: "User has no organization" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const pageId = body.page_id;

    if (!pageId) {
      return new Response(JSON.stringify({ error: "Missing page_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the page record
    const { data: pageRec, error: fetchError } = await supabaseAdmin
      .from('facebook_pages')
      .select('page_id, page_name, access_token')
      .eq('organization_id', organizationId)
      .eq('page_id', pageId)
      .single();

    if (fetchError || !pageRec) {
      return new Response(JSON.stringify({ error: "Page not found", details: fetchError }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decrypt the token
    let pageToken = pageRec.access_token;
    if (pageToken && vaultEnabled) {
      try {
        pageToken = await vaultDecrypt(supabaseAdmin, pageToken);
      } catch (decryptErr) {
        console.error('[Subscribe Facebook Webhook] Token decryption failed:', decryptErr);
        return new Response(JSON.stringify({ error: "Failed to decrypt access token" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!pageToken) {
      return new Response(JSON.stringify({ error: "No access token available for page" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Subscribe app to the page to receive messaging events
    console.log(`[Subscribe Facebook Webhook] Subscribing app to page ${pageId} (${pageRec.page_name})`);
    const subscribeRes = await fetch(`https://graph.facebook.com/v18.0/${pageId}/subscribed_apps?access_token=${encodeURIComponent(pageToken)}`, {
      method: 'POST',
    });

    const subscribeJson = await subscribeRes.json();

    if (!subscribeRes.ok) {
      console.error('[Subscribe Facebook Webhook] Subscription failed:', subscribeJson);
      return new Response(JSON.stringify({
        error: "Failed to subscribe to webhook",
        details: subscribeJson,
        status: subscribeRes.status
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log('[Subscribe Facebook Webhook] Successfully subscribed page to webhook:', subscribeJson);

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully subscribed ${pageRec.page_name} to webhook`,
      page_id: pageId,
      page_name: pageRec.page_name
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('[Subscribe Facebook Webhook] Error', error);
    await logger.logRequest({
      responseStatus: 500,
      errorMessage: String(error),
      responseTimeMs: Date.now() - startTime
    });
    return new Response(JSON.stringify({ error: 'Server error', details: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
