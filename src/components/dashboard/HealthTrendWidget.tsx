import { useState, useEffect } from 'react';
import { devError } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  HeartPulse, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  CheckCircle,
  Bell,
  BellOff,
  Volume2,
  VolumeX
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { subDays, subHours, format } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useHealthAlerts } from '@/hooks/useHealthAlerts';

interface TrendData {
  time: string;
  score: number;
}

export function HealthTrendWidget() {
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [currentScore, setCurrentScore] = useState(100);
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable');
  const [status, setStatus] = useState<'healthy' | 'warning' | 'critical'>('healthy');
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { requestPermission, soundEnabled, setSoundEnabled } = useHealthAlerts(70);

  const toggleAlerts = async () => {
    if (!alertsEnabled) {
      const granted = await requestPermission();
      setAlertsEnabled(granted);
    } else {
      setAlertsEnabled(false);
    }
  };

  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        const now = new Date();
        
        // Fetch recent login attempts for health scoring
        const [loginRes, secretsRes] = await Promise.all([
          supabase.from('login_attempts').select('*').gte('attempted_at', subDays(now, 1).toISOString()),
          supabase.from('secret_rotation_tracking').select('*'),
        ]);

        const failedLogins = loginRes.data?.filter(a => !a.was_successful) || [];
        const secrets = secretsRes.data || [];

        // Calculate overdue secrets
        const overdueSecrets = secrets.filter(s => {
          if (!s.last_rotated_at) return true;
          const lastRotated = new Date(s.last_rotated_at);
          const daysSince = (now.getTime() - lastRotated.getTime()) / (1000 * 60 * 60 * 24);
          return daysSince > s.rotation_interval_days;
        }).length;

        // Generate deterministic trend data for the last 12 hours.
        const trends: TrendData[] = [];
        for (let i = 11; i >= 0; i--) {
          const hourTime = subHours(now, i);
          const hourStart = subHours(hourTime, 1);
          const hourFailedLogins = failedLogins.filter(
            l => new Date(l.attempted_at) >= hourStart && 
                 new Date(l.attempted_at) < hourTime
          ).length;

          const score = Math.max(0, Math.min(100, 100 - (overdueSecrets * 12) - (hourFailedLogins * 8)));

          trends.push({
            time: format(hourTime, 'HH:mm'),
            score,
          });
        }

        setTrendData(trends);

        // Calculate current score
        const latestScore = trends[trends.length - 1]?.score || 100;
        setCurrentScore(latestScore);

        // Determine trend
        if (trends.length >= 2) {
          const latest = trends[trends.length - 1].score;
          const previous = trends[trends.length - 2].score;
          if (latest > previous + 2) setTrend('up');
          else if (latest < previous - 2) setTrend('down');
          else setTrend('stable');
        }

        // Determine status
        if (latestScore < 50 || overdueSecrets > 2) setStatus('critical');
        else if (latestScore < 70 || overdueSecrets > 0) setStatus('warning');
        else setStatus('healthy');

        setLastUpdated(now);

      } catch (error) {
        devError('Error fetching health data:', error);
      }
    };

    fetchHealthData();
    const interval = setInterval(fetchHealthData, 60000);
    return () => clearInterval(interval);
  }, []);

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-success" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-destructive" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'healthy':
        return (
          <Badge className="bg-success/10 text-success border-success/20 gap-1">
            <CheckCircle className="w-3 h-3" />
            Healthy
          </Badge>
        );
      case 'warning':
        return (
          <Badge className="bg-warning/10 text-warning border-warning/20 gap-1">
            <AlertTriangle className="w-3 h-3" />
            Warning
          </Badge>
        );
      case 'critical':
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
            <AlertTriangle className="w-3 h-3" />
            Critical
          </Badge>
        );
    }
  };

  const getScoreColor = () => {
    if (currentScore >= 80) return 'text-success';
    if (currentScore >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getChartColor = () => {
    if (currentScore >= 80) return 'hsl(var(--success))';
    if (currentScore >= 60) return 'hsl(var(--warning))';
    return 'hsl(var(--destructive))';
  };

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-primary" />
            System Health
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="h-7 px-2"
              title={soundEnabled ? 'Disable sound alerts' : 'Enable sound alerts'}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-primary" />
              ) : (
                <VolumeX className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAlerts}
              className="h-7 px-2"
              title={alertsEnabled ? 'Disable browser alerts' : 'Enable browser alerts'}
            >
              {alertsEnabled ? (
                <Bell className="w-4 h-4 text-primary" />
              ) : (
                <BellOff className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
            {getStatusBadge()}
          </div>
        </div>
        <CardDescription>Derived from failed login attempts and overdue secret rotations over the last 12 hours</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-3xl font-bold ${getScoreColor()}`}>
              {currentScore}%
            </span>
            {getTrendIcon()}
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>{lastUpdated ? `Updated ${format(lastUpdated, 'HH:mm:ss')}` : 'Awaiting data'}</p>
          </div>
        </div>

        <div className="h-[100px] -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="healthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={getChartColor()} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={getChartColor()} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis 
                domain={[0, 100]}
                hide
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                formatter={(value: number) => [`${value}%`, 'Health Score']}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke={getChartColor()}
                strokeWidth={2}
                fill="url(#healthGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
