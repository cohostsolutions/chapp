import { useEffect, useState } from 'react';
import { devError, devWarn, devLog } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, X, Loader2 } from 'lucide-react';
import { addDays, isBefore } from 'date-fns';
import { toast } from 'sonner';
import { getSupabaseFunctionAuthHeaders } from '@/lib/supabaseFunctionHeaders';

interface ExpiringToken {
  id: string;
  platform: string;
  display_name: string;
  organization_id: string;
  expires_at: Date;
  is_expired: boolean;
}

export function TokenExpiryAlert() {
  const { isSuperAdmin, effectiveIsClientAdmin, profile } = useAuth();
  const [expiringTokens, setExpiringTokens] = useState<ExpiringToken[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [reconnecting, setReconnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Only show to super admins and client admins
  const canManage = isSuperAdmin || effectiveIsClientAdmin;

  useEffect(() => {
    if (!canManage) {
      setIsLoading(false);
      return;
    }

    const checkTokens = async () => {
      try {
        const { data: platforms, error: platformsError } = await supabase
          .from('social_platforms')
          .select('id, platform, display_name, organization_id, credentials')
          .in('platform', ['instagram', 'whatsapp'])
          .eq('is_enabled', true);

        const { data: facebookPages, error: facebookPagesError } = await supabase
          .from('facebook_pages_safe')
          .select('id, organization_id, page_name, token_expires_at')
          .eq('is_enabled', true);

        if (platformsError) throw platformsError;
        if (facebookPagesError) throw facebookPagesError;

        const now = new Date();
        const sevenDaysFromNow = addDays(now, 7);
        const expiring: ExpiringToken[] = [];

        for (const p of platforms || []) {
          const credentials = p.credentials as { token_expires_at?: string } | null;
          if (!credentials?.token_expires_at) continue;

          const expiresAt = new Date(credentials.token_expires_at);
          const isExpired = isBefore(expiresAt, now);
          const isExpiringSoon = !isExpired && isBefore(expiresAt, sevenDaysFromNow);

          if (isExpired || isExpiringSoon) {
            expiring.push({
              id: p.id,
              platform: p.platform,
              display_name: p.display_name,
              organization_id: p.organization_id,
              expires_at: expiresAt,
              is_expired: isExpired,
            });
          }
        }

        for (const page of facebookPages || []) {
          if (!page.token_expires_at) continue;

          const expiresAt = new Date(page.token_expires_at);
          const isExpired = isBefore(expiresAt, now);
          const isExpiringSoon = !isExpired && isBefore(expiresAt, sevenDaysFromNow);

          if (isExpired || isExpiringSoon) {
            expiring.push({
              id: page.id,
              platform: 'facebook',
              display_name: page.page_name || 'Facebook Page',
              organization_id: page.organization_id,
              expires_at: expiresAt,
              is_expired: isExpired,
            });
          }
        }

        setExpiringTokens(expiring);
      } catch (error) {
        devError('Error checking token expiry:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkTokens();
    // Check every 5 minutes
    const interval = setInterval(checkTokens, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [canManage]);

  const handleReconnect = () => {
    setReconnecting(true);
    const FB_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID;

    devLog('[Meta Direct Login] Reconnect click', {
      hasConfiguredAppId: Boolean(FB_APP_ID),
      tokenCount: expiringTokens.length,
    });
    
    if (!FB_APP_ID) {
      toast.error('Facebook App ID not configured');
      setReconnecting(false);
      return;
    }

    try {
      const fbWindow = window as Window & {
        FB?: {
          login?: (
            callback: (response: { authResponse?: { accessToken: string } }) => void,
            options?: Record<string, unknown>
          ) => void;
        };
      };

      devLog('[Meta Direct Login] Reconnect SDK availability', {
        hasFBObject: Boolean(fbWindow.FB),
        hasLoginMethod: Boolean(fbWindow.FB?.login),
      });

      if (fbWindow.FB?.login) {
        fbWindow.FB.login(async (response) => {
          try {
            devLog('[Meta Direct Login] Reconnect FB.login response', {
              hasAuthResponse: Boolean(response?.authResponse),
            });

            const userAccessToken = response?.authResponse?.accessToken;
            if (!userAccessToken) {
              toast.error('Facebook login cancelled');
              return;
            }

            const { data, error } = await supabase.functions.invoke('facebook-connect', {
              body: { action: 'exchange_with_token', userAccessToken },
              headers: await getSupabaseFunctionAuthHeaders(),
            });

            if (error) {
              devError('facebook reconnect error', error);
              toast.error(error.message || 'Failed to reconnect Meta accounts');
              return;
            }

            const pagesCount = Number(data?.pages_count || 0);
            const instagramCount = Number(data?.instagram_accounts_count || 0);
            const whatsappCount = Number(data?.whatsapp_accounts_count || 0);
            const failures = Array.isArray(data?.failures) ? data.failures : [];
            const warnings = Array.isArray(data?.warnings) ? data.warnings : [];

            devLog('[Meta Direct Login] Reconnect sync result', {
              pagesCount,
              instagramCount,
              whatsappCount,
              warningCount: warnings.length,
              failureCount: failures.length,
            });

            if (pagesCount === 0 && instagramCount === 0 && whatsappCount === 0) {
              toast.error(failures[0] || warnings[0] || 'Login completed, but no Meta assets were saved.');
              return;
            }

            toast.success(`Imported ${pagesCount} Facebook page${pagesCount === 1 ? '' : 's'}, ${instagramCount} Instagram account${instagramCount === 1 ? '' : 's'}, ${whatsappCount} WhatsApp number${whatsappCount === 1 ? '' : 's'}`);
          } catch (error) {
            devError('Meta reconnect error:', error);
            toast.error('Failed to reconnect Meta accounts');
          } finally {
            setReconnecting(false);
          }
        }, {
          scope: 'pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging,instagram_basic,instagram_manage_messages,whatsapp_business_management,whatsapp_business_messaging',
          return_scopes: true,
        } as Record<string, unknown>);
        return;
      }

      const redirectUri = `${window.location.origin}/facebook-callback`;
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const state = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

      localStorage.setItem('fb_oauth_state', state);
      const scope = encodeURIComponent('pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging,instagram_basic,instagram_manage_messages,whatsapp_business_management,whatsapp_business_messaging');
      const oauthUrl = `https://www.facebook.com/v17.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`;
      devWarn('[Meta Direct Login] Reconnect SDK unavailable, falling back to redirect OAuth',
        redirectUri,
        { hasStoredState: true },
      );
      window.location.href = oauthUrl;
    } catch (err) {
      devError('Meta reconnect error:', err);
      toast.error('Failed to start reconnection');
      setReconnecting(false);
    }
  };

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set([...prev, id]));
  };

  const handleDismissAll = () => {
    setDismissed(new Set(expiringTokens.map(t => t.id)));
  };

  // Filter out dismissed tokens
  const visibleTokens = expiringTokens.filter(t => !dismissed.has(t.id));

  if (!canManage || isLoading || visibleTokens.length === 0) {
    return null;
  }

  const expiredCount = visibleTokens.filter(t => t.is_expired).length;
  const expiringSoonCount = visibleTokens.length - expiredCount;

  return (
    <Alert 
      variant="destructive" 
      className="mb-4 border-warning/50 bg-warning/10 text-foreground"
    >
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertTitle className="flex items-center justify-between">
        <span>Social Media Token{visibleTokens.length > 1 ? 's' : ''} Need Attention</span>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 w-6 p-0 hover:bg-transparent"
          onClick={handleDismissAll}
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {expiredCount > 0 && (
              <span className="text-destructive font-medium">{expiredCount} expired</span>
            )}
            {expiredCount > 0 && expiringSoonCount > 0 && ' and '}
            {expiringSoonCount > 0 && (
              <span className="text-warning font-medium">{expiringSoonCount} expiring soon</span>
            )}
            . Reconnect to continue receiving messages.
          </p>
          
          <div className="flex flex-wrap gap-2 mt-2">
            {visibleTokens.slice(0, 3).map(token => (
              <span 
                key={token.id} 
                className={`text-xs px-2 py-1 rounded ${
                  token.is_expired 
                    ? 'bg-destructive/20 text-destructive' 
                    : 'bg-warning/20 text-warning'
                }`}
              >
                {token.display_name}
              </span>
            ))}
            {visibleTokens.length > 3 && (
              <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                +{visibleTokens.length - 3} more
              </span>
            )}
          </div>

          <div className="flex gap-2 mt-3">
            <Button 
              size="sm" 
              onClick={handleReconnect}
              disabled={reconnecting}
              className="gap-2"
            >
              {reconnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Reconnect with Facebook
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
