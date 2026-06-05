import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface DayData {
  date: string;
  cold: number;
  warm: number;
  hot: number;
}

export function LeadTemperatureTrends() {
  const { profile } = useAuth();
  const [data, setData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrends = async () => {
    if (!profile?.organization_id) return;
    setLoading(true);

    try {
      const days: DayData[] = [];
      
      // Get data for the last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dayStart = startOfDay(date).toISOString();
        const dayEnd = endOfDay(date).toISOString();

        // Query leads that existed on that day (created before day end)
        // and get their temperature state
        const { data: leads, error } = await supabase
          .from('leads')
          .select('lead_temperature, created_at, updated_at')
          .eq('organization_id', profile.organization_id)
          .lte('created_at', dayEnd);

        if (error) throw error;

        const counts = { cold: 0, warm: 0, hot: 0 };
        
        leads?.forEach(lead => {
          // For simplicity, use current temperature
          // In production, you'd track historical temperature changes
          const temp = lead.lead_temperature as 'cold' | 'warm' | 'hot' | null;
          if (temp && temp in counts) {
            counts[temp]++;
          }
        });

        days.push({
          date: format(date, 'EEE'),
          ...counts,
        });
      }

      setData(days);
    } catch (error) {
      console.error('Error fetching temperature trends:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, [profile?.organization_id]);

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ color?: string; name?: string; value?: number }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground capitalize">{entry.name}:</span>
              <span className="font-medium text-foreground">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base lg:text-lg font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5 text-primary" />
            Temperature Trends (7 Days)
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchTrends}
            disabled={loading}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 lg:p-6 pt-0">
        <div className="h-[250px] w-full">
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorCold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorWarm" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorHot" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ paddingTop: '10px' }}
                  formatter={(value) => (
                    <span className="text-sm text-muted-foreground capitalize">{value}</span>
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="cold"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCold)"
                />
                <Area
                  type="monotone"
                  dataKey="warm"
                  stroke="#f97316"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorWarm)"
                />
                <Area
                  type="monotone"
                  dataKey="hot"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorHot)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              {loading ? 'Loading trends...' : 'No data available'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
