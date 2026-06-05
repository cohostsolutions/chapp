import { useState, useMemo, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Users,
  Target,
  Zap,
  MessageSquare,
  ArrowRight,
  ChevronRight,
  X,
  BedDouble
} from 'lucide-react';
import { 
  BarChart as RechartsBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from 'recharts';
import { format, subDays, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getAgentAwareLeadLabel, getAgentAwareLeadNoun } from '@/lib/reportingAgentConfig';

type ComparisonPeriod = '7days' | '30days' | '90days';

interface Lead {
  id: string;
  created_at: string;
  status?: string;
  lead_temperature?: string;
  qualification_status?: string;
  source?: string;
  assigned_agent_id?: string;
  [key: string]: unknown;
}

interface Order {
  id: string;
  created_at: string;
  total_amount?: number;
  status?: string;
}

interface Conversation {
  id: string;
  messages: unknown[];
  channel?: string;
}

interface Booking {
  id: string;
  created_at: string;
  status?: string;
}

interface Meeting {
  id: string;
  created_at: string;
  start_time?: string;
  appointment_source?: string;
}

interface ReportComparisonProps {
  leads: Lead[];
  orders: Order[];
  conversations: Conversation[];
  bookings?: Booking[];
  meetings?: Meeting[];
  isLoading: boolean;
}

interface ComparisonMetric {
  label: string;
  key: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  format?: 'number' | 'currency' | 'percent';
  icon: React.ReactNode;
  color: string;
  drilldownType: 'source' | 'status' | 'temperature' | 'agent' | 'order_status' | null;
}

const periodLabels: Record<ComparisonPeriod, string> = {
  '7days': 'Last 7 days',
  '30days': 'Last 30 days',
  '90days': 'Last 90 days',
};

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function ReportComparison({ leads, orders, conversations, bookings = [], meetings = [], isLoading }: ReportComparisonProps) {
  const [period, setPeriod] = useState<ComparisonPeriod>('30days');
  const [drilldownMetric, setDrilldownMetric] = useState<ComparisonMetric | null>(null);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const { profile } = useAuth();
  const formatCurrency = useFormatCurrency();

  // Check if CeCe or Jay organization
  const { data: organization } = useQuery({
    queryKey: ['org-agent-type-comparison', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;
      const { data } = await supabase
        .from('organizations')
        .select('ai_agent_type')
        .eq('id', profile.organization_id)
        .single();
      return data;
    },
    enabled: !!profile?.organization_id,
    staleTime: 5 * 60 * 1000,
  });

  const isCece = organization?.ai_agent_type === 'cece';
  const leadLabel = getAgentAwareLeadLabel(organization?.ai_agent_type);
  const leadNoun = getAgentAwareLeadNoun(organization?.ai_agent_type);
  const singularLeadLabel = 'Inquiry';

  const { currentInterval, previousInterval } = useMemo(() => {
    const now = new Date();
    const days = period === '7days' ? 7 : period === '30days' ? 30 : 90;
    
    return {
      currentInterval: {
        start: startOfDay(subDays(now, days)),
        end: endOfDay(now),
      },
      previousInterval: {
        start: startOfDay(subDays(now, days * 2)),
        end: endOfDay(subDays(now, days + 1)),
      },
    };
  }, [period]);

  const filterByInterval = <T extends { created_at: string }>(data: T[], interval: { start: Date; end: Date }) => {
    return data.filter(item => {
      try {
        const date = parseISO(item.created_at);
        return isWithinInterval(date, interval);
      } catch {
        return false;
      }
    });
  };

  const currentLeads = useMemo(() => filterByInterval(leads, currentInterval), [leads, currentInterval]);
  const previousLeads = useMemo(() => filterByInterval(leads, previousInterval), [leads, previousInterval]);
  
  const currentOrders = useMemo(() => filterByInterval(orders, currentInterval), [orders, currentInterval]);
  const previousOrders = useMemo(() => filterByInterval(orders, previousInterval), [orders, previousInterval]);

  const calculateChange = (current: number, previous: number) => {
    const change = current - previous;
    const changePercent = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
    return { change, changePercent };
  };

  const currentBookings = useMemo(() => filterByInterval(bookings, currentInterval), [bookings, currentInterval]);
  const previousBookings = useMemo(() => filterByInterval(bookings, previousInterval), [bookings, previousInterval]);

  const currentMeetings = useMemo(() => filterByInterval(meetings, currentInterval), [meetings, currentInterval]);
  const previousMeetings = useMemo(() => filterByInterval(meetings, previousInterval), [meetings, previousInterval]);

  const metrics: ComparisonMetric[] = useMemo(() => {
    const currentTotalLeads = currentLeads.length;
    const previousTotalLeads = previousLeads.length;
    const leadsChange = calculateChange(currentTotalLeads, previousTotalLeads);

    const currentQualified = currentLeads.filter(l => l.qualification_status === 'qualified').length;
    const previousQualified = previousLeads.filter(l => l.qualification_status === 'qualified').length;
    const qualifiedChange = calculateChange(currentQualified, previousQualified);

    const currentConverted = currentLeads.filter(l => l.status === 'converted').length;
    const previousConverted = previousLeads.filter(l => l.status === 'converted').length;
    const currentConversionRate = currentTotalLeads > 0 ? (currentConverted / currentTotalLeads) * 100 : 0;
    const previousConversionRate = previousTotalLeads > 0 ? (previousConverted / previousTotalLeads) * 100 : 0;
    const conversionChange = calculateChange(currentConversionRate, previousConversionRate);

    const currentHotLeads = currentLeads.filter(l => l.lead_temperature === 'hot').length;
    const previousHotLeads = previousLeads.filter(l => l.lead_temperature === 'hot').length;
    const hotLeadsChange = calculateChange(currentHotLeads, previousHotLeads);

    // Base metrics for all organizations
    const baseMetrics: ComparisonMetric[] = [
      {
        key: 'total_leads',
        label: `Total ${leadLabel}`,
        current: currentTotalLeads,
        previous: previousTotalLeads,
        ...leadsChange,
        icon: <Users className="w-5 h-5" />,
        color: 'text-primary',
        drilldownType: 'source' as const,
      },
      {
        key: 'qualified_leads',
        label: `Qualified ${leadLabel}`,
        current: currentQualified,
        previous: previousQualified,
        ...qualifiedChange,
        icon: <Target className="w-5 h-5" />,
        color: 'text-success',
        drilldownType: 'status' as const,
      },
      {
        key: 'conversion_rate',
        label: 'Conversion Rate',
        current: currentConversionRate,
        previous: previousConversionRate,
        ...conversionChange,
        format: 'percent' as const,
        icon: <TrendingUp className="w-5 h-5" />,
        color: 'text-chart-2',
        drilldownType: 'status' as const,
      },
      {
        key: 'hot_leads',
        label: `Hot ${leadLabel}`,
        current: currentHotLeads,
        previous: previousHotLeads,
        ...hotLeadsChange,
        icon: <Target className="w-5 h-5" />,
        color: 'text-destructive',
        drilldownType: 'temperature' as const,
      },
    ];

    // For CeCe, show bookings instead of orders
    if (isCece) {
      const bookingsChange = calculateChange(currentBookings.length, previousBookings.length);
      const confirmedCurrent = currentBookings.filter(b => b.status === 'upcoming' || b.status === 'checked_in' || b.status === 'checked_out').length;
      const confirmedPrevious = previousBookings.filter(b => b.status === 'upcoming' || b.status === 'checked_in' || b.status === 'checked_out').length;
      const confirmationChange = calculateChange(confirmedCurrent, confirmedPrevious);

      return [
        ...baseMetrics,
        {
          key: 'total_bookings',
          label: 'Total Bookings',
          current: currentBookings.length,
          previous: previousBookings.length,
          ...bookingsChange,
          icon: <BedDouble className="w-5 h-5" />,
          color: 'text-chart-3',
          drilldownType: null,
        },
        {
          key: 'confirmed_bookings',
          label: 'Confirmed Bookings',
          current: confirmedCurrent,
          previous: confirmedPrevious,
          ...confirmationChange,
          icon: <BedDouble className="w-5 h-5" />,
          color: 'text-chart-4',
          drilldownType: null,
        },
      ];
    }

    // For Cece, show bookings
    const bookingRevenue = currentBookings.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);
    const prevBookingRevenue = previousBookings.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);
    const revenueChange = calculateChange(bookingRevenue, prevBookingRevenue);

    return [
      ...baseMetrics,
      {
        key: 'total_revenue',
        label: 'Total Revenue',
        current: bookingRevenue,
        previous: prevBookingRevenue,
        ...revenueChange,
        format: 'currency' as const,
        icon: <Zap className="w-5 h-5" />,
        color: 'text-chart-3',
        drilldownType: 'booking_status' as const,
      },
      {
        key: 'total_bookings',
        label: 'Total Bookings',
        current: currentBookings.length,
        previous: previousBookings.length,
        ...calculateChange(currentBookings.length, previousBookings.length),
        icon: <BedDouble className="w-5 h-5" />,
        color: 'text-chart-4',
        drilldownType: 'booking_status' as const,
      },
    ];
  }, [currentLeads, previousLeads, currentOrders, previousOrders, currentBookings, previousBookings, currentMeetings, previousMeetings, isCece, leadLabel]);

  const chartData = useMemo(() => {
    return metrics.map(m => ({
      name: m.label,
      current: m.format === 'percent' ? m.current : m.current,
      previous: m.format === 'percent' ? m.previous : m.previous,
    }));
  }, [metrics]);

  // Drilldown data based on selected metric
  const drilldownData = useMemo(() => {
    if (!drilldownMetric) return { current: [], previous: [] };

    const normalizeSource = (source: string | undefined) => {
      if (!source) return 'Direct';
      if (source.startsWith('messenger:')) return 'Facebook';
      if (source.startsWith('whatsapp:')) return 'WhatsApp';
      if (source.startsWith('instagram:')) return 'Instagram';
      return source;
    };

     const groupBy = <T extends object>(
       arr: T[],
       key: keyof T,
       transform?: (val: unknown) => string
     ) => {
       const grouped: Record<string, number> = {};
       arr.forEach(item => {
         const raw = (item as any)[key] as unknown;
         const val = transform
           ? transform(raw)
           : (typeof raw === 'string' && raw.trim().length > 0 ? raw : 'Unknown');
         grouped[val] = (grouped[val] || 0) + 1;
       });
       return Object.entries(grouped).map(([name, value]) => ({ name, value }));
     };

    switch (drilldownMetric.drilldownType) {
      case 'source':
        return {
          current: groupBy(currentLeads, 'source', normalizeSource),
          previous: groupBy(previousLeads, 'source', normalizeSource),
        };
      case 'status':
        return {
          current: groupBy(currentLeads, 'status'),
          previous: groupBy(previousLeads, 'status'),
        };
      case 'temperature':
        return {
          current: groupBy(currentLeads, 'lead_temperature'),
          previous: groupBy(previousLeads, 'lead_temperature'),
        };
      case 'order_status':
        return {
          current: groupBy(currentOrders, 'status'),
          previous: groupBy(previousOrders, 'status'),
        };
      default:
        return { current: [], previous: [] };
    }
  }, [drilldownMetric, currentLeads, previousLeads, currentOrders, previousOrders]);

  const handleDrilldown = (metric: ComparisonMetric) => {
    if (metric.drilldownType) {
      setDrilldownMetric(metric);
      setDrilldownOpen(true);
    }
  };

  const formatValue = (value: number, format?: 'number' | 'currency' | 'percent') => {
    if (format === 'currency') return formatCurrency(value);
    if (format === 'percent') return `${value.toFixed(1)}%`;
    return value.toLocaleString();
  };

  const getChangeIcon = (changePercent: number) => {
    if (changePercent > 0) return <TrendingUp className="w-4 h-4" />;
    if (changePercent < 0) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getChangeColor = (changePercent: number) => {
    if (changePercent > 0) return 'text-success bg-success/10';
    if (changePercent < 0) return 'text-destructive bg-destructive/10';
    return 'text-muted-foreground bg-muted';
  };

  const getDrilldownTitle = () => {
    if (!drilldownMetric) return '';
    switch (drilldownMetric.drilldownType) {
      case 'source': return `${singularLeadLabel} Source Breakdown`;
      case 'status': return `${singularLeadLabel} Status Breakdown`;
      case 'temperature': return `${singularLeadLabel} Temperature Breakdown`;
      case 'order_status': return 'Breakdown by Order Status';
      default: return 'Breakdown';
    }
  };

  const days = period === '7days' ? 7 : period === '30days' ? 30 : 90;

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Period Comparison</h3>
          <p className="text-sm text-muted-foreground">
            Compare {periodLabels[period]} vs previous {days} days across your {leadNoun} pipeline
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as ComparisonPeriod)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border shadow-lg z-50">
            <SelectItem value="7days">Last 7 days</SelectItem>
            <SelectItem value="30days">Last 30 days</SelectItem>
            <SelectItem value="90days">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Period Labels */}
      <div className="flex items-center justify-center gap-4 p-4 bg-muted/30 rounded-lg">
        <div className="text-center">
          <Badge variant="outline" className="mb-1">Previous Period</Badge>
          <p className="text-xs text-muted-foreground">
            {format(previousInterval.start, 'MMM d')} - {format(previousInterval.end, 'MMM d, yyyy')}
          </p>
        </div>
        <ArrowRight className="w-5 h-5 text-muted-foreground" />
        <div className="text-center">
          <Badge className="mb-1">Current Period</Badge>
          <p className="text-xs text-muted-foreground">
            {format(currentInterval.start, 'MMM d')} - {format(currentInterval.end, 'MMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Comparison Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <Card 
            key={metric.key} 
            className={cn(
              "glass transition-all",
              metric.drilldownType && "cursor-pointer hover:border-primary/50 hover:shadow-lg"
            )}
            onClick={() => handleDrilldown(metric)}
          >
            <CardContent className="p-6">
              {isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", `${metric.color}/10`)}>
                      <span className={metric.color}>{metric.icon}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={cn("gap-1", getChangeColor(metric.changePercent))}>
                        {getChangeIcon(metric.changePercent)}
                        {metric.changePercent > 0 ? '+' : ''}{metric.changePercent.toFixed(1)}%
                      </Badge>
                      {metric.drilldownType && (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  
                  <h4 className="text-sm text-muted-foreground">{metric.label}</h4>
                  
                  <div className="flex items-end gap-4 mt-2">
                    <div>
                      <p className="text-2xl font-bold">{formatValue(metric.current, metric.format)}</p>
                      <p className="text-xs text-muted-foreground">Current</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg text-muted-foreground">{formatValue(metric.previous, metric.format)}</p>
                      <p className="text-xs text-muted-foreground">Previous</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t flex items-center justify-between">
                    <p className="text-xs">
                      <span className={metric.change >= 0 ? 'text-success' : 'text-destructive'}>
                        {metric.change >= 0 ? '+' : ''}{formatValue(metric.change, metric.format)}
                      </span>
                      <span className="text-muted-foreground"> vs previous period</span>
                    </p>
                    {metric.drilldownType && (
                      <span className="text-xs text-primary">View details</span>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparison Chart */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Side-by-Side Comparison</CardTitle>
          <CardDescription>Current period vs previous period metrics</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[350px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <RechartsBarChart data={chartData} layout="vertical" barGap={4}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={100}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, name: string) => [
                    typeof value === 'number' ? value.toLocaleString() : value,
                    name === 'current' ? 'Current Period' : 'Previous Period'
                  ]}
                />
                <Bar 
                  dataKey="previous" 
                  fill="hsl(var(--muted-foreground))" 
                  radius={[0, 4, 4, 0]}
                  name="previous"
                />
                <Bar 
                  dataKey="current" 
                  fill="hsl(var(--primary))" 
                  radius={[0, 4, 4, 0]}
                  name="current"
                />
              </RechartsBarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-muted-foreground" />
          <span className="text-muted-foreground">Previous Period</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-primary" />
          <span>Current Period</span>
        </div>
      </div>

      {/* Drilldown Dialog */}
      <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen}>
        <DialogContent className="max-w-3xl bg-background">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {drilldownMetric?.icon}
              {drilldownMetric?.label} - {getDrilldownTitle()}
            </DialogTitle>
            <DialogDescription>
              Detailed breakdown comparing current vs previous period
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="current" className="mt-4">
            <TabsList className="mb-4">
              <TabsTrigger value="current">Current Period</TabsTrigger>
              <TabsTrigger value="previous">Previous Period</TabsTrigger>
              <TabsTrigger value="comparison">Side by Side</TabsTrigger>
            </TabsList>

            <TabsContent value="current">
              <div className="space-y-4">
                {drilldownData.current.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No data available</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={250}>
                      <RechartsPieChart>
                        <Pie
                          data={drilldownData.current}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {drilldownData.current.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--popover))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {drilldownData.current.map((item, index) => (
                        <div key={item.name} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm truncate">{item.name}</span>
                          <span className="text-sm font-medium ml-auto">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="previous">
              <div className="space-y-4">
                {drilldownData.previous.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No data available</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={250}>
                      <RechartsPieChart>
                        <Pie
                          data={drilldownData.previous}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {drilldownData.previous.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--popover))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {drilldownData.previous.map((item, index) => (
                        <div key={item.name} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm truncate">{item.name}</span>
                          <span className="text-sm font-medium ml-auto">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="comparison">
              <div className="space-y-4">
                {drilldownData.current.length === 0 && drilldownData.previous.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No data available</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsBarChart 
                        data={(() => {
                          const allKeys = new Set([
                            ...drilldownData.current.map(d => d.name),
                            ...drilldownData.previous.map(d => d.name),
                          ]);
                          return Array.from(allKeys).map(name => ({
                            name,
                            current: drilldownData.current.find(d => d.name === name)?.value || 0,
                            previous: drilldownData.previous.find(d => d.name === name)?.value || 0,
                          }));
                        })()}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--popover))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          formatter={(value: number, name: string) => [
                            value,
                            name === 'current' ? 'Current Period' : 'Previous Period'
                          ]}
                        />
                        <Bar dataKey="previous" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} name="previous" />
                        <Bar dataKey="current" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="current" />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                    <div className="flex items-center justify-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-muted-foreground" />
                        <span className="text-muted-foreground">Previous</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-primary" />
                        <span>Current</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Memoized wrapper to prevent unnecessary re-renders when props are unchanged
export const ReportComparisonMemo = memo(ReportComparison);
