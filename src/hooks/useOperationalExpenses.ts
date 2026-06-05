import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { devError, devWarn } from '@/lib/logger';
import {
  CECE_DAILY_EXPENSE_TYPES,
  CECE_MONTHLY_EXPENSE_TYPES,
} from '@/lib/operationsExpenseTypes';

export interface OperationalExpense {
  id: string;
  organization_id: string;
  room_unit_id: string | null;
  category: 'daily' | 'monthly';
  expense_type: string;
  amount: number;
  expense_date: string;
  due_date: string | null;
  is_paid: boolean;
  paid_at: string | null;
  notes: string | null;
  vendor: string | null;
  calendar_event_id: string | null;
  expense_calendar_event_id: string | null;
  is_recurring: boolean;
  recurrence_pattern: 'weekly' | 'monthly' | 'yearly' | null;
  recurrence_day_of_week: number | null;
  recurrence_day_of_month: number | null;
  parent_expense_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  room_unit?: {
    id: string;
    name: string;
  };
}

export const DAILY_EXPENSE_TYPES = CECE_DAILY_EXPENSE_TYPES;

export const MONTHLY_EXPENSE_TYPES = CECE_MONTHLY_EXPENSE_TYPES;

export function useOperationalExpenses() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<OperationalExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchExpenses = async () => {
    if (!profile?.organization_id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('operational_expenses')
        .select(`
          *,
          room_unit:room_units(id, name)
        `)
        .eq('organization_id', profile.organization_id)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      setExpenses((data || []) as OperationalExpense[]);
    } catch (error) {
      devError('Error fetching expenses:', error);
      toast({
        title: 'Error',
        description: 'Failed to load expenses',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createExpense = async (expense: Omit<OperationalExpense, 'id' | 'organization_id' | 'created_at' | 'updated_at' | 'created_by' | 'room_unit'> & { add_to_calendar?: boolean }) => {
    if (!profile?.organization_id) return null;
    
    setSaving(true);
    try {
      // Extract add_to_calendar flag (not a DB column)
      const { add_to_calendar, ...expenseData } = expense;

      let calendarEventId: string | null = null;
      let expenseCalendarEventId: string | null = null;

      // Create Google Calendar event for expense_date
      if (add_to_calendar) {
        try {
          const { data: expenseEventData, error: expenseEventError } = await supabase.functions.invoke('google-calendar', {
            body: {
              action: 'create_event',
              event: {
                title: `💸 ${expenseData.expense_type}: ${expenseData.amount}`,
                description: `Expense recorded: ${expenseData.expense_type}\nAmount: ${expenseData.amount}\nCategory: ${expenseData.category}\n${expenseData.vendor ? `Vendor: ${expenseData.vendor}` : ''}\n${expenseData.notes || ''}`,
                startTime: `${expenseData.expense_date}T09:00:00`,
                endTime: `${expenseData.expense_date}T09:30:00`,
              },
            },
          });

          if (!expenseEventError && expenseEventData?.id) {
            expenseCalendarEventId = expenseEventData.id;
          }
        } catch (calError) {
          devError('Failed to create expense calendar event:', calError);
        }

        // Also create due date event if due_date is set
        if (expenseData.due_date) {
          try {
            const { data: dueEventData, error: dueEventError } = await supabase.functions.invoke('google-calendar', {
              body: {
                action: 'create_event',
                event: {
                  title: `⏰ Due: ${expenseData.expense_type}`,
                  description: `Payment due: ${expenseData.expense_type}\nAmount: ${expenseData.amount}\n${expenseData.vendor ? `Vendor: ${expenseData.vendor}` : ''}\n${expenseData.notes || ''}`,
                  startTime: `${expenseData.due_date}T09:00:00`,
                  endTime: `${expenseData.due_date}T09:30:00`,
                },
              },
            });

            if (!dueEventError && dueEventData?.id) {
              calendarEventId = dueEventData.id;
            }
          } catch (calError) {
            devError('Failed to create due date calendar event:', calError);
          }
        }
      }

      const isUuid = (value: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

      const fullInsertPayload = {
        ...expenseData,
        organization_id: profile.organization_id,
        created_by: profile.id,
        // Newer schema can store provider IDs as text here, older schema may require UUID.
        calendar_event_id: calendarEventId,
        expense_calendar_event_id: expenseCalendarEventId,
      };

      let { data, error } = await supabase
        .from('operational_expenses')
        .insert(fullInsertPayload)
        .select()
        .single();

      if (error) {
        const normalizedMessage = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
        const shouldRetryWithLegacyPayload =
          error.code === '42703' || // undefined_column
          (normalizedMessage.includes('column') && normalizedMessage.includes('does not exist')) ||
          ((error.code === '22P02' || error.code === '22p02') &&
            normalizedMessage.includes('uuid') &&
            normalizedMessage.includes('calendar_event_id'));

        if (shouldRetryWithLegacyPayload) {
          const legacyInsertPayload = {
            category: expenseData.category,
            expense_type: expenseData.expense_type,
            amount: expenseData.amount,
            expense_date: expenseData.expense_date,
            due_date: expenseData.due_date,
            room_unit_id: expenseData.room_unit_id,
            notes: expenseData.notes,
            vendor: expenseData.vendor,
            is_paid: expenseData.is_paid,
            paid_at: expenseData.paid_at,
            organization_id: profile.organization_id,
            created_by: profile.id,
            // Older schema defines this as UUID, so only persist when compatible.
            calendar_event_id: calendarEventId && isUuid(calendarEventId) ? calendarEventId : null,
          };

          const retryResult = await supabase
            .from('operational_expenses')
            .insert(legacyInsertPayload)
            .select()
            .single();

          data = retryResult.data;
          error = retryResult.error;

          if (!error) {
            devWarn('createExpense used legacy insert payload due to schema mismatch', {
              originalCode: error?.code,
              originalMessage: error?.message,
            });
          }
        }
      }

      if (error) throw error;
      
      await fetchExpenses();
      
      // Show undoable toast
      const createdId = data.id;
      sonnerToast.success('Expense Added', {
        description: expenseCalendarEventId 
          ? 'The expense has been recorded and added to your calendar' 
          : 'The expense has been recorded successfully',
        duration: 10000,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await supabase.from('operational_expenses').delete().eq('id', createdId);
              await fetchExpenses();
              sonnerToast.success('Action undone', { description: 'Expense removed', duration: 3000 });
            } catch (err) {
              sonnerToast.error('Undo failed', { duration: 3000 });
            }
          },
        },
      });
      return data;
    } catch (error) {
      devError('Error creating expense:', error);
      const errorMessage =
        typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: string }).message || 'Failed to create expense')
          : 'Failed to create expense';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Sync existing expenses to Google Calendar (backfill) - including due dates
  const syncExpensesToCalendar = async () => {
    if (!profile?.organization_id) return { synced: 0, failed: 0 };
    
    setSaving(true);
    let synced = 0;
    let failed = 0;

    try {
      // Get expenses without calendar events for expense_date OR due_date
      const expensesToSync = expenses.filter(e => !e.expense_calendar_event_id);
      const dueDatesToSync = expenses.filter(e => e.due_date && !e.calendar_event_id && !e.is_paid);
      
      // Sync expense dates
      for (const expense of expensesToSync) {
        try {
          const { data: eventData, error: eventError } = await supabase.functions.invoke('google-calendar', {
            body: {
              action: 'create_event',
              event: {
                title: `💸 ${expense.expense_type}: ${expense.amount}`,
                description: `Expense recorded: ${expense.expense_type}\nAmount: ${expense.amount}\nCategory: ${expense.category}\n${expense.vendor ? `Vendor: ${expense.vendor}` : ''}\n${expense.notes || ''}`,
                startTime: `${expense.expense_date}T09:00:00`,
                endTime: `${expense.expense_date}T09:30:00`,
              },
            },
          });

          if (!eventError && eventData?.id) {
            await supabase
              .from('operational_expenses')
              .update({ expense_calendar_event_id: eventData.id })
              .eq('id', expense.id);
            synced++;
          } else {
            failed++;
          }
        } catch (err) {
          devError('Failed to sync expense:', expense.id, err);
          failed++;
        }
      }

      // Sync due dates separately
      for (const expense of dueDatesToSync) {
        try {
          const { data: eventData, error: eventError } = await supabase.functions.invoke('google-calendar', {
            body: {
              action: 'create_event',
              event: {
                title: `⏰ Due: ${expense.expense_type}`,
                description: `Payment due: ${expense.expense_type}\nAmount: ${expense.amount}\n${expense.vendor ? `Vendor: ${expense.vendor}` : ''}\n${expense.notes || ''}`,
                startTime: `${expense.due_date}T09:00:00`,
                endTime: `${expense.due_date}T09:30:00`,
              },
            },
          });

          if (!eventError && eventData?.id) {
            await supabase
              .from('operational_expenses')
              .update({ calendar_event_id: eventData.id })
              .eq('id', expense.id);
            synced++;
          } else {
            failed++;
          }
        } catch (err) {
          devError('Failed to sync due date:', expense.id, err);
          failed++;
        }
      }

      await fetchExpenses();
      
      toast({
        title: 'Calendar Sync Complete',
        description: `Synced ${synced} item${synced !== 1 ? 's' : ''} to calendar${failed > 0 ? `, ${failed} failed` : ''}`,
      });

      return { synced, failed };
    } catch (error) {
      devError('Error syncing expenses to calendar:', error);
      toast({
        title: 'Error',
        description: 'Failed to sync expenses to calendar',
        variant: 'destructive',
      });
      return { synced, failed };
    } finally {
      setSaving(false);
    }
  };

  const updateExpense = async (id: string, updates: Partial<OperationalExpense>) => {
    setSaving(true);
    try {
      // Find the existing expense to get calendar event IDs
      const existingExpense = expenses.find(e => e.id === id);

      const { error } = await supabase
        .from('operational_expenses')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      // Sync calendar events if relevant fields changed
      if (existingExpense) {
        const mergedExpense = { ...existingExpense, ...updates };
        
        // Update expense date calendar event
        if (existingExpense.expense_calendar_event_id && 
            (updates.expense_type || updates.amount || updates.expense_date || updates.vendor || updates.notes)) {
          try {
            await supabase.functions.invoke('google-calendar', {
              body: {
                action: 'update_event',
                eventId: existingExpense.expense_calendar_event_id,
                event: {
                  title: `💸 ${mergedExpense.expense_type}: ${mergedExpense.amount}`,
                  description: `Expense recorded: ${mergedExpense.expense_type}\nAmount: ${mergedExpense.amount}\nCategory: ${mergedExpense.category}\n${mergedExpense.vendor ? `Vendor: ${mergedExpense.vendor}` : ''}\n${mergedExpense.notes || ''}`,
                  startTime: `${mergedExpense.expense_date}T09:00:00`,
                  endTime: `${mergedExpense.expense_date}T09:30:00`,
                },
              },
            });
          } catch (calErr) {
            devWarn('Failed to update expense calendar event:', calErr);
          }
        }

        // Update due date calendar event
        if (existingExpense.calendar_event_id && 
            (updates.expense_type || updates.amount || updates.due_date || updates.vendor || updates.notes)) {
          try {
            await supabase.functions.invoke('google-calendar', {
              body: {
                action: 'update_event',
                eventId: existingExpense.calendar_event_id,
                event: {
                  title: `⏰ Due: ${mergedExpense.expense_type}`,
                  description: `Payment due: ${mergedExpense.expense_type}\nAmount: ${mergedExpense.amount}\n${mergedExpense.vendor ? `Vendor: ${mergedExpense.vendor}` : ''}\n${mergedExpense.notes || ''}`,
                  startTime: `${mergedExpense.due_date}T09:00:00`,
                  endTime: `${mergedExpense.due_date}T09:30:00`,
                },
              },
            });
          } catch (calErr) {
            devWarn('Failed to update due date calendar event:', calErr);
          }
        }
      }
      
      // Store previous data for undo
      const previousData = { ...existingExpense };
      
      await fetchExpenses();
      
      // Show undoable toast
      sonnerToast.success('Expense Updated', {
        description: 'The expense has been updated successfully',
        duration: 10000,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await supabase.from('operational_expenses').update({
                expense_type: previousData.expense_type,
                amount: previousData.amount,
                expense_date: previousData.expense_date,
                due_date: previousData.due_date,
                notes: previousData.notes,
                vendor: previousData.vendor,
                category: previousData.category,
                is_paid: previousData.is_paid,
                paid_at: previousData.paid_at,
                room_unit_id: previousData.room_unit_id,
              }).eq('id', id);
              await fetchExpenses();
              sonnerToast.success('Action undone', { description: 'Expense restored', duration: 3000 });
            } catch (err) {
              sonnerToast.error('Undo failed', { duration: 3000 });
            }
          },
        },
      });
      return true;
    } catch (error) {
      devError('Error updating expense:', error);
      toast({
        title: 'Error',
        description: 'Failed to update expense',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      // First, get the expense to check for calendar event IDs
      const expenseToDelete = expenses.find(e => e.id === id);
      if (!expenseToDelete) return false;
      
      // Store for potential undo
      const deletedExpenseData = { ...expenseToDelete };
      
      // Delete associated Google Calendar events if they exist
      const eventIdsToDelete = [
        expenseToDelete.expense_calendar_event_id,
        expenseToDelete.calendar_event_id,
      ].filter(Boolean);

      for (const eventId of eventIdsToDelete) {
        try {
          await supabase.functions.invoke('google-calendar', {
            body: { action: 'delete_event', eventId },
          });
        } catch (calErr) {
          devWarn('Failed to delete calendar event:', eventId, calErr);
          // Continue even if calendar deletion fails
        }
      }

      const { error } = await supabase
        .from('operational_expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchExpenses();
      
      // Show undoable toast
      sonnerToast.success('Expense Deleted', {
        description: `${deletedExpenseData.expense_type} has been removed`,
        duration: 10000,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await supabase.from('operational_expenses').insert({
                id: deletedExpenseData.id,
                organization_id: deletedExpenseData.organization_id,
                room_unit_id: deletedExpenseData.room_unit_id,
                category: deletedExpenseData.category,
                expense_type: deletedExpenseData.expense_type,
                amount: deletedExpenseData.amount,
                expense_date: deletedExpenseData.expense_date,
                due_date: deletedExpenseData.due_date,
                is_paid: deletedExpenseData.is_paid,
                paid_at: deletedExpenseData.paid_at,
                notes: deletedExpenseData.notes,
                vendor: deletedExpenseData.vendor,
                is_recurring: deletedExpenseData.is_recurring,
                recurrence_pattern: deletedExpenseData.recurrence_pattern,
                recurrence_day_of_week: deletedExpenseData.recurrence_day_of_week,
                recurrence_day_of_month: deletedExpenseData.recurrence_day_of_month,
                parent_expense_id: deletedExpenseData.parent_expense_id,
              });
              await fetchExpenses();
              sonnerToast.success('Action undone', { description: 'Expense restored', duration: 3000 });
            } catch (err) {
              devError('Undo failed:', err);
              sonnerToast.error('Undo failed', { duration: 3000 });
            }
          },
        },
      });
      return true;
    } catch (error) {
      devError('Error deleting expense:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete expense',
        variant: 'destructive',
      });
      return false;
    }
  };

  const markAsPaid = async (id: string) => {
    return updateExpense(id, {
      is_paid: true,
      paid_at: new Date().toISOString(),
    });
  };

  const markAsUnpaid = async (id: string) => {
    return updateExpense(id, {
      is_paid: false,
      paid_at: null,
    });
  };

  useEffect(() => {
    fetchExpenses();
  }, [profile?.organization_id]);

  // Realtime subscription for expenses
  useEffect(() => {
    if (!profile?.organization_id) return;

    const channel = supabase
      .channel('operational_expenses_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'operational_expenses',
          filter: `organization_id=eq.${profile.organization_id}`,
        },
        () => {
          fetchExpenses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.organization_id]);

  // Summary calculations
  const summary = {
    totalExpenses: expenses.reduce((sum, e) => sum + Number(e.amount), 0),
    dailyTotal: expenses.filter(e => e.category === 'daily').reduce((sum, e) => sum + Number(e.amount), 0),
    monthlyTotal: expenses.filter(e => e.category === 'monthly').reduce((sum, e) => sum + Number(e.amount), 0),
    unpaidCount: expenses.filter(e => !e.is_paid).length,
    unpaidTotal: expenses.filter(e => !e.is_paid).reduce((sum, e) => sum + Number(e.amount), 0),
    overdueCount: expenses.filter(e => !e.is_paid && e.due_date && new Date(e.due_date) < new Date()).length,
  };

  // Count expenses not yet synced to calendar
  const unsyncedCount = expenses.filter(e => !e.expense_calendar_event_id).length;

  return {
    expenses,
    loading,
    saving,
    summary,
    unsyncedCount,
    fetchExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    markAsPaid,
    markAsUnpaid,
    syncExpensesToCalendar,
  };
}