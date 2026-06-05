import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { ChefHat, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { resolveReportingDateRange, useReportingFilters } from '@/contexts/ReportingFiltersContext';

const COLORS = [
  'hsl(187 85% 38%)',  // primary
  'hsl(142 76% 36%)',  // success
  'hsl(38 92% 50%)',   // warning
  'hsl(199 89% 48%)',  // info
  'hsl(280 65% 60%)',  // purple
  'hsl(340 75% 55%)',  // pink
];

interface OrderItem {
  name?: string;
  quantity?: number;
  price?: number;
}

export function MenuPerformanceChart() {
  const { profile } = useAuth();
  const formatCurrency = useFormatCurrency();
  const filters = useReportingFilters();
  const resolvedDateRange = resolveReportingDateRange(filters);

  const { data, isLoading } = useQuery({
    queryKey: ['menu-performance', profile?.organization_id, filters.dateRange, filters.startDate, filters.endDate],
    queryFn: async () => {
      if (!profile?.organization_id) return { items: [], offerings: [] };
      
      const [ordersRes, offeringsRes] = await Promise.all([
        (() => {
          let ordersQuery = supabase
          .from('orders')
          .select('order_items')
          .eq('organization_id', profile.organization_id);

          if (resolvedDateRange.start) {
            ordersQuery = ordersQuery.gte('created_at', resolvedDateRange.start.toISOString());
          }
          if (resolvedDateRange.end) {
            ordersQuery = ordersQuery.lte('created_at', resolvedDateRange.end.toISOString());
          }

          return ordersQuery;
        })(),
        supabase
          .from('offerings')
          .select('id, name, price, category')
          .eq('organization_id', profile.organization_id)
          .eq('is_active', true),
      ]);

      return {
        orders: ordersRes.data || [],
        offerings: offeringsRes.data || [],
      };
    },
    enabled: !!profile?.organization_id,
  });

  if (isLoading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-primary" />
            Menu Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Aggregate item sales from orders
  const itemSales: Record<string, { count: number; revenue: number }> = {};
  
  data?.orders?.forEach((order) => {
    const items = order.order_items as OrderItem[] | null;
    if (Array.isArray(items)) {
      items.forEach((item) => {
        const name = item.name || 'Unknown Item';
        if (!itemSales[name]) {
          itemSales[name] = { count: 0, revenue: 0 };
        }
        itemSales[name].count += item.quantity || 1;
        itemSales[name].revenue += (item.price || 0) * (item.quantity || 1);
      });
    }
  });

  const chartData = Object.entries(itemSales)
    .map(([name, stats]) => ({
      name: name.length > 20 ? name.substring(0, 17) + '...' : name,
      fullName: name,
      count: stats.count,
      revenue: stats.revenue,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8); // Top 8 items

  if (chartData.length === 0) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-primary" />
            Menu Performance
          </CardTitle>
          <CardDescription>Top selling menu items</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No order data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  const totalItemsSold = chartData.reduce((sum, item) => sum + item.count, 0);
  const totalRevenue = chartData.reduce((sum, item) => sum + item.revenue, 0);

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-primary" />
          Menu Performance
        </CardTitle>
        <CardDescription>Top selling menu items</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" className="text-xs fill-muted-foreground" />
            <YAxis 
              dataKey="name" 
              type="category" 
              className="text-xs fill-muted-foreground"
              width={100}
              tick={{ fontSize: 11 }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number, name: string, _props: unknown) => {
                if (name === 'count') {
                  return [`${value} sold`, 'Quantity'];
                }
                return [value, name];
              }}
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                  return payload[0].payload.fullName;
                }
                return label;
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{totalItemsSold}</p>
            <p className="text-xs text-muted-foreground">Items Sold</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-success">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
