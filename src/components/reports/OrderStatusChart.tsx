import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { UtensilsCrossed, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, parseISO, startOfDay } from 'date-fns';
import { resolveReportingDateRange, useReportingFilters } from '@/contexts/ReportingFiltersContext';

const STATUS_COLORS: Record<string, string> = {
  pending: 'hsl(38 92% 50%)',      // warning
  confirmed: 'hsl(199 89% 48%)',   // info
  preparing: 'hsl(187 85% 38%)',   // primary
  ready: 'hsl(142 76% 36%)',       // success
  completed: 'hsl(142 76% 36%)',   // success
  cancelled: 'hsl(0 72% 51%)',     // destructive
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready for Pickup',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function OrderStatusChart() {
  const { profile } = useAuth();
  const formatCurrency = useFormatCurrency();
  const filters = useReportingFilters();
  const resolvedDateRange = resolveReportingDateRange(filters);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['order-status-chart', profile?.organization_id, filters.dateRange, filters.startDate, filters.endDate],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      let query = supabase
        .from('orders')
        .select('id, status, total_amount, created_at')
        .eq('organization_id', profile.organization_id);

      if (resolvedDateRange.start) {
        query = query.gte('created_at', resolvedDateRange.start.toISOString());
      }
      if (resolvedDateRange.end) {
        query = query.lte('created_at', resolvedDateRange.end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.organization_id,
  });

  if (isLoading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-primary" />
            Order Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-primary" />
            Order Status
          </CardTitle>
          <CardDescription>Track order fulfillment status</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No orders yet.</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate status distribution
  const statusCounts: Record<string, number> = {};
  orders.forEach((order) => {
    const status = order.status || 'pending';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  const chartData = Object.entries(statusCounts).map(([status, count]) => ({
    status: STATUS_LABELS[status] || status,
    count,
    percentage: (count / orders.length) * 100,
    color: STATUS_COLORS[status] || 'hsl(var(--muted))',
  }));

  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.status === 'completed').length;
  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length;
  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UtensilsCrossed className="w-5 h-5 text-primary" />
          Order Status
        </CardTitle>
        <CardDescription>Track order fulfillment status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
          <ResponsiveContainer width={200} height={200}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
                nameKey="status"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          
          <div className="space-y-3 flex-1">
            {chartData.map((item) => (
              <div key={item.status} className="flex items-center gap-3">
                <div 
                  className="w-4 h-4 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex-1">
                  <p className="font-medium">{item.status}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.count} orders ({item.percentage.toFixed(0)}%)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-success mb-1">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold">{completedOrders}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-warning mb-1">
              <Clock className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold">{pendingOrders}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-info mb-1">
              <TrendingUp className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
