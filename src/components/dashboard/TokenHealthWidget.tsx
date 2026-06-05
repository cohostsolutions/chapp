import { useEffect, useState } from 'react';
import { devError } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Link2, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Loader2,
  Facebook,
  Instagram,
  MessageCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, addDays, isBefore } from 'date-fns';
import { toast } from 'sonner';

interface SocialPlatform {
  id: string;
  platform: string;
  display_name: string;
  is_enabled: boolean;
  organization_id: string;
  credentials: {
    token_expires_at?: string;
    access_token?: string;
  } | null;
  organization?: {
    name: string;
  };
}

type TokenStatus = 'healthy' | 'expiring_soon' | 'expired' | 'unknown';

interface TokenHealthData {
  platform: SocialPlatform;
  status: TokenStatus;
  expiresAt: Date | null;
  organizationName: string;
}

export function TokenHealthWidget() {
  const [tokens, setTokens] = useState<TokenHealthData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const fetchTokenHealth = async () => {
    setIsLoading(true);
    try {
      // Fetch all social platforms with organization info
      const { data: platforms, error } = await supabase
        .from('social_platforms')
        .select('*, organizations(name)')
        .in('platform', ['instagram', 'whatsapp', 'facebook'])
        .eq('is_enabled', true);

      if (error) throw error;

      const tokenData: TokenHealthData[] = (platforms || []).map((p) => {
        const credentials = p.credentials as SocialPlatform['credentials'];
        const expiresAtStr = credentials?.token_expires_at;
        const expiresAt = expiresAtStr ? new Date(expiresAtStr) : null;
        const now = new Date();
        const sevenDaysFromNow = addDays(now, 7);

        let status: TokenStatus = 'unknown';
        if (!credentials?.access_token) {
          status = 'unknown';
        } else if (!expiresAt) {
          status = 'unknown';
        } else if (isBefore(expiresAt, now)) {
          status = 'expired';
        } else if (isBefore(expiresAt, sevenDaysFromNow)) {
          status = 'expiring_soon';
        } else {
          status = 'healthy';
        }

        return {
          platform: p as SocialPlatform,
          status,
          expiresAt,
          organizationName: (p.organizations as { name: string } | null)?.name || 'Unknown Org',
        };
      });

      // Sort by status priority: expired first, then expiring soon, then healthy
      const statusPriority: Record<TokenStatus, number> = {
        expired: 0,
        expiring_soon: 1,
        unknown: 2,
        healthy: 3,
      };
      tokenData.sort((a, b) => statusPriority[a.status] - statusPriority[b.status]);

      setTokens(tokenData);
    } catch (error) {
      devError('Error fetching token health:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTokenHealth();
  }, []);

  const handleRefreshToken = async (platformId: string) => {
    setRefreshingId(platformId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      const { error } = await supabase.functions.invoke('refresh-single-token', {
        body: { platformId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      toast.success('Token refreshed successfully');
      await fetchTokenHealth();
    } catch (error) {
      devError('Error refreshing token:', error);
      toast.error('Failed to refresh token');
    } finally {
      setRefreshingId(null);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'facebook':
        return <Facebook className="w-4 h-4" />;
      case 'instagram':
        return <Instagram className="w-4 h-4" />;
      case 'whatsapp':
        return <MessageCircle className="w-4 h-4" />;
      default:
        return <Link2 className="w-4 h-4" />;
    }
  };

  const getStatusIcon = (status: TokenStatus) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'expiring_soon':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'expired':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: TokenStatus) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="secondary" className="bg-success/10 text-success border-success/20">Healthy</Badge>;
      case 'expiring_soon':
        return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">Expiring Soon</Badge>;
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const stats = {
    total: tokens.length,
    healthy: tokens.filter(t => t.status === 'healthy').length,
    expiringSoon: tokens.filter(t => t.status === 'expiring_soon').length,
    expired: tokens.filter(t => t.status === 'expired').length,
  };

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            Social Token Health
          </CardTitle>
          <CardDescription>Status of connected social platform tokens</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTokenHealth} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No social platforms connected</p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-success/10">
                <p className="text-lg font-bold text-success">{stats.healthy}</p>
                <p className="text-xs text-muted-foreground">Healthy</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-warning/10">
                <p className="text-lg font-bold text-warning">{stats.expiringSoon}</p>
                <p className="text-xs text-muted-foreground">Expiring</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-destructive/10">
                <p className="text-lg font-bold text-destructive">{stats.expired}</p>
                <p className="text-xs text-muted-foreground">Expired</p>
              </div>
            </div>

            {/* Token List */}
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {tokens.map((token) => (
                  <div 
                    key={token.platform.id} 
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 border border-border/50"
                  >
                    <div className="p-2 rounded-lg bg-muted/50">
                      {getPlatformIcon(token.platform.platform)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {token.platform.display_name}
                        </p>
                        {getStatusBadge(token.status)}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {token.organizationName}
                        {token.expiresAt && (
                          <> • Expires {formatDistanceToNow(token.expiresAt, { addSuffix: true })}</>
                        )}
                      </p>
                    </div>
                    {(token.status === 'expiring_soon' || token.status === 'expired') && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleRefreshToken(token.platform.id)}
                        disabled={refreshingId === token.platform.id}
                      >
                        {refreshingId === token.platform.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}
