import { useState, useEffect } from 'react';
import { devError } from '@/lib/logger';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Users, 
  TrendingUp, 
  MessageSquare, 
  DollarSign,
  UserCheck,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ShoppingBag,
  CalendarCheck,
  Flame,
  Thermometer,
  Snowflake
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay, subDays, differenceInDays } from 'date-fns';
import { 
  AreaChart, 
  Area, 
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
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';
import { getAgentAwareLeadLabel, getAgentAwareLeadNoun } from '@/lib/reportingAgentConfig';
import { getAgentRevenueEvents, getAgentRevenueTotal, getAgentTransactionCount } from '@/lib/adminAnalytics';

interface OrgDrilldownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string | null;
  orgName: string;
  aiAgentType: 'jay' | 'may' | 'cece';
  dateRange?: DateRange;
}

interface DetailedMetrics {
  leads: {
    total: number;
    new: number;
    contacted: number;
    qualified: number;
    converted: number;
    lost: number;
    hot: number;
    warm: number;
    cold: number;
  };
  revenue: {
    total: number;
    orderCount: number;
    avgOrderValue: number;
  };
  conversations: {
    total: number;
    active: number;
    completed: number;
  };
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>;
  dailyTrend: Array<{
    date: string;
    leads: number;
    conversations: number;
    revenue: number;
  }>;
}

interface PrevPeriodMetrics {
  leads: number;
  converted: number;
  revenue: number;
  conversations: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--info))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))'];

const AI_AGENT_LABELS = {
  jay: { label: 'Jay', color: 'bg-primary/10 text-primary' },
  may: { label: 'May', color: 'bg-success/10 text-success' },
  cece: { label: 'Cece', color: 'bg-info/10 text-info' },
};

export function OrgDrilldownDialog({ 
  open, 
  onOpenChange, 
  orgId, 
  orgName, 
  aiAgentType,
  dateRange 
}: OrgDrilldownDialogProps) {
  const formatCurrency = useFormatCurrency();
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<DetailedMetrics | null>(null);
  const [prevMetrics, setPrevMetrics] = useState<PrevPeriodMetrics | null>(null);
  const pipelineLabel = getAgentAwareLeadLabel(aiAgentType);
  const pipelineNoun = getAgentAwareLeadNoun(aiAgentType);
  const singularPipelineLabel = aiAgentType === 'cece' ? 'Inquiry' : aiAgentType === 'may' ? 'Demand' : 'Lead';
  const transactionCountLabel = aiAgentType === 'cece' ? 'Total Bookings' : 'Total Orders';
  const averageValueLabel = aiAgentType === 'cece' ? 'Avg Booking Value' : 'Avg Order Value';

  useEffect(() => {
    if (open && orgId) {
      fetchDetailedMetrics();
    }
  }, [open, orgId, dateRange]);

  const fetchDetailedMetrics = async () => {
    if (!orgId) return;
    setIsLoading(true);

    try {
      const startDate = dateRange?.from ? startOfDay(dateRange.from).toISOString() : undefined;
      const endDate = dateRange?.to ? endOfDay(dateRange.to).toISOString() : undefined;

      // Fetch leads with status breakdown
      let leadsQuery = supabase.from('leads').select('id, status, lead_temperature, created_at').eq('organization_id', orgId);
      if (startDate && endDate) {
        leadsQuery = leadsQuery.gte('created_at', startDate).lte('created_at', endDate);
      }
      const { data: leads } = await leadsQuery;

      // Fetch orders
      let ordersQuery = supabase.from('orders').select('id, total_amount, created_at').eq('organization_id', orgId);
      if (startDate && endDate) {
        ordersQuery = ordersQuery.gte('created_at', startDate).lte('created_at', endDate);
      }
      const { data: orders } = await ordersQuery;

      let bookingsQuery = supabase.from('bookings').select('id, total_price, status, created_at').eq('organization_id', orgId);
      if (startDate && endDate) {
        bookingsQuery = bookingsQuery.gte('created_at', startDate).lte('created_at', endDate);
      }
      const { data: bookings } = await bookingsQuery;

      // Fetch conversations
      let conversationsQuery = supabase.from('ai_conversations').select('id, status, created_at').eq('organization_id', orgId);
      if (startDate && endDate) {
        conversationsQuery = conversationsQuery.gte('created_at', startDate).lte('created_at', endDate);
      }
      const { data: conversations } = await conversationsQuery;

      // Fetch users (not date filtered) - use profiles_safe view for security
      const { data: profiles } = await supabase
        .from('profiles_safe')
        .select('id, full_name, email')
        .eq('organization_id', orgId);

      // Get user roles
      const userIds = profiles?.map(p => p.id) || [];
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      // Calculate daily trend for the period
      const dailyTrendMap = new Map<string, { leads: number; conversations: number; revenue: number }>();
      
      leads?.forEach(lead => {
        const day = format(new Date(lead.created_at), 'MMM d');
        const existing = dailyTrendMap.get(day) || { leads: 0, conversations: 0, revenue: 0 };
        existing.leads++;
        dailyTrendMap.set(day, existing);
      });

      conversations?.forEach(conv => {
        const day = format(new Date(conv.created_at), 'MMM d');
        const existing = dailyTrendMap.get(day) || { leads: 0, conversations: 0, revenue: 0 };
        existing.conversations++;
        dailyTrendMap.set(day, existing);
      });

      const revenueEvents = getAgentRevenueEvents(aiAgentType, orders || [], bookings || []);

      revenueEvents.forEach((event) => {
        const day = format(new Date(event.createdAt), 'MMM d');
        const existing = dailyTrendMap.get(day) || { leads: 0, conversations: 0, revenue: 0 };
        existing.revenue += event.amount;
        dailyTrendMap.set(day, existing);
      });

      const dailyTrend = Array.from(dailyTrendMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-14); // Last 14 data points

      const transactionCount = getAgentTransactionCount(aiAgentType, orders || [], bookings || []);
      const totalRevenue = getAgentRevenueTotal(aiAgentType, orders || [], bookings || []);

      setMetrics({
        leads: {
          total: leads?.length || 0,
          new: leads?.filter(l => l.status === 'new').length || 0,
          contacted: leads?.filter(l => l.status === 'contacted').length || 0,
          qualified: leads?.filter(l => l.status === 'qualified').length || 0,
          converted: leads?.filter(l => l.status === 'converted').length || 0,
          lost: leads?.filter(l => l.status === 'lost').length || 0,
          hot: leads?.filter(l => l.lead_temperature === 'hot').length || 0,
          warm: leads?.filter(l => l.lead_temperature === 'warm').length || 0,
          cold: leads?.filter(l => l.lead_temperature === 'cold').length || 0,
        },
        revenue: {
          total: totalRevenue,
          orderCount: transactionCount,
          avgOrderValue: transactionCount ? totalRevenue / transactionCount : 0,
        },
        conversations: {
          total: conversations?.length || 0,
          active: conversations?.filter(c => c.status === 'active').length || 0,
          completed: conversations?.filter(c => c.status === 'completed').length || 0,
        },
        users: profiles?.map(p => ({
          id: p.id,
          name: p.full_name || 'Unknown',
          email: p.email,
          role: rolesMap.get(p.id) || 'agent',
        })) || [],
        dailyTrend,
      });

      // Fetch previous period for comparison
      if (dateRange?.from && dateRange?.to) {
        const periodDays = differenceInDays(dateRange.to, dateRange.from) + 1;
        const prevStart = startOfDay(subDays(dateRange.from, periodDays)).toISOString();
        const prevEnd = endOfDay(subDays(dateRange.from, 1)).toISOString();

        const [prevLeads, prevOrders, prevBookings, prevConversations] = await Promise.all([
          supabase.from('leads').select('id, status').eq('organization_id', orgId).gte('created_at', prevStart).lte('created_at', prevEnd),
          supabase.from('orders').select('id, total_amount').eq('organization_id', orgId).gte('created_at', prevStart).lte('created_at', prevEnd),
          supabase.from('bookings').select('id, total_price, status').eq('organization_id', orgId).gte('created_at', prevStart).lte('created_at', prevEnd),
          supabase.from('ai_conversations').select('id').eq('organization_id', orgId).gte('created_at', prevStart).lte('created_at', prevEnd),
        ]);

        setPrevMetrics({
          leads: prevLeads.data?.length || 0,
          converted: prevLeads.data?.filter(l => l.status === 'converted').length || 0,
          revenue: getAgentRevenueTotal(aiAgentType, prevOrders.data || [], prevBookings.data || []),
          conversations: prevConversations.data?.length || 0,
        });
      } else {
        setPrevMetrics(null);
      }
    } catch (error) {
      devError('Error fetching detailed metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calcChange = (current: number, previous: number | undefined): number | null => {
    if (previous === undefined || previous === 0) return current > 0 ? 100 : null;
    return ((current - previous) / previous) * 100;
  };

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
        {isPositive ? <ArrowUpRight className="w-3 h-3" /> : isNeutral ? <Minus className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {Math.abs(change).toFixed(1)}%
      </div>
    );
  };

  const statusDistribution = metrics ? [
    { name: 'New', value: metrics.leads.new },
    { name: 'Contacted', value: metrics.leads.contacted },
    { name: 'Qualified', value: metrics.leads.qualified },
    { name: 'Converted', value: metrics.leads.converted },
    { name: 'Lost', value: metrics.leads.lost },
  ].filter(d => d.value > 0) : [];

  const temperatureDistribution = metrics ? [
    { name: 'Hot', value: metrics.leads.hot, color: 'hsl(var(--destructive))' },
    { name: 'Warm', value: metrics.leads.warm, color: 'hsl(var(--warning))' },
    { name: 'Cold', value: metrics.leads.cold, color: 'hsl(var(--info))' },
  ].filter(d => d.value > 0) : [];

  const conversionRate = metrics && metrics.leads.total > 0 
    ? (metrics.leads.converted / metrics.leads.total) * 100 
    : 0;

  const prevConversionRate = prevMetrics && prevMetrics.leads > 0 
    ? (prevMetrics.converted / prevMetrics.leads) * 100 
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {orgName}
            <Badge variant="secondary" className={AI_AGENT_LABELS[aiAgentType]?.color}>
              {AI_AGENT_LABELS[aiAgentType]?.label}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Detailed metrics and performance breakdown
            {dateRange?.from && dateRange?.to && (
              <span className="ml-2 text-xs">
                ({format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : metrics ? (
          <Tabs defaultValue="overview" className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="leads">{pipelineLabel}</TabsTrigger>
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-info/10">
                        <Users className="w-5 h-5 text-info" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-2xl font-bold">{metrics.leads.total}</p>
                          {prevMetrics && <ChangeIndicator current={metrics.leads.total} previous={prevMetrics.leads} />}
                        </div>
                        <p className="text-xs text-muted-foreground">Total {pipelineLabel}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-success/10">
                        <TrendingUp className="w-5 h-5 text-success" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-2xl font-bold">{conversionRate.toFixed(1)}%</p>
                          {prevMetrics && prevConversionRate > 0 && (
                            <ChangeIndicator current={conversionRate} previous={prevConversionRate} />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">Conversion Rate</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-warning/10">
                        <MessageSquare className="w-5 h-5 text-warning" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-2xl font-bold">{metrics.conversations.total}</p>
                          {prevMetrics && <ChangeIndicator current={metrics.conversations.total} previous={prevMetrics.conversations} />}
                        </div>
                        <p className="text-xs text-muted-foreground">Conversations</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <DollarSign className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-2xl font-bold">{formatCurrency(metrics.revenue.total)}</p>
                          {prevMetrics && <ChangeIndicator current={metrics.revenue.total} previous={prevMetrics.revenue} />}
                        </div>
                        <p className="text-xs text-muted-foreground">Revenue</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Trend Chart */}
              {metrics.dailyTrend.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Activity Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={metrics.dailyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
                          <Area type="monotone" dataKey="leads" name={pipelineLabel} stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.2)" />
                          <Area type="monotone" dataKey="conversations" name="Conversations" stroke="hsl(var(--info))" fill="hsl(var(--info)/0.2)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="leads" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Status Distribution */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Status Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {statusDistribution.length > 0 ? (
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={statusDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={70}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {statusDistribution.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Legend />
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                        No {pipelineNoun} data
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Temperature Distribution */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{singularPipelineLabel} Temperature</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Flame className="w-4 h-4 text-destructive" />
                          <span className="text-sm">Hot</span>
                        </div>
                        <span className="font-semibold">{metrics.leads.hot}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Thermometer className="w-4 h-4 text-warning" />
                          <span className="text-sm">Warm</span>
                        </div>
                        <span className="font-semibold">{metrics.leads.warm}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Snowflake className="w-4 h-4 text-info" />
                          <span className="text-sm">Cold</span>
                        </div>
                        <span className="font-semibold">{metrics.leads.cold}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Lead Status Table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{singularPipelineLabel} Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Percentage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { status: 'New', count: metrics.leads.new },
                        { status: 'Contacted', count: metrics.leads.contacted },
                        { status: 'Qualified', count: metrics.leads.qualified },
                        { status: 'Converted', count: metrics.leads.converted },
                        { status: 'Lost', count: metrics.leads.lost },
                      ].map((row) => (
                        <TableRow key={row.status}>
                          <TableCell>{row.status}</TableCell>
                          <TableCell className="text-right">{row.count}</TableCell>
                          <TableCell className="text-right">
                            {metrics.leads.total > 0 ? ((row.count / metrics.leads.total) * 100).toFixed(1) : 0}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="revenue" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <DollarSign className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{formatCurrency(metrics.revenue.total)}</p>
                        <p className="text-xs text-muted-foreground">Total Revenue</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-info/10">
                        <ShoppingBag className="w-5 h-5 text-info" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{metrics.revenue.orderCount}</p>
                        <p className="text-xs text-muted-foreground">{transactionCountLabel}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-success/10">
                        <CalendarCheck className="w-5 h-5 text-success" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{formatCurrency(metrics.revenue.avgOrderValue)}</p>
                        <p className="text-xs text-muted-foreground">{averageValueLabel}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Revenue Trend */}
              {metrics.dailyTrend.some(d => d.revenue > 0) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Revenue Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={metrics.dailyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                          <Tooltip 
                            formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
                          <Area type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--success))" fill="hsl(var(--success)/0.2)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="team" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <UserCheck className="w-4 h-4" />
                    Team Members ({metrics.users.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {metrics.users.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {metrics.users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.name}</TableCell>
                            <TableCell className="text-muted-foreground">{user.email}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="capitalize">
                                {user.role.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      No team members found
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No data available
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
