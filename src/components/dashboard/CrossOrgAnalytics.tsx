import { useEffect, useState, useRef, useCallback } from 'react';
import { devError } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { 
  Building2, 
  Users, 
  TrendingUp, 
  TrendingDown,
  MessageSquare, 
  DollarSign,
  Calendar,
  BarChart3,
  Loader2,
  Filter,
  CalendarDays,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  Clock,
  Pause,
  Play
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';
import { OrgDrilldownDialog } from './OrgDrilldownDialog';
import { getAgentRevenueTotal } from '@/lib/adminAnalytics';

interface OrgMetrics {
  id: string;
  name: string;
  ai_agent_type: 'jay' | 'may' | 'cece';
  lead_count: number;
  converted_leads: number;
  order_count: number;
  total_revenue: number;
  booking_count: number;
  conversation_count: number;
  user_count: number;
  conversion_rate: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--info))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))'];

const AI_AGENT_LABELS = {
  jay: { label: 'Jay', color: 'bg-primary/10 text-primary' },
  may: { label: 'May', color: 'bg-success/10 text-success' },
  cece: { label: 'Cece', color: 'bg-info/10 text-info' },
};

const DATE_PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 12 months', days: 365 },
  { label: 'All time', days: 0 },
];

const REFRESH_INTERVALS = [
  { label: 'Off', seconds: 0 },
  { label: '30 seconds', seconds: 30 },
  { label: '1 minute', seconds: 60 },
  { label: '5 minutes', seconds: 300 },
  { label: '15 minutes', seconds: 900 },
];

interface PeriodTotals {
  leads: number;
  converted: number;
  revenue: number;
  conversations: number;
  users: number;
  orders: number;
  bookings: number;
}

export function CrossOrgAnalytics() {
  const formatCurrency = useFormatCurrency();
  const [orgMetrics, setOrgMetrics] = useState<OrgMetrics[]>([]);
  const [prevPeriodTotals, setPrevPeriodTotals] = useState<PeriodTotals | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterAgentType, setFilterAgentType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [datePreset, setDatePreset] = useState<string>('30');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [selectedOrg, setSelectedOrg] = useState<OrgMetrics | null>(null);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const handleRowClick = (org: OrgMetrics) => {
    setSelectedOrg(org);
    setDrilldownOpen(true);
  };

  // Manual refresh handler
  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchOrgMetrics();
    setLastUpdated(new Date());
    setIsRefreshing(false);
    if (autoRefreshInterval > 0) {
      setCountdown(autoRefreshInterval);
    }
  }, [autoRefreshInterval]);

  // Auto-refresh effect
  useEffect(() => {
    // Clear existing intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (autoRefreshInterval > 0) {
      setCountdown(autoRefreshInterval);

      // Countdown timer (updates every second)
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) return autoRefreshInterval;
          return prev - 1;
        });
      }, 1000);

      // Refresh interval
      intervalRef.current = setInterval(async () => {
        setIsRefreshing(true);
        await fetchOrgMetrics();
        setLastUpdated(new Date());
        setIsRefreshing(false);
        setCountdown(autoRefreshInterval);
      }, autoRefreshInterval * 1000);
    } else {
      setCountdown(0);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoRefreshInterval]);

  const formatCountdown = (seconds: number): string => {
    if (seconds <= 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const formatLastUpdated = (date: Date): string => {
    return format(date, 'HH:mm:ss');
  };

  useEffect(() => {
    fetchOrgMetrics();
  }, [dateRange]);

  const handlePresetChange = (days: string) => {
    setDatePreset(days);
    const numDays = parseInt(days);
    if (numDays === 0) {
      setDateRange(undefined); // All time
    } else {
      setDateRange({
        from: subDays(new Date(), numDays),
        to: new Date(),
      });
    }
  };

  // Helper to fetch metrics for a date range
  const fetchMetricsForPeriod = async (
    orgs: { id: string; name: string; ai_agent_type: string }[],
    startDate?: string,
    endDate?: string
  ): Promise<OrgMetrics[]> => {
    const metricsPromises = orgs.map(async (org) => {
      let leadsQuery = supabase.from('leads').select('id, status', { count: 'exact' }).eq('organization_id', org.id);
      let ordersQuery = supabase.from('orders').select('id, total_amount').eq('organization_id', org.id);
      let bookingsQuery = supabase.from('bookings').select('id, total_price, status', { count: 'exact' }).eq('organization_id', org.id);
      let conversationsQuery = supabase.from('ai_conversations').select('id', { count: 'exact' }).eq('organization_id', org.id);
      const usersQuery = supabase.from('profiles_safe').select('id', { count: 'exact' }).eq('organization_id', org.id);

      if (startDate && endDate) {
        leadsQuery = leadsQuery.gte('created_at', startDate).lte('created_at', endDate);
        ordersQuery = ordersQuery.gte('created_at', startDate).lte('created_at', endDate);
        bookingsQuery = bookingsQuery.gte('created_at', startDate).lte('created_at', endDate);
        conversationsQuery = conversationsQuery.gte('created_at', startDate).lte('created_at', endDate);
      }

      const [leadsRes, ordersRes, bookingsRes, conversationsRes, usersRes] = await Promise.all([
        leadsQuery, ordersQuery, bookingsQuery, conversationsQuery, usersQuery,
      ]);

      const leads = leadsRes.data || [];
      const convertedLeads = leads.filter(l => l.status === 'converted').length;
      const orders = ordersRes.data || [];
      const bookings = bookingsRes.data || [];
      const totalRevenue = getAgentRevenueTotal(org.ai_agent_type as 'jay' | 'may' | 'cece', orders, bookings);

      return {
        id: org.id,
        name: org.name,
        ai_agent_type: org.ai_agent_type as 'jay' | 'may' | 'cece',
        lead_count: leadsRes.count || 0,
        converted_leads: convertedLeads,
        order_count: orders.length,
        total_revenue: totalRevenue,
        booking_count: bookingsRes.count || 0,
        conversation_count: conversationsRes.count || 0,
        user_count: usersRes.count || 0,
        conversion_rate: leads.length > 0 ? (convertedLeads / leads.length) * 100 : 0,
      };
    });

    return Promise.all(metricsPromises);
  };

  const fetchOrgMetrics = async () => {
    setIsLoading(true);
    try {
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('id, name, ai_agent_type')
        .eq('is_archived', false);

      if (orgsError) throw orgsError;

      const startDate = dateRange?.from ? startOfDay(dateRange.from).toISOString() : undefined;
      const endDate = dateRange?.to ? endOfDay(dateRange.to).toISOString() : undefined;

      // Fetch current period metrics
      const metrics = await fetchMetricsForPeriod(orgs || [], startDate, endDate);
      setOrgMetrics(metrics);

      // Calculate and fetch previous period for comparison
      if (dateRange?.from && dateRange?.to) {
        const periodDays = differenceInDays(dateRange.to, dateRange.from) + 1;
        const prevStart = startOfDay(subDays(dateRange.from, periodDays)).toISOString();
        const prevEnd = endOfDay(subDays(dateRange.from, 1)).toISOString();

        const prevMetrics = await fetchMetricsForPeriod(orgs || [], prevStart, prevEnd);
        const prevTotals = prevMetrics.reduce((acc, m) => ({
          leads: acc.leads + m.lead_count,
          converted: acc.converted + m.converted_leads,
          revenue: acc.revenue + m.total_revenue,
          conversations: acc.conversations + m.conversation_count,
          users: acc.users + m.user_count,
          orders: acc.orders + m.order_count,
          bookings: acc.bookings + m.booking_count,
        }), { leads: 0, converted: 0, revenue: 0, conversations: 0, users: 0, orders: 0, bookings: 0 });

        setPrevPeriodTotals(prevTotals);
      } else {
        setPrevPeriodTotals(null);
      }
    } catch (error) {
      devError('Error fetching org metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate percentage change
  const calcChange = (current: number, previous: number | undefined): number | null => {
    if (previous === undefined || previous === 0) return current > 0 ? 100 : null;
    return ((current - previous) / previous) * 100;
  };

  // Render change indicator
  const ChangeIndicator = ({ current, previous }: { current: number; previous: number | undefined }) => {
    const change = calcChange(current, previous);
    if (change === null) return null;

    const isPositive = change > 0;
    const isNeutral = change === 0;

    return (
      <div className={cn(
        "flex items-center gap-0.5 text-xs font-medium",
        isPositive ? "text-success" : isNeutral ? "text-muted-foreground" : "text-destructive"
      )}>
        {isPositive ? (
          <ArrowUpRight className="w-3 h-3" />
        ) : isNeutral ? (
          <Minus className="w-3 h-3" />
        ) : (
          <ArrowDownRight className="w-3 h-3" />
        )}
        {Math.abs(change).toFixed(1)}%
      </div>
    );
  };

  // Filter and sort
  const filteredMetrics = orgMetrics
    .filter(m => filterAgentType === 'all' || m.ai_agent_type === filterAgentType)
    .sort((a, b) => {
      switch (sortBy) {
        case 'leads': return b.lead_count - a.lead_count;
        case 'orders': return b.order_count - a.order_count;
        case 'bookings': return b.booking_count - a.booking_count;
        case 'revenue': return b.total_revenue - a.total_revenue;
        case 'conversion': return b.conversion_rate - a.conversion_rate;
        case 'conversations': return b.conversation_count - a.conversation_count;
        default: return a.name.localeCompare(b.name);
      }
    });

  // Aggregate stats
  const totals = filteredMetrics.reduce((acc, m) => ({
    leads: acc.leads + m.lead_count,
    converted: acc.converted + m.converted_leads,
    revenue: acc.revenue + m.total_revenue,
    conversations: acc.conversations + m.conversation_count,
    users: acc.users + m.user_count,
    orders: acc.orders + m.order_count,
    bookings: acc.bookings + m.booking_count,
  }), { leads: 0, converted: 0, revenue: 0, conversations: 0, users: 0, orders: 0, bookings: 0 });

  const avgConversionRate = totals.leads > 0 ? (totals.converted / totals.leads) * 100 : 0;

  // Chart data
  const barChartData = filteredMetrics.slice(0, 10).map(m => ({
    name: m.name.length > 15 ? m.name.slice(0, 15) + '...' : m.name,
    pipeline: m.lead_count,
    orders: m.order_count,
    bookings: m.booking_count,
  }));

  const agentTypeDistribution = [
    { name: 'Jay (Sales)', value: orgMetrics.filter(m => m.ai_agent_type === 'jay').length },
    { name: 'May (Food)', value: orgMetrics.filter(m => m.ai_agent_type === 'may').length },
    { name: 'Cece (Hotel)', value: orgMetrics.filter(m => m.ai_agent_type === 'cece').length },
  ].filter(d => d.value > 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Previous period conversion rate
  const prevAvgConversionRate = prevPeriodTotals && prevPeriodTotals.leads > 0 
    ? (prevPeriodTotals.converted / prevPeriodTotals.leads) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards with Period Comparison */}
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-3 lg:gap-4">
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{filteredMetrics.length}</p>
                <p className="text-xs text-muted-foreground">Organizations</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <Users className="w-5 h-5 text-info" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-foreground">{totals.leads}</p>
                  {prevPeriodTotals && <ChangeIndicator current={totals.leads} previous={prevPeriodTotals.leads} />}
                </div>
                <p className="text-xs text-muted-foreground">Pipeline Records</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-foreground">{avgConversionRate.toFixed(1)}%</p>
                  {prevPeriodTotals && prevAvgConversionRate > 0 && (
                    <ChangeIndicator current={avgConversionRate} previous={prevAvgConversionRate} />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Pipeline Conversion</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary/10">
                <Calendar className="w-5 h-5 text-secondary-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-foreground">{totals.orders}</p>
                  {prevPeriodTotals && <ChangeIndicator current={totals.orders} previous={prevPeriodTotals.orders} />}
                </div>
                <p className="text-xs text-muted-foreground">Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CalendarDays className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-foreground">{totals.bookings}</p>
                  {prevPeriodTotals && <ChangeIndicator current={totals.bookings} previous={prevPeriodTotals.bookings} />}
                </div>
                <p className="text-xs text-muted-foreground">Bookings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <MessageSquare className="w-5 h-5 text-warning" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-foreground">{totals.conversations}</p>
                  {prevPeriodTotals && <ChangeIndicator current={totals.conversations} previous={prevPeriodTotals.conversations} />}
                </div>
                <p className="text-xs text-muted-foreground">Conversations</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <DollarSign className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(totals.revenue)}
                  </p>
                  {prevPeriodTotals && <ChangeIndicator current={totals.revenue} previous={prevPeriodTotals.revenue} />}
                </div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Period comparison info */}
      {prevPeriodTotals && dateRange?.from && dateRange?.to && (
        <div className="text-xs text-muted-foreground text-center">
          Comparing to previous {differenceInDays(dateRange.to, dateRange.from) + 1} days
        </div>
      )}

      {/* Filters */}
      <Card className="glass">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filter by:</span>
            </div>
            
            {/* Date Range Preset */}
            <Select value={datePreset} onValueChange={handlePresetChange}>
              <SelectTrigger className="w-[160px]">
                <CalendarDays className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map((preset) => (
                  <SelectItem key={preset.days} value={String(preset.days)}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Custom Date Range Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn(
                  "justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}>
                  <Calendar className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d, yyyy")}
                      </>
                    ) : (
                      format(dateRange.from, "MMM d, yyyy")
                    )
                  ) : (
                    "All time"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={(range) => {
                    setDateRange(range);
                    setDatePreset('custom');
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            <div className="h-6 w-px bg-border" />

            <Select value={filterAgentType} onValueChange={setFilterAgentType}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="AI Agent Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                <SelectItem value="jay">Jay (Sales)</SelectItem>
                <SelectItem value="may">May (Food)</SelectItem>
                <SelectItem value="cece">Cece (Hotel)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="leads">Most Leads</SelectItem>
                <SelectItem value="orders">Most Orders</SelectItem>
                <SelectItem value="bookings">Most Bookings</SelectItem>
                <SelectItem value="revenue">Highest Revenue</SelectItem>
                <SelectItem value="conversion">Best Conversion</SelectItem>
                <SelectItem value="conversations">Most Conversations</SelectItem>
              </SelectContent>
            </Select>

            <div className="h-6 w-px bg-border" />

            {/* Auto-refresh controls */}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <Select value={String(autoRefreshInterval)} onValueChange={(v) => setAutoRefreshInterval(parseInt(v))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Auto-refresh" />
                </SelectTrigger>
                <SelectContent>
                  {REFRESH_INTERVALS.map((interval) => (
                    <SelectItem key={interval.seconds} value={String(interval.seconds)}>
                      {interval.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Last updated: {formatLastUpdated(lastUpdated)}</span>
              {isRefreshing && (
                <Badge variant="secondary" className="text-xs py-0">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Updating...
                </Badge>
              )}
            </div>
            {autoRefreshInterval > 0 && !isRefreshing && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs py-0 gap-1">
                  <Play className="w-3 h-3" />
                  Auto-refresh: {formatCountdown(countdown)}
                </Badge>
              </div>
            )}
            {autoRefreshInterval === 0 && (
              <div className="flex items-center gap-1">
                <Pause className="w-3 h-3" />
                <span>Auto-refresh disabled</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar Chart - Activity Comparison */}
        <Card className="glass lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Organization Comparison
            </CardTitle>
            <CardDescription>Pipeline, order, and booking volume by organization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {barChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="pipeline" name="Pipeline" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="orders" name="Orders" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="bookings" name="Bookings" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart - Agent Type Distribution */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-info" />
              AI Agent Distribution
            </CardTitle>
            <CardDescription>Organizations by agent type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {agentTypeDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={agentTypeDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {agentTypeDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Organization Table */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Organization Metrics</CardTitle>
          <CardDescription>
            Detailed comparison across {filteredMetrics.length} organizations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Pipeline</TableHead>
                  <TableHead className="text-right">Converted</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Conversion %</TableHead>
                  <TableHead className="text-right">Conversations</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMetrics.map((org) => (
                  <TableRow 
                    key={org.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleRowClick(org)}
                  >
                    <TableCell className="font-medium">
                      <span className="hover:text-primary hover:underline">{org.name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={AI_AGENT_LABELS[org.ai_agent_type]?.color}
                      >
                        {AI_AGENT_LABELS[org.ai_agent_type]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{org.lead_count}</TableCell>
                    <TableCell className="text-right">{org.converted_leads}</TableCell>
                    <TableCell className="text-right">{org.order_count}</TableCell>
                    <TableCell className="text-right">{org.booking_count}</TableCell>
                    <TableCell className="text-right">
                      <span className={org.conversion_rate > 20 ? 'text-success' : org.conversion_rate > 10 ? 'text-warning' : 'text-muted-foreground'}>
                        {org.conversion_rate.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{org.conversation_count}</TableCell>
                    <TableCell className="text-right">{formatCurrency(org.total_revenue)}</TableCell>
                    <TableCell className="text-right">{org.user_count}</TableCell>
                  </TableRow>
                ))}
                {filteredMetrics.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      No organizations found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Drill-down Dialog */}
      <OrgDrilldownDialog
        open={drilldownOpen}
        onOpenChange={setDrilldownOpen}
        orgId={selectedOrg?.id || null}
        orgName={selectedOrg?.name || ''}
        aiAgentType={selectedOrg?.ai_agent_type || 'jay'}
        dateRange={dateRange}
      />
    </div>
  );
}
