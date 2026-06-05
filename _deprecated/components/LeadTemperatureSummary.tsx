import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Flame, Thermometer, Snowflake, Bell, RefreshCw, TrendingUp, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface LeadCount {
  cold: number;
  warm: number;
  hot: number;
}

interface RecentAlert {
  id: string;
  name: string;
  temperature: 'warm' | 'hot';
  updatedAt: string;
}

export function LeadTemperatureSummary() {
  const { profile } = useAuth();
  const [counts, setCounts] = useState<LeadCount>({ cold: 0, warm: 0, hot: 0 });
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!profile?.organization_id) return;

    try {
      // Fetch lead counts by temperature
      const { data: leads, error } = await supabase
        .from('leads')
        .select('id, name, lead_temperature, updated_at')
        .eq('organization_id', profile.organization_id);

      if (error) throw error;

      const tempCounts: LeadCount = { cold: 0, warm: 0, hot: 0 };
      const alerts: RecentAlert[] = [];

      leads?.forEach(lead => {
        const temp = lead.lead_temperature as 'cold' | 'warm' | 'hot' | null;
        if (temp && temp in tempCounts) {
          tempCounts[temp]++;
        }
        
        // Get warm/hot leads from last 24 hours as recent alerts
        if ((temp === 'warm' || temp === 'hot') && lead.updated_at) {
          const updatedAt = new Date(lead.updated_at);
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          if (updatedAt > oneDayAgo) {
            alerts.push({
              id: lead.id,
              name: lead.name,
              temperature: temp,
              updatedAt: lead.updated_at,
            });
          }
        }
      });

      // Sort alerts by most recent
      alerts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      setCounts(tempCounts);
      setRecentAlerts(alerts.slice(0, 5));
    } catch (error) {
      console.error('Error fetching temperature summary:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('temperature-summary')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.organization_id]);

  const totalActive = counts.warm + counts.hot;

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base lg:text-lg font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5 text-primary" />
            Lead Temperature Summary
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 lg:p-6 pt-0">
        {/* Temperature Counts */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="flex flex-col items-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Snowflake className="w-5 h-5 text-blue-400 mb-1" />
            <span className="text-2xl font-bold text-blue-400">{counts.cold}</span>
            <span className="text-xs text-muted-foreground">Cold</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <Thermometer className="w-5 h-5 text-orange-400 mb-1" />
            <span className="text-2xl font-bold text-orange-400">{counts.warm}</span>
            <span className="text-xs text-muted-foreground">Warm</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <Flame className="w-5 h-5 text-red-400 mb-1" />
            <span className="text-2xl font-bold text-red-400">{counts.hot}</span>
            <span className="text-xs text-muted-foreground">Hot</span>
          </div>
        </div>

        {/* Active Leads Banner */}
        {totalActive > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 mb-4">
            <Bell className="w-4 h-4 text-primary" />
            <span className="text-sm text-foreground">
              <span className="font-semibold">{totalActive}</span> leads need attention
            </span>
          </div>
        )}

        {/* Recent Alerts */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Recent Alerts (24h)
          </h4>
          {recentAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">
              No warm/hot leads in the last 24 hours
            </p>
          ) : (
            <div className="space-y-2">
              {recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-secondary/50"
                >
                  <div className="flex items-center gap-2">
                    {alert.temperature === 'hot' ? (
                      <Flame className="w-4 h-4 text-red-400" />
                    ) : (
                      <Thermometer className="w-4 h-4 text-orange-400" />
                    )}
                    <span className="text-sm font-medium text-foreground">{alert.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        alert.temperature === 'hot'
                          ? 'bg-red-500/20 text-red-400 border-red-500/30'
                          : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                      )}
                    >
                      {alert.temperature}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(alert.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
