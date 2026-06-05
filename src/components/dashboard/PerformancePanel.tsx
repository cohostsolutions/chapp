import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Gauge, 
  Clock, 
  AlertTriangle, 
  Trash2,
  Activity,
  Database,
  Layers,
  Download,
  Bell,
  BellOff,
  Search,
  FileText
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { QueryAnalyzer } from './QueryAnalyzer';
import { QueryPlanViewer } from './QueryPlanViewer';
import { toast } from 'sonner';

export function PerformancePanel() {
  const { data, clearMetrics, clearAlerts, exportMetrics } = usePerformanceMonitor();

  const getStatusColor = (duration: number, threshold: number) => {
    if (duration > threshold * 2) return 'text-destructive';
    if (duration > threshold) return 'text-warning';
    return 'text-success';
  };

  const getSeverityColor = (severity: 'warning' | 'critical') => {
    return severity === 'critical' 
      ? 'bg-destructive/20 text-destructive border-destructive/30'
      : 'bg-warning/20 text-warning border-warning/30';
  };

  const handleExportMetrics = () => {
    const csv = exportMetrics();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-metrics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Performance metrics exported');
  };

  return (
    <div className="space-y-4">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{data.queryMetrics.length}</p>
                <p className="text-sm text-muted-foreground">Queries Tracked</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <Clock className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className={`text-2xl font-bold ${getStatusColor(data.averageQueryTime, 500)}`}>
                  {data.averageQueryTime}ms
                </p>
                <p className="text-sm text-muted-foreground">Avg Query Time</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{data.slowQueries.length}</p>
                <p className="text-sm text-muted-foreground">Slow Queries</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Bell className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{data.alerts.length}</p>
                <p className="text-sm text-muted-foreground">Active Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Tabs */}
      <Tabs defaultValue="metrics">
        <TabsList className="flex-wrap">
          <TabsTrigger value="metrics" className="gap-2">
            <Gauge className="w-4 h-4" />
            Metrics
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <Bell className="w-4 h-4" />
            Alerts
            {data.alerts.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {data.alerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="analyzer" className="gap-2">
            <Search className="w-4 h-4" />
            Analyzer
          </TabsTrigger>
          <TabsTrigger value="planner" className="gap-2">
            <FileText className="w-4 h-4" />
            Query Plan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="mt-4">
          {/* Query Metrics */}
          <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Gauge className="w-5 h-5 text-primary" />
                  Query Performance
                </CardTitle>
                <CardDescription>Recent database query durations</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportMetrics}>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={clearMetrics}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {data.queryMetrics.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <Activity className="w-5 h-5 mr-2" />
                    No queries tracked yet. Navigate around to see metrics.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.queryMetrics.map((metric, index) => (
                      <div
                        key={`${metric.queryKey}-${metric.timestamp}-${index}`}
                        className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono text-foreground truncate">
                            {metric.queryKey}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(metric.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={metric.status === 'success' ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {metric.status}
                          </Badge>
                          <span className={`text-sm font-mono font-bold ${getStatusColor(metric.duration, 500)}`}>
                            {metric.duration}ms
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="w-5 h-5 text-destructive" />
                  Performance Alerts
                </CardTitle>
                <CardDescription>Real-time performance issues and warnings</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={clearAlerts}>
                <BellOff className="w-4 h-4 mr-2" />
                Clear Alerts
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {data.alerts.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <Bell className="w-5 h-5 mr-2" />
                    No alerts. System performing normally.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                              alert.severity === 'critical' ? 'text-destructive' : 'text-warning'
                            }`} />
                            <div>
                              <p className="text-sm font-medium">{alert.message}</p>
                              {alert.queryKey && (
                                <p className="text-xs font-mono text-muted-foreground truncate max-w-[300px]">
                                  {alert.queryKey}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                              {alert.type.replace('_', ' ')}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analyzer" className="mt-4">
          <QueryAnalyzer />
        </TabsContent>

        <TabsContent value="planner" className="mt-4">
          <QueryPlanViewer />
        </TabsContent>
      </Tabs>
    </div>
  );
}
