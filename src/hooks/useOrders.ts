import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { devLog } from '@/lib/logger';
import type { OrderRow } from '@/types/database';
import { archiveRecoverableRecordDeletion, confirmRecoverableDeletion, DeletionCancelledError, RECOVERY_WINDOW_HOURS } from '@/lib/recoverableDeletion';

const ORDERS_QUERY_KEY = 'orders';

interface OrderFilters {
  search?: string;
  status?: string;
}

interface PaginationParams {
  page: number;
  pageSize: number;
}

interface UseOrdersOptions {
  filters?: OrderFilters;
  pagination?: PaginationParams;
  enableRealtime?: boolean;
}

export interface OrderWithLead extends OrderRow {
  lead?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
}

export function useOrders(options: UseOrdersOptions = {}) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { 
    filters = {}, 
    pagination = { page: 1, pageSize: 20 },
    enableRealtime = true 
  } = options;

  const fetchOrders = async () => {
    let query = supabase
      .from('orders')
      .select('*, lead:leads(id, name, email, phone)', { count: 'exact' });

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters.search) {
      query = query.or(`pickup_name.ilike.%${filters.search}%`);
    }

    const from = (pagination.page - 1) * pagination.pageSize;
    const to = from + pagination.pageSize - 1;
    
    query = query
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data: (data || []) as OrderWithLead[],
      count: count || 0,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil((count || 0) / pagination.pageSize)
    };
  };

  const query = useQuery({
    queryKey: [ORDERS_QUERY_KEY, filters, pagination],
    queryFn: fetchOrders,
    staleTime: 30000,
  });

  // Real-time subscription
  useEffect(() => {
    if (!enableRealtime) return;

    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          devLog('Order change:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY] });
          
          if (payload.eventType === 'INSERT') {
            toast({
              title: 'New Order',
              description: 'A new order was just placed',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enableRealtime, queryClient, toast]);

  const createOrder = useMutation({
    mutationFn: async (order: Omit<OrderRow, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('orders')
        .insert(order)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY] });
      toast({ title: 'Order Created', description: 'New order added successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const updateOrder = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OrderRow> & { id: string }) => {
      const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: [ORDERS_QUERY_KEY] });
      const previousOrders = queryClient.getQueryData([ORDERS_QUERY_KEY, filters, pagination]);
      
      // Optimistic update
      queryClient.setQueryData([ORDERS_QUERY_KEY, filters, pagination], (old) => {
        const previous = old as { data?: OrderWithLead[] } | undefined;
        if (!previous?.data) return old;
        return {
          ...previous,
          data: previous.data.map((order) =>
            order.id === id ? { ...order, ...updates } : order
          ),
        };
      });
      
      return { previousOrders };
    },
    onError: (error: Error, _, context) => {
      queryClient.setQueryData([ORDERS_QUERY_KEY, filters, pagination], context?.previousOrders);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY] });
    }
  });

  const deleteOrder = useMutation({
    mutationFn: async (id: string) => {
      const order = (query.data?.data || []).find((item) => item.id === id);
      const label = order?.lead?.name || order?.id || 'this order';
      if (!confirmRecoverableDeletion(label)) throw new DeletionCancelledError();
      await archiveRecoverableRecordDeletion('orders', id, label);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY] });
      toast({ title: 'Order Deleted', description: `Order removed. It can be restored from Deleted Items for ${RECOVERY_WINDOW_HOURS} hours.` });
    },
    onError: (error: Error) => {
      if (error instanceof DeletionCancelledError) return;
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  return {
    orders: query.data?.data || [],
    totalCount: query.data?.count || 0,
    totalPages: query.data?.totalPages || 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    createOrder,
    updateOrder,
    deleteOrder,
  };
}
