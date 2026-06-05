import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { HousekeepingTaskFormData } from '@/lib/validations';

/**
 * Hook to create and manage housekeeping tasks
 * TODO: Requires housekeeping_tasks table schema
 */
export function useCreateHousekeepingTask() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createTask = useMutation({
    mutationFn: async (data: HousekeepingTaskFormData & { propertyId: string }) => {
      if (!user || !profile?.organization_id) {
        throw new Error('Must be authenticated');
      }

      throw new Error(
        'Housekeeping tasks are not available yet because the housekeeping_tasks table has not been deployed.'
      );

      /* Actual implementation when table exists:
      const { data: result, error } = await supabase
        .from('housekeeping_tasks')
        .insert({
          property_id: data.propertyId,
          room_id: data.roomId,
          organization_id: profile.organization_id,
          title: data.title,
          description: data.description,
          priority: data.priority,
          task_type: data.taskType,
          status: data.status,
          assigned_to: data.assignedTo,
          estimated_duration: data.estimatedDuration,
          checklist_items: data.checklistItems,
          notes: data.notes,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
      */
    },
    onSuccess: () => {
      // Invalidate housekeeping task queries
      queryClient.invalidateQueries({ queryKey: ['housekeeping-tasks'] });

      toast({
        title: 'Success',
        description: 'Housekeeping task created successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create housekeeping task',
        variant: 'destructive',
      });
      throw error;
    },
  });

  return {
    createTask: createTask.mutateAsync,
    isLoading: createTask.isPending,
    error: createTask.error,
  };
}

/**
 * Hook to update housekeeping task status and progress
 */
export function useUpdateHousekeepingTask() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateTask = useMutation({
    mutationFn: async (data: {
      taskId: string;
      status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
      completedChecklist?: number[]; // indices of completed checklist items
      actualDuration?: number;
      notes?: string;
    }) => {
      if (!user || !profile?.organization_id) {
        throw new Error('Must be authenticated');
      }

      throw new Error(
        'Housekeeping task updates are not available yet because the housekeeping_tasks table has not been deployed.'
      );

      /* Actual implementation:
      const updateData: any = { updated_at: new Date().toISOString() };
      
      if (data.status) updateData.status = data.status;
      if (data.actualDuration !== undefined) updateData.actual_duration = data.actualDuration;
      if (data.notes !== undefined) updateData.notes = data.notes;
      
      // For checklist completion, would need to fetch and update the array
      if (data.completedChecklist) {
        // Get current task
        const { data: task } = await supabase
          .from('housekeeping_tasks')
          .select('checklist_items')
          .eq('id', data.taskId)
          .single();
        
        if (task?.checklist_items) {
          const updated = task.checklist_items.map((item: any, idx: number) => ({
            ...item,
            completed: data.completedChecklist.includes(idx) ? true : item.completed,
          }));
          updateData.checklist_items = updated;
        }
      }

      const { data: result, error } = await supabase
        .from('housekeeping_tasks')
        .update(updateData)
        .eq('id', data.taskId)
        .eq('organization_id', profile.organization_id)
        .select()
        .single();

      if (error) throw error;
      return result;
      */
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['housekeeping-tasks'] });

      toast({
        title: 'Success',
        description: 'Task updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update task',
        variant: 'destructive',
      });
      throw error;
    },
  });

  return {
    updateTask: updateTask.mutateAsync,
    isLoading: updateTask.isPending,
    error: updateTask.error,
  };
}
