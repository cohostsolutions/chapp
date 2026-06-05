import { useState, useEffect } from 'react';
import { devError } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { addDays, addWeeks, addMonths, addYears, isSameDay, isWithinInterval, eachDayOfInterval, parseISO, format } from 'date-fns';
import { archiveRecoverableRecordDeletion, confirmRecoverableDeletion, RECOVERY_WINDOW_HOURS } from '@/lib/recoverableDeletion';

export interface MaintenanceBlock {
  id: string;
  organization_id: string;
  room_unit_id: string;
  title: string;
  reason: string | null;
  start_date: string;
  end_date: string;
  is_recurring: boolean;
  recurrence_pattern: 'weekly' | 'monthly' | 'yearly' | null;
  recurrence_day_of_week: number | null;
  recurrence_day_of_month: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  room_unit?: {
    id: string;
    name: string;
  };
}

export interface CreateMaintenanceBlockInput {
  room_unit_id: string;
  title: string;
  reason?: string | null;
  start_date: string;
  end_date: string;
  is_recurring?: boolean;
  recurrence_pattern?: 'weekly' | 'monthly' | 'yearly' | null;
  recurrence_day_of_week?: number | null;
  recurrence_day_of_month?: number | null;
}

export function useMaintenanceBlocks() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [blocks, setBlocks] = useState<MaintenanceBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchBlocks = async () => {
    if (!profile?.organization_id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('maintenance_blocks')
        .select(`
          *,
          room_unit:room_units(id, name)
        `)
        .eq('organization_id', profile.organization_id)
        .order('start_date', { ascending: true });

      if (error) throw error;
      setBlocks((data || []) as MaintenanceBlock[]);
    } catch (error) {
      devError('Error fetching maintenance blocks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load maintenance blocks',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createBlock = async (input: CreateMaintenanceBlockInput) => {
    if (!profile?.organization_id) return null;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('maintenance_blocks')
        .insert({
          ...input,
          organization_id: profile.organization_id,
          created_by: profile.id,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchBlocks();
      toast({
        title: 'Maintenance Block Created',
        description: 'The room has been blocked for maintenance',
      });
      return data;
    } catch (error) {
      devError('Error creating maintenance block:', error);
      toast({
        title: 'Error',
        description: 'Failed to create maintenance block',
        variant: 'destructive',
      });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const updateBlock = async (id: string, updates: Partial<CreateMaintenanceBlockInput>) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('maintenance_blocks')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      await fetchBlocks();
      toast({
        title: 'Maintenance Block Updated',
        description: 'The maintenance block has been updated',
      });
      return true;
    } catch (error) {
      devError('Error updating maintenance block:', error);
      toast({
        title: 'Error',
        description: 'Failed to update maintenance block',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteBlock = async (id: string) => {
    try {
      const block = blocks.find((item) => item.id === id);
      const label = block?.reason || block?.title || 'this maintenance block';
      if (!confirmRecoverableDeletion(label)) return false;
      await archiveRecoverableRecordDeletion('maintenance_blocks', id, label);

      await fetchBlocks();
      toast({
        title: 'Maintenance Block Deleted',
        description: `The maintenance block has been removed. It can be restored from Deleted Items for ${RECOVERY_WINDOW_HOURS} hours.`,
      });
      return true;
    } catch (error) {
      devError('Error deleting maintenance block:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete maintenance block',
        variant: 'destructive',
      });
      return false;
    }
  };

  // Helper function to check if a date is blocked for a specific room
  const isDateBlocked = (date: Date, roomId: string): MaintenanceBlock | null => {
    for (const block of blocks) {
      if (block.room_unit_id !== roomId) continue;

      const startDate = parseISO(block.start_date);
      const endDate = parseISO(block.end_date);

      // Check direct date range
      if (isWithinInterval(date, { start: startDate, end: endDate })) {
        return block;
      }

      // Check recurring patterns
      if (block.is_recurring && block.recurrence_pattern) {
        const checkRecurring = (checkDate: Date): boolean => {
          switch (block.recurrence_pattern) {
            case 'weekly':
              return date.getDay() === startDate.getDay();
            case 'monthly':
              return date.getDate() === startDate.getDate();
            case 'yearly':
              return date.getMonth() === startDate.getMonth() && 
                     date.getDate() === startDate.getDate();
            default:
              return false;
          }
        };

        if (checkRecurring(date) && date >= startDate) {
          return block;
        }
      }
    }
    return null;
  };

  // Get all blocked dates for a room within a date range
  const getBlockedDates = (roomId: string, startRange: Date, endRange: Date): Date[] => {
    const blockedDates: Date[] = [];
    const days = eachDayOfInterval({ start: startRange, end: endRange });

    for (const day of days) {
      if (isDateBlocked(day, roomId)) {
        blockedDates.push(day);
      }
    }

    return blockedDates;
  };

  useEffect(() => {
    fetchBlocks();
  }, [profile?.organization_id]);

  // Set up realtime subscription
  useEffect(() => {
    if (!profile?.organization_id) return;

    const channel = supabase
      .channel('maintenance_blocks_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'maintenance_blocks',
          filter: `organization_id=eq.${profile.organization_id}`,
        },
        () => {
          fetchBlocks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.organization_id]);

  return {
    blocks,
    loading,
    saving,
    fetchBlocks,
    createBlock,
    updateBlock,
    deleteBlock,
    isDateBlocked,
    getBlockedDates,
  };
}
