import { useEffect } from 'react';
import { devError, devLog } from '@/lib/logger';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseFunctionAuthHeaders } from '@/lib/supabaseFunctionHeaders';

const META_SYNC_SUMMARY_KEY = 'meta_connect_last_result';
const META_DEBUG_TRAIL_KEY = 'meta_connect_debug_trail';

type MetaSyncSummary = {
  pagesCount: number;
  instagramCount: number;
  whatsappCount: number;
  failures: string[];
  warnings: string[];
  status?: 'success' | 'partial' | 'incomplete' | 'error';
  message?: string;
  syncedAt?: string;
};

type MetaDebugStep = {
  id: string;
  timestamp: string;
  stage: string;
  status: 'info' | 'success' | 'error';
  detail: string;
};

export default function FacebookCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const persistMetaSyncSummary = (summary: MetaSyncSummary) => {
        sessionStorage.setItem(META_SYNC_SUMMARY_KEY, JSON.stringify({
          ...summary,
          syncedAt: summary.syncedAt || new Date().toISOString(),
        }));
      };

      const appendMetaDebugStep = (step: Omit<MetaDebugStep, 'id' | 'timestamp'>) => {
        const existing = (() => {
          try {
            const stored = sessionStorage.getItem(META_DEBUG_TRAIL_KEY);
            return stored ? (JSON.parse(stored) as MetaDebugStep[]) : [];
          } catch {
            return [] as MetaDebugStep[];
          }
        })();

        const next = [
          ...existing,
          {
            ...step,
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
        ].slice(-20);

        sessionStorage.setItem(META_DEBUG_TRAIL_KEY, JSON.stringify(next));
      };

      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const errorReason = searchParams.get('error_reason');
      const errorDescription = searchParams.get('error_description');
      const receivedState = searchParams.get('state');
      const storedState = localStorage.getItem('fb_oauth_state');
      const storedOrganizationId = localStorage.getItem('fb_oauth_target_org');
      const redirectUri = `${window.location.origin}/facebook-callback`;

      devLog('[Meta Redirect OAuth] Callback start', {
        hasCode: Boolean(code),
        hasError: Boolean(error),
        hasReceivedState: Boolean(receivedState),
        hasStoredState: Boolean(storedState),
        pathname: window.location.pathname,
      });
      appendMetaDebugStep({
        stage: 'callback-start',
        status: 'info',
        detail: 'The Meta callback route was reached in the app.',
      });

      if (error) {
        devError('[Meta Redirect OAuth] Meta returned callback error', {
          error,
          errorReason,
          errorDescription,
        });
        localStorage.removeItem('fb_oauth_state');
        localStorage.removeItem('fb_oauth_target_org');
        persistMetaSyncSummary({
          pagesCount: 0,
          instagramCount: 0,
          whatsappCount: 0,
          failures: [errorDescription || errorReason || error],
          warnings: [],
          status: 'error',
          message: 'Meta returned an authorization error before any accounts could be imported.',
          syncedAt: new Date().toISOString(),
        });
        appendMetaDebugStep({
          stage: 'callback-error',
          status: 'error',
          detail: errorDescription || errorReason || error,
        });
        toast({
          title: 'Facebook connect failed',
          description: errorDescription || errorReason || error,
          variant: 'destructive',
        });
        navigate('/settings?tab=integrations');
        return;
      }

      // Validate state parameter to prevent CSRF attacks
      if (!receivedState || receivedState !== storedState) {
        devError('[Meta Redirect OAuth] State validation failed', {
          hasReceivedState: Boolean(receivedState),
          hasStoredState: Boolean(storedState),
          statesMatch: Boolean(receivedState && storedState && receivedState === storedState),
        });
        toast({ title: 'Security Error', description: 'Invalid OAuth state parameter', variant: 'destructive' });
        localStorage.removeItem('fb_oauth_state');
        localStorage.removeItem('fb_oauth_target_org');
        persistMetaSyncSummary({
          pagesCount: 0,
          instagramCount: 0,
          whatsappCount: 0,
          failures: ['Invalid OAuth state parameter'],
          warnings: [],
          status: 'error',
          message: 'The Meta callback returned with an invalid or missing security state.',
          syncedAt: new Date().toISOString(),
        });
        appendMetaDebugStep({
          stage: 'state-validation',
          status: 'error',
          detail: 'The Meta callback state did not match the stored OAuth state.',
        });
        navigate('/settings?tab=integrations');
        return;
      }

      // Clear state after successful validation
      localStorage.removeItem('fb_oauth_state');

      devLog('[Meta Redirect OAuth] State validation passed');
      appendMetaDebugStep({
        stage: 'state-validation',
        status: 'success',
        detail: 'The Meta callback state matched the stored OAuth state.',
      });

      if (!code) {
        devError('[Meta Redirect OAuth] Missing code in callback');
        persistMetaSyncSummary({
          pagesCount: 0,
          instagramCount: 0,
          whatsappCount: 0,
          failures: ['Missing code in callback'],
          warnings: [],
          status: 'error',
          message: 'Meta redirected back without an authorization code, so no accounts could be imported.',
          syncedAt: new Date().toISOString(),
        });
        appendMetaDebugStep({
          stage: 'callback-code',
          status: 'error',
          detail: 'Meta redirected back without an authorization code.',
        });
        toast({ title: 'Facebook connect failed', description: 'Missing code in callback', variant: 'destructive' });
        navigate('/settings?tab=integrations');
        return;
      }

      try {
        const sessionRes = await supabase.auth.getSession();
        const accessToken = sessionRes.data.session?.access_token;

        devLog('[Meta Redirect OAuth] Exchanging callback code', {
          hasSupabaseSession: Boolean(accessToken),
          redirectUri,
        });
        appendMetaDebugStep({
          stage: 'session-check',
          status: accessToken ? 'success' : 'error',
          detail: accessToken
            ? 'An active Supabase session was present for the Meta callback exchange.'
            : 'No active Supabase session was present for the Meta callback exchange.',
        });

        if (!accessToken) {
          devError('[Meta Redirect OAuth] Missing Supabase session during callback exchange');
          persistMetaSyncSummary({
            pagesCount: 0,
            instagramCount: 0,
            whatsappCount: 0,
            failures: ['You need an active session before completing the Meta callback.'],
            warnings: [],
            status: 'error',
            message: 'The Meta callback returned, but your app session was missing before the import could finish.',
            syncedAt: new Date().toISOString(),
          });
          toast({
            title: 'Facebook connect failed',
            description: 'You need an active session before completing the Meta callback.',
            variant: 'destructive',
          });
          navigate('/settings?tab=integrations');
          return;
        }

        const functionHeaders = await getSupabaseFunctionAuthHeaders();

        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...functionHeaders,
          },
          body: JSON.stringify({ action: 'exchange', code, redirectUri, state: receivedState, organizationId: storedOrganizationId }),
        });
        appendMetaDebugStep({
          stage: 'exchange-request',
          status: 'info',
          detail: 'The Meta callback code was sent to facebook-connect for exchange.',
        });

        const json = await res.json();
        if (!res.ok) {
          devError('facebook exchange error', json);
          const errorDetail = [json?.error, json?.details].filter(Boolean).join(': ') || `HTTP ${res.status}`;

          persistMetaSyncSummary({
            pagesCount: 0,
            instagramCount: 0,
            whatsappCount: 0,
            failures: [errorDetail],
            warnings: [],
            status: 'error',
            message: 'Meta authorization completed, but the app failed while exchanging the callback for importable assets.',
            syncedAt: new Date().toISOString(),
          });
          appendMetaDebugStep({
            stage: 'exchange-response',
            status: 'error',
            detail: `${errorDetail} during callback exchange.`,
          });
          toast({ title: 'Facebook connect failed', description: errorDetail, variant: 'destructive' });
        } else {
          const pagesCount = Number(json?.pages_count || 0);
          const instagramCount = Number(json?.instagram_accounts_count || 0);
          const whatsappCount = Number(json?.whatsapp_accounts_count || 0);
          const failures = Array.isArray(json?.failures) ? json.failures : [];
          const warnings = Array.isArray(json?.warnings) ? json.warnings : [];

          const syncStatus = pagesCount === 0 && instagramCount === 0 && whatsappCount === 0
            ? 'incomplete'
            : warnings.length > 0 || failures.length > 0
              ? 'partial'
              : 'success';

          sessionStorage.setItem(META_SYNC_SUMMARY_KEY, JSON.stringify({
            pagesCount,
            instagramCount,
            whatsappCount,
            failures,
            warnings,
            status: syncStatus,
            message: pagesCount === 0 && instagramCount === 0 && whatsappCount === 0
              ? 'Meta authorization completed, but this login did not return any importable Facebook, Instagram, or WhatsApp assets.'
              : syncStatus === 'partial'
                ? 'Meta connected, but one or more assets need attention before the setup is complete.'
              : undefined,
            syncedAt: new Date().toISOString(),
          }));

          devLog('[Meta Redirect OAuth] Exchange result', {
            pagesCount,
            instagramCount,
            whatsappCount,
            warningCount: warnings.length,
            failureCount: failures.length,
          });
          appendMetaDebugStep({
            stage: 'exchange-response',
            status: pagesCount === 0 && instagramCount === 0 && whatsappCount === 0 ? 'error' : 'success',
            detail: `facebook-connect returned ${pagesCount} Facebook page(s), ${instagramCount} Instagram account(s), and ${whatsappCount} WhatsApp number(s).`,
          });

          if (pagesCount === 0 && instagramCount === 0 && whatsappCount === 0) {
            toast({
              title: 'Facebook connection incomplete',
              description: failures[0] || warnings[0] || 'OAuth completed, but no Meta assets were saved.',
              variant: 'destructive',
            });
          } else {
            const description = `${pagesCount} Facebook page${pagesCount === 1 ? '' : 's'}, ${instagramCount} Instagram account${instagramCount === 1 ? '' : 's'}, ${whatsappCount} WhatsApp number${whatsappCount === 1 ? '' : 's'} imported`;
            toast({
              title: warnings.length > 0 || failures.length > 0 ? 'Facebook connected with warnings' : 'Facebook connected',
              description,
            });

            if (warnings.length > 0) {
              toast({
                title: 'Meta import warning',
                description: warnings[0],
              });
            }
          }
        }
      } catch (err) {
        devError('FacebookCallback error:', err);
        persistMetaSyncSummary({
          pagesCount: 0,
          instagramCount: 0,
          whatsappCount: 0,
          failures: ['Network error'],
          warnings: [],
          status: 'error',
          message: 'The Meta callback returned, but the app hit a network error before the import result could be completed.',
          syncedAt: new Date().toISOString(),
        });
        appendMetaDebugStep({
          stage: 'exchange-response',
          status: 'error',
          detail: err instanceof Error ? err.message : 'A network error occurred during the Meta callback exchange.',
        });
        toast({ title: 'Facebook connect failed', description: 'Network error', variant: 'destructive' });
      } finally {
        localStorage.removeItem('fb_oauth_target_org');
        navigate('/settings?tab=integrations');
      }
    })();
  }, []);  

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold">Connecting to Facebook...</h2>
      <p className="text-sm text-muted-foreground mt-2">Please wait while we finalize the connection and import pages.</p>
    </div>
  );
}
