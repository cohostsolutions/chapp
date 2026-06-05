import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';
import type { Json } from '@/integrations/supabase/types';
import { archiveRecoverableRecordDeletion, RECOVERY_WINDOW_HOURS } from '@/lib/recoverableDeletion';

type Report = Tables<'reports'>;
export type ReportType = 'leads' | 'revenue' | 'agents' | 'bookings' | 'orders' | 'operations' | 'custom';
interface ReportTemplate {
  name: string;
  type: ReportType;
  description: string;
  config: {
    metrics: string[];
    dateRange: string;
  };
}

export function useReports(organizationId: string) {
  return useQuery({
    queryKey: ['reports', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Report[];
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!organizationId,
  });
}

export function useReport(reportId: string) {
  return useQuery({
    queryKey: ['report', reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .maybeSingle();

      if (error) throw error;
      return data as Report | null;
    },
    enabled: !!reportId,
  });
}

export function useGenerateReport(reportId: string) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      // Generate report based on existing data
      const reportData: Record<string, unknown> = {};
      
      // Leads report
      const { data: leads } = await supabase
        .from('leads')
        .select('id, status, lead_temperature')
        .limit(1000);

      reportData.leads = {
        total: leads?.length || 0,
        byStatus: leads?.reduce((acc: Record<string, number>, lead) => {
          acc[lead.status] = (acc[lead.status] || 0) + 1;
          return acc;
        }, {}),
        byTemperature: leads?.reduce((acc: Record<string, number>, lead) => {
          const temp = lead.lead_temperature || 'unknown';
          acc[temp] = (acc[temp] || 0) + 1;
          return acc;
        }, {}),
      };

      // Orders report
      const { data: orders } = await supabase
        .from('orders')
        .select('id, total_amount')
        .limit(1000);

      const totalRevenue = orders?.reduce((sum, order) => 
        sum + parseFloat(String(order.total_amount || 0)), 0) || 0;

      reportData.revenue = {
        totalRevenue,
        orderCount: orders?.length || 0,
        averageOrderValue: totalRevenue / (orders?.length || 1),
      };

      return { reportId, data: reportData };
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to generate report',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useCreateReport(organizationId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (report: {
      name: string;
      description?: string;
      report_type: string;
      config?: Json;
      schedule?: string;
      is_public?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('reports')
        .insert({
          organization_id: organizationId,
          name: report.name,
          description: report.description || null,
          report_type: report.report_type,
          config: report.config || {},
          schedule: report.schedule || null,
          is_public: report.is_public ?? false,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports', organizationId] });
      toast({
        title: 'Report created',
        description: 'Your custom report has been saved.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create report',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateReport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Omit<Report, 'id' | 'organization_id' | 'created_at' | 'created_by'>>) => {
      const { data, error } = await supabase
        .from('reports')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast({
        title: 'Report updated',
        description: 'Your changes have been saved.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update report',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteReport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (reportId: string) => {
      await archiveRecoverableRecordDeletion('reports', reportId, 'Report');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast({
        title: 'Report deleted',
        description: `The report has been removed. It can be restored from Deleted Items for ${RECOVERY_WINDOW_HOURS} hours.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete report',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    name: 'Lead Generation Report',
    type: 'leads' as ReportType,
    description: 'Analyze lead sources, conversion rates, and quality',
    config: {
      metrics: ['total', 'bySource', 'byStatus', 'byTemperature', 'averageScore'],
      dateRange: 'last30days',
    },
  },
  {
    name: 'Revenue Analysis',
    type: 'revenue' as ReportType,
    description: 'Track revenue trends, order values, and growth',
    config: {
      metrics: ['totalRevenue', 'orderCount', 'averageOrderValue', 'byMonth'],
      dateRange: 'last90days',
    },
  },
  {
    name: 'Agent Performance',
    type: 'agents' as ReportType,
    description: 'Monitor team productivity and effectiveness',
    config: {
      metrics: ['leadsPerAgent', 'conversionsPerAgent', 'responseTime'],
      dateRange: 'last30days',
    },
  },
  {
    name: 'Booking Analytics',
    type: 'bookings' as ReportType,
    description: 'Track reservation volume, occupancy, and booking sources',
    config: {
      metrics: ['bookingCount', 'bookingStatus', 'occupancyRate', 'bookingSource'],
      dateRange: 'last90days',
    },
  },
  {
    name: 'Order Analytics',
    type: 'orders' as ReportType,
    description: 'Monitor order status, volume, and menu performance',
    config: {
      metrics: ['orderCount', 'orderStatus', 'averageOrderValue', 'topItems'],
      dateRange: 'last30days',
    },
  },
  {
    name: 'Operations Spend',
    type: 'operations' as ReportType,
    description: 'Review operational expenses, pending payables, and spend mix',
    config: {
      metrics: ['totalExpenses', 'pendingExpenses', 'expenseTypes', 'monthlyTrend'],
      dateRange: 'last90days',
    },
  },
  {
    name: 'Sales Funnel',
    type: 'custom' as ReportType,
    description: 'Visualize lead progression through sales stages',
    config: {
      metrics: ['funnelStages', 'conversionRates', 'dropoffPoints'],
      dateRange: 'last30days',
    },
  },
];
