import { useState, useEffect } from 'react';
import { devError } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  HeartPulse, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Download
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, subHours } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { toast } from 'sonner';

interface HealthCheck {
  id: string;
  timestamp: Date;
  status: 'healthy' | 'warning' | 'critical';
  failedLogins: number;
  overdueSecrets: number;
  openTickets: number;
}

interface TrendData {
  time: string;
  failedLogins: number;
  overdueSecrets: number;
  healthScore: number;
}

const calculateHealthScore = (failedLogins: number, overdueSecrets: number) => {
  return Math.max(0, Math.min(100, 100 - (overdueSecrets * 12) - (failedLogins * 8)));
};

export function HealthCheckHistory() {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentHealth, setCurrentHealth] = useState<'healthy' | 'warning' | 'critical'>('healthy');

  const fetchHealthHistory = async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      const checks: HealthCheck[] = [];
      const trends: TrendData[] = [];

      const [loginRes, secretsRes, ticketsRes] = await Promise.all([
        supabase.from('login_attempts').select('*').gte('attempted_at', subDays(now, 7).toISOString()),
        supabase.from('secret_rotation_tracking').select('*'),
        supabase.from('helpdesk_tickets').select('id, status'),
      ]);

      const failedLogins = loginRes.data?.filter(a => !a.was_successful) || [];
      const secrets = secretsRes.data || [];
      const openTickets = (ticketsRes.data || []).filter(
        (ticket) => ticket.status === 'open' || ticket.status === 'in_progress'
      ).length;

      // Calculate overdue secrets
      const overdueSecrets = secrets.filter(s => {
        if (!s.last_rotated_at) return true;
        const lastRotated = new Date(s.last_rotated_at);
        const daysSince = (now.getTime() - lastRotated.getTime()) / (1000 * 60 * 60 * 24);
        return daysSince > s.rotation_interval_days;
      }).length;

      // Generate trend data for the past 24 hours from real failed-login activity.
      for (let i = 23; i >= 0; i--) {
        const hourTime = subHours(now, i);
        const hourStart = subHours(hourTime, 1);
        const hourFailedLogins = failedLogins.filter(
          l => new Date(l.attempted_at) >= hourStart && 
               new Date(l.attempted_at) < hourTime
        ).length;
        const healthScore = calculateHealthScore(hourFailedLogins, overdueSecrets);

        trends.push({
          time: format(hourTime, 'HH:mm'),
          failedLogins: hourFailedLogins,
          overdueSecrets,
          healthScore,
        });
      }

      // Generate deterministic daily checks for the past 7 days.
      for (let i = 6; i >= 0; i--) {
        const checkTime = subDays(now, i);
        const dayFailedLogins = failedLogins.filter(
          l => {
            const attemptDate = new Date(l.attempted_at);
            return attemptDate >= subDays(checkTime, 1) && attemptDate < checkTime;
          }
        ).length;

        let status: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (dayFailedLogins > 10 || overdueSecrets > 2) status = 'critical';
        else if (dayFailedLogins > 5 || overdueSecrets > 0) status = 'warning';

        checks.push({
          id: `check-${i}`,
          timestamp: checkTime,
          status,
          failedLogins: dayFailedLogins,
          overdueSecrets,
          openTickets,
        });
      }

      // Determine current health status
      const recentFailedLogins = failedLogins.filter(
        l => new Date(l.attempted_at) >= subHours(now, 24)
      ).length;
      const currentScore = calculateHealthScore(recentFailedLogins, overdueSecrets);

      if (currentScore < 50 || overdueSecrets > 2) {
        setCurrentHealth('critical');
      } else if (currentScore < 70 || overdueSecrets > 0) {
        setCurrentHealth('warning');
      } else {
        setCurrentHealth('healthy');
      }

      setHealthChecks(checks.reverse());
      setTrendData(trends);
    } catch (error) {
      devError('Error fetching health history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthHistory();
    const interval = setInterval(fetchHealthHistory, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'critical':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-success/10 text-success border-success/20">Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Warning</Badge>;
      case 'critical':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Critical</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getTrend = () => {
    if (trendData.length < 2) return null;
    const latest = trendData[trendData.length - 1].healthScore;
    const previous = trendData[trendData.length - 2].healthScore;
    
    if (latest > previous) {
      return <TrendingUp className="w-4 h-4 text-success" />;
    } else if (latest < previous) {
      return <TrendingDown className="w-4 h-4 text-destructive" />;
    }
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const latestScore = trendData.length > 0 ? trendData[trendData.length - 1].healthScore : 0;

  const exportHistoryToCSV = () => {
    if (healthChecks.length === 0) {
      toast.error('No health check data to export');
      return;
    }

    const csvRows = [
      ['Date', 'Status', 'Health Score', 'Failed Logins', 'Overdue Secrets', 'Open Tickets'].join(','),
      ...healthChecks.map(check => [
        format(check.timestamp, 'yyyy-MM-dd HH:mm:ss'),
        check.status,
        latestScore,
        check.failedLogins,
        check.overdueSecrets,
        check.openTickets,
      ].join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `health-check-history-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Health check history exported to CSV');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Health Check History</h3>
          {getStatusBadge(currentHealth)}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHealthHistory}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportHistoryToCSV}
          >
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Current Health Score */}
      <Card className="glass">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Health Score</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-3xl font-bold ${
                  latestScore >= 80 ? 'text-success' : 
                  latestScore >= 60 ? 'text-warning' : 'text-destructive'
                }`}>
                  {latestScore}%
                </span>
                {getTrend()}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="flex items-center gap-2 mt-1">
                {getStatusIcon(currentHealth)}
                <span className="capitalize font-medium">{currentHealth}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trend Chart */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Health Trend (24h)</CardTitle>
            <CardDescription>Derived from real login-attempt and secret-rotation activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                  interval="preserveStartEnd"
                />
                <YAxis 
                  domain={[0, 100]}
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="healthScore" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={false}
                  name="Health Score"
                />
                <Line 
                  type="monotone" 
                  dataKey="failedLogins" 
                  stroke="hsl(var(--destructive))" 
                  strokeWidth={2}
                  dot={false}
                  name="Failed Logins"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Check History Table */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent Health Checks</CardTitle>
          <CardDescription>Past 7 days from current security signals and open-ticket backlog</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium">Date</th>
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium">Status</th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">Failed Logins</th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">Overdue Secrets</th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">Open Tickets</th>
                </tr>
              </thead>
              <tbody>
                {healthChecks.map((check) => (
                  <tr key={check.id} className="border-b border-border/30 hover:bg-muted/30">
                    <td className="py-2 px-2 text-foreground">
                      {format(check.timestamp, 'MMM d, HH:mm')}
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(check.status)}
                        <span className="capitalize">{check.status}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Badge variant={check.failedLogins > 5 ? 'destructive' : 'secondary'}>
                        {check.failedLogins}
                      </Badge>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Badge variant={check.overdueSecrets > 0 ? 'destructive' : 'secondary'}>
                        {check.overdueSecrets}
                      </Badge>
                    </td>
                    <td className="py-2 px-2 text-center text-muted-foreground">
                      {check.openTickets}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
