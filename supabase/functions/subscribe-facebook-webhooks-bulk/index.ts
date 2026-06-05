import { serve } from "std/http/server";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { initVault, vaultDecrypt } from "../_shared/vault.ts";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface SubscriptionResult {
  page_id: string;
  page_name: string;
  success: boolean;
  message: string;
  error?: string;
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  const logger = createLogger(req, 'subscribe-facebook-webhooks-bulk');
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
    console.log('[Bulk Subscribe] Vault encryption:', vaultEnabled ? 'enabled' : 'disabled');

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
    const pageIds = body.page_ids as string[] | undefined;

    // Fetch pages to subscribe
    let pagesQuery = supabaseAdmin
      .from('facebook_pages')
      .select('page_id, page_name, access_token')
      .eq('organization_id', organizationId)
      .eq('is_enabled', true);

    // If specific page IDs provided, filter to those
    if (pageIds && Array.isArray(pageIds) && pageIds.length > 0) {
      pagesQuery = pagesQuery.in('page_id', pageIds);
    }

    const { data: pages, error: fetchError } = await pagesQuery;

    if (fetchError || !pages || pages.length === 0) {
      return new Response(JSON.stringify({ 
        error: "No pages found to subscribe",
        details: fetchError?.message || "No enabled facebook pages found",
        organization_id: organizationId
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Bulk Subscribe] Found ${pages.length} page(s) to subscribe`);

    const results: SubscriptionResult[] = [];

    // Subscribe each page
    for (const page of pages) {
      const pageId = page.page_id as string;
      const pageName = page.page_name as string;
      let pageToken = page.access_token as string;

      try {
        // Decrypt token if encrypted
        if (pageToken && vaultEnabled) {
          try {
            pageToken = await vaultDecrypt(supabaseAdmin, pageToken);
          } catch (decryptErr) {
            console.error(`[Bulk Subscribe] Token decryption failed for ${pageName}:`, decryptErr);
            results.push({
              page_id: pageId,
              page_name: pageName,
              success: false,
              message: "Token decryption failed",
              error: String(decryptErr)
            });
            continue;
          }
        }

        if (!pageToken) {
          results.push({
            page_id: pageId,
            page_name: pageName,
            success: false,
            message: "No access token available"
          });
          continue;
        }

        // Subscribe app to the page
        console.log(`[Bulk Subscribe] Subscribing app to ${pageName} (${pageId})`);
        const subscribeRes = await fetch(`https://graph.facebook.com/v18.0/${pageId}/subscribed_apps?access_token=${encodeURIComponent(pageToken)}`, {
          method: 'POST',
        });

        const subscribeJson = await subscribeRes.json();

        if (!subscribeRes.ok) {
          console.error(`[Bulk Subscribe] Subscription failed for ${pageName}:`, subscribeJson);
          results.push({
            page_id: pageId,
            page_name: pageName,
            success: false,
            message: "Failed to subscribe to webhook",
            error: JSON.stringify(subscribeJson)
          });
        } else {
          console.log(`[Bulk Subscribe] Successfully subscribed ${pageName} to webhook`);
          results.push({
            page_id: pageId,
            page_name: pageName,
            success: true,
            message: `Successfully subscribed ${pageName} to webhook`
          });
        }
      } catch (err) {
        console.error(`[Bulk Subscribe] Error processing ${pageName}:`, err);
        results.push({
          page_id: pageId,
          page_name: pageName,
          success: false,
          message: "Unexpected error",
          error: String(err)
        });
      }
    }

    // Count results
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`[Bulk Subscribe] Complete - ${successful} successful, ${failed} failed`);

    return new Response(JSON.stringify({
      success: failed === 0,
      total: results.length,
      successful,
      failed,
      results
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('[Bulk Subscribe] Error', error);
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
