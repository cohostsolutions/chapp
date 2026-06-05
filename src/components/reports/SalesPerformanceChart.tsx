import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Bar } from 'recharts';
import { useSalesPerformanceData } from '@/hooks/useReportingData';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';

export function SalesPerformanceChart() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useSalesPerformanceData(days);
  const formatCurrency = useFormatCurrency();

  if (isLoading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Booking Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Booking Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Failed to load data.</p>
        </CardContent>
      </Card>
    );
  }

  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
  const totalBookings = data.reduce((sum, d) => sum + d.bookings, 0);

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Booking Performance
        </CardTitle>
        <div className="flex gap-1">
          <Button 
            variant={days === 7 ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setDays(7)}
          >
            7D
          </Button>
          <Button 
            variant={days === 30 ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setDays(30)}
          >
            30D
          </Button>
          <Button 
            variant={days === 90 ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setDays(90)}
          >
            90D
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold text-chart-2">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold text-chart-3">{totalBookings}</p>
            <p className="text-xs text-muted-foreground">Bookings</p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="date" 
              className="text-xs fill-muted-foreground"
              tickLine={false}
              axisLine={false}
              interval={days <= 7 ? 0 : days <= 30 ? 4 : 10}
            />
            <YAxis 
              yAxisId="left"
              className="text-xs fill-muted-foreground"
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              className="text-xs fill-muted-foreground"
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'Revenue') return [formatCurrency(value), name];
                return [value, name];
              }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="bookings" fill="hsl(var(--chart-3))" name="Bookings" radius={[2, 2, 0, 0]} />
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey="revenue" 
              stroke="hsl(var(--chart-2))" 
              name="Revenue"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
