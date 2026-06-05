import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  RefreshCw,
  Download,
  Filter
} from 'lucide-react';
import { format, subHours, subDays } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ErrorLog {
  id: string;
  created_at: string;
  user_id: string | null;
  organization_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: {
    errorType?: string;
    errorMessage?: string;
    stack?: string;
    component?: string;
    url?: string;
    userAgent?: string;
  };
}

export default function ErrorDashboard() {
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [errorTypeFilter, setErrorTypeFilter] = useState<string>('all');

  // Fetch error logs
  const { data: errors, isLoading, refetch } = useQuery({
    queryKey: ['error-logs', timeRange],
    queryFn: async () => {
      const startDate = timeRange === '1h' ? subHours(new Date(), 1)
        : timeRange === '24h' ? subDays(new Date(), 1)
        : timeRange === '7d' ? subDays(new Date(), 7)
        : subDays(new Date(), 30);

      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'error')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      return (data ?? []).map((d: { action: string; created_at: string; details: unknown; id: string; ip_address: string | null; resource_id: string | null; resource_type: string; user_agent: string | null; user_id: string | null }) => ({
        ...d,
        organization_id: null,
        metadata: typeof d.details === 'object' && d.details !== null ? d.details as ErrorLog['metadata'] : null,
      })) as ErrorLog[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Calculate error statistics
  const stats = errors ? {
    total: errors.length,
    lastHour: errors.filter(e => new Date(e.created_at) > subHours(new Date(), 1)).length,
    byType: errors.reduce((acc, err) => {
      const type = err.metadata?.errorType || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byComponent: errors.reduce((acc, err) => {
      const component = err.metadata?.component || 'Unknown';
      acc[component] = (acc[component] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    trend: calculateTrend(errors)
  } : null;

  const filteredErrors = errors?.filter(err => 
    errorTypeFilter === 'all' || err.metadata?.errorType === errorTypeFilter
  );

  const errorTypes = stats ? ['all', ...Object.keys(stats.byType)] : ['all'];

  const exportErrors = () => {
    if (!errors) return;
    
    const csv = [
      ['Timestamp', 'Type', 'Message', 'Component', 'User ID', 'Org ID'].join(','),
      ...errors.map(err => [
        err.created_at,
        err.metadata?.errorType || '',
        (err.metadata?.errorMessage || '').replace(/,/g, ';'),
        err.metadata?.component || '',
        err.user_id || '',
        err.organization_id || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `errors-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    a.click();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Error Monitoring</h1>
          <p className="text-muted-foreground">Real-time error tracking and analysis</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={exportErrors}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Errors</p>
                <p className="text-3xl font-bold">{stats?.total || 0}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last Hour</p>
                <p className="text-3xl font-bold">{stats?.lastHour || 0}</p>
              </div>
              <Clock className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Error Types</p>
                <p className="text-3xl font-bold">{stats ? Object.keys(stats.byType).length : 0}</p>
              </div>
              <Filter className="w-8 h-8 text-info" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Trend</p>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold">{stats?.trend.percentage}%</p>
                  {stats?.trend.direction === 'up' ? (
                    <TrendingUp className="w-5 h-5 text-destructive" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-success" />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Analysis Tabs */}
      <Tabs defaultValue="recent" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recent">Recent Errors</TabsTrigger>
          <TabsTrigger value="types">By Type</TabsTrigger>
          <TabsTrigger value="components">By Component</TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Errors</CardTitle>
                <Select value={errorTypeFilter} onValueChange={setErrorTypeFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    {errorTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {type === 'all' ? 'All Types' : type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">Loading errors...</p>
              ) : filteredErrors && filteredErrors.length > 0 ? (
                <div className="space-y-4">
                  {filteredErrors.slice(0, 50).map((error) => (
                    <div key={error.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="destructive">
                              {error.metadata?.errorType || 'Unknown'}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(error.created_at), 'MMM d, yyyy HH:mm:ss')}
                            </span>
                          </div>
                          <p className="font-mono text-sm">
                            {error.metadata?.errorMessage || 'No message'}
                          </p>
                          {error.metadata?.component && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Component: {error.metadata.component}
                            </p>
                          )}
                          {error.metadata?.url && (
                            <p className="text-sm text-muted-foreground">
                              URL: {error.metadata.url}
                            </p>
                          )}
                        </div>
                      </div>
                      {error.metadata?.stack && (
                        <details className="mt-2">
                          <summary className="text-sm cursor-pointer text-primary">
                            View Stack Trace
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                            {error.metadata.stack}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No errors found in this time range 🎉
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="types">
          <Card>
            <CardHeader>
              <CardTitle>Errors by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats && Object.entries(stats.byType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="font-medium">{type}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-48 bg-muted rounded-full h-2">
                          <div
                            className="bg-destructive h-2 rounded-full"
                            style={{
                              width: `${(count / (stats.total || 1)) * 100}%`
                            }}
                          />
                        </div>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="components">
          <Card>
            <CardHeader>
              <CardTitle>Errors by Component</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats && Object.entries(stats.byComponent)
                  .sort(([, a], [, b]) => b - a)
                  .map(([component, count]) => (
                    <div key={component} className="flex items-center justify-between">
                      <span className="font-medium">{component}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-48 bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{
                              width: `${(count / (stats.total || 1)) * 100}%`
                            }}
                          />
                        </div>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function calculateTrend(errors: ErrorLog[]): { percentage: number; direction: 'up' | 'down' } {
  if (!errors || errors.length === 0) return { percentage: 0, direction: 'down' };

  const now = new Date();
  const halfwayPoint = new Date(now.getTime() - (now.getTime() - new Date(errors[errors.length - 1].created_at).getTime()) / 2);

  const recentCount = errors.filter(e => new Date(e.created_at) > halfwayPoint).length;
  const olderCount = errors.filter(e => new Date(e.created_at) <= halfwayPoint).length;

  if (olderCount === 0) return { percentage: 0, direction: 'down' };

  const change = ((recentCount - olderCount) / olderCount) * 100;
  return {
    percentage: Math.abs(Math.round(change)),
    direction: change >= 0 ? 'up' : 'down'
  };
}
