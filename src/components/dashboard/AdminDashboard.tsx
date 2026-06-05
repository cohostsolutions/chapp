import { useEffect, useState, lazy, Suspense } from 'react';
import { devError } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Shield, 
  Gauge, 
  Bug,
  AlertTriangle,
  CheckCircle,
  Users,
  Key,
  Activity,
  RefreshCw,
  XCircle,
  Lock,
  Loader2,
  Building2,
  Download,
  BarChart3,
  MessageSquare,
  Ticket,
  GraduationCap,
  TrendingUp,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import {
  useAdminDashboardSnapshot,
  type AdminAuditLog,
  type AdminLoginAttempt,
  type AdminSecretRotation,
} from '@/hooks/useAdminDashboardSnapshot';
import { TokenHealthWidget } from './TokenHealthWidget';

// Lazy load heavy chart components
const PerformancePanel = lazy(() => import('./PerformancePanel').then(m => ({ default: m.PerformancePanel })));
const DebugPanel = lazy(() => import('./DebugPanel').then(m => ({ default: m.DebugPanel })));
const DatabaseActivityMonitor = lazy(() => import('./DatabaseActivityMonitor').then(m => ({ default: m.DatabaseActivityMonitor })));
const AlertThresholdsConfig = lazy(() => import('./AlertThresholdsConfig').then(m => ({ default: m.AlertThresholdsConfig })));
const HealthCheckHistory = lazy(() => import('./HealthCheckHistory').then(m => ({ default: m.HealthCheckHistory })));
const HealthTrendWidget = lazy(() => import('./HealthTrendWidget').then(m => ({ default: m.HealthTrendWidget })));
const CrossOrgAnalytics = lazy(() => import('./CrossOrgAnalytics').then(m => ({ default: m.CrossOrgAnalytics })));
const DemoAnalyticsDashboard = lazy(() => import('./DemoAnalyticsDashboard').then(m => ({ default: m.DemoAnalyticsDashboard })));

// Chart loading skeleton
const ChartSkeleton = () => (
  <div className="space-y-3 p-4">
    <Skeleton className="h-4 w-1/3" />
    <Skeleton className="h-[200px] w-full" />
  </div>
);

export default function AdminDashboard() {
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('activity');
  const {
    data: snapshot,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useAdminDashboardSnapshot(isSuperAdmin);

  const metrics = snapshot?.metrics ?? null;
  const auditLogs = snapshot?.auditLogs ?? [];
  const loginAttempts = snapshot?.loginAttempts ?? [];
  const secretRotations = snapshot?.secretRotations ?? [];
  const platformMetrics = snapshot?.platformMetrics ?? null;

  // Only actual super admins can see admin dashboard (not impersonated)
  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/dashboard');
    }
  }, [isSuperAdmin, navigate]);

  useEffect(() => {
    if (!error) return;

    devError('Error fetching admin data:', error);
    toast.error('Failed to load admin dashboard');
  }, [error]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'user_created':
        return <Users className="w-4 h-4 text-success" />;
      case 'user_updated':
        return <Users className="w-4 h-4 text-info" />;
      case 'user_activated':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'user_deactivated':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'password_changed':
      case 'password_reset_by_admin':
        return <Key className="w-4 h-4 text-warning" />;
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

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="space-y-4 lg:space-y-6 animate-fade-in" data-tour="dashboard-content">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Admin Dashboard
          </h1>
          <p className="text-sm lg:text-base text-muted-foreground mt-1">
            System maintenance, security, and performance monitoring
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading || isFetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Quick Stats - Security */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <Card className="glass">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{metrics?.failedLogins24h || 0}</p>
                    <p className="text-xs text-muted-foreground">Failed Logins (24h)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-warning/10">
                    <Key className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{metrics?.overdueSecrets || 0}</p>
                    <p className="text-xs text-muted-foreground">Overdue Rotations</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{metrics?.totalOrganizations || 0}</p>
                    <p className="text-xs text-muted-foreground">Organizations</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-info/10">
                    <Users className="w-5 h-5 text-info" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{metrics?.totalUsers || 0}</p>
                    <p className="text-xs text-muted-foreground">Total Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats - Platform Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <Card className="glass border-l-4 border-l-orange-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <Ticket className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{platformMetrics?.openTickets || 0}</p>
                    <p className="text-xs text-muted-foreground">Open Tickets</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass border-l-4 border-l-purple-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <GraduationCap className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{platformMetrics?.trainingSessions || 0}</p>
                    <p className="text-xs text-muted-foreground">Training Sessions</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <MessageSquare className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{platformMetrics?.totalTeamChats || 0}</p>
                    <p className="text-xs text-muted-foreground">Team Chats</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass border-l-4 border-l-cyan-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10">
                    <TrendingUp className="w-5 h-5 text-cyan-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{platformMetrics?.totalLeads || 0}</p>
                    <p className="text-xs text-muted-foreground">Pipeline Records</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Admin Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
              <TabsTrigger value="activity" className="gap-2">
                <Ticket className="w-4 h-4" />
                <span className="hidden sm:inline">Activity</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="overview" className="gap-2">
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Security</span>
              </TabsTrigger>
              <TabsTrigger value="performance" className="gap-2">
                <Gauge className="w-4 h-4" />
                <span className="hidden sm:inline">Performance</span>
              </TabsTrigger>
              <TabsTrigger value="debug" className="gap-2">
                <Bug className="w-4 h-4" />
                <span className="hidden sm:inline">Debug</span>
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-2">
                <Activity className="w-4 h-4" />
                <span className="hidden sm:inline">Logs</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="activity" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Recent Support Tickets */}
                <Card className="glass lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Ticket className="w-5 h-5 text-orange-500" />
                      Recent Support Tickets
                    </CardTitle>
                    <CardDescription>Latest helpdesk tickets across all organizations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-3">
                        {platformMetrics?.recentTickets && platformMetrics.recentTickets.length > 0 ? (
                          platformMetrics.recentTickets.map((ticket) => (
                            <div key={ticket.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate('/support-tickets')}>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {ticket.subject}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge 
                                    variant={ticket.priority === 'urgent' ? 'destructive' : ticket.priority === 'high' ? 'default' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {ticket.priority}
                                  </Badge>
                                  <Badge 
                                    variant={ticket.status === 'open' ? 'outline' : ticket.status === 'in_progress' ? 'default' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {ticket.status.replace('_', ' ')}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-12">
                            <Ticket className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                            <p className="text-sm text-muted-foreground">No support tickets yet</p>
                            <p className="text-xs text-muted-foreground mt-1">Tickets from all organizations will appear here</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                    <Button 
                      variant="outline" 
                      className="w-full mt-4" 
                      onClick={() => navigate('/support-tickets')}
                    >
                      View All Tickets
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="mt-4 space-y-6">
              <Suspense fallback={<ChartSkeleton />}>
                <DemoAnalyticsDashboard />
              </Suspense>
              <Suspense fallback={<ChartSkeleton />}>
                <CrossOrgAnalytics />
              </Suspense>
            </TabsContent>

            <TabsContent value="overview" className="mt-4 space-y-4">
              {/* Health Trend Widget */}
              <Suspense fallback={<ChartSkeleton />}>
                <HealthTrendWidget />
              </Suspense>

              {/* Token Health Widget */}
              <TokenHealthWidget />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Recent Admin Actions */}
                <Card className="glass">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="w-5 h-5 text-primary" />
                      Recent Admin Actions
                    </CardTitle>
                    <CardDescription>Latest security-related activities</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[250px]">
                      <div className="space-y-2">
                        {auditLogs.slice(0, 10).map((log: AdminAuditLog) => (
                          <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                            {getActionIcon(log.action)}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">
                                {getActionLabel(log.action)}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {log.resource_type}: {String(log.resource_id || '').slice(0, 8)}...
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        ))}
                        {auditLogs.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">No audit logs found</p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Recent Failed Logins */}
                <Card className="glass">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Lock className="w-5 h-5 text-destructive" />
                      Recent Failed Logins
                    </CardTitle>
                    <CardDescription>Failed authentication attempts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[250px]">
                      <div className="space-y-2">
                        {loginAttempts.filter((a: AdminLoginAttempt) => !a.was_successful).slice(0, 10).map((attempt) => (
                          <div key={attempt.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                            <XCircle className="w-4 h-4 text-destructive mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {String(attempt.email)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                IP: {String(attempt.ip_address || 'Unknown')}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(attempt.attempted_at), { addSuffix: true })}
                            </span>
                          </div>
                        ))}
                        {loginAttempts.filter((a: AdminLoginAttempt) => !a.was_successful).length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">No failed logins</p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Secret Rotation Status */}
              {secretRotations.length > 0 && (
                <Card className="glass">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Key className="w-5 h-5 text-warning" />
                      Secret Rotation Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {secretRotations.map((secret: AdminSecretRotation) => {
                        const now = new Date();
                        const lastRotated = secret.last_rotated_at ? new Date(secret.last_rotated_at) : null;
                        const daysSinceRotation = lastRotated 
                          ? (now.getTime() - lastRotated.getTime()) / (1000 * 60 * 60 * 24)
                          : Infinity;
                        const isOverdue = daysSinceRotation > secret.rotation_interval_days;

                        return (
                          <div 
                            key={secret.id} 
                            className={`p-3 rounded-lg border ${isOverdue ? 'border-warning/50 bg-warning/5' : 'border-border/50'}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{secret.secret_name}</span>
                              <Badge variant={isOverdue ? 'destructive' : 'secondary'}>
                                {isOverdue ? 'Overdue' : 'OK'}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Last: {lastRotated ? format(lastRotated, 'MMM d, yyyy') : 'Never'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Alert Thresholds Configuration */}
              <Suspense fallback={<ChartSkeleton />}>
                <AlertThresholdsConfig />
              </Suspense>
            </TabsContent>

            <TabsContent value="performance" className="mt-4">
              <Suspense fallback={<ChartSkeleton />}>
                <PerformancePanel />
              </Suspense>
            </TabsContent>

            <TabsContent value="debug" className="mt-4 space-y-6">
              <Suspense fallback={<ChartSkeleton />}>
                <DatabaseActivityMonitor />
              </Suspense>
              <Suspense fallback={<ChartSkeleton />}>
                <HealthCheckHistory />
              </Suspense>
              <Suspense fallback={<ChartSkeleton />}>
                <DebugPanel />
              </Suspense>
            </TabsContent>

            <TabsContent value="logs" className="mt-4">
              <Card className="glass">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>All Audit Logs</CardTitle>
                    <CardDescription>Complete history of admin actions</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      const csvRows = [
                        ['Action', 'Resource Type', 'Resource ID', 'IP Address', 'User Agent', 'Created At'].join(','),
                        ...auditLogs.map(log => [
                          log.action,
                          log.resource_type,
                          log.resource_id || '',
                          log.ip_address || '',
                          String(log.user_agent || '').replace(/,/g, ';'),
                          new Date(log.created_at).toISOString()
                        ].join(','))
                      ];
                      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success('Audit logs exported');
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {auditLogs.map((log) => (
                        <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50">
                          {getActionIcon(log.action)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline">{getActionLabel(log.action)}</Badge>
                              <Badge variant="secondary" className="text-xs">{log.resource_type}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Resource: {String(log.resource_id || 'N/A')} | IP: {String(log.ip_address || 'Unknown')}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.created_at), 'MMM d, HH:mm')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
