import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { devError } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { 
  GraduationCap, 
  Download, 
  FileText, 
  RefreshCw, 
  Users, 
  TrendingUp,
  ShoppingCart,
  Calendar,
  Filter,
  X,
  ChevronDown,
  Clock,
  BarChart3,
  PieChart,
  Target,
  Flame,
  Snowflake,
  Thermometer,
  Award,
  Trophy,
  Medal,
  FileSpreadsheet,
  FileDown,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Info,
  Scale,
  Zap,
  Bot,
  MessageSquare,
  BedDouble,
  UtensilsCrossed,
  Briefcase,
  Wallet,
  Save
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchTrainingAnalytics } from '@/lib/training/api';
import { TrainingAnalytics } from '@/lib/training/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReportingSummaryCards } from '@/components/reports/ReportingSummaryCards';
import { LeadConversionChart } from '@/components/reports/LeadConversionChart';
import { LeadSourceChart } from '@/components/reports/LeadSourceChart';
import { LeadTemperatureChart } from '@/components/reports/LeadTemperatureChart';
import { SalesPerformanceChart } from '@/components/reports/SalesPerformanceChart';
import { AgentPerformanceTable } from '@/components/reports/AgentPerformanceTable';
import { ReportComparisonMemo as ReportComparison } from '@/components/reports/ReportComparison';
import { OrderStatusChart } from '@/components/reports/OrderStatusChart';
import { MenuPerformanceChart } from '@/components/reports/MenuPerformanceChart';
import { BookingStatusChart } from '@/components/reports/BookingStatusChart';
import { BookingSourceChart } from '@/components/reports/BookingSourceChart';
import { RoomOccupancyChart } from '@/components/reports/RoomOccupancyChart';
import { OperationsExpenseChart } from '@/components/reports/OperationsExpenseChart';
import { toast } from 'sonner';
import { format, formatDistanceToNow, parseISO, subDays, startOfDay, endOfDay } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { generateReportPDF } from '@/lib/pdfExport';
import { cn } from '@/lib/utils';
import { useCurrencySymbol, useFormatCurrency } from '@/hooks/useMultiCurrency';
import { SavedReportsTab } from '@/components/reports/SavedReportsTab';
import { ReportingFiltersProvider, resolveReportingDateRange, type ReportingDateRange } from '@/contexts/ReportingFiltersContext';
import {
  getAgentAwareAgentPerformanceCopy,
  getAgentAwareConversionCopy,
  getAgentAwareLeadSourceCopy,
  getAgentAwareOperationsCopy,
  getAgentAwareReportingTabs,
  getAgentAwareTemperatureCopy,
} from '@/lib/reportingAgentConfig';

type AIAgentType = 'jay' | 'may' | 'cece';

// Local types matching ReportComparison props
interface Lead {
  id: string;
  created_at: string;
  status?: string;
  lead_temperature?: string;
  source?: string;
  assigned_agent_id?: string;
  qualification_status?: string;
  name?: string;
  email?: string;
  phone?: string;
}
interface Order {
  id: string;
  created_at: string;
  total_amount?: number;
  status?: string;
  lead_id?: string;
  pickup_time?: string;
}
interface Conversation { id: string; messages: unknown[]; channel?: string }
interface Booking {
  id: string;
  created_at: string;
  status?: string;
  lead_id?: string;
  room_unit_id?: string;
  check_in?: string;
  check_out?: string;
}
interface Meeting { id: string; created_at: string; start_time?: string; appointment_source?: string }

// AI Agent configuration with semantic colors
const agentConfig: Record<AIAgentType, {
  name: string;
  description: string;
  icon: typeof Bot;
  primaryMetric: string;
  secondaryMetric: string;
  focusAreas: string[];
}> = {
  jay: {
    name: 'Jay',
    description: 'Sales & Lead Conversion Specialist',
    icon: Briefcase,
    primaryMetric: 'Conversion Rate',
    secondaryMetric: 'Lead Response Time',
    focusAreas: ['Lead Qualification', 'Sales Pipeline', 'Revenue Growth'],
  },
  may: {
    name: 'May',
    description: 'Food & Order Management Specialist',
    icon: UtensilsCrossed,
    primaryMetric: 'Order Completion',
    secondaryMetric: 'Average Order Value',
    focusAreas: ['Order Processing', 'Menu Items', 'Pickup Efficiency'],
  },
  cece: {
    name: 'CeCe',
    description: 'Hospitality & Booking Specialist',
    icon: BedDouble,
    primaryMetric: 'Booking Rate',
    secondaryMetric: 'Occupancy Rate',
    focusAreas: ['Reservations', 'Guest Experience', 'Room Availability'],
  },
};

function getReportingTabIntro(tab: string, agentType: AIAgentType, isClientAdmin: boolean) {
  const leadLabel = getAgentAwareConversionCopy(agentType).metricLabel;

  switch (tab) {
    case 'overview':
      return {
        eyebrow: 'Executive Snapshot',
        title: 'See the signals that matter first',
        description: 'Start with the overall health of the business, then drill into the channel or workflow that needs attention.',
      };
    case 'leads':
      return {
        eyebrow: `${leadLabel} Pipeline`,
        title: `Understand where ${leadLabel.toLowerCase()} are coming from`,
        description: 'Review source mix, conversion flow, and intent distribution to spot quality changes early.',
      };
    case 'sales':
      return {
        eyebrow: 'Sales Performance',
        title: 'Track commercial momentum',
        description: 'Use this view to monitor revenue performance, conversion movement, and sales execution over time.',
      };
    case 'orders':
      return {
        eyebrow: 'Order Flow',
        title: 'Keep service demand and order quality visible',
        description: 'Check completion trends, menu performance, and operational throughput in one place.',
      };
    case 'bookings':
      return {
        eyebrow: 'Booking Flow',
        title: 'Monitor reservations and stay demand',
        description: 'Review booking sources, occupancy patterns, and reservation outcomes to guide hospitality decisions.',
      };
    case 'operations':
      return {
        eyebrow: 'Operations Spend',
        title: 'Connect spend to delivery performance',
        description: 'Use operating cost visibility to spot margin pressure, recurring expenses, and vendor obligations.',
      };
    case 'agents':
      return {
        eyebrow: 'Team Performance',
        title: 'See who is converting best',
        description: 'Compare assigned volume, completions, and conversion efficiency without losing mobile readability.',
      };
    case 'comparison':
      return {
        eyebrow: 'Trend Comparison',
        title: 'Compare outcomes across business areas',
        description: 'Use the comparison view when you need context across leads, conversations, bookings, or orders.',
      };
    case 'saved':
      return {
        eyebrow: 'Saved Reports',
        title: 'Reuse and schedule recurring reports',
        description: 'Keep repeat reports organized so teams can export, preview, or automate them without rebuilding filters each time.',
      };
    case 'training':
      return {
        eyebrow: 'Training Analytics',
        title: 'Review how training activity is progressing',
        description: isClientAdmin
          ? 'Client admins can filter by date and agent to inspect participation, scores, and module activity.'
          : 'Training analytics are available to client admins.',
      };
    default:
      return {
        eyebrow: 'Reporting',
        title: 'Review your analytics clearly',
        description: 'Use the tabs below to move between core business views without losing context.',
      };
  }
}

function getAgentFilterScope(tab: string): 'full' | 'partial' | 'none' {
  switch (tab) {
    case 'leads':
    case 'agents':
    case 'training':
      return 'full';
    case 'overview':
    case 'sales':
    case 'comparison':
      return 'partial';
    default:
      return 'none';
  }
}

function getAgentFilterMessage(tab: string) {
  const scope = getAgentFilterScope(tab);

  if (tab === 'overview') {
    return 'Assigned-agent filtering narrows lead-owned summary signals here, but organization-wide revenue, booking, and operations totals stay unchanged.';
  }

  if (tab === 'sales') {
    return 'Assigned-agent filtering only affects lead-owned sales inputs in this view. Order and booking totals still reflect the whole organization.';
  }

  if (tab === 'comparison') {
    return 'Assigned-agent filtering only changes lead-based comparison metrics here. Conversations, orders, and bookings remain organization-wide.';
  }

  if (scope === 'full') {
    return 'Assigned-agent filtering is fully active in this view.';
  }

  if (scope === 'partial') {
    return 'Assigned-agent filtering only affects owner-based metrics in this view. Organization-wide totals remain unchanged.';
  }

  return 'Assigned-agent filtering does not change this view because the data is reported at the organization level.';
}

function ReportingContent() {
  const { isClientAdmin, profile, aiAgentType } = useAuth();
  const [training, setTraining] = useState<TrainingAnalytics | null>(null);
  const [loadingTraining, setLoadingTraining] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [agents, setAgents] = useState<Array<{ id: string; full_name?: string }>>([]);
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'csv' | 'pdf'>('csv');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState<ReportingDateRange>('30days');
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [organization, setOrganization] = useState<{ ai_agent_type: AIAgentType; name: string } | null>(null);
  
  // Comparison data - using properly typed state
  const [comparisonData, setComparisonData] = useState<{
    leads: Lead[];
    orders: Order[];
    conversations: Conversation[];
    bookings: Booking[];
    meetings: Meeting[];
  }>({ leads: [], orders: [], conversations: [], bookings: [], meetings: [] });
  const formatCurrency = useFormatCurrency();
  const currencySymbol = useCurrencySymbol();
  const [loadingComparison, setLoadingComparison] = useState(true);

  // Quick insights based on AI agent type
  const [insights, setInsights] = useState<{
    topSource: string;
    topSourceCount: number;
    hotLeadsPercent: number;
    avgOrderValue: number;
    bestAgent: string;
    bestAgentRate: number;
    totalBookings: number;
    occupancyRate: number;
    avgResponseTime: number | null;
    conversionRate: number;
  } | null>(null);

  const activeAgentType = organization?.ai_agent_type ?? aiAgentType ?? null;

  const currentAgent = activeAgentType ? agentConfig[activeAgentType] : null;
  const leadSourceCopy = getAgentAwareLeadSourceCopy(activeAgentType);
  const conversionCopy = getAgentAwareConversionCopy(activeAgentType);
  const temperatureCopy = getAgentAwareTemperatureCopy(activeAgentType);
  const operationsCopy = getAgentAwareOperationsCopy(activeAgentType);
  const agentPerformanceCopy = getAgentAwareAgentPerformanceCopy(activeAgentType);
  const activeTabIntro = getReportingTabIntro(activeTab, activeAgentType, isClientAdmin);
  const activeTabAgentFilterScope = getAgentFilterScope(activeTab);
  const resolvedDateRange = useMemo(
    () => resolveReportingDateRange({ dateRange, startDate, endDate }),
    [dateRange, startDate, endDate],
  );
  const effectiveStartDate = resolvedDateRange.start?.toISOString();
  const effectiveEndDate = resolvedDateRange.end?.toISOString();
  const hasActiveGlobalFilters = dateRange !== '30days' || selectedAgent !== 'all' || !!startDate || !!endDate;
  const loadInitialDataRef = useRef<() => Promise<void> | void>(() => undefined);

  const loadInitialData = useCallback(async () => {
    if (!profile?.organization_id) return;
    
    setLoadingComparison(true);
    try {
      // Load organization info
      const { data: orgData } = await supabase
        .from('organizations')
        .select('ai_agent_type, name')
        .eq('id', profile.organization_id)
        .single();
      
      if (orgData) {
        setOrganization(orgData as { ai_agent_type: AIAgentType; name: string });
      }

      // Load agents
      const { data: agentsData } = await supabase
        .from('profiles_safe')
        .select('id, full_name')
        .eq('organization_id', profile.organization_id);
      setAgents(agentsData || []);

      // Load comparison data including bookings (skip orders for CeCe)
      const isCeceOrg = orgData?.ai_agent_type === 'cece';
      
      const withDateRange = (query: any, column: string) => {
        let nextQuery = query;
        if (effectiveStartDate) nextQuery = nextQuery.gte(column, effectiveStartDate);
        if (effectiveEndDate) nextQuery = nextQuery.lte(column, effectiveEndDate);
        return nextQuery;
      };

      let leadsQuery = withDateRange(
        supabase.from('leads').select('*').eq('organization_id', profile.organization_id),
        'created_at',
      );
      if (selectedAgent !== 'all') {
        leadsQuery = leadsQuery.eq('assigned_agent_id', selectedAgent);
      }

      const ordersQuery = withDateRange(
        supabase.from('orders').select('*').eq('organization_id', profile.organization_id),
        'created_at',
      );
      const conversationsQuery = withDateRange(
        supabase.from('ai_conversations').select('id, created_at, platform, status').eq('organization_id', profile.organization_id),
        'created_at',
      );
      const bookingsQuery = withDateRange(
        supabase.from('bookings').select('*').eq('organization_id', profile.organization_id),
        'created_at',
      );
      const meetingsQuery = withDateRange(
        supabase.from('calendar_events').select('id, created_at, start_time, appointment_source').eq('organization_id', profile.organization_id),
        'created_at',
      );

      const [leadsRes, ordersRes, conversationsRes, bookingsRes, meetingsRes] = await Promise.all([
        leadsQuery,
        isCeceOrg ? Promise.resolve({ data: [] }) : ordersQuery,
        conversationsQuery,
        bookingsQuery,
        meetingsQuery,
      ]);

      const leads = leadsRes.data || [];
      const orders = ordersRes.data || [];
      const conversations = conversationsRes.data || [];
      const bookings = bookingsRes.data || [];
      const meetings = meetingsRes.data || [];

      setComparisonData({ 
        leads, 
        orders, 
        conversations: conversations.map(c => ({ ...c, messages: [] })),
        bookings,
        meetings
      });

      // Calculate quick insights
      const totalLeads = leads.length;
      const convertedLeads = leads.filter(l => l.status === 'converted').length;
      const hotCount = leads.filter(l => l.lead_temperature === 'hot').length;
      
      const sourceCounts: Record<string, number> = {};
      leads.forEach(l => {
        const source = l.source || 'Direct';
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
      });

      const topSource = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0];
      const avgOrderValue = orders.length > 0 
        ? orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) / orders.length 
        : 0;

      // Get best agent
      const agentStats: Record<string, { assigned: number; converted: number; name: string }> = {};
      leads.forEach(l => {
        if (l.assigned_agent_id) {
          if (!agentStats[l.assigned_agent_id]) {
            const agent = agentsData?.find(a => a.id === l.assigned_agent_id);
            agentStats[l.assigned_agent_id] = { assigned: 0, converted: 0, name: agent?.full_name || 'Unknown' };
          }
          agentStats[l.assigned_agent_id].assigned++;
          if (l.status === 'converted') agentStats[l.assigned_agent_id].converted++;
        }
      });

      const bestAgent = Object.entries(agentStats)
        .map(([id, stats]) => ({ ...stats, rate: stats.assigned > 0 ? (stats.converted / stats.assigned) * 100 : 0 }))
        .sort((a, b) => b.rate - a.rate)[0];

      // Calculate bookings metrics (upcoming = confirmed bookings)
      const confirmedBookings = bookings.filter(b => b.status === 'upcoming' || b.status === 'checked_in').length;
      
      setInsights({
        topSource: topSource?.[0] || 'N/A',
        topSourceCount: topSource?.[1] || 0,
        hotLeadsPercent: totalLeads > 0 ? (hotCount / totalLeads) * 100 : 0,
        avgOrderValue,
        bestAgent: bestAgent?.name || 'N/A',
        bestAgentRate: bestAgent?.rate || 0,
        totalBookings: bookings.length,
        occupancyRate: bookings.length > 0 ? (confirmedBookings / bookings.length) * 100 : 0,
        avgResponseTime: null,
        conversionRate: totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0,
      });

      setLastUpdated(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load comparison data';
      devError('Failed to load data', err);
      toast.error(errorMessage);
    } finally {
      setLoadingComparison(false);
    }

    if (isClientAdmin) {
      loadTrainingData();
    }
  }, [effectiveEndDate, effectiveStartDate, isClientAdmin, profile?.organization_id, selectedAgent]);

  useEffect(() => {
    if (!profile?.organization_id) return;
    loadInitialData();
  }, [loadInitialData, profile?.organization_id]);

  useEffect(() => {
    loadInitialDataRef.current = loadInitialData;
  }, [loadInitialData]);

  useEffect(() => {
    if (!profile?.organization_id) return;

    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      refreshTimeout = setTimeout(() => {
        void loadInitialDataRef.current();
      }, 350);
    };

    const channel = supabase
      .channel(`reporting-live-${profile.organization_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `organization_id=eq.${profile.organization_id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `organization_id=eq.${profile.organization_id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `organization_id=eq.${profile.organization_id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events', filter: `organization_id=eq.${profile.organization_id}` }, scheduleRefresh)
      .subscribe();

    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      supabase.removeChannel(channel);
    };
  }, [profile?.organization_id]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadInitialData();
    setIsRefreshing(false);
    toast.success('Reports refreshed');
  };

  const handleResetGlobalFilters = () => {
    setDateRange('30days');
    setStartDate('');
    setEndDate('');
    setSelectedAgent('all');
  };

  const loadTrainingData = async () => {
    if (!isClientAdmin || !profile?.organization_id) return;
    setLoadingTraining(true);
    try {
      const data = await fetchTrainingAnalytics(profile.organization_id, {
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        userId: selectedAgent !== 'all' ? selectedAgent : undefined,
      });
      setTraining(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load training analytics';
      devError('Failed to load training analytics', err);
      toast.error(errorMessage);
    } finally {
      setLoadingTraining(false);
    }
  };

  const handleExportReport = async (type: 'csv' | 'pdf') => {
    if (!profile?.organization_id) return;
    
    setIsExporting(true);
    setExportType(type);
    
    try {
      // Reuse already-loaded data from comparisonData to avoid duplicate fetches
      const leads = comparisonData.leads;
      const orders = comparisonData.orders;
      const bookings = comparisonData.bookings;
      const totalRows = leads.length + orders.length + bookings.length;

      if (totalRows === 0) {
        toast.error('No reporting data available to export for the selected filters.');
        return;
      }

      const csvCell = (value: unknown) => {
        const raw = value == null ? '' : String(value);
        return `"${raw.replace(/"/g, '""')}"`;
      };

      const exportStart = resolvedDateRange.start || subDays(new Date(), 29);
      const exportEnd = resolvedDateRange.end || new Date();
      const exportRangeLabel = `${format(exportStart, 'MMM d, yyyy')} - ${format(exportEnd, 'MMM d, yyyy')}`;

      if (type === 'csv') {
        const csvContent = [
          '=== REPORTING SUMMARY ===',
          `Generated: ${format(new Date(), 'PPpp')}`,
          `Range: ${exportRangeLabel}`,
          '',
          '=== LEADS ===',
          'ID,Name,Email,Phone,Status,Temperature,Source,Created At',
          ...leads.map((lead) => [
            csvCell(lead.id),
            csvCell(lead.name),
            csvCell(lead.email),
            csvCell(lead.phone),
            csvCell(lead.status),
            csvCell(lead.lead_temperature),
            csvCell(lead.source),
            csvCell(lead.created_at),
          ].join(',')),
          '',
          '=== ORDERS ===',
          'ID,Lead ID,Status,Total Amount,Pickup Time,Created At',
          ...orders.map((order) => [
            csvCell(order.id),
            csvCell(order.lead_id),
            csvCell(order.status),
            csvCell(order.total_amount ?? 0),
            csvCell(order.pickup_time),
            csvCell(order.created_at),
          ].join(',')),
          '',
          '=== BOOKINGS ===',
          'ID,Lead ID,Room Unit,Check In,Check Out,Status,Created At',
          ...bookings.map((booking) => [
            csvCell(booking.id),
            csvCell(booking.lead_id),
            csvCell(booking.room_unit_id),
            csvCell(booking.check_in),
            csvCell(booking.check_out),
            csvCell(booking.status),
            csvCell(booking.created_at),
          ].join(',')),
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
      } else {
        // PDF Export
        const totalLeads = leads.length;
        const convertedLeads = leads.filter(l => l.status === 'converted').length;
        const hotLeads = leads.filter(l => l.lead_temperature === 'hot').length;
        const warmLeads = leads.filter(l => l.lead_temperature === 'warm').length;
        const coldLeads = leads.filter(l => l.lead_temperature === 'cold' || !l.lead_temperature).length;
        const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
        
        const statusCounts: Record<string, number> = {};
        leads.forEach(l => {
          statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
        });

        const sourceCounts: Record<string, number> = {};
        leads.forEach(l => {
          const source = l.source || 'Unknown';
          sourceCounts[source] = (sourceCounts[source] || 0) + 1;
        });

        const qualifiedLeads = leads.filter(l => l.qualification_status === 'qualified').length;
        
        generateReportPDF({
          dateRange: exportRangeLabel,
          conversionMetrics: {
            totalLeads,
            qualifiedLeads,
            convertedLeads,
            qualificationRate: totalLeads > 0 ? (qualifiedLeads / totalLeads) * 100 : 0,
            conversionRate: totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0,
          },
          revenueMetrics: {
            totalRevenue,
            avgOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
            orderCount: orders.length,
          },
          communicationMetrics: {
            totalConversations: comparisonData.conversations.length,
            totalMessages: 0,
            avgMessagesPerConversation: 0,
          },
          leadStatusData: Object.entries(statusCounts).map(([name, value]) => ({
            name,
            value,
          })),
          leadTemperatureData: [
            { name: 'Hot', value: hotLeads },
            { name: 'Warm', value: warmLeads },
            { name: 'Cold', value: coldLeads },
          ],
          leadSourceData: Object.entries(sourceCounts).map(([name, value]) => ({
            name,
            value,
          })),
          currencySymbol,
        });
      }
      
      toast.success(`Report exported as ${type.toUpperCase()}`);
    } catch (error) {
      devError('Export failed:', error);
      toast.error('Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  const getChangeIndicator = (value: number) => {
    if (value > 0) return { icon: ArrowUpRight, color: 'text-success', bg: 'bg-success/10' };
    if (value < 0) return { icon: ArrowDownRight, color: 'text-destructive', bg: 'bg-destructive/10' };
    return { icon: Minus, color: 'text-muted-foreground', bg: 'bg-muted' };
  };

  const getRelativeTime = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true });
  };

  // Get AI-specific insight cards based on agent type
  const getAgentSpecificInsights = () => {
    if (!insights || !organization?.ai_agent_type) return null;
    
    const agentType = organization.ai_agent_type;
    
    // Common card for all agents
    const topSourceCard = (
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-primary mb-1">
            <Target className="w-4 h-4" />
            <span className="text-xs font-medium">Top Source</span>
          </div>
          <p className="text-lg font-bold truncate">{insights.topSource}</p>
          <p className="text-xs text-muted-foreground">{insights.topSourceCount} leads</p>
        </CardContent>
      </Card>
    );

    if (agentType === 'jay') {
      return (
        <>
          {topSourceCard}
          <Card className="bg-gradient-to-br from-warning/5 to-warning/10 border-warning/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-warning mb-1">
                <Flame className="w-4 h-4" />
                <span className="text-xs font-medium">Hot Leads</span>
              </div>
              <p className="text-lg font-bold">{insights.hotLeadsPercent.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">ready to convert</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-success/5 to-success/10 border-success/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-success mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-medium">Conversion Rate</span>
              </div>
              <p className="text-lg font-bold">{insights.conversionRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">leads converted</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-info/5 to-info/10 border-info/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-info mb-1">
                <Trophy className="w-4 h-4" />
                <span className="text-xs font-medium">Top Agent</span>
              </div>
              <p className="text-lg font-bold truncate">{insights.bestAgent}</p>
              <p className="text-xs text-muted-foreground">{insights.bestAgentRate.toFixed(1)}% conversion</p>
            </CardContent>
          </Card>
        </>
      );
    }

    if (agentType === 'may') {
      return (
        <>
          {topSourceCard}
          <Card className="bg-gradient-to-br from-success/5 to-success/10 border-success/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-success mb-1">
                <UtensilsCrossed className="w-4 h-4" />
                <span className="text-xs font-medium">Total Orders</span>
              </div>
              <p className="text-lg font-bold">{comparisonData.orders.length}</p>
              <p className="text-xs text-muted-foreground">processed</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-info/5 to-info/10 border-info/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-info mb-1">
                <Zap className="w-4 h-4" />
                <span className="text-xs font-medium">Avg Order Value</span>
              </div>
              <p className="text-lg font-bold">{formatCurrency(insights.avgOrderValue)}</p>
              <p className="text-xs text-muted-foreground">per order</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-warning/5 to-warning/10 border-warning/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-warning mb-1">
                <Flame className="w-4 h-4" />
                <span className="text-xs font-medium">Hot Leads</span>
              </div>
              <p className="text-lg font-bold">{insights.hotLeadsPercent.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">high intent</p>
            </CardContent>
          </Card>
        </>
      );
    }

    if (agentType === 'cece') {
      return (
        <>
          {topSourceCard}
          <Card className="bg-gradient-to-br from-info/5 to-info/10 border-info/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-info mb-1">
                <BedDouble className="w-4 h-4" />
                <span className="text-xs font-medium">Total Bookings</span>
              </div>
              <p className="text-lg font-bold">{insights.totalBookings}</p>
              <p className="text-xs text-muted-foreground">reservations</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-success/5 to-success/10 border-success/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-success mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-medium">Confirmation Rate</span>
              </div>
              <p className="text-lg font-bold">{insights.occupancyRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">bookings confirmed</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-warning/5 to-warning/10 border-warning/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-warning mb-1">
                <MessageSquare className="w-4 h-4" />
                <span className="text-xs font-medium">Avg Response</span>
              </div>
              <p className="text-lg font-bold">{insights.avgResponseTime !== null ? `${insights.avgResponseTime.toFixed(1)}min` : 'N/A'}</p>
              <p className="text-xs text-muted-foreground">
                {insights.avgResponseTime !== null ? 'response time' : 'response metric unavailable'}
              </p>
            </CardContent>
          </Card>
        </>
      );
    }

    // Default fallback
    return (
      <>
        {topSourceCard}
        <Card className="bg-gradient-to-br from-warning/5 to-warning/10 border-warning/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-warning mb-1">
              <Flame className="w-4 h-4" />
              <span className="text-xs font-medium">Hot Leads</span>
            </div>
            <p className="text-lg font-bold">{insights.hotLeadsPercent.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">of all leads</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-info/5 to-info/10 border-info/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-info mb-1">
              <Zap className="w-4 h-4" />
              <span className="text-xs font-medium">Avg Order</span>
            </div>
            <p className="text-lg font-bold">{formatCurrency(insights.avgOrderValue)}</p>
            <p className="text-xs text-muted-foreground">per order</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-success/5 to-success/10 border-success/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-success mb-1">
              <Trophy className="w-4 h-4" />
              <span className="text-xs font-medium">Top Agent</span>
            </div>
            <p className="text-lg font-bold truncate">{insights.bestAgent}</p>
            <p className="text-xs text-muted-foreground">{insights.bestAgentRate.toFixed(1)}% conversion</p>
          </CardContent>
        </Card>
      </>
    );
  };

  const agentTabs = getAgentAwareReportingTabs(activeAgentType);

  return (
    <TooltipProvider>
      <ReportingFiltersProvider value={{ dateRange, startDate, endDate, selectedAgent }}>
      <div className="container mx-auto py-4 md:py-8 px-3 md:px-6 space-y-4 md:space-y-6">
        <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-background via-primary/5 to-background shadow-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 space-y-3 xl:flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                    {currentAgent ? `${currentAgent.name} reporting` : 'Reporting hub'}
                  </Badge>
                  {organization?.name && (
                    <Badge variant="outline" className="border-border/60 bg-background/80 text-muted-foreground">
                      {organization.name}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-muted-foreground">
                    <Clock className="mr-1 h-3 w-3" />
                    Updated {getRelativeTime(lastUpdated)}
                  </Badge>
                </div>

                <div className="flex items-start gap-3 md:gap-4">
                  {currentAgent && (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15 md:h-14 md:w-14">
                      <currentAgent.icon className="h-5 w-5 md:h-6 md:w-6" />
                    </div>
                  )}
                  <div className="min-w-0 space-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight md:text-4xl">
                      {currentAgent ? `${currentAgent.name} Analytics` : 'Reporting & Analytics'}
                    </h1>
                    <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
                      {currentAgent ? currentAgent.description : 'Track performance and gain insights across business workflows.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 xl:w-auto xl:min-w-[720px] xl:items-end">
                <div className="flex w-full flex-wrap items-center gap-2 xl:justify-end">
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={cn('mr-2 h-4 w-4', isRefreshing && 'animate-spin')} />
                    Refresh reports
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button disabled={isExporting || loadingComparison} className="rounded-2xl">
                        {isExporting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        Export report
                        <ChevronDown className="ml-auto h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover border shadow-lg">
                      <DropdownMenuItem onClick={() => handleExportReport('csv')}>
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Export as CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportReport('pdf')}>
                        <FileDown className="w-4 h-4 mr-2" />
                        Export as PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex w-full flex-nowrap items-center gap-2 overflow-x-auto pb-1 xl:justify-end xl:overflow-visible xl:pb-0">
                  <Button variant="outline" size="sm" className="shrink-0 rounded-xl" onClick={() => setShowFilters((current) => !current)}>
                    <Filter className="mr-2 h-4 w-4" />
                    {showFilters ? 'Hide Filters' : 'Show Filters'}
                  </Button>
                  {hasActiveGlobalFilters && (
                    <Button variant="ghost" size="sm" className="shrink-0 rounded-xl" onClick={handleResetGlobalFilters}>
                      <X className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                  )}

                  {[
                    { value: 'today', label: 'Today' },
                    { value: '7days', label: 'Last 7 days' },
                    { value: '30days', label: 'Last 30 days' },
                    { value: '90days', label: 'Last 90 days' },
                    { value: 'custom', label: 'Custom' },
                  ].map((option) => (
                    <Button
                      key={option.value}
                      variant={dateRange === option.value ? 'default' : 'outline'}
                      size="sm"
                      className="shrink-0 rounded-full"
                      onClick={() => setDateRange(option.value as ReportingDateRange)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {showFilters && (
              <div className="mt-4 border-t border-border/50 pt-4 md:mt-5 md:pt-5">
                <div className="rounded-2xl border border-border/60 bg-background/60 p-3 md:p-4">
                  <div className="grid gap-3 md:grid-cols-3 md:gap-4">
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label>Assigned agent</Label>
                        <p className="text-xs text-muted-foreground">Applies to lead ownership, agent performance, comparison lead metrics, and training.</p>
                      </div>
                      <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="All agents" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border shadow-lg">
                          <SelectItem value="all">All agents</SelectItem>
                          {agents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>{agent.full_name || 'Unnamed agent'}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Start date</Label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(event) => {
                          setStartDate(event.target.value);
                          setDateRange('custom');
                        }}
                        className="rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>End date</Label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(event) => {
                          setEndDate(event.target.value);
                          setDateRange('custom');
                        }}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3 md:space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Immediate Signals</p>
              <h2 className="text-lg font-semibold text-foreground md:text-xl">What needs attention right now</h2>
            </div>
          </div>

          {insights && !loadingComparison && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
              {getAgentSpecificInsights()}
            </div>
          )}

          {loadingComparison && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 md:h-[88px]" />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Business Snapshot</p>
            <h2 className="text-lg font-semibold text-foreground md:text-xl">Core reporting metrics</h2>
          </div>
          <ReportingSummaryCards />
        </div>

        {/* Main Reports - AI Agent Specific Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 md:space-y-6">
          <div className="overflow-x-auto pb-1">
            <TabsList className="inline-flex h-auto min-w-full justify-start gap-1 rounded-2xl border border-border/60 bg-muted/30 p-1">
              {agentTabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="gap-2 rounded-xl px-3 py-2 text-xs md:text-sm"
                >
                  <tab.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </TabsTrigger>
              ))}
              {isClientAdmin && (
                <TabsTrigger
                  value="training"
                  className="gap-2 rounded-xl px-3 py-2 text-xs md:text-sm"
                >
                  <GraduationCap className="h-4 w-4 shrink-0" />
                  <span className="truncate">Training</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <Card className="border-border/60 bg-muted/15 shadow-none">
            <CardContent className="p-4 md:p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{activeTabIntro.eyebrow}</p>
              <div className="mt-1 flex flex-col gap-1 md:flex-row md:items-end md:justify-between md:gap-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-foreground">{activeTabIntro.title}</h3>
                  <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{activeTabIntro.description}</p>
                </div>
              </div>
              {selectedAgent !== 'all' && (
                <div className={cn(
                  'mt-4 rounded-2xl border px-3 py-2 text-sm',
                  activeTabAgentFilterScope === 'full'
                    ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700'
                    : activeTabAgentFilterScope === 'partial'
                      ? 'border-amber-500/20 bg-amber-500/5 text-amber-700'
                      : 'border-border/60 bg-background/70 text-muted-foreground'
                )}>
                  {getAgentFilterMessage(activeTab)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Overview Tab - Agent Specific */}
          <TabsContent value="overview" className="space-y-6">
            {activeAgentType === 'jay' ? (
              <>
                <SalesPerformanceChart />
                <div className="grid gap-6 lg:grid-cols-2">
                  <LeadConversionChart {...conversionCopy} />
                  <LeadTemperatureChart {...temperatureCopy} />
                </div>
                <LeadSourceChart {...leadSourceCopy} />
              </>
            ) : activeAgentType === 'may' ? (
              <>
                <SalesPerformanceChart />
                <div className="grid gap-6 lg:grid-cols-2">
                  <OrderStatusChart />
                  <MenuPerformanceChart />
                </div>
                <LeadSourceChart {...leadSourceCopy} />
              </>
            ) : activeAgentType === 'cece' ? (
              <>
                <div className="grid gap-6 lg:grid-cols-2">
                  <BookingStatusChart />
                  <RoomOccupancyChart />
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                  <LeadSourceChart {...leadSourceCopy} />
                  <BookingSourceChart />
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-6 lg:grid-cols-2">
                  <LeadConversionChart {...conversionCopy} />
                  <LeadSourceChart {...leadSourceCopy} />
                </div>
                <LeadTemperatureChart {...temperatureCopy} />
              </>
            )}
          </TabsContent>

          <TabsContent value="leads" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <LeadConversionChart {...conversionCopy} />
              <LeadSourceChart {...leadSourceCopy} />
            </div>
            <LeadTemperatureChart {...temperatureCopy} />
          </TabsContent>

          <TabsContent value="sales" className="space-y-6">
            <SalesPerformanceChart />
          </TabsContent>

          {/* Bookings Tab - for CeCe agent */}
          <TabsContent value="bookings" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <BookingStatusChart />
              <RoomOccupancyChart />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <LeadSourceChart {...leadSourceCopy} />
              <BookingSourceChart />
            </div>
            <SalesPerformanceChart />
          </TabsContent>

          {/* Orders Tab - for May agent */}
          <TabsContent value="orders" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <OrderStatusChart />
              <MenuPerformanceChart />
            </div>
            <SalesPerformanceChart />
          </TabsContent>

          {/* Operations Tab - for all agent types */}
          <TabsContent value="operations" className="space-y-6">
            <OperationsExpenseChart {...operationsCopy} />
          </TabsContent>

          <TabsContent value="agents" className="space-y-6">
            <AgentPerformanceTable {...agentPerformanceCopy} />
          </TabsContent>

          <TabsContent value="comparison" className="space-y-6">
            <ReportComparison 
              leads={comparisonData.leads}
              orders={comparisonData.orders}
              conversations={comparisonData.conversations}
              bookings={comparisonData.bookings}
              meetings={comparisonData.meetings}
              isLoading={loadingComparison}
            />
          </TabsContent>

          <TabsContent value="saved" className="space-y-6">
            <SavedReportsTab />
          </TabsContent>

          {isClientAdmin && (
            <TabsContent value="training" className="space-y-6">
              <Card className="glass">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <GraduationCap className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle>Training Performance</CardTitle>
                        <CardDescription>Track agent training progress and scores</CardDescription>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={loadTrainingData} disabled={loadingTraining}>
                      {loadingTraining ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Training Scope</p>
                        <p className="mt-1 text-sm text-foreground">This tab follows the global filters above.</p>
                        <p className="mt-1 text-sm text-muted-foreground">Use the shared date range and assigned-agent filter to narrow participation, completion, and score trends, then refresh if you want a manual reload.</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={loadTrainingData} className="rounded-xl">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh training
                      </Button>
                    </div>
                  </div>

                  {loadingTraining ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                      ))}
                    </div>
                  ) : !training ? (
                    <div className="text-center py-12">
                      <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">No training data available</p>
                      <p className="text-sm text-muted-foreground/70">Training sessions will appear here once agents complete them</p>
                    </div>
                  ) : (
                    <>
                      {/* Stats Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-primary/5 border-primary/20">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-muted-foreground">Total Sessions</p>
                                <p className="text-3xl font-bold">{training.totalSessions}</p>
                              </div>
                              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                <BarChart3 className="w-6 h-6 text-primary" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-success/5 border-success/20">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-muted-foreground">Average Score</p>
                                <p className="text-3xl font-bold">
                                  {training.avgScore === null ? '—' : training.avgScore.toFixed(1)}
                                </p>
                              </div>
                              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                                <Target className="w-6 h-6 text-success" />
                              </div>
                            </div>
                            {training.avgScore !== null && (
                              <Progress value={training.avgScore * 10} className="mt-3 h-2" />
                            )}
                          </CardContent>
                        </Card>

                        <Card className="bg-info/5 border-info/20">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-muted-foreground">Active Modules</p>
                                <p className="text-3xl font-bold">{training.topModules.length}</p>
                              </div>
                              <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center">
                                <FileText className="w-6 h-6 text-info" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Top Modules */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Top Training Modules</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {training.topModules.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">No sessions yet</p>
                          ) : (
                            <div className="space-y-3">
                              {training.topModules.map((m, idx) => (
                                <div 
                                  key={m.id} 
                                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={cn(
                                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                                      idx === 0 && "bg-warning/20 text-warning",
                                      idx === 1 && "bg-muted text-muted-foreground",
                                      idx === 2 && "bg-warning/10 text-warning/80",
                                      idx > 2 && "bg-muted text-muted-foreground"
                                    )}>
                                      {idx + 1}
                                    </div>
                                    <div>
                                      <p className="font-medium">{m.title}</p>
                                      <p className="text-xs text-muted-foreground">{m.count} sessions</p>
                                    </div>
                                  </div>
                                  {m.avgScore && (
                                    <Badge variant="outline" className="gap-1">
                                      <Target className="w-3 h-3" />
                                      {m.avgScore.toFixed(1)}
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Agent Leaderboard */}
                      {training.agentBreakdown && training.agentBreakdown.length > 0 && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Trophy className="w-5 h-5 text-warning" />
                              Agent Leaderboard
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {training.agentBreakdown.map((agent, idx) => (
                                <div 
                                  key={agent.id} 
                                  className={cn(
                                    "flex items-center justify-between p-3 rounded-lg transition-colors",
                                    idx === 0 ? "bg-warning/10 border border-warning/20" : "bg-muted/30 hover:bg-muted/50"
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    {idx === 0 && <Trophy className="w-5 h-5 text-warning" />}
                                    {idx === 1 && <Medal className="w-5 h-5 text-muted-foreground" />}
                                    {idx === 2 && <Medal className="w-5 h-5 text-warning/60" />}
                                    {idx > 2 && <span className="w-5 h-5 flex items-center justify-center text-sm text-muted-foreground">#{idx + 1}</span>}
                                    <span className="font-medium">{agent.name}</span>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm">
                                    <span className="text-muted-foreground">{agent.sessions} sessions</span>
                                    <Badge className={cn(
                                      agent.avgScore && agent.avgScore >= 8 ? "bg-success/20 text-success" :
                                      agent.avgScore && agent.avgScore >= 6 ? "bg-warning/20 text-warning" :
                                      "bg-destructive/20 text-destructive"
                                    )}>
                                      {agent.avgScore?.toFixed(1) || '—'}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
      </ReportingFiltersProvider>
    </TooltipProvider>
  );
}

export default function Reporting() {
  return (
    <ErrorBoundary fullPage>
      <ReportingContent />
    </ErrorBoundary>
  );
}
