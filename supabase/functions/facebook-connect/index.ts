import { serve } from "std/http/server";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { initVault, vaultEncrypt, vaultDecrypt } from "../_shared/vault.ts";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

type PersistenceResult = {
  success: boolean;
  warning?: string;
  error?: unknown;
};

type SocialIntegrationEventStatus = 'info' | 'success' | 'warning' | 'error';
type SocialIntegrationSyncStatus = 'success' | 'partial' | 'incomplete' | 'error';

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  const logger = createLogger(req, 'facebook-connect');
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
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize vault encryption
    const vaultEnabled = await initVault(supabaseAdmin);
    console.log('[Facebook Connect] Vault encryption:', vaultEnabled ? 'enabled' : 'disabled');

    const authHeader = req.headers.get("Authorization") || "";
    const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    if (!accessToken) {
      console.error('[Facebook Connect] Missing bearer token');
      return new Response(JSON.stringify({ error: "Unauthorized", details: "Missing bearer token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get calling user from the bearer token using the user-scoped client.
    const { data: { user: callingUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !callingUser) {
      console.error('[Facebook Connect] Auth error', userError);
      return new Response(JSON.stringify({
        error: "Unauthorized",
        details: userError?.message || 'Bearer token could not be resolved to a user',
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Basic role check: allow client admins and super admins to create connections
    const { data: callerRoles, error: callerRolesError } = await supabaseUser
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id);

    if (callerRolesError) {
      console.error('[Facebook Connect] Role lookup error', callerRolesError);
      return new Response(JSON.stringify({
        error: "Forbidden",
        details: callerRolesError.message || 'Unable to read user roles during Meta connect',
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSuperAdmin = callerRoles?.some((r) => r.role === "super_admin");
    const isClientAdmin = callerRoles?.some((r) => r.role === "client_admin");

    if (!isSuperAdmin && !isClientAdmin) {
      return new Response(JSON.stringify({
        error: "Forbidden",
        details: 'Meta connect requires a client_admin or super_admin role.',
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile, error: callerProfileError } = await supabaseUser
      .from("profiles")
      .select("organization_id")
      .eq("id", callingUser.id)
      .single();

    if (callerProfileError) {
      console.error('[Facebook Connect] Profile lookup error', callerProfileError);
      return new Response(JSON.stringify({
        error: "Forbidden",
        details: callerProfileError.message || 'Unable to load user organization context during Meta connect',
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerOrganizationId = callerProfile?.organization_id ?? null;

    const resolveOrganizationId = (requestedOrganizationId?: string | null) => {
      if (requestedOrganizationId) {
        if (!isSuperAdmin && requestedOrganizationId !== callerOrganizationId) {
          return {
            error: new Response(JSON.stringify({
              error: "Forbidden organization scope",
              details: `Requested organization ${requestedOrganizationId} does not match the caller organization context.`,
            }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }),
          };
        }

        return { organizationId: requestedOrganizationId };
      }

      if (callerOrganizationId) {
        return { organizationId: callerOrganizationId };
      }

      return {
        error: new Response(JSON.stringify({ error: "User has no organization context" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }),
      };
    };

    const isMissingConstraintError = (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error || "");
      return message.includes("no unique or exclusion constraint matching the ON CONFLICT specification") || message.includes("42P10");
    };

    const isLegacyPlatformUniqueError = (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error || "");
      return message.includes("social_platforms_organization_id_platform_key") || message.includes("duplicate key value violates unique constraint");
    };

    const persistFacebookPage = async (
      organizationId: string,
      pageId: string,
      pageName: string | null,
      encryptedToken: string,
      expiresAt: string,
    ): Promise<PersistenceResult> => {
      const row = {
        organization_id: organizationId,
        page_id: pageId,
        page_name: pageName,
        access_token: encryptedToken,
        token_expires_at: expiresAt,
        connected_by: callingUser.id,
      };

      const upsertResult = await supabaseAdmin
        .from("facebook_pages")
        .upsert(row, { onConflict: "organization_id,page_id" });

      if (!upsertResult.error) {
        return { success: true };
      }

      if (!isMissingConstraintError(upsertResult.error)) {
        return { success: false, error: upsertResult.error };
      }

      const existingPage = await supabaseAdmin
        .from("facebook_pages")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("page_id", pageId)
        .maybeSingle();

      const fallbackMutation = existingPage.data?.id
        ? await supabaseAdmin
            .from("facebook_pages")
            .update({
              page_name: pageName,
              access_token: encryptedToken,
              token_expires_at: expiresAt,
              connected_by: callingUser.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingPage.data.id)
        : await supabaseAdmin.from("facebook_pages").insert(row);

      if (fallbackMutation.error) {
        return { success: false, error: fallbackMutation.error };
      }

      return {
        success: true,
        warning: "Facebook pages were saved using legacy schema compatibility mode. Apply the latest database migration for full Meta import support.",
      };
    };

    const persistSocialPlatform = async (
      organizationId: string,
      platform: "instagram" | "whatsapp",
      displayName: string,
      credentials: Record<string, unknown>,
    ): Promise<PersistenceResult> => {
      const row = {
        organization_id: organizationId,
        platform,
        display_name: displayName,
        is_enabled: false,
        credentials,
      };

      const upsertResult = await supabaseAdmin
        .from("social_platforms")
        .upsert(row, { onConflict: "organization_id,platform,display_name" });

      if (!upsertResult.error) {
        return { success: true };
      }

      if (!isMissingConstraintError(upsertResult.error) && !isLegacyPlatformUniqueError(upsertResult.error)) {
        return { success: false, error: upsertResult.error };
      }

      const existingPlatform = await supabaseAdmin
        .from("social_platforms")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("platform", platform)
        .maybeSingle();

      const fallbackMutation = existingPlatform.data?.id
        ? await supabaseAdmin
            .from("social_platforms")
            .update({
              display_name: displayName,
              is_enabled: false,
              credentials,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingPlatform.data.id)
        : await supabaseAdmin.from("social_platforms").insert(row);

      if (fallbackMutation.error) {
        return { success: false, error: fallbackMutation.error };
      }

      return {
        success: true,
        warning: `Stored ${platform} using legacy schema compatibility mode. Apply the latest database migration to keep multiple imported Meta assets per organization.`,
      };
    };

    const logSocialIntegrationEvent = async (
      organizationId: string,
      eventType: string,
      options?: {
        assetType?: string | null;
        assetId?: string | null;
        assetName?: string | null;
        status?: SocialIntegrationEventStatus;
        details?: Record<string, unknown>;
      },
    ) => {
      try {
        await supabaseAdmin.from('social_integration_events').insert({
          organization_id: organizationId,
          actor_user_id: callingUser.id,
          provider: 'meta',
          event_type: eventType,
          asset_type: options?.assetType ?? null,
          asset_id: options?.assetId ?? null,
          asset_name: options?.assetName ?? null,
          status: options?.status ?? 'success',
          details: options?.details ?? {},
        });
      } catch (eventError) {
        console.warn('[Facebook Connect] Failed to persist social integration event', eventError);
      }
    };

    const logSocialIntegrationSyncRun = async (
      organizationId: string,
      action: string,
      status: SocialIntegrationSyncStatus,
      options?: {
        pagesCount?: number;
        instagramCount?: number;
        whatsappCount?: number;
        warnings?: string[];
        failures?: string[];
        message?: string | null;
        metadata?: Record<string, unknown>;
      },
    ) => {
      try {
        await supabaseAdmin.from('social_integration_sync_runs').insert({
          organization_id: organizationId,
          provider: 'meta',
          initiated_by: callingUser.id,
          action,
          status,
          pages_count: options?.pagesCount ?? 0,
          instagram_count: options?.instagramCount ?? 0,
          whatsapp_count: options?.whatsappCount ?? 0,
          warnings: options?.warnings ?? [],
          failures: options?.failures ?? [],
          message: options?.message ?? null,
          metadata: options?.metadata ?? {},
        });
      } catch (syncError) {
        console.warn('[Facebook Connect] Failed to persist social integration sync run', syncError);
      }
    };

    const syncMetaAssets = async (organizationId: string, userAccessToken: string, syncAction: string) => {
      const pagesRes = await fetch(`https://graph.facebook.com/v17.0/me/accounts?access_token=${encodeURIComponent(userAccessToken)}`);
      const pagesJson = await pagesRes.json();
      if (!pagesRes.ok || !pagesJson.data) {
        console.error('[Facebook Connect] Pages fetch error', pagesJson);
        await logSocialIntegrationSyncRun(organizationId, syncAction, 'error', {
          failures: ['Failed to fetch Facebook pages from Meta.'],
          message: 'Meta authorization completed, but the app could not fetch available Facebook pages.',
          metadata: { graphError: pagesJson },
        });
        return {
          response: new Response(JSON.stringify({ error: 'Failed to fetch pages', details: pagesJson }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }),
        };
      }

      const pages = pagesJson.data as Array<any>;
      let storedPagesCount = 0;
      let instagramAccountsCount = 0;
      let whatsappAccountsCount = 0;
      const warnings = new Set<string>();
      const failures: string[] = [];

      const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

      for (const p of pages) {
        try {
          const pageId = String(p.id);
          const pageName = p.name || null;
          const pageAccessToken = p.access_token;

          if (!pageAccessToken) {
            failures.push(`Facebook page ${pageName || pageId} did not return a page access token.`);
            continue;
          }

          const encryptedToken = vaultEnabled
            ? await vaultEncrypt(supabaseAdmin, pageAccessToken)
            : pageAccessToken;

          const pagePersistResult = await persistFacebookPage(organizationId, pageId, pageName, encryptedToken, tokenExpiresAt);
          if (!pagePersistResult.success) {
            console.error('[Facebook Connect] Failed to persist page', pageId, pagePersistResult.error);
            failures.push(`Failed to save Facebook page ${pageName || pageId}.`);
            continue;
          }

          storedPagesCount++;
          if (pagePersistResult.warning) {
            warnings.add(pagePersistResult.warning);
          }

          try {
            const igRes = await fetch(
              `https://graph.facebook.com/v17.0/${pageId}?fields=instagram_business_account{id,name,username}&access_token=${encodeURIComponent(pageAccessToken)}`
            );
            const igJson = await igRes.json();

            if (igJson.instagram_business_account) {
              const igAccount = igJson.instagram_business_account;
              const igEncryptedToken = vaultEnabled
                ? await vaultEncrypt(supabaseAdmin, pageAccessToken)
                : pageAccessToken;

              const igPersistResult = await persistSocialPlatform(
                organizationId,
                'instagram',
                igAccount.username || igAccount.name || `Instagram ${igAccount.id}`,
                {
                  instagram_account_id: igAccount.id,
                  instagram_username: igAccount.username,
                  page_id: pageId,
                  page_name: pageName,
                  access_token: igEncryptedToken,
                  token_expires_at: tokenExpiresAt,
                  connected_at: new Date().toISOString(),
                },
              );

              if (igPersistResult.success) {
                instagramAccountsCount++;
                if (igPersistResult.warning) {
                  warnings.add(igPersistResult.warning);
                }
                console.log(`[Facebook Connect] Linked Instagram account: ${igAccount.username || igAccount.id}`);
              } else {
                console.error('[Facebook Connect] Failed to persist Instagram account', igPersistResult.error);
                failures.push(`Failed to save Instagram account ${igAccount.username || igAccount.id}.`);
              }
            }
          } catch (igErr) {
            console.warn('[Facebook Connect] Failed to fetch Instagram account for page', pageId, igErr);
          }
        } catch (err) {
          console.error('[Facebook Connect] Failed to process page', err);
          failures.push('Failed to process one of the imported Facebook pages.');
        }
      }

      try {
        const wabaRes = await fetch(
          `https://graph.facebook.com/v17.0/me/businesses?fields=id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}&access_token=${encodeURIComponent(userAccessToken)}`
        );
        const wabaJson = await wabaRes.json();

        if (wabaJson.data) {
          for (const business of wabaJson.data) {
            const wabas = business.owned_whatsapp_business_accounts?.data || [];
            for (const waba of wabas) {
              const phoneNumbers = waba.phone_numbers?.data || [];
              for (const phone of phoneNumbers) {
                const waEncryptedToken = vaultEnabled
                  ? await vaultEncrypt(supabaseAdmin, userAccessToken)
                  : userAccessToken;

                const waPersistResult = await persistSocialPlatform(
                  organizationId,
                  'whatsapp',
                  phone.verified_name || phone.display_phone_number || `WhatsApp ${phone.id}`,
                  {
                    phone_number_id: phone.id,
                    display_phone_number: phone.display_phone_number,
                    verified_name: phone.verified_name,
                    business_account_id: waba.id,
                    business_name: business.name,
                    waba_name: waba.name,
                    access_token: waEncryptedToken,
                    token_expires_at: tokenExpiresAt,
                    connected_at: new Date().toISOString(),
                  },
                );

                if (waPersistResult.success) {
                  whatsappAccountsCount++;
                  if (waPersistResult.warning) {
                    warnings.add(waPersistResult.warning);
                  }
                  console.log(`[Facebook Connect] Linked WhatsApp number: ${phone.display_phone_number}`);
                } else {
                  console.error('[Facebook Connect] Failed to persist WhatsApp number', waPersistResult.error);
                  failures.push(`Failed to save WhatsApp number ${phone.display_phone_number || phone.id}.`);
                }
              }
            }
          }
        }
      } catch (waErr) {
        console.warn('[Facebook Connect] Failed to fetch WhatsApp Business Accounts', waErr);
      }

      console.log(
        '[Facebook Connect] Stored',
        storedPagesCount,
        'pages,',
        instagramAccountsCount,
        'Instagram accounts,',
        whatsappAccountsCount,
        'WhatsApp numbers with encryption:',
        vaultEnabled,
      );

      const syncStatus: SocialIntegrationSyncStatus = storedPagesCount === 0 && instagramAccountsCount === 0 && whatsappAccountsCount === 0
        ? 'incomplete'
        : warnings.size > 0 || failures.length > 0
          ? 'partial'
          : 'success';
      const syncMessage = syncStatus === 'partial'
        ? 'Meta connected, but one or more assets need attention before the setup is complete.'
        : syncStatus === 'incomplete'
          ? 'Meta connected, but no importable assets were returned for this organization.'
          : null;

      await logSocialIntegrationSyncRun(organizationId, syncAction, syncStatus, {
        pagesCount: storedPagesCount,
        instagramCount: instagramAccountsCount,
        whatsappCount: whatsappAccountsCount,
        warnings: Array.from(warnings),
        failures: failures.slice(0, 10),
        message: syncMessage,
        metadata: {
          fetchedPagesCount: pages.length,
          vaultEnabled,
        },
      });

      await logSocialIntegrationEvent(organizationId, 'meta_sync_completed', {
        status: syncStatus === 'success' ? 'success' : syncStatus === 'error' ? 'error' : 'warning',
        details: {
          action: syncAction,
          pagesCount: storedPagesCount,
          instagramCount: instagramAccountsCount,
          whatsappCount: whatsappAccountsCount,
          warningCount: warnings.size,
          failureCount: failures.length,
        },
      });

      return {
        response: new Response(JSON.stringify({
          success: storedPagesCount > 0 || instagramAccountsCount > 0 || whatsappAccountsCount > 0,
          pages_count: storedPagesCount,
          fetched_pages_count: pages.length,
          instagram_accounts_count: instagramAccountsCount,
          whatsapp_accounts_count: whatsappAccountsCount,
          warnings: Array.from(warnings),
          failures: failures.slice(0, 10),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }),
      };
    };

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || undefined;
    const requestedOrganizationId = url.searchParams.get("organizationId");

    if (req.method === "GET" && action === "list") {
      const resolvedOrg = resolveOrganizationId(requestedOrganizationId);
      if (resolvedOrg.error) {
        return resolvedOrg.error;
      }

      // List stored pages for the organization (do not return raw access tokens)
      const { data } = await supabaseAdmin
        .from("facebook_pages")
        .select("id, organization_id, page_id, page_name, token_expires_at, is_enabled, connected_by, created_at, updated_at")
        .eq("organization_id", resolvedOrg.organizationId);

      return new Response(JSON.stringify({ pages: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { action: postAction } = body || {};
      const resolvedOrg = resolveOrganizationId(body?.organizationId);

      if (resolvedOrg.error) {
        return resolvedOrg.error;
      }

      const organizationId = resolvedOrg.organizationId;

      if (postAction === "exchange") {
        // Exchange code for user token, get pages and store their page tokens
        const code = body.code;
        const redirectUri = body.redirectUri;

        if (!code || !redirectUri) {
          return new Response(JSON.stringify({ error: "Missing code or redirectUri" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const FB_APP_ID = Deno.env.get("FACEBOOK_APP_ID")!;
        const FB_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET")!;

        // Exchange code for short-lived user access token
        const tokenRes = await fetch(
          `https://graph.facebook.com/v17.0/oauth/access_token?client_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${FB_APP_SECRET}&code=${encodeURIComponent(code)}`
        );
        const tokenJson = await tokenRes.json();
        if (!tokenRes.ok || !tokenJson.access_token) {
          console.error('[Facebook Connect] Token exchange error', tokenJson);
          await logSocialIntegrationSyncRun(organizationId, 'connect', 'error', {
            failures: ['Meta code exchange failed.'],
            message: 'Meta authorization returned, but the callback code could not be exchanged for a usable token.',
            metadata: { graphError: tokenJson },
          });
          return new Response(JSON.stringify({ error: 'Failed to exchange code for token', details: tokenJson }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const shortLivedToken = tokenJson.access_token as string;

        // Exchange for long-lived user token
        const longRes = await fetch(
          `https://graph.facebook.com/v17.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${encodeURIComponent(shortLivedToken)}`
        );
        const longJson = await longRes.json();
        const userAccessToken = longJson.access_token || shortLivedToken;

        const { response } = await syncMetaAssets(organizationId, userAccessToken, 'connect');
        return response;
      }

      if (postAction === 'exchange_with_token') {
        // Client provided a user access token (from FB JS SDK). Use it to fetch pages and store tokens.
        const userToken = body.userAccessToken;
        if (!userToken) {
          return new Response(JSON.stringify({ error: 'Missing userAccessToken' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Optionally exchange for a long-lived token
        const FB_APP_ID = Deno.env.get("FACEBOOK_APP_ID")!;
        const FB_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET")!;

        let userAccessToken = userToken;
        try {
          const longRes = await fetch(
            `https://graph.facebook.com/v17.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${encodeURIComponent(userToken)}`
          );
          const longJson = await longRes.json();
          if (longJson.access_token) userAccessToken = longJson.access_token;
        } catch (err) {
          console.warn('[Facebook Connect] Failed to exchange user token for long-lived token, continuing with short-lived token');
        }

        const syncAction = typeof body?.syncAction === 'string' && body.syncAction.trim() ? body.syncAction.trim() : 'resync';
        const { response } = await syncMetaAssets(organizationId, userAccessToken, syncAction);
        return response;
      }

      if (postAction === 'disconnect') {
        const pageId = body.page_id;
        if (!pageId) {
          return new Response(JSON.stringify({ error: 'Missing page_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { data: pageRecord } = await supabaseAdmin
          .from('facebook_pages')
          .select('page_id, page_name')
          .eq('organization_id', organizationId)
          .eq('page_id', pageId)
          .maybeSingle();

        await supabaseAdmin.from('facebook_pages').delete().eq('organization_id', organizationId).eq('page_id', pageId);
        await logSocialIntegrationEvent(organizationId, 'facebook_page_disconnected', {
          assetType: 'facebook_page',
          assetId: pageId,
          assetName: pageRecord?.page_name || pageId,
          details: { pageId },
        });
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (postAction === 'set_enabled') {
        const pageId = body.page_id;
        const enabled = Boolean(body.enabled);
        if (!pageId) {
          return new Response(JSON.stringify({ error: 'Missing page_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { data: existingPage } = await supabaseAdmin
          .from('facebook_pages')
          .select('page_id, page_name, access_token')
          .eq('organization_id', organizationId)
          .eq('page_id', pageId)
          .maybeSingle();

        // Update the local flag
        const { error: updateError } = await supabaseAdmin
          .from('facebook_pages')
          .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
          .eq('organization_id', organizationId)
          .eq('page_id', pageId);

        if (updateError) {
          console.error('[Facebook Connect] Failed to update is_enabled', updateError);
          return new Response(JSON.stringify({ error: 'Failed to update page' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Manage webhook subscription when enabling/disabling
        try {
          // Decrypt the token
          let pageToken = existingPage?.access_token;
          if (pageToken) {
            pageToken = await vaultDecrypt(supabaseAdmin, pageToken);
          }
          
          if (enabled && pageToken) {
            // Subscribe app to the page to receive messaging events
            const subscribeRes = await fetch(`https://graph.facebook.com/v17.0/${pageId}/subscribed_apps?access_token=${encodeURIComponent(pageToken)}`, {
              method: 'POST',
            });
            const subscribeJson = await subscribeRes.json();
            if (!subscribeRes.ok) console.warn('[Facebook Connect] Failed to subscribe page', subscribeJson);
          } else if (!enabled && pageToken) {
            // Unsubscribe app from the page
            const unsubscribeRes = await fetch(`https://graph.facebook.com/v17.0/${pageId}/subscribed_apps?access_token=${encodeURIComponent(pageToken)}`, {
              method: 'DELETE',
            });
            const unsubscribeJson = await unsubscribeRes.json();
            if (!unsubscribeRes.ok) console.warn('[Facebook Connect] Failed to unsubscribe page', unsubscribeJson);
          }
        } catch (err) {
          console.error('[Facebook Connect] Webhook subscription error', err);
        }

        await logSocialIntegrationEvent(organizationId, enabled ? 'facebook_page_enabled' : 'facebook_page_disabled', {
          assetType: 'facebook_page',
          assetId: pageId,
          assetName: existingPage?.page_name || pageId,
          details: { enabled },
        });

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[Facebook Connect] Error', error);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
