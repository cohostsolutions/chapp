import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { initVault, vaultEncrypt, vaultDecrypt } from "../_shared/vault.ts";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // Service role client for database operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const getGoogleOAuthConfig = async () => {
      let clientId = Deno.env.get('OAuth_Client_ID') ?? Deno.env.get('GOOGLE_CLIENT_ID');
      let clientSecret =
        Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')
        ?? Deno.env.get('GOOGLE_AUTH_CLIENT_SECRET')
        ?? Deno.env.get('GOOGLE_CLIENT_SECRET');

      if (clientId && clientSecret) {
        return { clientId, clientSecret };
      }

      // Use the get_vault_secret RPC which is a SECURITY DEFINER function with
      // the correct grants on vault.decrypted_secrets — more reliable than
      // querying the vault schema directly from the JS client.
      try {
        const lookups: Array<{ key: 'clientId' | 'clientSecret'; names: string[] }> = [
          { key: 'clientId',     names: ['OAuth_Client_ID', 'GOOGLE_CLIENT_ID'] },
          { key: 'clientSecret', names: ['GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_AUTH_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET'] },
        ];

        for (const { key, names } of lookups) {
          if (key === 'clientId' && clientId) continue;
          if (key === 'clientSecret' && clientSecret) continue;

          for (const name of names) {
            const { data: secretValue, error: rpcError } = await supabase
              .rpc('get_vault_secret', { p_name: name });

            if (!rpcError && secretValue) {
              if (key === 'clientId') clientId = secretValue as string;
              else clientSecret = secretValue as string;
              break;
            }
          }
        }
      } catch (vaultReadError) {
        console.warn('[Google Calendar] Vault lookup failed for OAuth config:', vaultReadError);
      }

      return { clientId, clientSecret };
    };

    const { clientId, clientSecret } = await getGoogleOAuthConfig();

    // Initialize vault encryption
    const vaultEnabled = await initVault(supabase);
    console.log('[Google Calendar] Vault encryption:', vaultEnabled ? 'enabled' : 'disabled');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // This function has JWT verification enabled at the platform level (verify_jwt=true).
    // We only decode the token to identify the user.
    const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
      try {
        const [, payload] = token.split('.');
        if (!payload) return null;
        const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '==='.slice((b64.length + 3) % 4);
        return JSON.parse(atob(padded));
      } catch {
        return null;
      }
    };

    const userToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    const jwtPayload = userToken ? decodeJwtPayload(userToken) : null;

    if (!jwtPayload?.sub) {
      console.error('[Google Calendar] Invalid JWT payload');
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = { id: String(jwtPayload.sub) };

    const { action, ...params } = await req.json();
    console.log('[Google Calendar] Action:', action, 'User:', user.id);

    const userAgent = req.headers.get('user-agent');
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? null;

    const getActorOrganizationId = async (actorUserId: string): Promise<string | null> => {
      const { data } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', actorUserId)
        .maybeSingle();

      return data?.organization_id ?? null;
    };

    const notifySuperAdmins = async (
      issueKey: string,
      title: string,
      message: string,
      organizationId: string | null,
    ) => {
      const duplicateWindowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: existingNotifications } = await supabase
        .from('notification_history')
        .select('id')
        .eq('channel', 'audit')
        .eq('related_id', issueKey)
        .gte('created_at', duplicateWindowStart)
        .limit(1);

      if (existingNotifications && existingNotifications.length > 0) {
        return;
      }

      const { data: superAdminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'super_admin');

      const superAdminIds = Array.from(new Set((superAdminRoles || []).map((role) => role.user_id).filter(Boolean)));
      if (superAdminIds.length === 0) {
        return;
      }

      await supabase.from('notification_history').insert(
        superAdminIds.map((superAdminId) => ({
          user_id: superAdminId,
          organization_id: organizationId,
          title,
          message,
          type: 'system_health',
          channel: 'audit',
          related_id: issueKey,
          is_read: false,
        })),
      );
    };

    const reportGoogleIssue = async ({
      issueType,
      stage,
      message,
      severity = 'error',
      details = {},
    }: {
      issueType: string;
      stage: string;
      message: string;
      severity?: 'info' | 'warning' | 'error';
      details?: Record<string, unknown>;
    }) => {
      const organizationId = await getActorOrganizationId(user.id);
      const issueKey = `google_oauth:${issueType}:${stage}`;
      const title = 'Google OAuth issue detected';
      const notificationMessage = `${stage}: ${message}`;

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'google_oauth_issue_detected',
        resource_type: 'google_oauth',
        resource_id: issueKey,
        details: {
          issue_type: issueType,
          stage,
          severity,
          message,
          organization_id: organizationId,
          ...details,
        },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      if (severity !== 'info') {
        await notifySuperAdmins(issueKey, title, notificationMessage, organizationId);
      }
    };

    if (action === 'report_issue') {
      const issueType = typeof params.issueType === 'string' ? params.issueType : 'unknown_issue';
      const stage = typeof params.stage === 'string' ? params.stage : 'unknown_stage';
      const message = typeof params.message === 'string' ? params.message : 'A Google OAuth issue was reported.';
      const severity = params.severity === 'info' || params.severity === 'warning' || params.severity === 'error'
        ? params.severity
        : 'error';
      const details = params.context && typeof params.context === 'object' ? params.context as Record<string, unknown> : {};

      await reportGoogleIssue({
        issueType,
        stage,
        message,
        severity,
        details,
      });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if OAuth credentials are configured
    if (!clientId || !clientSecret) {
      console.error('[Google Calendar] OAuth credentials not configured');
      await reportGoogleIssue({
        issueType: 'oauth_credentials_missing',
        stage: String(action || 'unknown_action'),
        message: 'Google OAuth credentials are not configured in the active Supabase project.',
        severity: 'error',
        details: {
          action,
        },
      });
      return new Response(
        JSON.stringify({ 
          error: 'Google OAuth credentials not configured',
          setup_required: true 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get OAuth authorization URL
    if (action === 'get_auth_url') {
      const { redirectUri, state } = params;
      const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events');
      const stateQuery = typeof state === 'string' && state.length > 0
        ? `&state=${encodeURIComponent(state)}`
        : '';
      const authUrl = `${GOOGLE_AUTH_URL}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent${stateQuery}`;
      
      return new Response(
        JSON.stringify({ authUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Exchange authorization code for tokens
    if (action === 'exchange_code') {
      const { code, redirectUri } = params;
      try {

      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = await tokenResponse.json();
      
      if (tokenData.error) {
        console.error('[Google Calendar] Token exchange error:', tokenData);
        await reportGoogleIssue({
          issueType: 'token_exchange_failed',
          stage: 'exchange_code',
          message: tokenData.error_description || tokenData.error,
          severity: 'error',
          details: {
            action,
            redirect_uri: redirectUri,
            token_error: tokenData.error,
          },
        });
        return new Response(
          JSON.stringify({ error: tokenData.error_description || tokenData.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Encrypt tokens before storage
      const encryptedAccessToken = vaultEnabled 
        ? await vaultEncrypt(supabase, tokenData.access_token)
        : tokenData.access_token;
      const encryptedRefreshToken = vaultEnabled 
        ? await vaultEncrypt(supabase, tokenData.refresh_token)
        : tokenData.refresh_token;

      if (!encryptedAccessToken || !encryptedRefreshToken) {
        console.error('[Google Calendar] Token exchange response missing access_token or refresh_token');
        await reportGoogleIssue({
          issueType: 'token_missing_fields',
          stage: 'exchange_code',
          message: 'Google returned a successful response but access_token or refresh_token was missing.',
          severity: 'error',
          details: { has_access_token: Boolean(tokenData.access_token), has_refresh_token: Boolean(tokenData.refresh_token) },
        });
        return new Response(
          JSON.stringify({ error: 'Incomplete token response from Google' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Store encrypted tokens in database
      const expirySeconds = typeof tokenData.expires_in === 'number' ? tokenData.expires_in : 3600;
      const expiryDate = new Date(Date.now() + expirySeconds * 1000);
      
      console.log('[Google Calendar] Attempting to store tokens for user:', user.id);
      console.log('[Google Calendar] Token expiry:', expiryDate.toISOString());
      console.log('[Google Calendar] Encrypted access token length:', encryptedAccessToken?.length || 0);
      console.log('[Google Calendar] Encrypted refresh token length:', encryptedRefreshToken?.length || 0);
      
      const { data: upsertData, error: upsertError } = await supabase
        .from('google_calendar_tokens')
        .upsert({
          user_id: user.id,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expiry: expiryDate.toISOString(),
        }, { onConflict: 'user_id' })
        .select();

      if (upsertError) {
        console.error('[Google Calendar] Token storage FAILED:', JSON.stringify({
          code: upsertError.code,
          message: upsertError.message,
          details: upsertError.details,
          hint: upsertError.hint,
          userId: user.id,
        }));
        await reportGoogleIssue({
          issueType: 'token_storage_failed',
          stage: 'exchange_code',
          message: 'Google tokens could not be stored after a successful token exchange.',
          severity: 'error',
          details: {
            action,
            database_code: upsertError.code,
            database_message: upsertError.message,
          },
        });
        return new Response(
          JSON.stringify({ 
            error: 'Failed to store tokens',
            details: upsertError.message,
            code: upsertError.code
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[Google Calendar] Tokens stored SUCCESSFULLY:', JSON.stringify({
        userId: user.id,
        vaultEnabled,
        recordId: upsertData?.[0]?.id || 'unknown',
        expiresAt: expiryDate.toISOString()
      }));
      
      return new Response(
        JSON.stringify({ success: true, message: 'Google Calendar connected successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      } catch (exchangeError) {
        const msg = exchangeError instanceof Error ? exchangeError.message : 'Unknown error during token exchange';
        console.error('[Google Calendar] Unexpected error in exchange_code:', msg);
        try {
          await reportGoogleIssue({
            issueType: 'exchange_code_unexpected_error',
            stage: 'exchange_code',
            message: msg,
            severity: 'error',
          });
        } catch (_) { /* best-effort */ }
        return new Response(
          JSON.stringify({ error: msg }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Helper function to get valid access token (with decryption)
    async function getValidAccessToken(userId: string): Promise<string | null> {
      const { data: tokenData, error } = await supabase
        .from('google_calendar_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !tokenData) {
        return null;
      }

      // Decrypt tokens
      let accessToken: string;
      let refreshToken: string;
      
      try {
        accessToken = await vaultDecrypt(supabase, tokenData.access_token);
        refreshToken = await vaultDecrypt(supabase, tokenData.refresh_token);
      } catch (decryptError) {
        console.error('[Google Calendar] Token decryption failed:', decryptError);
        // Delete corrupted tokens
        await supabase.from('google_calendar_tokens').delete().eq('user_id', userId);
        return null;
      }

      // Check if token is expired
      if (new Date(tokenData.token_expiry) <= new Date()) {
        // Refresh the token
        const refreshResponse = await fetch(GOOGLE_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId!,
            client_secret: clientSecret!,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
          }),
        });

        const refreshData = await refreshResponse.json();
        
        if (refreshData.error) {
          console.error('[Google Calendar] Token refresh error:', refreshData);
          // Delete invalid tokens
          await supabase.from('google_calendar_tokens').delete().eq('user_id', userId);
          return null;
        }

        // Encrypt and update stored tokens
        const newEncryptedAccessToken = vaultEnabled 
          ? await vaultEncrypt(supabase, refreshData.access_token)
          : refreshData.access_token;
        
        const newExpiry = new Date(Date.now() + refreshData.expires_in * 1000);
        await supabase
          .from('google_calendar_tokens')
          .update({
            access_token: newEncryptedAccessToken,
            token_expiry: newExpiry.toISOString(),
          })
          .eq('user_id', userId);

        return refreshData.access_token;
      }

      return accessToken;
    }

    // Check connection status
    if (action === 'check_connection') {
      const accessToken = await getValidAccessToken(user.id);
      
      if (!accessToken) {
        return new Response(
          JSON.stringify({ connected: false, message: 'Not connected to Google Calendar' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify token works by making a simple API call
      const calendarResponse = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList?maxResults=1`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!calendarResponse.ok) {
        // Only delete stored tokens when Google explicitly rejects them (401 Unauthorized).
        // Transient errors (5xx, network issues) should not disconnect the user.
        if (calendarResponse.status === 401) {
          await supabase.from('google_calendar_tokens').delete().eq('user_id', user.id);
          return new Response(
            JSON.stringify({ connected: false, message: 'Connection expired, please reconnect' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ connected: false, message: 'Could not verify connection, please try again' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ connected: true, message: 'Connected to Google Calendar' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Disconnect Google Calendar
    if (action === 'disconnect') {
      // Attempt to revoke the token with Google before deleting from DB
      try {
        const { data: tokenData } = await supabase
          .from('google_calendar_tokens')
          .select('access_token')
          .eq('user_id', user.id)
          .single();

        if (tokenData?.access_token) {
          const rawToken = vaultEnabled
            ? await vaultDecrypt(supabase, tokenData.access_token)
            : tokenData.access_token;
          // Fire-and-forget: revocation failure doesn't block disconnect
          fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(rawToken)}`, {
            method: 'POST',
          }).catch((revokeErr) => {
            console.warn('[Google Calendar] Token revocation request failed:', revokeErr);
          });
        }
      } catch (revokeErr) {
        console.warn('[Google Calendar] Could not revoke token before disconnect:', revokeErr);
      }

      await supabase.from('google_calendar_tokens').delete().eq('user_id', user.id);
      return new Response(
        JSON.stringify({ success: true, message: 'Disconnected from Google Calendar' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // List all user's calendars
    if (action === 'list_calendars') {
      const accessToken = await getValidAccessToken(user.id);
      
      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: 'Not connected to Google Calendar', calendars: [] }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const calendarListResponse = await fetch(
        `${GOOGLE_CALENDAR_API}/users/me/calendarList?minAccessRole=reader`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!calendarListResponse.ok) {
        const errorText = await calendarListResponse.text();
        console.error('[Google Calendar] Calendar list fetch error:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch calendars', calendars: [] }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const calendarListData = await calendarListResponse.json();
      const calendars = (calendarListData.items || []).map((cal: { id?: string; summary?: string; [key: string]: unknown }) => ({
        id: cal.id,
        name: cal.summary || 'Unnamed Calendar',
        description: cal.description,
        primary: cal.primary || false,
        accessRole: cal.accessRole,
        backgroundColor: cal.backgroundColor,
        foregroundColor: cal.foregroundColor,
        selected: cal.selected,
        timeZone: cal.timeZone || 'UTC',
      }));

      console.log(`[Google Calendar] Found ${calendars.length} calendars for user ${user.id}`);

      return new Response(
        JSON.stringify({ calendars }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // List events from ALL accessible calendars (not just primary)
    if (action === 'list_events') {
      const accessToken = await getValidAccessToken(user.id);
      
      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: 'Not connected to Google Calendar', events: [] }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { calendarIds } = params; // Optional: specific calendars to fetch from
      const now = new Date().toISOString();
      const maxTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
      
      let calendarsToFetch: { id: string; name: string; primary: boolean; timeZone: string }[] = [];

      if (calendarIds && Array.isArray(calendarIds) && calendarIds.length > 0) {
        // Use provided calendar IDs - fetch their metadata to get timezone
        for (const id of calendarIds) {
          try {
            const calResponse = await fetch(
              `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(id)}`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (calResponse.ok) {
              const calData = await calResponse.json();
              calendarsToFetch.push({ 
                id, 
                name: calData.summary || id, 
                primary: id === 'primary',
                timeZone: calData.timeZone || 'UTC'
              });
            } else {
              calendarsToFetch.push({ id, name: id, primary: id === 'primary', timeZone: 'UTC' });
            }
          } catch {
            calendarsToFetch.push({ id, name: id, primary: id === 'primary', timeZone: 'UTC' });
          }
        }
      } else {
        // Fetch ALL accessible calendars
        const calendarListResponse = await fetch(
          `${GOOGLE_CALENDAR_API}/users/me/calendarList?minAccessRole=reader`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (calendarListResponse.ok) {
          const calendarListData = await calendarListResponse.json();
          calendarsToFetch = (calendarListData.items || []).map((cal: { id?: string; [key: string]: unknown }) => ({
            id: cal.id,
            name: cal.summary || 'Unnamed Calendar',
            primary: cal.primary || false,
            timeZone: cal.timeZone || 'UTC',
          }));
          console.log(`[Google Calendar] Fetching events from ${calendarsToFetch.length} calendars`);
        } else {
          // Fallback to primary only
          calendarsToFetch = [{ id: 'primary', name: 'Primary', primary: true, timeZone: 'UTC' }];
        }
      }

      const allEvents: Array<{ startTime: string; endTime: string; [key: string]: unknown }> = [];

      // Fetch events from each calendar
      for (const calendar of calendarsToFetch) {
        try {
          const eventsResponse = await fetch(
            `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendar.id)}/events?timeMin=${encodeURIComponent(now)}&timeMax=${encodeURIComponent(maxTime)}&maxResults=100&singleEvents=true&orderBy=startTime`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          if (eventsResponse.ok) {
            const eventsData = await eventsResponse.json();
            const events = (eventsData.items || [])
              .filter((event: { status?: string; [key: string]: unknown }) => event.status !== 'cancelled')
              .map((event: { start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; attendees?: Array<{ email?: string; [key: string]: unknown }>; [key: string]: unknown }) => ({
                id: event.id,
                title: event.summary || 'No title',
                description: event.description,
                startTime: event.start?.dateTime || event.start?.date || '',
                endTime: event.end?.dateTime || event.end?.date || '',
                allDay: !event.start?.dateTime,
                attendees: event.attendees?.map((a: { email?: string; [key: string]: unknown }) => a.email) || [],
                calendarId: calendar.id,
                calendarName: calendar.name,
                calendarTimeZone: calendar.timeZone,
                isPrimary: calendar.primary,
              }));
            allEvents.push(...events);
          } else {
            console.warn(`[Google Calendar] Could not fetch events from calendar ${calendar.id}: ${eventsResponse.status}`);
          }
        } catch (calError) {
          console.error(`[Google Calendar] Error fetching events from ${calendar.id}:`, calError);
        }
      }

      // Sort all events by start time
      allEvents.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      console.log(`[Google Calendar] Retrieved ${allEvents.length} events from ${calendarsToFetch.length} calendars`);

      return new Response(
        JSON.stringify({ 
          events: allEvents,
          calendarsChecked: calendarsToFetch.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check availability across multiple calendars for a room
    if (action === 'check_availability') {
      const accessToken = await getValidAccessToken(user.id);
      
      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: 'Not connected to Google Calendar', available: false }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { calendarIds, startDate, endDate, roomName } = params;
      
      if (!calendarIds || !Array.isArray(calendarIds) || calendarIds.length === 0) {
        return new Response(
          JSON.stringify({ available: true, message: 'No calendars configured for this room' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[Google Calendar] Checking availability for ${roomName || 'room'} across ${calendarIds.length} calendar(s)`);
      
      const conflictingEvents: Array<Record<string, unknown>> = [];
      
      // Check each calendar for events in the date range
      for (const calendarId of calendarIds) {
        try {
          const eventsUrl = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?` + 
            `timeMin=${encodeURIComponent(startDate)}&` +
            `timeMax=${encodeURIComponent(endDate)}&` +
            `singleEvents=true&orderBy=startTime`;
          
          const eventsResponse = await fetch(eventsUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (eventsResponse.ok) {
            const eventsData = await eventsResponse.json();
            if (eventsData.items && eventsData.items.length > 0) {
              eventsData.items.forEach((event: { start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; [key: string]: unknown }) => {
                // Skip cancelled events
                if (event.status === 'cancelled') return;
                
                conflictingEvents.push({
                  calendarId,
                  eventId: event.id,
                  title: event.summary || 'Busy',
                  start: event.start?.dateTime || event.start?.date,
                  end: event.end?.dateTime || event.end?.date,
                });
              });
            }
          } else {
            console.warn(`[Google Calendar] Could not check calendar ${calendarId}: ${eventsResponse.status}`);
          }
        } catch (calError) {
          console.error(`[Google Calendar] Error checking calendar ${calendarId}:`, calError);
        }
      }

      const isAvailable = conflictingEvents.length === 0;
      
      console.log(`[Google Calendar] ${roomName || 'Room'} availability: ${isAvailable ? 'AVAILABLE' : 'BUSY'} (${conflictingEvents.length} conflicts)`);

      return new Response(
        JSON.stringify({ 
          available: isAvailable,
          roomName,
          conflictingEvents: isAvailable ? [] : conflictingEvents,
          calendarsChecked: calendarIds.length,
          message: isAvailable 
            ? `${roomName || 'Room'} is available for the requested dates` 
            : `${roomName || 'Room'} has ${conflictingEvents.length} conflicting booking(s)`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create event
    if (action === 'create_event') {
      const accessToken = await getValidAccessToken(user.id);
      
      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: 'Not connected to Google Calendar', success: false }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { title, description, startTime, endTime, attendees } = params.event || params;

      // Normalize datetime to RFC3339 format (add Z if missing timezone)
      const normalizeDateTime = (dt: string): string => {
        if (!dt) return dt;
        // If already has timezone offset or Z, return as-is
        if (dt.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dt)) {
          return dt;
        }
        // Add Z for UTC
        return dt + 'Z';
      };

      const normalizedStart = normalizeDateTime(startTime);
      const normalizedEnd = normalizeDateTime(endTime);

      console.log('[Google Calendar] Creating event:', { title, startTime: normalizedStart, endTime: normalizedEnd });

      const eventBody = {
        summary: title,
        description,
        start: { dateTime: normalizedStart, timeZone: 'UTC' },
        end: { dateTime: normalizedEnd, timeZone: 'UTC' },
        attendees: attendees?.map((email: string) => ({ email })) || [],
      };

      const createResponse = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('[Google Calendar] Event creation error:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to create event', success: false }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const createdEvent = await createResponse.json();
      return new Response(
        JSON.stringify({ 
          success: true, 
          id: createdEvent.id,
          eventId: createdEvent.id,
          message: 'Event created successfully' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update event
    if (action === 'update_event') {
      const accessToken = await getValidAccessToken(user.id);
      
      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: 'Not connected to Google Calendar', success: false }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fields are sent as top-level params (hook spreads ...eventData directly)
      const { eventId, calendarId = 'primary', title, description, startTime, startDate, endTime, endDate } = params as {
        eventId?: string;
        calendarId?: string;
        title?: string;
        description?: string;
        startTime?: string;
        startDate?: string;
        endTime?: string;
        endDate?: string;
      };

      if (!eventId) {
        return new Response(
          JSON.stringify({ error: 'Event ID is required', success: false }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Normalize datetime to RFC3339 format
      const normalizeDateTime = (dt: string): string => {
        if (!dt) return dt;
        if (dt.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dt)) {
          return dt;
        }
        return dt + 'Z';
      };

      // Accept full ISO datetime in startTime/endTime, or fall back to startDate/endDate
      const resolvedStart = startTime || startDate;
      const resolvedEnd = endTime || endDate;

      const updateBody: Record<string, unknown> = {};
      if (title) updateBody.summary = title;
      if (description !== undefined) updateBody.description = description;
      if (resolvedStart) updateBody.start = { dateTime: normalizeDateTime(resolvedStart), timeZone: 'UTC' };
      if (resolvedEnd) updateBody.end = { dateTime: normalizeDateTime(resolvedEnd), timeZone: 'UTC' };

      console.log('[Google Calendar] Updating event:', eventId, updateBody);

      const updateResponse = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateBody),
        }
      );

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('[Google Calendar] Event update error:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to update event', success: false }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const updatedEvent = await updateResponse.json();
      return new Response(
        JSON.stringify({ success: true, id: updatedEvent.id, message: 'Event updated successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete event
    if (action === 'delete_event') {
      const accessToken = await getValidAccessToken(user.id);
      
      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: 'Not connected to Google Calendar', success: false }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { eventId, calendarId = 'primary' } = params;

      if (!eventId) {
        return new Response(
          JSON.stringify({ error: 'Event ID is required', success: false }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[Google Calendar] Deleting event:', eventId);

      const deleteResponse = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!deleteResponse.ok && deleteResponse.status !== 404) {
        const errorText = await deleteResponse.text();
        console.error('[Google Calendar] Event deletion error:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to delete event', success: false }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Event deleted successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Google Calendar] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
