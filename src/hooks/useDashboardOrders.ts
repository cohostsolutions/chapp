import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardOrderItem {
  name: string;
  quantity: number;
  price: number;
  notes?: string;
}

export interface DashboardOrder {
  id: string;
  organization_id: string;
  lead_id: string;
  order_items: DashboardOrderItem[];
  total_amount: number | null;
  status: string;
  pickup_name: string | null;
  pickup_time: string | null;
  notes: string | null;
  created_at: string;
  lead?: {
    name: string;
    phone: string | null;
    email: string | null;
  };
}

export function useDashboardOrders(organizationId?: string | null, limit: number = 10) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['dashboard-orders', organizationId, limit],
    enabled: !!organizationId,
    queryFn: async (): Promise<DashboardOrder[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          organization_id,
          lead_id,
          order_items,
          total_amount,
          status,
          pickup_name,
          pickup_time,
          notes,
          created_at,
          lead:leads(name, phone, email)
        `)
        .eq('organization_id', organizationId!)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((order) => ({
        ...order,
        lead: order.lead as DashboardOrder['lead'],
        order_items: (order.order_items as unknown as DashboardOrderItem[]) || [],
      })) as DashboardOrder[];
    },
    staleTime: 15000,
  });

  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel(`dashboard-orders-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dashboard-orders', organizationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);

  return {
    orders: query.data || [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    lastUpdatedAt: query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null,
  };
}