import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createInternalAuthErrorResponse, isAuthorizedInternalRequest } from "../_shared/internal-auth.ts";
import { initVault, vaultEncrypt, vaultDecrypt } from "../_shared/vault.ts";

const FACEBOOK_APP_ID = Deno.env.get('FACEBOOK_APP_ID');
const FACEBOOK_APP_SECRET = Deno.env.get('FACEBOOK_APP_SECRET');
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

Deno.serve(async (req: Request) => {
  const corsHeaders = createCorsHeaders(req, 'x-internal-function-secret');

  const preflightResponse = handleCorsPreflightRequest(req, 'x-internal-function-secret');
  if (preflightResponse) return preflightResponse;

  try {
    if (!isAuthorizedInternalRequest(req)) {
      return createInternalAuthErrorResponse(corsHeaders);
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Initialize vault encryption
    const vaultEnabled = await initVault(supabaseClient);
    console.log('[Refresh Tokens] Vault encryption:', vaultEnabled ? 'enabled' : 'disabled');

    type TokenError = {
      type: string;
      page_id?: string;
      page_name?: string;
      organization_id?: string;
      platform?: string;
      display_name?: string;
      error: string;
    };

    type ExpiringAccount = {
      type: string;
      platform?: string;
      display_name: string;
      organization_id?: string;
      organization_name?: string;
      expires_at: string;
      [key: string]: unknown;
    };

    const results: {
      facebook_pages_refreshed: number;
      facebook_pages_failed: number;
      social_platforms_refreshed: number;
      social_platforms_failed: number;
      expiring_soon_notified: number;
      errors: TokenError[];
      expiringSoonAccounts: ExpiringAccount[];
    } = {
      facebook_pages_refreshed: 0,
      facebook_pages_failed: 0,
      social_platforms_refreshed: 0,
      social_platforms_failed: 0,
      expiring_soon_notified: 0,
      errors: [],
      expiringSoonAccounts: [],
    };

    // Find tokens expiring in the next 7 days
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // Find tokens expiring in the next 3 days (for proactive warning)
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // 1. Refresh facebook_pages tokens
    const { data: expiringPages, error: fetchPagesError } = await supabaseClient
      .from('facebook_pages')
      .select('*')
      .eq('is_enabled', true)
      .lt('token_expires_at', sevenDaysFromNow.toISOString());

    if (fetchPagesError) {
      console.error('Error fetching expiring facebook_pages tokens:', fetchPagesError);
    } else if (expiringPages && expiringPages.length > 0) {
      console.log(`Found ${expiringPages.length} facebook_pages tokens to refresh`);

      for (const page of expiringPages) {
        try {
          console.log(`Refreshing token for Facebook page ${page.page_id}`);

          // Decrypt the current token
          let currentToken = page.access_token;
          if (vaultEnabled && currentToken) {
            currentToken = await vaultDecrypt(supabaseClient, currentToken);
          }

          // Exchange for new long-lived token
          const exchangeUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
          exchangeUrl.searchParams.set('grant_type', 'fb_exchange_token');
          exchangeUrl.searchParams.set('client_id', FACEBOOK_APP_ID!);
          exchangeUrl.searchParams.set('client_secret', FACEBOOK_APP_SECRET!);
          exchangeUrl.searchParams.set('fb_exchange_token', currentToken);

          const exchangeResponse = await fetch(exchangeUrl.toString());
          if (!exchangeResponse.ok) {
            const errorText = await exchangeResponse.text();
            throw new Error(`Token exchange failed: ${errorText}`);
          }

          const exchangeData = await exchangeResponse.json();
          let newAccessToken = exchangeData.access_token;
          const expiresIn = exchangeData.expires_in || 5184000; // Default 60 days

          // Encrypt the new token
          if (vaultEnabled) {
            newAccessToken = await vaultEncrypt(supabaseClient, newAccessToken);
          }

          // Calculate new expiry date
          const newExpiryDate = new Date();
          newExpiryDate.setSeconds(newExpiryDate.getSeconds() + expiresIn);

          // Update the token in database
          const { error: updateError } = await supabaseClient
            .from('facebook_pages')
            .update({
              access_token: newAccessToken,
              token_expires_at: newExpiryDate.toISOString(),
            })
            .eq('id', page.id);

          if (updateError) {
            throw new Error(`Failed to update token: ${updateError.message}`);
          }

          console.log(`Successfully refreshed token for Facebook page ${page.page_id}`);
          results.facebook_pages_refreshed++;
        } catch (error) {
          console.error(`Failed to refresh token for Facebook page ${page.page_id}:`, error);
          results.facebook_pages_failed++;
          results.errors.push({
            type: 'facebook_page',
            page_id: page.page_id,
            page_name: page.page_name,
            organization_id: page.organization_id,
            error: (error as Error).message,
          });
        }
      }
    } else {
      console.log('No facebook_pages tokens expiring soon');
    }

    // 2. Refresh social_platforms tokens (Instagram & WhatsApp)
    const { data: allSocialPlatforms, error: fetchSocialError } = await supabaseClient
      .from('social_platforms')
      .select('*')
      .in('platform', ['instagram', 'whatsapp'])
      .eq('is_enabled', true);

    if (fetchSocialError) {
      console.error('Error fetching social_platforms:', fetchSocialError);
    } else if (allSocialPlatforms && allSocialPlatforms.length > 0) {
      // Filter platforms with expiring tokens
      const expiringSocialPlatforms = allSocialPlatforms.filter(platform => {
        const credentials = (platform.credentials ?? {}) as Record<string, unknown>;
        if (!credentials?.token_expires_at) return false;
        const expiresAt = new Date(String(credentials.token_expires_at));
        return expiresAt < sevenDaysFromNow;
      });

      console.log(`Found ${expiringSocialPlatforms.length} social_platforms tokens to refresh`);

      for (const platform of expiringSocialPlatforms) {
        try {
          const credentials = (platform.credentials ?? {}) as Record<string, unknown>;
          console.log(`Refreshing token for ${platform.platform} - ${platform.display_name}`);

          // Decrypt the current token
          let currentToken = String(credentials.access_token || '');
          if (vaultEnabled && currentToken) {
            currentToken = await vaultDecrypt(supabaseClient, currentToken);
          }

          // Exchange for new long-lived token
          const exchangeUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
          exchangeUrl.searchParams.set('grant_type', 'fb_exchange_token');
          exchangeUrl.searchParams.set('client_id', FACEBOOK_APP_ID!);
          exchangeUrl.searchParams.set('client_secret', FACEBOOK_APP_SECRET!);
          exchangeUrl.searchParams.set('fb_exchange_token', currentToken);

          const exchangeResponse = await fetch(exchangeUrl.toString());
          if (!exchangeResponse.ok) {
            const errorText = await exchangeResponse.text();
            throw new Error(`Token exchange failed: ${errorText}`);
          }

          const exchangeData = await exchangeResponse.json();
          let newAccessToken = exchangeData.access_token;
          const expiresIn = exchangeData.expires_in || 5184000; // Default 60 days

          // Encrypt the new token
          if (vaultEnabled) {
            newAccessToken = await vaultEncrypt(supabaseClient, newAccessToken);
          }

          // Calculate new expiry date
          const newExpiryDate = new Date();
          newExpiryDate.setSeconds(newExpiryDate.getSeconds() + expiresIn);

          // Update credentials with new token
          const updatedCredentials = {
            ...credentials,
            access_token: newAccessToken,
            token_expires_at: newExpiryDate.toISOString(),
          };

          const { error: updateError } = await supabaseClient
            .from('social_platforms')
            .update({ credentials: updatedCredentials })
            .eq('id', platform.id);

          if (updateError) {
            throw new Error(`Failed to update token: ${updateError.message}`);
          }

          console.log(`Successfully refreshed token for ${platform.platform} - ${platform.display_name}`);
          results.social_platforms_refreshed++;
        } catch (error) {
          console.error(`Failed to refresh token for ${platform.platform} - ${platform.display_name}:`, error);
          results.social_platforms_failed++;
          results.errors.push({
            type: 'social_platform',
            platform: platform.platform,
            display_name: platform.display_name,
            organization_id: platform.organization_id,
            error: (error as Error).message,
          });

          // Optionally disable the platform on failure
          try {
            await supabaseClient
              .from('social_platforms')
              .update({ is_enabled: false })
              .eq('id', platform.id);
            console.log(`Disabled ${platform.platform} - ${platform.display_name} due to token refresh failure`);
          } catch (disableError) {
            console.error(`Failed to disable platform:`, disableError);
          }
        }
      }
    } else {
      console.log('No social_platforms tokens expiring soon');
    }

    // 3. Check for tokens expiring in the next 3 days and send proactive warning
    // (These are tokens that couldn't be auto-refreshed or will expire soon)
    const { data: allFacebookPages } = await supabaseClient
      .from('facebook_pages')
      .select('*, organizations(name)')
      .eq('is_enabled', true)
      .lt('token_expires_at', threeDaysFromNow.toISOString())
      .gt('token_expires_at', new Date().toISOString());

    const { data: allSocialPlatformsExpiring } = await supabaseClient
      .from('social_platforms')
      .select('*, organizations(name)')
      .in('platform', ['instagram', 'whatsapp'])
      .eq('is_enabled', true);

    // Filter social platforms expiring in 3 days
    const expiringSocialPlatforms3Days = (allSocialPlatformsExpiring || []).filter(platform => {
      const credentials = (platform.credentials ?? {}) as Record<string, unknown>;
      if (!credentials?.token_expires_at) return false;
      const expiresAt = new Date(String(credentials.token_expires_at));
      const now = new Date();
      return expiresAt > now && expiresAt < threeDaysFromNow;
    });

    // Collect expiring accounts for warning email
    for (const page of allFacebookPages || []) {
      results.expiringSoonAccounts.push({
        type: 'facebook_page',
        platform: 'facebook',
        display_name: page.page_name,
        organization_id: page.organization_id,
        organization_name: page.organizations?.name || 'Unknown',
        expires_at: page.token_expires_at,
      });
    }

    for (const platform of expiringSocialPlatforms3Days) {
      results.expiringSoonAccounts.push({
        type: 'social_platform',
        platform: platform.platform,
        display_name: platform.display_name,
        organization_id: platform.organization_id,
        organization_name: platform.organizations?.name || 'Unknown',
        expires_at: platform.credentials?.token_expires_at,
      });
    }

    const totalRefreshed = results.facebook_pages_refreshed + results.social_platforms_refreshed;
    const totalFailed = results.facebook_pages_failed + results.social_platforms_failed;

    // Send email alert if any tokens failed to refresh
    if (totalFailed > 0 && results.errors.length > 0) {
      await sendFailureAlertEmail(supabaseClient, results.errors);
    }

    // Send proactive warning email for tokens expiring soon
    if (results.expiringSoonAccounts.length > 0) {
      await sendExpiryWarningEmail(supabaseClient, results.expiringSoonAccounts);
      results.expiring_soon_notified = results.expiringSoonAccounts.length;
    }

    console.log(`Token refresh completed: ${totalRefreshed} refreshed, ${totalFailed} failed, ${results.expiringSoonAccounts.length} expiring soon`);

    return new Response(
      JSON.stringify({
        message: 'Token refresh completed',
        ...results,
        total_refreshed: totalRefreshed,
        total_failed: totalFailed,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Fatal error in token refresh:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function sendFailureAlertEmail(
  supabaseClient: SupabaseClient<any, "public", any>,
  errors: Array<{ type: string; organization_id?: string; error: string; [key: string]: unknown }>
) {
  try {
    // Get super admin emails
    const { data: superAdminRoles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('user_id')
      .eq('role', 'super_admin');

    if (rolesError || !superAdminRoles || superAdminRoles.length === 0) {
      console.error('No super admins found to notify');
      return;
    }

    const userIds = (superAdminRoles as Array<{ user_id: string }>).map(r => r.user_id);
    
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('email')
      .in('id', userIds);

    if (profilesError || !profiles || profiles.length === 0) {
      console.error('No super admin emails found');
      return;
    }

    const superAdminEmails = (profiles as Array<{ email: string | null }>)
      .map(p => p.email)
      .filter((email): email is string => email !== null);
    
    if (superAdminEmails.length === 0) {
      console.error('No valid super admin emails');
      return;
    }

    // Group errors by organization
    const errorsByOrg: Record<string, Array<{ type: string; organization_id?: string; error: string; [key: string]: unknown }>> = {};
    for (const error of errors) {
      const orgId = error.organization_id || 'unknown';
      if (!errorsByOrg[orgId]) {
        errorsByOrg[orgId] = [];
      }
      errorsByOrg[orgId].push(error);
    }

    // Get organization names
    const orgIds = Object.keys(errorsByOrg).filter(id => id !== 'unknown');
    let orgNames: Record<string, string> = {};
    
    if (orgIds.length > 0) {
      const { data: orgs } = await supabaseClient
        .from('organizations')
        .select('id, name')
        .in('id', orgIds);
      
      if (orgs) {
        orgNames = orgs.reduce((acc: Record<string, string>, org: { id: string; name: string }) => {
          acc[org.id] = org.name;
          return acc;
        }, {});
      }
    }

    // Build error list HTML
    let errorListHtml = '';
    for (const [orgId, orgErrors] of Object.entries(errorsByOrg)) {
      const orgName = orgNames[orgId] || 'Unknown Organization';
      errorListHtml += `<h3 style="color: #333; margin-top: 20px;">${orgName}</h3>`;
      errorListHtml += '<ul style="margin: 10px 0; padding-left: 20px;">';
      
      for (const err of orgErrors) {
        const accountName = err.display_name || err.page_name || err.page_id || 'Unknown';
        const platformName = String(err.platform || err.type || 'Unknown');
        errorListHtml += `
          <li style="margin: 8px 0; color: #555;">
            <strong>${platformName.charAt(0).toUpperCase() + platformName.slice(1)}</strong>: ${accountName}
            <br><span style="color: #dc2626; font-size: 12px;">${err.error}</span>
          </li>
        `;
      }
      
      errorListHtml += '</ul>';
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Token Refresh Failed - Action Required</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 20px;">
              <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #dc2626, #b91c1c); border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 30px;">⚠️</span>
              </div>
              <h1 style="color: #dc2626; margin: 0; font-size: 24px;">Token Refresh Failed</h1>
            </div>
            
            <p style="color: #333; font-size: 16px; line-height: 1.5;">
              The automatic token refresh process encountered ${errors.length} failure${errors.length > 1 ? 's' : ''}. 
              The affected accounts have been disabled and require manual reconnection.
            </p>
            
            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 15px; margin: 20px 0;">
              <h2 style="color: #dc2626; margin: 0 0 15px 0; font-size: 18px;">Failed Accounts:</h2>
              ${errorListHtml}
            </div>
            
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 15px; margin: 20px 0;">
              <h3 style="color: #16a34a; margin: 0 0 10px 0; font-size: 16px;">How to fix:</h3>
              <ol style="margin: 0; padding-left: 20px; color: #555;">
                <li style="margin: 5px 0;">Go to <strong>Social Platforms</strong> in the dashboard</li>
                <li style="margin: 5px 0;">Click <strong>Connect Facebook</strong> to re-authenticate</li>
                <li style="margin: 5px 0;">Re-enable the affected accounts</li>
              </ol>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              This is an automated message from AlCor Nexus. Token refresh runs daily at 2 AM UTC.
            </p>
          </div>
        </body>
      </html>
    `;

    const { error: emailError } = await resend.emails.send({
      from: 'AlCor Nexus <onboarding@resend.dev>',
      to: superAdminEmails,
      subject: `⚠️ Token Refresh Failed - ${errors.length} Account${errors.length > 1 ? 's' : ''} Need Attention`,
      html: emailHtml,
    });

    if (emailError) {
      console.error('Failed to send alert email:', emailError);
    } else {
      console.log(`Alert email sent to ${superAdminEmails.length} super admin(s)`);
    }
  } catch (error) {
    console.error('Error sending failure alert email:', error);
  }
}

async function sendExpiryWarningEmail(
  supabaseClient: SupabaseClient<any, "public", any>,
  expiringAccounts: Array<{ type: string; display_name: string; expires_at: string; [key: string]: unknown }>
) {
  try {
    // Get super admin emails
    const { data: superAdminRoles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('user_id')
      .eq('role', 'super_admin');

    if (rolesError || !superAdminRoles || superAdminRoles.length === 0) {
      console.error('No super admins found to notify');
      return;
    }

    const userIds = (superAdminRoles as Array<{ user_id: string }>).map(r => r.user_id);
    
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('email')
      .in('id', userIds);

    if (profilesError || !profiles || profiles.length === 0) {
      console.error('No super admin emails found');
      return;
    }

    const superAdminEmails = (profiles as Array<{ email: string | null }>)
      .map(p => p.email)
      .filter((email): email is string => email !== null);
    
    if (superAdminEmails.length === 0) {
      console.error('No valid super admin emails');
      return;
    }

    // Group by organization
    const accountsByOrg: Record<string, Array<{ type: string; platform?: string; display_name: string; expires_at: string; [key: string]: unknown }>> = {};
    for (const account of expiringAccounts) {
      const orgName = String(account.organization_name || 'Unknown Organization');
      if (!accountsByOrg[orgName]) {
        accountsByOrg[orgName] = [];
      }
      accountsByOrg[orgName].push(account);
    }

    // Build account list HTML
    let accountListHtml = '';
    for (const [orgName, accounts] of Object.entries(accountsByOrg)) {
      accountListHtml += `<h3 style="color: #333; margin-top: 20px;">${orgName}</h3>`;
      accountListHtml += '<ul style="margin: 10px 0; padding-left: 20px;">';
      
      for (const acc of accounts) {
        const expiresAt = new Date(acc.expires_at);
        const now = new Date();
        const hoursUntilExpiry = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
        const daysUntilExpiry = Math.round(hoursUntilExpiry / 24);
        
        const timeLeft = daysUntilExpiry > 0 
          ? `${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}` 
          : `${hoursUntilExpiry} hour${hoursUntilExpiry !== 1 ? 's' : ''}`;
        
        const platformStr = String(acc.platform || 'unknown');
        accountListHtml += `
          <li style="margin: 8px 0; color: #555;">
            <strong>${platformStr.charAt(0).toUpperCase() + platformStr.slice(1)}</strong>: ${acc.display_name}
            <br><span style="color: #d97706; font-size: 12px;">Expires in ${timeLeft}</span>
          </li>
        `;
      }
      
      accountListHtml += '</ul>';
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Token Expiry Warning - Action Recommended</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 20px;">
              <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #d97706, #b45309); border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 30px;">⏰</span>
              </div>
              <h1 style="color: #d97706; margin: 0; font-size: 24px;">Tokens Expiring Soon</h1>
            </div>
            
            <p style="color: #333; font-size: 16px; line-height: 1.5;">
              ${expiringAccounts.length} social media token${expiringAccounts.length > 1 ? 's are' : ' is'} about to expire within the next 3 days.
              While we attempt to auto-refresh tokens, some may require manual reconnection.
            </p>
            
            <div style="background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 15px; margin: 20px 0;">
              <h2 style="color: #d97706; margin: 0 0 15px 0; font-size: 18px;">Accounts Expiring Soon:</h2>
              ${accountListHtml}
            </div>
            
            <div style="background-color: #eff6ff; border: 1px solid #93c5fd; border-radius: 6px; padding: 15px; margin: 20px 0;">
              <h3 style="color: #2563eb; margin: 0 0 10px 0; font-size: 16px;">Recommended Action:</h3>
              <ol style="margin: 0; padding-left: 20px; color: #555;">
                <li style="margin: 5px 0;">Go to <strong>Social Platforms</strong> in the dashboard</li>
                <li style="margin: 5px 0;">Click <strong>Refresh Token</strong> on the expiring accounts</li>
                <li style="margin: 5px 0;">If refresh fails, click <strong>Connect Facebook</strong> to re-authenticate</li>
              </ol>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              This is an automated warning from AlCor Nexus. Token refresh runs daily at 2 AM UTC.
            </p>
          </div>
        </body>
      </html>
    `;

    const { error: emailError } = await resend.emails.send({
      from: 'AlCor Nexus <onboarding@resend.dev>',
      to: superAdminEmails,
      subject: `⏰ Token Expiry Warning - ${expiringAccounts.length} Account${expiringAccounts.length > 1 ? 's' : ''} Expiring Soon`,
      html: emailHtml,
    });

    if (emailError) {
      console.error('Failed to send expiry warning email:', emailError);
    } else {
      console.log(`Expiry warning email sent to ${superAdminEmails.length} super admin(s)`);
    }
  } catch (error) {
    console.error('Error sending expiry warning email:', error);
  }
}
