import { useState, useEffect, useCallback } from 'react';
import { devError } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Database, 
  Activity, 
  RefreshCw, 
  FileText,
  Users,
  CalendarDays,
  ShoppingBag,
  MessageSquare,
  Pause,
  Play,
  Download
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

interface DatabaseStats {
  recentAuditEvents: number;
  totalLeads: number;
  totalBookings: number;
  totalOrders: number;
  totalConversations: number;
}

interface RecentActivity {
  id: string;
  table: string;
  operation: string;
  timestamp: Date;
  rowCount?: number;
}

export function DatabaseActivityMonitor() {
  const [stats, setStats] = useState<DatabaseStats>({
    recentAuditEvents: 0,
    totalLeads: 0,
    totalBookings: 0,
    totalOrders: 0,
    totalConversations: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDatabaseStats = useCallback(async () => {
    if (!isMonitoring) return;
    setIsLoading(true);

    try {
      // Get recent audit logs for activity tracking
      const { data: auditData } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      const activities: RecentActivity[] = (auditData || []).map((log) => ({
        id: log.id,
        table: log.resource_type,
        operation: log.action.toUpperCase(),
        timestamp: new Date(log.created_at),
      }));

      // Get table counts for common tables
      const [leadsRes, bookingsRes, ordersRes, conversationsRes] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact', head: true }),
        supabase.from('bookings').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('ai_conversations').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        recentAuditEvents: activities.length,
        totalLeads: leadsRes.count || 0,
        totalBookings: bookingsRes.count || 0,
        totalOrders: ordersRes.count || 0,
        totalConversations: conversationsRes.count || 0,
      });

      setRecentActivity(activities.slice(0, 15));
    } catch (error) {
      devError('Error fetching database stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isMonitoring]);

  useEffect(() => {
    fetchDatabaseStats();
    const interval = setInterval(fetchDatabaseStats, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [fetchDatabaseStats]);

  const getOperationColor = (operation: string) => {
    switch (operation.toUpperCase()) {
      case 'INSERT':
      case 'USER_CREATED':
        return 'bg-success/10 text-success';
      case 'UPDATE':
      case 'USER_UPDATED':
        return 'bg-info/10 text-info';
      case 'DELETE':
      case 'USER_DEACTIVATED':
        return 'bg-destructive/10 text-destructive';
      case 'SELECT':
        return 'bg-primary/10 text-primary';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const exportActivityToCSV = () => {
    if (recentActivity.length === 0) {
      toast.error('No activity data to export');
      return;
    }

    const csvRows = [
      ['Timestamp', 'Table', 'Operation', 'Row Count'].join(','),
      ...recentActivity.map(activity => [
        format(activity.timestamp, 'yyyy-MM-dd HH:mm:ss'),
        activity.table,
        activity.operation,
        activity.rowCount ?? '',
      ].join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `database-activity-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Activity log exported to CSV');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Operational Activity Monitor</h3>
          {isMonitoring && (
            <Badge variant="outline" className="animate-pulse bg-success/10 text-success border-success/20">
              <Activity className="w-3 h-3 mr-1" />
              Live
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMonitoring(!isMonitoring)}
          >
            {isMonitoring ? (
              <>
                <Pause className="w-4 h-4 mr-1" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" />
                Resume
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDatabaseStats}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportActivityToCSV}
          >
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{stats.recentAuditEvents}</p>
                <p className="text-xs text-muted-foreground">Recent Audit Events</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <Users className="w-4 h-4 text-info" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{stats.totalLeads}</p>
                <p className="text-xs text-muted-foreground">Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <CalendarDays className="w-4 h-4 text-warning" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{stats.totalBookings}</p>
                <p className="text-xs text-muted-foreground">Bookings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <ShoppingBag className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{stats.totalOrders}</p>
                <p className="text-xs text-muted-foreground">Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MessageSquare className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{stats.totalConversations}</p>
                <p className="text-xs text-muted-foreground">AI Conversations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Feed */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Recent Audit Activity
          </CardTitle>
          <CardDescription>Recent persisted audit-log events and core record counts</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[250px]">
            <div className="space-y-2">
              {recentActivity.map((activity) => (
                <div 
                  key={activity.id} 
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Badge 
                    variant="outline" 
                    className={`${getOperationColor(activity.operation)} text-xs min-w-[70px] justify-center`}
                  >
                    {activity.operation.slice(0, 10)}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {activity.table}
                    </p>
                    {activity.rowCount !== undefined && (
                      <p className="text-xs text-muted-foreground">
                        {activity.rowCount.toLocaleString()} rows
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                  </span>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recent activity
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
