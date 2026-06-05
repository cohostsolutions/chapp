import { useState, useEffect, useMemo, useCallback } from 'react';
import { Facebook, MessageCircle, Instagram, Trash2, RefreshCw, Copy, Zap, CheckCircle2, XCircle, Loader2, AlertTriangle, Building2, Search, X, Activity, Signal, ChevronDown, History, Clock3 } from 'lucide-react';
import { formatDistanceToNow, isPast, addDays, isBefore, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { devError, devWarn, devLog } from '@/lib/logger';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { archiveRecoverableRecordDeletion, confirmRecoverableDeletion, RECOVERY_WINDOW_HOURS } from '@/lib/recoverableDeletion';
import { getSupabaseFunctionAuthHeaders } from '@/lib/supabaseFunctionHeaders';

interface SocialPlatform {
  id: string;
  organization_id: string;
  platform: string;
  display_name: string;
  is_enabled: boolean;
  credentials: Record<string, unknown> | null;
  webhook_url: string | null;
  created_at: string;
  updated_at: string;
}

interface FacebookPage {
  id: string;
  organization_id: string;
  page_id: string;
  page_name: string | null;
  token_expires_at: string | null;
  is_enabled: boolean;
  connected_by?: string | null;
  created_at: string;
  updated_at: string | null;
}

interface MetaSyncSummary {
  pagesCount: number;
  instagramCount: number;
  whatsappCount: number;
  warnings: string[];
  failures: string[];
  status?: 'success' | 'partial' | 'incomplete' | 'error';
  message?: string;
  syncedAt?: string;
}

interface MetaDebugStep {
  id: string;
  timestamp: string;
  stage: string;
  status: 'info' | 'success' | 'error';
  detail: string;
}

interface MetaAssetStatus {
  key: 'facebook' | 'instagram' | 'whatsapp';
  label: string;
  count: number;
  connectedLabel: string;
  emptyLabel: string;
}

interface SocialIntegrationSyncRun {
  id: string;
  organization_id: string;
  provider: string;
  initiated_by: string | null;
  action: string;
  status: 'success' | 'partial' | 'incomplete' | 'error';
  pages_count: number;
  instagram_count: number;
  whatsapp_count: number;
  warnings: string[];
  failures: string[];
  message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor_label?: string;
}

interface SocialIntegrationEvent {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  provider: string;
  event_type: string;
  asset_type: string | null;
  asset_id: string | null;
  asset_name: string | null;
  status: 'info' | 'success' | 'warning' | 'error';
  details: Record<string, unknown> | null;
  created_at: string;
  actor_label?: string;
}

const META_SYNC_SUMMARY_KEY = 'meta_connect_last_result';
const META_DEBUG_TRAIL_KEY = 'meta_connect_debug_trail';

const platformConfigs = {
  facebook: {
    name: 'Facebook Messenger',
    icon: Facebook,
    color: 'bg-blue-500',
    description: 'Connect to Facebook Messenger to receive and respond to messages',
    fields: [
      { key: 'page_id', label: 'Page ID', type: 'text', placeholder: 'Your Facebook Page ID' },
      { key: 'access_token', label: 'Page Access Token', type: 'password', placeholder: 'Your Page Access Token' },
    ]
  },
  whatsapp: {
    name: 'WhatsApp Business',
    icon: MessageCircle,
    color: 'bg-green-500',
    description: 'Connect to WhatsApp Business API for messaging',
    fields: [
      { key: 'phone_number_id', label: 'Phone Number ID', type: 'text', placeholder: 'Your Phone Number ID' },
      { key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'Your WhatsApp Access Token' },
      { key: 'business_account_id', label: 'Business Account ID', type: 'text', placeholder: 'Your Business Account ID' },
    ]
  },
  instagram: {
    name: 'Instagram DMs',
    icon: Instagram,
    color: 'bg-gradient-to-br from-purple-500 to-pink-500',
    description: 'Connect to Instagram Direct Messages',
    fields: [
      { key: 'instagram_account_id', label: 'Instagram Account ID', type: 'text', placeholder: 'Your Instagram Account ID' },
      { key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'Your Instagram Access Token' },
    ]
  }
};

export function SocialPlatformsTab() {
  const { effectiveIsSuperAdmin, effectiveIsClientAdmin, profile, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [platforms, setPlatforms] = useState<SocialPlatform[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [fbLoading, setFbLoading] = useState(false);
  const [fbPages, setFbPages] = useState<FacebookPage[]>([]);
  const [refreshingAccounts, setRefreshingAccounts] = useState(false);
  const [bulkEnabling, setBulkEnabling] = useState(false);
  const [testingPlatformId, setTestingPlatformId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [filterOrganizationId, setFilterOrganizationId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastMetaSyncSummary, setLastMetaSyncSummary] = useState<MetaSyncSummary | null>(null);
  const [metaDebugTrail, setMetaDebugTrail] = useState<MetaDebugStep[]>([]);
  const [showMetaDebugDetails, setShowMetaDebugDetails] = useState(false);
  const [recentSyncRuns, setRecentSyncRuns] = useState<SocialIntegrationSyncRun[]>([]);
  const [recentEvents, setRecentEvents] = useState<SocialIntegrationEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const targetOrganizationId = useMemo(() => {
    if (effectiveIsSuperAdmin) {
      return filterOrganizationId !== 'all' ? filterOrganizationId : profile?.organization_id ?? null;
    }

    return profile?.organization_id ?? null;
  }, [effectiveIsSuperAdmin, filterOrganizationId, profile?.organization_id]);

  const orgNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    organizations.forEach(org => {
      map[org.id] = org.name;
    });
    return map;
  }, [organizations]);

  const canManage = effectiveIsSuperAdmin || effectiveIsClientAdmin;

  useEffect(() => {
    if (targetOrganizationId || isSuperAdmin) {
      fetchPlatforms();
    }
  }, [targetOrganizationId, isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchOrganizations();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(META_SYNC_SUMMARY_KEY);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as MetaSyncSummary;
      setLastMetaSyncSummary(parsed);
    } catch (error) {
      devWarn('Failed to read last Meta sync result', error);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(META_DEBUG_TRAIL_KEY);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as MetaDebugStep[];
      setMetaDebugTrail(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      devWarn('Failed to read Meta debug trail', error);
    }
  }, []);

  const persistMetaSyncSummary = useCallback((summary: MetaSyncSummary) => {
    const normalized = {
      ...summary,
      syncedAt: summary.syncedAt || new Date().toISOString(),
    };

    setLastMetaSyncSummary(normalized);
    try {
      sessionStorage.setItem(META_SYNC_SUMMARY_KEY, JSON.stringify(normalized));
    } catch (error) {
      devWarn('Failed to persist Meta sync result', error);
    }
  }, []);

  const clearMetaSyncSummary = useCallback(() => {
    setLastMetaSyncSummary(null);
    sessionStorage.removeItem(META_SYNC_SUMMARY_KEY);
  }, []);

  const appendMetaDebugStep = useCallback((step: Omit<MetaDebugStep, 'id' | 'timestamp'>) => {
    setMetaDebugTrail((previous) => {
      const next = [
        ...previous,
        {
          ...step,
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      ].slice(-20);

      sessionStorage.setItem(META_DEBUG_TRAIL_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearMetaDebugTrail = useCallback(() => {
    setMetaDebugTrail([]);
    sessionStorage.removeItem(META_DEBUG_TRAIL_KEY);
  }, []);

  useEffect(() => {
    if (lastMetaSyncSummary?.status === 'success') {
      clearMetaDebugTrail();
    }
  }, [clearMetaDebugTrail, lastMetaSyncSummary?.status]);

  const logSocialIntegrationEvent = useCallback(async (
    eventType: string,
    options?: {
      assetType?: string | null;
      assetId?: string | null;
      assetName?: string | null;
      status?: 'info' | 'success' | 'warning' | 'error';
      details?: Record<string, unknown>;
    },
  ) => {
    if (!targetOrganizationId || !canManage) {
      return;
    }

    const { error } = await supabase.rpc('log_social_integration_event', {
      p_organization_id: targetOrganizationId,
      p_event_type: eventType,
      p_provider: 'meta',
      p_asset_type: options?.assetType ?? null,
      p_asset_id: options?.assetId ?? null,
      p_asset_name: options?.assetName ?? null,
      p_status: options?.status ?? 'success',
      p_details: options?.details ?? {},
    });

    if (error) {
      devWarn('Failed to log social integration event', error);
    }
  }, [canManage, targetOrganizationId]);

  const fetchIntegrationHistory = useCallback(async () => {
    if (!targetOrganizationId) {
      setRecentSyncRuns([]);
      setRecentEvents([]);
      return;
    }

    setHistoryLoading(true);
    try {
      const [syncRunsResult, eventsResult] = await Promise.all([
        supabase
          .from('social_integration_sync_runs')
          .select('*')
          .eq('organization_id', targetOrganizationId)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('social_integration_events')
          .select('*')
          .eq('organization_id', targetOrganizationId)
          .order('created_at', { ascending: false })
          .limit(8),
      ]);

      if (syncRunsResult.error) {
        throw syncRunsResult.error;
      }

      if (eventsResult.error) {
        throw eventsResult.error;
      }

      const actorIds = Array.from(new Set([
        ...(syncRunsResult.data || []).map((run) => run.initiated_by).filter(Boolean),
        ...(eventsResult.data || []).map((event) => event.actor_user_id).filter(Boolean),
      ]));

      const actorMap = new Map<string, string>();
      if (actorIds.length > 0) {
        const { data: profilesSafe } = await supabase
          .from('profiles_safe')
          .select('id, email, full_name')
          .in('id', actorIds);

        (profilesSafe || []).forEach((profile) => {
          actorMap.set(profile.id, profile.full_name || profile.email || profile.id.slice(0, 8));
        });
      }

      setRecentSyncRuns(((syncRunsResult.data || []) as SocialIntegrationSyncRun[]).map((run) => ({
        ...run,
        warnings: Array.isArray(run.warnings) ? run.warnings : [],
        failures: Array.isArray(run.failures) ? run.failures : [],
        metadata: (run.metadata as Record<string, unknown> | null) || {},
        actor_label: run.initiated_by ? actorMap.get(run.initiated_by) || run.initiated_by.slice(0, 8) : 'System',
      })));

      setRecentEvents(((eventsResult.data || []) as SocialIntegrationEvent[]).map((event) => ({
        ...event,
        details: (event.details as Record<string, unknown> | null) || {},
        actor_label: event.actor_user_id ? actorMap.get(event.actor_user_id) || event.actor_user_id.slice(0, 8) : 'System',
      })));
    } catch (error) {
      devError('Failed to fetch social integration history', error);
      setRecentSyncRuns([]);
      setRecentEvents([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [targetOrganizationId]);

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('is_archived', false)
        .order('name');
      
      if (!error && data) {
        setOrganizations(data);
      }
    } catch (error) {
      devError('Failed to fetch organizations:', error);
    }
  };

  const stats = useMemo(() => {
    const allPlatforms = [...platforms];
    const total = allPlatforms.length + fbPages.length;
    const active = allPlatforms.filter(p => p.is_enabled).length + fbPages.filter((p) => (p as unknown as { is_enabled?: boolean }).is_enabled).length;
    const inactive = total - active;
    
    let expiring = 0;
    let expired = 0;
    
    allPlatforms.forEach(p => {
      const creds = p.credentials as Record<string, unknown> | null;
      const expiresAt = creds?.token_expires_at;
      if (typeof expiresAt === 'string') {
        const expiryDate = new Date(expiresAt);
        const now = new Date();
        const warningDate = addDays(now, 7);
        if (isPast(expiryDate)) {
          expired++;
        } else if (isBefore(expiryDate, warningDate)) {
          expiring++;
        }
      }
    });

    fbPages.forEach(p => {
      if (!p.token_expires_at) return;
      const expiryDate = new Date(p.token_expires_at);
      const now = new Date();
      const warningDate = addDays(now, 7);
      if (isPast(expiryDate)) {
        expired++;
      } else if (isBefore(expiryDate, warningDate)) {
        expiring++;
      }
    });

    return { total, active, inactive, expiring, expired };
  }, [platforms, fbPages]);

  const syncMetaAssetsWithUserToken = async (userAccessToken: string, successTitle: string) => {
    if (!targetOrganizationId) {
      appendMetaDebugStep({
        stage: 'sync-start',
        status: 'error',
        detail: 'Meta sync was attempted without an organization context.',
      });
      toast({
        title: 'Organization context missing',
        description: 'Select or load an organization before connecting Meta accounts.',
        variant: 'destructive',
      });
      return false;
    }

    devLog('[Meta Direct Login] Sync start', {
      flow: successTitle,
      hasUserToken: Boolean(userAccessToken),
      targetOrganizationId,
    });
    appendMetaDebugStep({
      stage: 'sync-start',
      status: 'info',
      detail: `Starting Meta asset sync for organization ${targetOrganizationId}.`,
    });

    const functionHeaders = await getSupabaseFunctionAuthHeaders();

    const { data: json, error } = await supabase.functions.invoke('facebook-connect', {
      body: {
        action: 'exchange_with_token',
        userAccessToken,
        organizationId: targetOrganizationId,
        syncAction: successTitle === 'Accounts refreshed' ? 'resync' : 'connect',
      },
      headers: functionHeaders,
    });

    if (error) {
      devError('facebook sync error', error);
      appendMetaDebugStep({
        stage: 'sync-response',
        status: 'error',
        detail: error.message || 'facebook-connect returned an error during token exchange.',
      });
      toast({ title: 'Meta connection failed', description: error.message || 'Unknown error', variant: 'destructive' });
      return false;
    }

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

    persistMetaSyncSummary({
      pagesCount,
      instagramCount,
      whatsappCount,
      warnings,
      failures,
      status: syncStatus,
      message: syncStatus === 'partial'
        ? 'Meta connected, but one or more assets need attention before the setup is complete.'
        : syncStatus === 'incomplete'
          ? 'Meta connected, but no importable assets were returned for this organization.'
          : undefined,
      syncedAt: new Date().toISOString(),
    });

    devLog('[Meta Direct Login] Sync result', {
      flow: successTitle,
      pagesCount,
      instagramCount,
      whatsappCount,
      warningCount: warnings.length,
      failureCount: failures.length,
    });
    appendMetaDebugStep({
      stage: 'sync-response',
      status: pagesCount === 0 && instagramCount === 0 && whatsappCount === 0 ? 'error' : 'success',
      detail: `Meta sync returned ${pagesCount} Facebook page(s), ${instagramCount} Instagram account(s), and ${whatsappCount} WhatsApp number(s).`,
    });

    if (pagesCount === 0 && instagramCount === 0 && whatsappCount === 0) {
      toast({
        title: 'Meta connection incomplete',
        description: failures[0] || warnings[0] || 'Login completed, but no Meta assets were saved.',
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: warnings.length > 0 || failures.length > 0 ? `${successTitle} with warnings` : successTitle,
      description: `${pagesCount} Facebook page${pagesCount === 1 ? '' : 's'}, ${instagramCount} Instagram account${instagramCount === 1 ? '' : 's'}, ${whatsappCount} WhatsApp number${whatsappCount === 1 ? '' : 's'} imported`,
    });

    if (warnings.length > 0) {
      toast({ title: 'Meta import warning', description: warnings[0] });
    }

    fetchPlatforms();
    return true;
  };

  const handleConnectFacebook = async () => {
    const FB_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID;

    clearMetaDebugTrail();
    appendMetaDebugStep({
      stage: 'connect-click',
      status: 'info',
      detail: 'Meta connect was initiated from the integrations tab.',
    });

    devLog('[Meta Direct Login] Connect click', {
      hasConfiguredAppId: Boolean(FB_APP_ID),
      pathname: window.location.pathname,
    });

    if (!FB_APP_ID) {
      appendMetaDebugStep({
        stage: 'connect-config',
        status: 'error',
        detail: 'VITE_FACEBOOK_APP_ID is not configured in the frontend environment.',
      });
      toast({
        title: 'Facebook App ID not configured',
        description: 'Set VITE_FACEBOOK_APP_ID before connecting Meta accounts.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const redirectUri = `${window.location.origin}/facebook-callback`;
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const state = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

      localStorage.setItem('fb_oauth_state', state);
      if (targetOrganizationId) {
        localStorage.setItem('fb_oauth_target_org', targetOrganizationId);
      } else {
        localStorage.removeItem('fb_oauth_target_org');
      }
      appendMetaDebugStep({
        stage: 'redirect-to-meta',
        status: 'info',
        detail: `Redirecting to Meta OAuth with callback ${redirectUri}.`,
      });
      const scope = encodeURIComponent('pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging,instagram_basic,instagram_manage_messages,whatsapp_business_management,whatsapp_business_messaging');
      const oauthUrl = `https://www.facebook.com/v17.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`;
      devLog('[Meta Direct Login] Redirecting to Meta OAuth', {
        redirectUri,
        hasStoredState: true,
      });
      window.location.assign(oauthUrl);
    } catch (err) {
      devError('Meta OAuth redirect error:', err);
      appendMetaDebugStep({
        stage: 'redirect-to-meta',
        status: 'error',
        detail: err instanceof Error ? err.message : 'Failed to initiate Meta OAuth redirect.',
      });
      toast({ title: 'Error', description: 'Failed to initiate Facebook OAuth', variant: 'destructive' });
    }
  };

  const handleRefreshAccounts = async () => {
    const fbWindow = window as Window & {
      FB?: {
        login?: (callback: (response: { authResponse?: { accessToken: string } } | null) => void) => void;
      };
    };
    devLog('[Meta Direct Login] Refresh click', {
      hasFBObject: Boolean(fbWindow.FB),
      hasLoginMethod: Boolean(fbWindow.FB?.login),
    });

    if (!fbWindow.FB) {
      toast({ title: 'Facebook SDK not loaded', description: 'Please try again in a moment', variant: 'destructive' });
      return;
    }

    setRefreshingAccounts(true);
    
    fbWindow.FB.login?.(async (response) => {
      devLog('[Meta Direct Login] Refresh FB.login response', {
        hasAuthResponse: Boolean(response?.authResponse),
      });

      const resp = response as { authResponse?: { accessToken: string } };
      if (!resp || !resp.authResponse) {
        setRefreshingAccounts(false);
        toast({ title: 'Facebook login cancelled', description: 'Please try again to refresh accounts', variant: 'destructive' });
        return;
      }

      const userAccessToken = resp.authResponse.accessToken;
      try {
        await syncMetaAssetsWithUserToken(userAccessToken, 'Accounts refreshed');
      } catch (err) {
        devError('Meta accounts refresh error:', err);
        toast({ title: 'Refresh failed', description: 'Network error', variant: 'destructive' });
      } finally {
        setRefreshingAccounts(false);
      }
    }, { scope: 'pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging,instagram_basic,instagram_manage_messages,whatsapp_business_management,whatsapp_business_messaging', return_scopes: true } as any);
  };

  const handleEnableImportedAssets = async () => {
    const disabledPages = fbPages.filter((page) => !page.is_enabled);
    const disabledPlatforms = platforms.filter((platform) => !platform.is_enabled);

    if (disabledPages.length === 0 && disabledPlatforms.length === 0) {
      return;
    }

    setBulkEnabling(true);
    try {
      const functionHeaders = await getSupabaseFunctionAuthHeaders();

      await Promise.all([
        ...disabledPages.map((page) =>
          supabase.functions.invoke('facebook-connect', {
            body: { action: 'set_enabled', page_id: page.page_id, enabled: true },
            headers: functionHeaders,
          }),
        ),
        ...disabledPlatforms.map((platform) =>
          supabase
            .from('social_platforms')
            .update({ is_enabled: true })
            .eq('id', platform.id),
        ),
      ]);

      toast({
        title: 'Imported assets enabled',
        description: `${disabledPages.length + disabledPlatforms.length} asset${disabledPages.length + disabledPlatforms.length === 1 ? '' : 's'} are now active.`,
      });

      await logSocialIntegrationEvent('bulk_enable_imported_assets', {
        details: {
          facebookPagesEnabled: disabledPages.length,
          platformAssetsEnabled: disabledPlatforms.length,
        },
      });

      await fetchPlatforms();
    } catch (error) {
      devError('Failed to enable imported assets', error);
      toast({
        title: 'Enable failed',
        description: 'One or more imported assets could not be enabled.',
        variant: 'destructive',
      });
    } finally {
      setBulkEnabling(false);
    }
  };

  const fetchFacebookPages = async () => {
    if (effectiveIsSuperAdmin && !targetOrganizationId) {
      return [] as FacebookPage[];
    }

    try {
      const facebookPagesSafeTable = 'facebook_pages_safe' as const;
      let directQuery = supabase
        .from(facebookPagesSafeTable)
        .select('*');

      if (targetOrganizationId) {
        directQuery = directQuery.eq('organization_id', targetOrganizationId);
      }

      const { data: directPages, error: directError } = await directQuery.order('created_at', { ascending: true });
      if (!directError && Array.isArray(directPages)) {
        return directPages as FacebookPage[];
      }

      if (directError) {
        devWarn('Direct facebook_pages_safe query failed, falling back to edge function list', directError);
      }
    } catch (error) {
      devWarn('Direct facebook_pages_safe query threw, falling back to edge function list', error);
    }

    const functionHeaders = await getSupabaseFunctionAuthHeaders();
    const query = targetOrganizationId ? `?action=list&organizationId=${encodeURIComponent(targetOrganizationId)}` : '?action=list';

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-connect${query}`, {
      headers: {
        'Content-Type': 'application/json',
        ...functionHeaders,
      },
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json?.error || 'Failed to fetch Facebook pages');
    }

    return (json?.pages || []) as FacebookPage[];
  };

  const fetchPlatforms = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('social_platforms')
        .select('*');

      if (targetOrganizationId) {
        query = query.eq('organization_id', targetOrganizationId);
      } else if (!isSuperAdmin && profile?.organization_id) {
        query = query.eq('organization_id', profile.organization_id);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) throw error;
      setPlatforms((data || []).map(d => ({
        ...d,
        credentials: (d.credentials as Record<string, unknown> | null) || {}
      })));

      try {
        const [pages] = await Promise.all([
          fetchFacebookPages(),
          fetchIntegrationHistory(),
        ]);
        setFbPages(pages);
      } catch (err) {
        devError('Failed to fetch Facebook pages:', err);
        setFbPages([]);
        toast({
          title: 'Error',
          description: 'Failed to fetch Facebook pages',
          variant: 'destructive',
        });
      }
    } catch (error) {
      devError('Failed to fetch platforms:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch social platforms',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleToggleFacebookPage = async (page: FacebookPage) => {
    try {
      const functionHeaders = await getSupabaseFunctionAuthHeaders();

      const { error } = await supabase.functions.invoke('facebook-connect', {
        body: { action: 'set_enabled', page_id: page.page_id, enabled: !page.is_enabled },
        headers: functionHeaders,
      });

      if (error) throw error;

      toast({
        title: page.is_enabled ? 'Page Disabled' : 'Page Enabled',
        description: `${page.page_name || 'Facebook Page'} has been ${page.is_enabled ? 'disabled' : 'enabled'}`,
      });

      await logSocialIntegrationEvent(page.is_enabled ? 'facebook_page_disabled' : 'facebook_page_enabled', {
        assetType: 'facebook_page',
        assetId: page.page_id,
        assetName: page.page_name || page.page_id,
        details: { enabled: !page.is_enabled },
      });

      fetchPlatforms();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to toggle Facebook page',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteFacebookPage = async (page: FacebookPage) => {
    if (!confirm(`Are you sure you want to disconnect ${page.page_name || 'this Facebook page'}?`)) return;

    try {
      const functionHeaders = await getSupabaseFunctionAuthHeaders();

      const { error } = await supabase.functions.invoke('facebook-connect', {
        body: { action: 'disconnect', page_id: page.page_id },
        headers: functionHeaders,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `${page.page_name || 'Facebook page'} has been disconnected`,
      });

      await logSocialIntegrationEvent('facebook_page_disconnected', {
        assetType: 'facebook_page',
        assetId: page.page_id,
        assetName: page.page_name || page.page_id,
      });

      fetchPlatforms();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to disconnect Facebook page',
        variant: 'destructive',
      });
    }
  };

  const handleCopyPageId = async (pageId: string) => {
    try {
      await navigator.clipboard.writeText(pageId);
      toast({ title: 'Copied', description: 'Facebook Page ID copied to clipboard' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to copy Page ID', variant: 'destructive' });
    }
  };

  const handleToggleEnabled = async (platform: SocialPlatform) => {
    try {
      const { error } = await supabase
        .from('social_platforms')
        .update({ is_enabled: !platform.is_enabled })
        .eq('id', platform.id);

      if (error) throw error;
      
      toast({
        title: platform.is_enabled ? 'Platform Disabled' : 'Platform Enabled',
        description: `${platform.display_name} has been ${platform.is_enabled ? 'disabled' : 'enabled'}`,
      });

      await logSocialIntegrationEvent(platform.is_enabled ? `${platform.platform}_asset_disabled` : `${platform.platform}_asset_enabled`, {
        assetType: platform.platform,
        assetId: platform.id,
        assetName: platform.display_name,
        details: { enabled: !platform.is_enabled },
      });
      
      fetchPlatforms();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to toggle platform',
        variant: 'destructive',
      });
    }
  };

  const handleDeletePlatform = async (platform: SocialPlatform) => {
    if (!confirm(`Disconnect ${platform.display_name}? It will remain recoverable in Deleted Items for ${RECOVERY_WINDOW_HOURS} hours before permanent removal.`)) return;

    try {
      await archiveRecoverableRecordDeletion('social_platforms', platform.id, platform.display_name);
      
      toast({
        title: 'Asset disconnected',
        description: `${platform.display_name} was removed and can be restored from Deleted Items for ${RECOVERY_WINDOW_HOURS} hours.`,
      });

      await logSocialIntegrationEvent(`${platform.platform}_asset_disconnected`, {
        assetType: platform.platform,
        assetId: platform.id,
        assetName: platform.display_name,
        status: 'warning',
        details: { recoveryWindowHours: RECOVERY_WINDOW_HOURS },
      });
      
      fetchPlatforms();
    } catch (error) {
      devError('Failed to remove social platform', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect this imported asset.',
        variant: 'destructive',
      });
    }
  };

  const handleTestConnection = async (platform: SocialPlatform) => {
    setTestingPlatformId(platform.id);
    try {
      const { data: json, error } = await supabase.functions.invoke('test-social-connection', {
        body: { platformId: platform.id },
      });

      if (error) {
        throw error;
      }
      
      if (json?.success) {
        await logSocialIntegrationEvent(`${platform.platform}_connection_tested`, {
          assetType: platform.platform,
          assetId: platform.id,
          assetName: platform.display_name,
          details: { outcome: 'success', message: json?.message || null },
        });
        toast({ 
          title: 'Connection Successful', 
          description: json?.message || `${platform.display_name} is connected and working.`
        });
      } else {
        await logSocialIntegrationEvent(`${platform.platform}_connection_tested`, {
          assetType: platform.platform,
          assetId: platform.id,
          assetName: platform.display_name,
          status: 'error',
          details: { outcome: 'failed', message: json?.error || json?.message || null },
        });
        toast({ 
          title: 'Connection Failed', 
          description: json?.error || json?.message || 'Unable to verify connection.',
          variant: 'destructive'
        });
      }
    } catch (err) {
      devError('Test connection error:', err);
      await logSocialIntegrationEvent(`${platform.platform}_connection_tested`, {
        assetType: platform.platform,
        assetId: platform.id,
        assetName: platform.display_name,
        status: 'error',
        details: { outcome: 'network_error' },
      });
      toast({ 
        title: 'Test Failed', 
        description: 'Network error while testing connection.',
        variant: 'destructive'
      });
    } finally {
      setTestingPlatformId(null);
    }
  };

  const filteredPlatforms = useMemo(() => {
    let result = platforms;
    
    if (isSuperAdmin && filterOrganizationId !== 'all') {
      result = result.filter(p => p.organization_id === filterOrganizationId);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.display_name.toLowerCase().includes(query) ||
        p.platform.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [platforms, filterOrganizationId, isSuperAdmin, searchQuery]);

  const filteredFacebookPages = useMemo(() => {
    let result = fbPages;

    if (isSuperAdmin && filterOrganizationId !== 'all') {
      result = result.filter(p => p.organization_id === filterOrganizationId);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        (p.page_name || '').toLowerCase().includes(query) ||
        p.page_id.toLowerCase().includes(query)
      );
    }

    return result;
  }, [fbPages, filterOrganizationId, isSuperAdmin, searchQuery]);

  const hasActiveFilters = searchQuery.trim() !== '' || (isSuperAdmin && filterOrganizationId !== 'all');
  const hasEmptyMetaImport = Boolean(
    lastMetaSyncSummary &&
      lastMetaSyncSummary.pagesCount === 0 &&
      lastMetaSyncSummary.instagramCount === 0 &&
      lastMetaSyncSummary.whatsappCount === 0
  );
  const hasImportedAssets = fbPages.length > 0 || platforms.length > 0;
  const hasVisibleAssets = filteredPlatforms.length > 0 || filteredFacebookPages.length > 0;
  const hasMetaDebugError = useMemo(
    () => metaDebugTrail.some((step) => step.status === 'error'),
    [metaDebugTrail],
  );
  const facebookAssets = filteredFacebookPages;
  const instagramAssets = filteredPlatforms.filter((platform) => platform.platform === 'instagram');
  const whatsappAssets = filteredPlatforms.filter((platform) => platform.platform === 'whatsapp');
  const disabledImportedAssetsCount = useMemo(
    () => fbPages.filter((page) => !page.is_enabled).length + platforms.filter((platform) => !platform.is_enabled).length,
    [fbPages, platforms],
  );
  const totalImportedAssets = fbPages.length + platforms.length;
  const lastMetaSyncStatusLabel = useMemo(() => {
    switch (lastMetaSyncSummary?.status) {
      case 'success':
        return 'Healthy';
      case 'partial':
        return 'Needs attention';
      case 'incomplete':
        return 'Incomplete';
      case 'error':
        return 'Failed';
      default:
        return hasImportedAssets ? 'Connected' : 'Not connected';
    }
  }, [hasImportedAssets, lastMetaSyncSummary?.status]);
  const lastMetaSyncStatusTone = useMemo(() => {
    switch (lastMetaSyncSummary?.status) {
      case 'success':
        return 'text-green-600 bg-green-500/10';
      case 'partial':
      case 'incomplete':
        return 'text-yellow-600 bg-yellow-500/10';
      case 'error':
        return 'text-destructive bg-destructive/10';
      default:
        return 'text-muted-foreground bg-muted';
    }
  }, [lastMetaSyncSummary?.status]);
  const lastMetaSyncRelative = useMemo(() => {
    if (!lastMetaSyncSummary?.syncedAt) {
      return 'No sync recorded yet';
    }

    return `Last synced ${formatDistanceToNow(new Date(lastMetaSyncSummary.syncedAt), { addSuffix: true })}`;
  }, [lastMetaSyncSummary?.syncedAt]);
  const shouldShowSyncAlert = Boolean(
    lastMetaSyncSummary &&
      (lastMetaSyncSummary.status === 'error' ||
        lastMetaSyncSummary.status === 'partial' ||
        lastMetaSyncSummary.status === 'incomplete' ||
        lastMetaSyncSummary.warnings.length > 0 ||
        lastMetaSyncSummary.failures.length > 0),
  );
  const connectPlatformLabel = hasImportedAssets ? 'Reconnect Platform' : 'Connect Platform';
  const metaConnectLabel = hasImportedAssets ? 'Reconnect Meta' : 'Connect Meta';
  const metaAssetStatuses: MetaAssetStatus[] = useMemo(() => {
    if (!lastMetaSyncSummary) {
      return [];
    }

    return [
      {
        key: 'facebook',
        label: 'Facebook Pages',
        count: lastMetaSyncSummary.pagesCount,
        connectedLabel: `${lastMetaSyncSummary.pagesCount} connected`,
        emptyLabel: 'No Pages returned',
      },
      {
        key: 'instagram',
        label: 'Instagram',
        count: lastMetaSyncSummary.instagramCount,
        connectedLabel: `${lastMetaSyncSummary.instagramCount} connected`,
        emptyLabel: 'No IG Business account returned',
      },
      {
        key: 'whatsapp',
        label: 'WhatsApp',
        count: lastMetaSyncSummary.whatsappCount,
        connectedLabel: `${lastMetaSyncSummary.whatsappCount} connected`,
        emptyLabel: 'No WhatsApp number returned',
      },
    ];
  }, [lastMetaSyncSummary]);
  
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setFilterOrganizationId('all');
  }, []);

  const getSyncStatusTone = (status: SocialIntegrationSyncRun['status']) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-500/10';
      case 'partial':
      case 'incomplete':
        return 'text-yellow-600 bg-yellow-500/10';
      case 'error':
        return 'text-destructive bg-destructive/10';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const getEventStatusTone = (status: SocialIntegrationEvent['status']) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-500/10';
      case 'warning':
        return 'text-yellow-600 bg-yellow-500/10';
      case 'error':
        return 'text-destructive bg-destructive/10';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const formatEventLabel = (value: string) => value
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

  const getPlatformBorderColor = (platform: SocialPlatform['platform']) => {
    switch (platform) {
      case 'instagram':
        return '#e1306c';
      case 'whatsapp':
        return '#25d366';
      case 'facebook':
      default:
        return '#3b82f6';
    }
  };

  const getImportedAssetHint = (platform: SocialPlatform['platform']) => {
    switch (platform) {
      case 'instagram':
        return 'Imported through the connected Facebook Page relationship.';
      case 'whatsapp':
        return 'Imported through the connected Meta business account.';
      default:
        return 'Imported through the connected Meta account.';
    }
  };

  const getTokenStatus = (expiresAt: string | null | undefined) => {
    if (!expiresAt) {
      return { status: 'unknown', label: 'Unknown', color: 'text-muted-foreground', bgColor: 'bg-muted' };
    }
    
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const warningDate = addDays(now, 7);
    
    if (isPast(expiryDate)) {
      return { 
        status: 'expired', 
        label: 'Expired', 
        color: 'text-destructive', 
        bgColor: 'bg-destructive/10',
        message: `Expired ${formatDistanceToNow(expiryDate, { addSuffix: true })}`
      };
    } else if (isBefore(expiryDate, warningDate)) {
      return { 
        status: 'expiring', 
        label: 'Expiring Soon', 
        color: 'text-yellow-600', 
        bgColor: 'bg-yellow-500/10',
        message: `Expires ${formatDistanceToNow(expiryDate, { addSuffix: true })}`
      };
    } else {
      return { 
        status: 'valid', 
        label: 'Valid', 
        color: 'text-green-600', 
        bgColor: 'bg-green-500/10',
        message: `Expires ${formatDistanceToNow(expiryDate, { addSuffix: true })}`
      };
    }
  };

  const PlatformCardSkeleton = () => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-6 w-10" />
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        <Skeleton className="h-8 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 w-10" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-2xl border border-border bg-card/40 p-5 sm:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-primary p-3 shadow-sm">
                <Signal className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground sm:text-2xl">Channels & Integrations</h2>
                <p className="max-w-2xl text-sm text-muted-foreground">Authorize Meta, import the assets you own, and enable the channels you want the app to operate.</p>
              </div>
            </div>
            </div>

            {shouldShowSyncAlert ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Latest Meta sync</AlertTitle>
              <AlertDescription className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p>
                    {lastMetaSyncSummary.message || `Imported ${lastMetaSyncSummary.pagesCount} Facebook page${lastMetaSyncSummary.pagesCount === 1 ? '' : 's'}, ${lastMetaSyncSummary.instagramCount} Instagram account${lastMetaSyncSummary.instagramCount === 1 ? '' : 's'}, and ${lastMetaSyncSummary.whatsappCount} WhatsApp number${lastMetaSyncSummary.whatsappCount === 1 ? '' : 's'}.`}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {metaAssetStatuses.map((asset) => (
                      <div key={asset.key} className="rounded-md border border-border bg-background/70 px-3 py-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          {asset.count > 0 ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                          {asset.label}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {asset.count > 0 ? asset.connectedLabel : asset.emptyLabel}
                        </p>
                      </div>
                    ))}
                  </div>
                  {lastMetaSyncSummary.failures[0] ? <p className="text-destructive">{lastMetaSyncSummary.failures[0]}</p> : null}
                  {!lastMetaSyncSummary.failures[0] && lastMetaSyncSummary.warnings[0] ? <p>{lastMetaSyncSummary.warnings[0]}</p> : null}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={clearMetaSyncSummary}>
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
            ) : null}

            {hasMetaDebugError ? (
            <Alert>
              <Activity className="h-4 w-4" />
              <AlertTitle>Meta debug trail</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>Technical details are available for the most recent failed Meta attempt.</p>
                <Collapsible open={showMetaDebugDetails} onOpenChange={setShowMetaDebugDetails}>
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="outline">Only shown on errors</Badge>
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="ghost" size="sm">
                        {showMetaDebugDetails ? 'Hide technical details' : 'Show technical details'}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent className="pt-3">
                    <div className="space-y-2">
                      {metaDebugTrail.map((step) => (
                        <div key={step.id} className="flex items-start justify-between gap-3 rounded-md border border-border bg-background/70 px-3 py-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={step.status === 'error' ? 'destructive' : step.status === 'success' ? 'default' : 'outline'}>
                                {step.stage}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{new Date(step.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="text-sm text-foreground">{step.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={clearMetaDebugTrail}>
                    Clear debug trail
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
              <Card className="border-border/80 bg-background/60 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Facebook className="h-4 w-4 text-primary" />
                    Meta Platform
                  </CardTitle>
                  <CardDescription>
                    Authorize Meta once, import pages and accounts, then enable the channels this organization should actively use.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={lastMetaSyncStatusTone} variant="outline">
                      {lastMetaSyncStatusLabel}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{lastMetaSyncRelative}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {metaAssetStatuses.length > 0 ? metaAssetStatuses.map((asset) => (
                      <div key={asset.key} className="rounded-lg border border-border bg-card/40 px-3 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{asset.label}</p>
                        <p className="mt-1 text-xl font-semibold text-foreground">{asset.count}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {asset.count > 0 ? asset.connectedLabel : asset.emptyLabel}
                        </p>
                      </div>
                    )) : (
                      <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground sm:col-span-3">
                        No Meta assets imported yet.
                      </div>
                    )}
                  </div>
                  {canManage ? (
                    <div className="flex flex-wrap gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" className="gap-2" disabled={fbLoading}>
                            {metaConnectLabel}
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-72">
                          <DropdownMenuItem onClick={() => void handleConnectFacebook()} className="flex items-start gap-3 py-3">
                            <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
                              <Facebook className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium">{metaConnectLabel}</span>
                              <span className="text-xs text-muted-foreground">Authorize Meta and import Facebook, Instagram, and WhatsApp assets.</span>
                            </div>
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled className="flex items-start gap-3 py-3 opacity-50">
                            <div className="mt-0.5 rounded-md bg-muted p-2 text-muted-foreground">
                              <Signal className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium">TikTok</span>
                              <span className="text-xs text-muted-foreground">Coming Soon</span>
                            </div>
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled className="flex items-start gap-3 py-3 opacity-50">
                            <div className="mt-0.5 rounded-md bg-muted p-2 text-muted-foreground">
                              <MessageCircle className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium">Viber</span>
                              <span className="text-xs text-muted-foreground">Coming Soon</span>
                            </div>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshAccounts}
                        disabled={refreshingAccounts || !hasImportedAssets}
                      >
                        <RefreshCw className={`mr-2 h-4 w-4 ${refreshingAccounts ? 'animate-spin' : ''}`} />
                        Resync Assets
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchPlatforms()}
                        disabled={isLoading}
                      >
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh View
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="border-border/80 bg-background/60 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Imported Assets</CardTitle>
                  <CardDescription>Track what Meta returned and what still needs to be activated.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-border bg-card/40 px-3 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Imported</p>
                      <p className="mt-1 text-2xl font-semibold text-foreground">{totalImportedAssets}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card/40 px-3 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Inactive</p>
                      <p className="mt-1 text-2xl font-semibold text-foreground">{disabledImportedAssetsCount}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Facebook Pages: {fbPages.length}</p>
                    <p>Instagram accounts: {platforms.filter((platform) => platform.platform === 'instagram').length}</p>
                    <p>WhatsApp numbers: {platforms.filter((platform) => platform.platform === 'whatsapp').length}</p>
                  </div>
                  {canManage && disabledImportedAssetsCount > 0 ? (
                    <Button variant="outline" size="sm" onClick={handleEnableImportedAssets} disabled={bulkEnabling}>
                      {bulkEnabling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      Enable Imported Assets
                    </Button>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="border-border/80 bg-background/60 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Connection Health</CardTitle>
                  <CardDescription>Operational status for active assets and tokens.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-border bg-card/40 px-3 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Active</p>
                      <p className="mt-1 text-xl font-semibold text-green-600">{stats.active}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card/40 px-3 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Expiring</p>
                      <p className="mt-1 text-xl font-semibold text-yellow-600">{stats.expiring}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card/40 px-3 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Expired</p>
                      <p className="mt-1 text-xl font-semibold text-destructive">{stats.expired}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-card/40 px-3 py-3 text-sm">
                    <p className="font-medium text-foreground">Latest status</p>
                    <p className="mt-1 text-muted-foreground">{lastMetaSyncRelative}</p>
                    {lastMetaSyncSummary?.message ? <p className="mt-2 text-muted-foreground">{lastMetaSyncSummary.message}</p> : null}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Platforms List */}
        {isInitialLoad ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <PlatformCardSkeleton />
            <PlatformCardSkeleton />
            <PlatformCardSkeleton />
          </div>
        ) : !hasVisibleAssets ? (
          <Card className="border-dashed bg-card/30">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Facebook className="h-10 w-10 text-primary" />
              </div>
              <h3 className="font-semibold text-2xl mb-2">
                {hasEmptyMetaImport ? 'Meta Connected, But No Assets Are Available Yet' : 'Connect Your Messaging Channels'}
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                {hasActiveFilters 
                  ? 'No platforms match your current filters.'
                  : hasEmptyMetaImport
                    ? 'Your Meta login completed, but this login did not return any Facebook Pages, Instagram Business accounts, or WhatsApp numbers that can be connected here.'
                    : 'Authorize Meta to import Facebook Pages, Instagram accounts, and WhatsApp numbers for this organization.'}
              </p>
              {!hasActiveFilters && hasEmptyMetaImport ? (
                <div className="mb-6 max-w-xl rounded-lg border border-border bg-muted/30 px-4 py-3 text-left text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">What to check</p>
                  <div className="mt-2 space-y-2">
                    <div>
                      <p className="font-medium text-foreground">Facebook</p>
                      <p>Make sure the Meta user you logged in with has access to at least one Facebook Page.</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Instagram</p>
                      <p>Instagram only appears when it is linked as an Instagram Business account to one of those Facebook Pages.</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">WhatsApp</p>
                      <p>WhatsApp only appears when the Meta Business has a visible WhatsApp Business account and phone number.</p>
                    </div>
                  </div>
                  {lastMetaSyncSummary?.failures[0] ? <p className="mt-2 text-destructive">{lastMetaSyncSummary.failures[0]}</p> : null}
                  {!lastMetaSyncSummary?.failures[0] && lastMetaSyncSummary?.warnings[0] ? <p className="mt-2">{lastMetaSyncSummary.warnings[0]}</p> : null}
                </div>
              ) : null}
              {hasActiveFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear filters
                </Button>
              ) : canManage && (
                <Button onClick={() => void handleConnectFacebook()} disabled={fbLoading}>
                  {fbLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Facebook className="mr-2 h-4 w-4" />}
                  {metaConnectLabel}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-2xl border border-border bg-card/30 p-5 sm:p-6">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold">Connected Assets</h3>
                <p className="text-sm text-muted-foreground">Enable, test, and disconnect the Facebook, Instagram, and WhatsApp assets linked through Meta.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search pages or accounts"
                    className="pl-9"
                  />
                </div>
                {isSuperAdmin ? (
                  <Select value={filterOrganizationId} onValueChange={setFilterOrganizationId}>
                    <SelectTrigger className="w-full sm:w-56">
                      <SelectValue placeholder="All organizations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All organizations</SelectItem>
                      {organizations.map((organization) => (
                        <SelectItem key={organization.id} value={organization.id}>{organization.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                {hasActiveFilters ? (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-foreground">Facebook Pages</h4>
                    <p className="text-sm text-muted-foreground">Pages imported from the connected Meta account.</p>
                  </div>
                  <Badge variant="outline">{facebookAssets.length}</Badge>
                </div>
                {facebookAssets.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {facebookAssets.map((page) => {
                const tokenStatus = getTokenStatus(page.token_expires_at);
                return (
                  <Card key={`fb-${page.page_id}`} className={`border-l-4 bg-background/60 shadow-sm ${!page.is_enabled ? 'opacity-60' : ''}`} style={{ borderLeftColor: '#3b82f6' }}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Facebook className="h-4 w-4" />
                            {page.page_name || `Facebook Page ${page.page_id}`}
                          </CardTitle>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant={page.is_enabled ? 'default' : 'secondary'}>
                              {page.is_enabled ? 'Active' : 'Inactive'}
                            </Badge>
                            {isSuperAdmin && orgNameMap[page.organization_id] && (
                              <Badge variant="outline" className="gap-1 text-xs">
                                <Building2 className="w-3 h-3" />
                                {orgNameMap[page.organization_id]}
                              </Badge>
                            )}
                            <Badge variant="outline" className={`${tokenStatus.color} ${tokenStatus.bgColor} border-0`}>
                              {tokenStatus.message || tokenStatus.label}
                            </Badge>
                          </div>
                        </div>
                        {canManage && (
                          <Switch
                            checked={page.is_enabled}
                            onCheckedChange={() => handleToggleFacebookPage(page)}
                          />
                        )}
                      </div>
                    </CardHeader>
                    {canManage && (
                      <CardContent className="pt-0 space-y-2">
                        <p className="text-xs text-muted-foreground">Page ID: {page.page_id}</p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleCopyPageId(page.page_id)}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy ID
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteFacebookPage(page)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Disconnect
                          </Button>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                    No Facebook Pages match the current view.
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-foreground">Instagram Accounts</h4>
                    <p className="text-sm text-muted-foreground">Business accounts linked through imported Facebook Pages.</p>
                  </div>
                  <Badge variant="outline">{instagramAssets.length}</Badge>
                </div>
                {instagramAssets.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {instagramAssets.map((platform) => {
              const config = platformConfigs[platform.platform as keyof typeof platformConfigs];
              if (!config) return null;
              const Icon = config.icon;
              const tokenStatus = getTokenStatus((platform.credentials as any)?.token_expires_at as any);
              
              return (
                <Card key={platform.id} className={`border-l-4 bg-background/60 shadow-sm ${!platform.is_enabled ? 'opacity-60' : ''}`} style={{ borderLeftColor: getPlatformBorderColor(platform.platform) }}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {platform.display_name}
                        </CardTitle>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={platform.is_enabled ? 'default' : 'secondary'}>
                            {platform.is_enabled ? 'Active' : 'Inactive'}
                          </Badge>
                          {isSuperAdmin && orgNameMap[platform.organization_id] && (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <Building2 className="w-3 h-3" />
                              {orgNameMap[platform.organization_id]}
                            </Badge>
                          )}
                          <Badge variant="outline" className={`${tokenStatus.color} ${tokenStatus.bgColor} border-0`}>
                            {tokenStatus.message || tokenStatus.label}
                          </Badge>
                        </div>
                      </div>
                      {canManage && (
                        <Switch
                          checked={platform.is_enabled}
                          onCheckedChange={() => handleToggleEnabled(platform)}
                        />
                      )}
                    </div>
                  </CardHeader>
                  {canManage && (
                    <CardContent className="pt-0 space-y-3">
                      <p className="text-xs text-muted-foreground">{getImportedAssetHint(platform.platform)}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={() => handleTestConnection(platform)}
                          disabled={testingPlatformId === platform.id}
                        >
                          {testingPlatformId === platform.id ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4 mr-1" />
                          )}
                          {testingPlatformId === platform.id ? 'Testing...' : 'Test Connection'}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="w-full text-destructive hover:text-destructive"
                          onClick={() => handleDeletePlatform(platform)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Disconnect
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                    No Instagram accounts match the current view.
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-foreground">WhatsApp Numbers</h4>
                    <p className="text-sm text-muted-foreground">WhatsApp Business numbers discovered from the connected Meta business.</p>
                  </div>
                  <Badge variant="outline">{whatsappAssets.length}</Badge>
                </div>
                {whatsappAssets.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {whatsappAssets.map((platform) => {
              const config = platformConfigs[platform.platform as keyof typeof platformConfigs];
              if (!config) return null;
              const Icon = config.icon;
              const tokenStatus = getTokenStatus((platform.credentials as any)?.token_expires_at as any);
              
              return (
                <Card key={platform.id} className={`border-l-4 bg-background/60 shadow-sm ${!platform.is_enabled ? 'opacity-60' : ''}`} style={{ borderLeftColor: getPlatformBorderColor(platform.platform) }}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {platform.display_name}
                        </CardTitle>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={platform.is_enabled ? 'default' : 'secondary'}>
                            {platform.is_enabled ? 'Active' : 'Inactive'}
                          </Badge>
                          {isSuperAdmin && orgNameMap[platform.organization_id] && (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <Building2 className="w-3 h-3" />
                              {orgNameMap[platform.organization_id]}
                            </Badge>
                          )}
                          <Badge variant="outline" className={`${tokenStatus.color} ${tokenStatus.bgColor} border-0`}>
                            {tokenStatus.message || tokenStatus.label}
                          </Badge>
                        </div>
                      </div>
                      {canManage && (
                        <Switch
                          checked={platform.is_enabled}
                          onCheckedChange={() => handleToggleEnabled(platform)}
                        />
                      )}
                    </div>
                  </CardHeader>
                  {canManage && (
                    <CardContent className="pt-0 space-y-3">
                      <p className="text-xs text-muted-foreground">{getImportedAssetHint(platform.platform)}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={() => handleTestConnection(platform)}
                          disabled={testingPlatformId === platform.id}
                        >
                          {testingPlatformId === platform.id ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4 mr-1" />
                          )}
                          {testingPlatformId === platform.id ? 'Testing...' : 'Test Connection'}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="w-full text-destructive hover:text-destructive"
                          onClick={() => handleDeletePlatform(platform)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Disconnect
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                    No WhatsApp numbers match the current view.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {canManage && targetOrganizationId ? (
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="border-border/80 bg-background/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4 text-primary" />
                  Sync History
                </CardTitle>
                <CardDescription>Recent Meta import and resync runs stored for this organization.</CardDescription>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : recentSyncRuns.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                    No persisted Meta sync runs yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentSyncRuns.map((run) => (
                      <div key={run.id} className="rounded-lg border border-border bg-card/40 px-4 py-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={getSyncStatusTone(run.status)}>
                                {formatEventLabel(run.status)}
                              </Badge>
                              <Badge variant="outline">{formatEventLabel(run.action)}</Badge>
                              <span className="text-xs text-muted-foreground">{run.actor_label || 'System'}</span>
                            </div>
                            <p className="text-sm text-foreground">
                              {run.message || `${run.pages_count} Facebook Pages, ${run.instagram_count} Instagram accounts, ${run.whatsapp_count} WhatsApp numbers processed.`}
                            </p>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>Facebook: {run.pages_count}</span>
                              <span>Instagram: {run.instagram_count}</span>
                              <span>WhatsApp: {run.whatsapp_count}</span>
                              {run.failures.length > 0 ? <span>Failures: {run.failures.length}</span> : null}
                              {run.warnings.length > 0 ? <span>Warnings: {run.warnings.length}</span> : null}
                            </div>
                            {run.failures[0] ? <p className="text-xs text-destructive">{run.failures[0]}</p> : null}
                            {!run.failures[0] && run.warnings[0] ? <p className="text-xs text-muted-foreground">{run.warnings[0]}</p> : null}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-background/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-primary" />
                  Activity Log
                </CardTitle>
                <CardDescription>Recent enable, disconnect, reconnect, and test actions for social assets.</CardDescription>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : recentEvents.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                    No persistent integration events yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentEvents.map((event) => (
                      <div key={event.id} className="rounded-lg border border-border bg-card/40 px-4 py-3">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={getEventStatusTone(event.status)}>
                              {formatEventLabel(event.status)}
                            </Badge>
                            <span className="text-sm font-medium text-foreground">{formatEventLabel(event.event_type)}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span>{event.asset_name || event.asset_id || 'Organization scope'}</span>
                            <span> · {event.actor_label || 'System'}</span>
                            <span> · {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}</span>
                          </div>
                          {typeof event.details?.message === 'string' && event.details.message ? (
                            <p className="text-xs text-muted-foreground">{event.details.message}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
