import { useEffect, useState } from 'react';
import { devError } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  RefreshCw,
  Loader2,
  Clock,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface WebhookHealth {
  id: string;
  platform: string;
  platform_id: string;
  last_webhook_at: string | null;
  last_message_at: string | null;
  webhooks_received_24h: number;
  messages_processed_24h: number;
  errors_24h: number;
  last_error: string | null;
  status: string;
  calculated_status: string;
  hours_since_last_webhook: number | null;
  social_platforms: {
    display_name: string;
    platform: string;
    is_enabled: boolean;
  } | null;
}

interface Props {
  organizationId?: string;
  platformId?: string;
}

export function WebhookHealthWidget({ organizationId, platformId }: Props) {
  const [healthData, setHealthData] = useState<WebhookHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);

  const fetchHealth = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('webhook-health-check', {
        body: { 
          action: 'get-health',
          organizationId,
          platformId,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      setHealthData(data?.health || []);
    } catch (error) {
      devError('Error fetching webhook health:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Refresh every 5 minutes
    const interval = setInterval(fetchHealth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [organizationId, platformId]);

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('webhook-health-check', {
        body: { 
          action: 'test-webhook',
          platformId: id,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      toast.info(
        <div className="space-y-1">
          <p className="font-medium">Webhook Status: {data.status}</p>
          <p className="text-sm text-muted-foreground">{data.recommendation}</p>
        </div>,
        { duration: 8000 }
      );

      await fetchHealth();
    } catch (error) {
      devError('Error testing webhook:', error);
      toast.error('Failed to test webhook');
    } finally {
      setTestingId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'degraded':
        return <AlertCircle className="w-4 h-4 text-warning" />;
      case 'inactive':
      case 'error':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'secondary' | 'destructive' | 'outline'; className: string }> = {
      healthy: { variant: 'secondary', className: 'bg-success/10 text-success border-success/20' },
      warning: { variant: 'secondary', className: 'bg-warning/10 text-warning border-warning/20' },
      degraded: { variant: 'secondary', className: 'bg-warning/10 text-warning border-warning/20' },
      inactive: { variant: 'destructive', className: '' },
      error: { variant: 'destructive', className: '' },
      no_data: { variant: 'outline', className: '' },
      waiting: { variant: 'outline', className: '' },
      unknown: { variant: 'outline', className: '' },
    };

    const config = variants[status] || variants.unknown;
    const labels: Record<string, string> = {
      healthy: 'Healthy',
      warning: 'Low Activity',
      degraded: 'Degraded',
      inactive: 'Inactive',
      error: 'Error',
      no_data: 'No Data',
      waiting: 'Waiting',
      unknown: 'Unknown',
    };

    return (
      <Badge variant={config.variant} className={config.className}>
        {labels[status] || 'Unknown'}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card className="glass">
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (healthData.length === 0) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Webhook Health
          </CardTitle>
          <CardDescription>No webhook data available yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Webhook health tracking will appear once platforms receive messages.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalWebhooks = healthData.reduce((sum, h) => sum + h.webhooks_received_24h, 0);
  const totalMessages = healthData.reduce((sum, h) => sum + h.messages_processed_24h, 0);
  const totalErrors = healthData.reduce((sum, h) => sum + h.errors_24h, 0);
  const healthyCount = healthData.filter(h => h.calculated_status === 'healthy').length;

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Webhook Health
          </CardTitle>
          <CardDescription>Real-time webhook activity monitoring</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={fetchHealth} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="text-center p-2 rounded-lg bg-success/10">
            <p className="text-lg font-bold text-success">{healthyCount}/{healthData.length}</p>
            <p className="text-xs text-muted-foreground">Healthy</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold">{totalWebhooks}</p>
            <p className="text-xs text-muted-foreground">Webhooks (24h)</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-primary/10">
            <p className="text-lg font-bold text-primary">{totalMessages}</p>
            <p className="text-xs text-muted-foreground">Messages (24h)</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-destructive/10">
            <p className="text-lg font-bold text-destructive">{totalErrors}</p>
            <p className="text-xs text-muted-foreground">Errors (24h)</p>
          </div>
        </div>

        {/* Platform List */}
        <div className="space-y-2">
          {healthData.map((health) => (
            <div 
              key={health.id} 
              className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50"
            >
              {getStatusIcon(health.calculated_status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">
                    {health.social_platforms?.display_name || health.platform}
                  </p>
                  {getStatusBadge(health.calculated_status)}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  {health.last_webhook_at ? (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(health.last_webhook_at), { addSuffix: true })}
                    </span>
                  ) : (
                    <span>No activity yet</span>
                  )}
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {health.messages_processed_24h} msgs
                  </span>
                  {health.errors_24h > 0 && (
                    <span className="text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {health.errors_24h} errors
                    </span>
                  )}
                </div>
                {health.last_error && health.calculated_status !== 'healthy' && (
                  <p className="text-xs text-destructive mt-1 truncate">
                    Last error: {health.last_error}
                  </p>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleTest(health.platform_id)}
                disabled={testingId === health.platform_id}
              >
                {testingId === health.platform_id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Test'
                )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
