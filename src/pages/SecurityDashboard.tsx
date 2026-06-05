import { useState, useEffect, lazy, Suspense } from 'react';
import { devError } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Users, 
  Key, 
  Activity,
  RefreshCw,
  XCircle,
  Lock,
  Loader2,
  BarChart3,
  ShieldOff
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { IPBlocklistManager } from '@/components/security/IPBlocklistManager';

// Lazy load chart-heavy component
const LoginMonitoringDashboard = lazy(() => import('@/components/security/LoginMonitoringDashboard').then(m => ({ default: m.LoginMonitoringDashboard })));

const ChartSkeleton = () => (
  <div className="space-y-3 p-4">
    <Skeleton className="h-4 w-1/3" />
    <Skeleton className="h-[300px] w-full" />
  </div>
);

interface SecurityMetrics {
  totalAuditLogs: number;
  failedLogins24h: number;
  successfulLogins24h: number;
  overdueSecrets: number;
  recentUserActions: number;
}

interface AuditLog {
  id: string;
  created_at: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  ip_address?: string;
  details?: unknown;
}

// Minimal local type for local state - the full LoginAttempt from component has more fields
interface LoginAttemptRow {
  id: string;
  attempted_at: string;
  was_successful: boolean;
  email?: string;
  ip_address?: string;
  country?: string | null;
  country_code?: string | null;
  city?: string | null;
  region?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isp?: string | null;
}

interface SecretRotation {
  id: string;
  secret_name: string;
  last_rotated_at: string | null;
  rotation_interval_days: number;
  [key: string]: unknown;
}

interface SecurityDashboardSnapshot {
  metrics?: SecurityMetrics;
  auditLogs?: AuditLog[];
  loginAttempts?: LoginAttemptRow[];
  secretRotations?: SecretRotation[];
}

export default function SecurityDashboard() {
  const { effectiveIsSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttemptRow[]>([]);
  const [secretRotations, setSecretRotations] = useState<SecretRotation[]>([]);
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!effectiveIsSuperAdmin) {
      navigate('/dashboard');
      return;
    }
    fetchSecurityData();
  }, [effectiveIsSuperAdmin, navigate]);

  const fetchSecurityData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc('get_security_dashboard_snapshot');

      if (error) throw error;
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid security dashboard payload');
      }

      const snapshot = data as SecurityDashboardSnapshot;

      setAuditLogs(Array.isArray(snapshot.auditLogs) ? snapshot.auditLogs : []);
      setLoginAttempts(Array.isArray(snapshot.loginAttempts) ? snapshot.loginAttempts : []);
      setSecretRotations(Array.isArray(snapshot.secretRotations) ? snapshot.secretRotations : []);
      setMetrics(snapshot.metrics || null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load security data';
      setError(errorMessage);
      toast({
        title: 'Error loading security dashboard',
        description: errorMessage,
        variant: 'destructive',
      });
      devError('Error fetching security data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'user_created':
        return <Users className="w-4 h-4 text-green-500" />;
      case 'user_updated':
        return <Users className="w-4 h-4 text-blue-500" />;
      case 'user_activated':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'user_deactivated':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'password_changed':
      case 'password_reset_by_admin':
        return <Key className="w-4 h-4 text-amber-500" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      user_created: 'User Created',
      user_updated: 'User Updated',
      user_activated: 'User Activated',
      user_deactivated: 'User Deactivated',
      password_changed: 'Password Changed',
      password_reset_by_admin: 'Password Reset by Admin',
    };
    return labels[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (!effectiveIsSuperAdmin) {
    return null;
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 md:w-7 md:h-7 text-primary" />
            Security Dashboard
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">Monitor security events and system health</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSecurityData} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <Card className="glass">
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="p-1.5 md:p-2 rounded-lg bg-destructive/10">
                    <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-destructive" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg md:text-2xl font-bold text-foreground">{metrics?.failedLogins24h || 0}</p>
                    <p className="text-[10px] md:text-sm text-muted-foreground truncate">Failed Logins (24h)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="p-1.5 md:p-2 rounded-lg bg-green-500/10">
                    <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg md:text-2xl font-bold text-foreground">{metrics?.successfulLogins24h || 0}</p>
                    <p className="text-[10px] md:text-sm text-muted-foreground truncate">Successful (24h)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="p-1.5 md:p-2 rounded-lg bg-amber-500/10">
                    <Key className="w-4 h-4 md:w-5 md:h-5 text-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg md:text-2xl font-bold text-foreground">{metrics?.overdueSecrets || 0}</p>
                    <p className="text-[10px] md:text-sm text-muted-foreground truncate">Overdue Secrets</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
                    <Activity className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg md:text-2xl font-bold text-foreground">{metrics?.recentUserActions || 0}</p>
                    <p className="text-[10px] md:text-sm text-muted-foreground truncate">Actions (24h)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
              <TabsList className="inline-flex w-auto min-w-full md:w-auto">
                <TabsTrigger value="overview" className="text-xs md:text-sm">Overview</TabsTrigger>
                <TabsTrigger value="login-monitoring" className="flex items-center gap-1 text-xs md:text-sm">
                  <BarChart3 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  <span className="hidden sm:inline">Login Monitoring</span>
                  <span className="sm:hidden">Logins</span>
                </TabsTrigger>
                <TabsTrigger value="ip-blocklist" className="flex items-center gap-1 text-xs md:text-sm">
                  <ShieldOff className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  <span className="hidden sm:inline">IP Blocklist</span>
                  <span className="sm:hidden">IPs</span>
                </TabsTrigger>
                <TabsTrigger value="audit-logs" className="text-xs md:text-sm">
                  <span className="hidden sm:inline">Audit Logs</span>
                  <span className="sm:hidden">Audit</span>
                </TabsTrigger>
                <TabsTrigger value="login-attempts" className="text-xs md:text-sm">
                  <span className="hidden sm:inline">Login Attempts</span>
                  <span className="sm:hidden">Attempts</span>
                </TabsTrigger>
                <TabsTrigger value="secret-rotation" className="text-xs md:text-sm">
                  <span className="hidden sm:inline">Secret Rotation</span>
                  <span className="sm:hidden">Secrets</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
                <Card className="glass">
                  <CardHeader className="pb-2 md:pb-4">
                    <CardTitle className="text-sm md:text-lg flex items-center gap-2">
                      <Activity className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                      Recent Admin Actions
                    </CardTitle>
                    <CardDescription className="text-xs md:text-sm">Latest security-related activities</CardDescription>
                  </CardHeader>
                  <CardContent className="px-3 md:px-6">
                    <ScrollArea className="h-[250px] md:h-[300px]">
                      <div className="space-y-2 md:space-y-3">
                        {auditLogs.slice(0, 10).map((log) => (
                          <div key={log.id} className="flex items-start gap-2 md:gap-3 p-2 rounded-lg hover:bg-muted/50">
                            {getActionIcon(log.action)}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs md:text-sm font-medium text-foreground">
                                {getActionLabel(log.action)}
                              </p>
                              <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                                {log.resource_type}: {log.resource_id?.slice(0, 8)}...
                              </p>
                            </div>
                            <span className="text-[10px] md:text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        ))}
                        {auditLogs.length === 0 && (
                          <p className="text-xs md:text-sm text-muted-foreground text-center py-4">No audit logs found</p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className="glass">
                  <CardHeader className="pb-2 md:pb-4">
                    <CardTitle className="text-sm md:text-lg flex items-center gap-2">
                      <Lock className="w-4 h-4 md:w-5 md:h-5 text-destructive" />
                      Recent Failed Logins
                    </CardTitle>
                    <CardDescription className="text-xs md:text-sm">Failed authentication attempts</CardDescription>
                  </CardHeader>
                  <CardContent className="px-3 md:px-6">
                    <ScrollArea className="h-[250px] md:h-[300px]">
                      <div className="space-y-2 md:space-y-3">
                        {loginAttempts.filter((a: { was_successful: boolean }) => !a.was_successful).slice(0, 10).map((attempt) => (
                          <div key={attempt.id} className="flex items-start gap-2 md:gap-3 p-2 rounded-lg hover:bg-muted/50">
                            <XCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-destructive mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs md:text-sm font-medium text-foreground truncate">
                                {attempt.email}
                              </p>
                              <p className="text-[10px] md:text-xs text-muted-foreground">
                                IP: {attempt.ip_address || 'Unknown'}
                              </p>
                            </div>
                            <span className="text-[10px] md:text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(attempt.attempted_at), { addSuffix: true })}
                            </span>
                          </div>
                        ))}
                        {loginAttempts.filter((a: { was_successful: boolean }) => !a.was_successful).length === 0 && (
                          <p className="text-xs md:text-sm text-muted-foreground text-center py-4">No failed logins</p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="login-monitoring" className="mt-4">
              <Suspense fallback={<ChartSkeleton />}>
                <LoginMonitoringDashboard loginAttempts={loginAttempts as any} onRefresh={fetchSecurityData} />
              </Suspense>
            </TabsContent>

            <TabsContent value="ip-blocklist" className="mt-4">
              <IPBlocklistManager />
            </TabsContent>

            <TabsContent value="audit-logs" className="mt-4">
              <Card className="glass">
                <CardHeader className="pb-2 md:pb-4">
                  <CardTitle className="text-sm md:text-base">All Audit Logs</CardTitle>
                  <CardDescription className="text-xs md:text-sm">Complete history of admin actions</CardDescription>
                </CardHeader>
                <CardContent className="px-3 md:px-6">
                  <ScrollArea className="h-[400px] md:h-[500px]">
                    <div className="space-y-2">
                      {auditLogs.map((log) => (
                        <div key={log.id} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 p-2 md:p-3 rounded-lg border border-border/50 hover:bg-muted/50">
                          <div className="flex items-start gap-2 flex-1">
                            {getActionIcon(log.action)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                                <Badge variant="outline" className="text-[10px] md:text-xs">{getActionLabel(log.action)}</Badge>
                                <Badge variant="secondary" className="text-[10px] md:text-xs">{log.resource_type}</Badge>
                              </div>
                              <p className="text-[10px] md:text-xs text-muted-foreground mt-1 truncate">
                                Resource: {log.resource_id?.slice(0, 8) || 'N/A'}... | IP: {log.ip_address || 'Unknown'}
                              </p>
                              {log.details && Object.keys(log.details).length > 0 && (
                                <details className="mt-2">
                                  <summary className="text-[10px] md:text-xs text-primary cursor-pointer hover:underline">View details</summary>
                                  <pre className="text-[10px] md:text-xs mt-1 p-2 bg-muted rounded overflow-auto max-h-24 md:max-h-32">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] md:text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.created_at), 'MMM d, HH:mm')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="login-attempts" className="mt-4">
              <Card className="glass">
                <CardHeader className="pb-2 md:pb-4">
                  <CardTitle className="text-sm md:text-base">Login Attempts</CardTitle>
                  <CardDescription className="text-xs md:text-sm">All authentication attempts</CardDescription>
                </CardHeader>
                <CardContent className="px-3 md:px-6">
                  <ScrollArea className="h-[400px] md:h-[500px]">
                    <div className="space-y-2">
                      {loginAttempts.map((attempt) => (
                        <div key={attempt.id} className="flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg border border-border/50 hover:bg-muted/50">
                          {attempt.was_successful ? (
                            <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-500 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 md:w-5 md:h-5 text-destructive shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs md:text-sm font-medium text-foreground truncate">
                              {attempt.email}
                            </p>
                            <p className="text-[10px] md:text-xs text-muted-foreground">
                              IP: {attempt.ip_address || 'Unknown'}
                            </p>
                          </div>
                          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2">
                            <Badge variant={attempt.was_successful ? 'default' : 'destructive'} className="text-[10px] md:text-xs">
                              {attempt.was_successful ? 'OK' : 'Fail'}
                            </Badge>
                            <span className="text-[10px] md:text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(attempt.attempted_at), 'MMM d, HH:mm')}
                            </span>
                          </div>
                        </div>
                      ))}
                      {loginAttempts.length === 0 && (
                        <p className="text-xs md:text-sm text-muted-foreground text-center py-4">No login attempts found</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="secret-rotation" className="mt-4">
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Secret Rotation Status</CardTitle>
                  <CardDescription>Track API key and secret rotation schedules</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {secretRotations.map((secret) => {
                      const now = new Date();
                      const lastRotated = secret.last_rotated_at ? new Date(secret.last_rotated_at) : null;
                      const daysSinceRotation = lastRotated 
                        ? (now.getTime() - lastRotated.getTime()) / (1000 * 60 * 60 * 24)
                        : Infinity;
                      const isOverdue = daysSinceRotation > secret.rotation_interval_days;
                      const daysUntilDue = secret.rotation_interval_days - daysSinceRotation;

                      return (
                        <div key={secret.id} className="flex items-center gap-3 p-4 rounded-lg border border-border/50 hover:bg-muted/50">
                          <div className={`p-2 rounded-lg ${isOverdue ? 'bg-destructive/10' : 'bg-green-500/10'}`}>
                            <Key className={`w-5 h-5 ${isOverdue ? 'text-destructive' : 'text-green-500'}`} />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-foreground">{secret.secret_name}</p>
                            <p className="text-xs text-muted-foreground">
                              Rotation interval: {secret.rotation_interval_days} days
                            </p>
                          </div>
                          <div className="text-right">
                            {lastRotated ? (
                              <>
                                <p className="text-sm text-muted-foreground">
                                  Last rotated: {format(lastRotated, 'MMM d, yyyy')}
                                </p>
                                <Badge variant={isOverdue ? 'destructive' : 'outline'}>
                                  {isOverdue 
                                    ? `${Math.floor(daysSinceRotation - secret.rotation_interval_days)} days overdue`
                                    : `${Math.ceil(daysUntilDue)} days until due`
                                  }
                                </Badge>
                              </>
                            ) : (
                              <Badge variant="destructive">Never rotated</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {secretRotations.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No secrets tracked</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
