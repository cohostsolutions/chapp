import { useMemo, useState } from 'react';
import { devError } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { 
  MapPin, 
  Globe, 
  Clock, 
  AlertTriangle, 
  TrendingUp,
  Shield,
  XCircle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { format, formatDistanceToNow, subHours, getHours } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { LoginWorldMap } from './LoginWorldMap';
import { CountryBreakdown } from './CountryBreakdown';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LoginAttempt {
  id: string;
  email: string;
  ip_address: string | null;
  was_successful: boolean;
  attempted_at: string;
  country: string | null;
  country_code: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  isp: string | null;
}

interface LoginMonitoringDashboardProps {
  loginAttempts: LoginAttempt[];
  onRefresh?: () => void;
}

const CHART_COLORS = ['hsl(var(--destructive))', 'hsl(var(--primary))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export function LoginMonitoringDashboard({ loginAttempts, onRefresh }: LoginMonitoringDashboardProps) {
  const [isUpdatingGeo, setIsUpdatingGeo] = useState(false);

  // Prepare location data for the world map
  const locationData = useMemo(() => {
    const grouped = loginAttempts.reduce((acc, attempt) => {
      const key = `${attempt.country || 'Unknown'}-${attempt.city || 'Unknown'}`;
      if (!acc[key]) {
        acc[key] = {
          country: attempt.country,
          country_code: attempt.country_code,
          city: attempt.city,
          latitude: attempt.latitude,
          longitude: attempt.longitude,
          failed: 0,
          successful: 0,
        };
      }
      if (attempt.was_successful) {
        acc[key].successful++;
      } else {
        acc[key].failed++;
      }
      return acc;
    }, {} as Record<string, { country: string | null; country_code: string | null; city: string | null; latitude: number | null; longitude: number | null; failed: number; successful: number }>);
    
    return Object.values(grouped).filter(loc => loc.country || loc.latitude);
  }, [loginAttempts]);

  // Count attempts missing geolocation
  const missingGeoCount = useMemo(() => {
    return loginAttempts.filter(a => a.ip_address && !a.country).length;
  }, [loginAttempts]);

  const handleUpdateGeolocation = async () => {
    setIsUpdatingGeo(true);
    try {
      const { data, error } = await supabase.functions.invoke('geolocate-ip', {
        body: { batch_update: true }
      });
      
      if (error) throw error;
      
      toast.success(`Updated ${data.updated} login attempts with geolocation data`);
      onRefresh?.();
    } catch (error) {
      devError('Error updating geolocation:', error);
      toast.error('Failed to update geolocation data');
    } finally {
      setIsUpdatingGeo(false);
    }
  };
  // Group attempts by IP address
  const attemptsByIP = useMemo(() => {
    const grouped = loginAttempts.reduce((acc, attempt) => {
      const ip = attempt.ip_address || 'Unknown';
      if (!acc[ip]) {
        acc[ip] = { ip, total: 0, failed: 0, successful: 0, emails: new Set<string>(), lastAttempt: attempt.attempted_at };
      }
      acc[ip].total++;
      if (attempt.was_successful) {
        acc[ip].successful++;
      } else {
        acc[ip].failed++;
      }
      acc[ip].emails.add(attempt.email);
      if (new Date(attempt.attempted_at) > new Date(acc[ip].lastAttempt)) {
        acc[ip].lastAttempt = attempt.attempted_at;
      }
      return acc;
    }, {} as Record<string, { ip: string; total: number; failed: number; successful: number; emails: Set<string>; lastAttempt: string }>);

    return Object.values(grouped)
      .map(g => ({ ...g, emails: Array.from(g.emails), emailCount: g.emails.size }))
      .sort((a, b) => b.failed - a.failed);
  }, [loginAttempts]);

  // Suspicious IPs (high failure rate or multiple emails)
  const suspiciousIPs = useMemo(() => {
    return attemptsByIP.filter(ip => {
      const failureRate = ip.failed / ip.total;
      return (failureRate > 0.5 && ip.failed >= 3) || ip.emailCount > 3;
    });
  }, [attemptsByIP]);

  // Time pattern analysis - hourly distribution
  const hourlyDistribution = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ 
      hour: i, 
      label: `${i.toString().padStart(2, '0')}:00`,
      failed: 0, 
      successful: 0 
    }));
    
    loginAttempts.forEach(attempt => {
      const hour = getHours(new Date(attempt.attempted_at));
      if (attempt.was_successful) {
        hours[hour].successful++;
      } else {
        hours[hour].failed++;
      }
    });
    
    return hours;
  }, [loginAttempts]);

  // Daily trend for the last 7 days
  const dailyTrend = useMemo(() => {
    const days: Record<string, { date: string; failed: number; successful: number }> = {};
    const now = new Date();
    
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = format(date, 'MMM d');
      days[dateStr] = { date: dateStr, failed: 0, successful: 0 };
    }
    
    loginAttempts.forEach(attempt => {
      const dateStr = format(new Date(attempt.attempted_at), 'MMM d');
      if (days[dateStr]) {
        if (attempt.was_successful) {
          days[dateStr].successful++;
        } else {
          days[dateStr].failed++;
        }
      }
    });
    
    return Object.values(days);
  }, [loginAttempts]);

  // Email attack detection - multiple failed attempts for same email
  const targetedEmails = useMemo(() => {
    const emailStats = loginAttempts.reduce((acc, attempt) => {
      if (!acc[attempt.email]) {
        acc[attempt.email] = { email: attempt.email, failed: 0, successful: 0, ips: new Set<string>() };
      }
      if (attempt.was_successful) {
        acc[attempt.email].successful++;
      } else {
        acc[attempt.email].failed++;
      }
      if (attempt.ip_address) {
        acc[attempt.email].ips.add(attempt.ip_address);
      }
      return acc;
    }, {} as Record<string, { email: string; failed: number; successful: number; ips: Set<string> }>);

    return Object.values(emailStats)
      .filter(e => e.failed >= 3)
      .map(e => ({ ...e, ipCount: e.ips.size }))
      .sort((a, b) => b.failed - a.failed);
  }, [loginAttempts]);

  // Recent failed attempts (last 24 hours)
  const recentFailedAttempts = useMemo(() => {
    const cutoff = subHours(new Date(), 24);
    return loginAttempts
      .filter(a => !a.was_successful && new Date(a.attempted_at) > cutoff)
      .sort((a, b) => new Date(b.attempted_at).getTime() - new Date(a.attempted_at).getTime());
  }, [loginAttempts]);

  // Success/Failure ratio for pie chart
  const overallStats = useMemo(() => {
    const failed = loginAttempts.filter(a => !a.was_successful).length;
    const successful = loginAttempts.filter(a => a.was_successful).length;
    return [
      { name: 'Failed', value: failed },
      { name: 'Successful', value: successful },
    ];
  }, [loginAttempts]);

  return (
    <div className="space-y-6">
      {/* Alert Banner for Suspicious Activity */}
      {suspiciousIPs.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  {suspiciousIPs.length} Suspicious IP{suspiciousIPs.length > 1 ? 's' : ''} Detected
                </p>
                <p className="text-sm text-muted-foreground">
                  High failure rates or multiple email attempts detected from these addresses
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Geolocation Update Banner */}
      {missingGeoCount > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="font-medium text-amber-600 dark:text-amber-400">
                    {missingGeoCount} login attempts missing geolocation data
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Click update to fetch location data for these IPs
                  </p>
                </div>
              </div>
              <Button 
                size="sm" 
                onClick={handleUpdateGeolocation}
                disabled={isUpdatingGeo}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isUpdatingGeo ? 'animate-spin' : ''}`} />
                {isUpdatingGeo ? 'Updating...' : 'Update Geolocation'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* World Map */}
      {locationData.length > 0 && (
        <LoginWorldMap locations={locationData} />
      )}

      {/* Country Breakdown and Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CountryBreakdown loginAttempts={loginAttempts} />
        
        {/* Success/Failure Ratio */}
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Success Ratio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={overallStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {overallStats.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Daily Trend */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Login Attempts (7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="successful" 
                stackId="1" 
                stroke="hsl(var(--primary))" 
                fill="hsl(var(--primary))" 
                fillOpacity={0.3}
                name="Successful"
              />
              <Area 
                type="monotone" 
                dataKey="failed" 
                stackId="1" 
                stroke="hsl(var(--destructive))" 
                fill="hsl(var(--destructive))" 
                fillOpacity={0.3}
                name="Failed"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Hourly Distribution */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Hourly Login Pattern
          </CardTitle>
          <CardDescription>Login attempts distribution by hour of day</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={hourlyDistribution}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 10 }} 
                interval={2}
                className="text-muted-foreground" 
              />
              <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }} 
              />
              <Bar dataKey="successful" stackId="a" fill="hsl(var(--primary))" name="Successful" />
              <Bar dataKey="failed" stackId="a" fill="hsl(var(--destructive))" name="Failed" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Suspicious IPs */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4 text-destructive" />
              High-Risk IP Addresses
            </CardTitle>
            <CardDescription>IPs with high failure rates or multiple target emails</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {suspiciousIPs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <CheckCircle className="w-8 h-8 mb-2 text-green-500" />
                  <p>No suspicious IPs detected</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP Address</TableHead>
                      <TableHead className="text-center">Failed</TableHead>
                      <TableHead className="text-center">Emails</TableHead>
                      <TableHead>Last Seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suspiciousIPs.slice(0, 10).map((ip) => (
                      <TableRow key={ip.ip}>
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            {ip.ip}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="destructive">{ip.failed}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{ip.emailCount}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(ip.lastAttempt), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Targeted Emails */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Targeted Accounts
            </CardTitle>
            <CardDescription>Accounts with multiple failed login attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {targetedEmails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <CheckCircle className="w-8 h-8 mb-2 text-green-500" />
                  <p>No targeted accounts detected</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-center">Failed</TableHead>
                      <TableHead className="text-center">IPs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targetedEmails.slice(0, 10).map((email) => (
                      <TableRow key={email.email}>
                        <TableCell className="text-sm truncate max-w-[200px]">
                          {email.email}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="destructive">{email.failed}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{email.ipCount}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Recent Failed Attempts Timeline */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <XCircle className="w-4 h-4 text-destructive" />
            Recent Failed Attempts (24h)
          </CardTitle>
          <CardDescription>Timeline of failed login attempts in the last 24 hours</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[250px]">
            {recentFailedAttempts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCircle className="w-8 h-8 mb-2 text-green-500" />
                <p>No failed attempts in the last 24 hours</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentFailedAttempts.map((attempt) => (
                  <div 
                    key={attempt.id} 
                    className="flex items-center gap-3 p-2 rounded-lg border border-border/50 hover:bg-muted/50"
                  >
                    <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{attempt.email}</p>
                      <p className="text-xs text-muted-foreground">
                        IP: {attempt.ip_address || 'Unknown'}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(attempt.attempted_at), 'HH:mm:ss')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
