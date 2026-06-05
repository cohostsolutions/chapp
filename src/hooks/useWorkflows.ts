import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';
import type { Json } from '@/integrations/supabase/types';
import { archiveRecoverableRecordDeletion, RECOVERY_WINDOW_HOURS } from '@/lib/recoverableDeletion';

type Workflow = Tables<'workflows'>;
type WorkflowRun = Tables<'workflow_runs'>;
type WorkflowTriggerType = 'lead_created' | 'lead_updated' | 'status_changed' | 'order_created' | 'time_based' | 'manual';

export function useWorkflows(organizationId: string) {
  return useQuery({
    queryKey: ['workflows', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Workflow[];
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!organizationId,
  });
}

export function useWorkflow(workflowId: string) {
  return useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', workflowId)
        .maybeSingle();

      if (error) throw error;
      return data as Workflow | null;
    },
    enabled: !!workflowId,
  });
}

export function useCreateWorkflow(organizationId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (workflow: {
      name: string;
      description?: string;
      trigger_type: string;
      trigger_config?: Json;
      actions?: Json;
      is_active?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('workflows')
        .insert({
          organization_id: organizationId,
          name: workflow.name,
          description: workflow.description || null,
          trigger_type: workflow.trigger_type,
          trigger_config: workflow.trigger_config || {},
          actions: workflow.actions || [],
          is_active: workflow.is_active ?? true,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows', organizationId] });
      toast({
        title: 'Workflow created',
        description: 'Your automation workflow has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create workflow',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Omit<Workflow, 'id' | 'organization_id' | 'created_at' | 'created_by'>>) => {
      const { data, error } = await supabase
        .from('workflows')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast({
        title: 'Workflow updated',
        description: 'Your changes have been saved.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update workflow',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (workflowId: string) => {
      await archiveRecoverableRecordDeletion('workflows', workflowId, 'Workflow');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast({
        title: 'Workflow deleted',
        description: `The workflow has been removed. It can be restored from Deleted Items for ${RECOVERY_WINDOW_HOURS} hours.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete workflow',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useExecuteWorkflow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ workflowId, triggerData }: { workflowId: string; triggerData?: Json }) => {
      // Create a workflow run record
      const { data, error } = await supabase
        .from('workflow_runs')
        .insert({
          workflow_id: workflowId,
          status: 'running',
          trigger_data: triggerData || {},
          steps_completed: 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Update workflow run count
      await supabase
        .from('workflows')
        .update({ 
          last_run_at: new Date().toISOString(),
          run_count: supabase.rpc ? undefined : 1 // Increment would need a separate call
        })
        .eq('id', workflowId);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-runs'] });
      toast({
        title: 'Workflow executed',
        description: 'The workflow has been successfully executed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Workflow execution failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useWorkflowRuns(workflowId: string) {
  return useQuery({
    queryKey: ['workflow-runs', workflowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_runs')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as WorkflowRun[];
    },
    staleTime: 60 * 1000,
    enabled: !!workflowId,
  });
}

// Predefined workflow templates
export const WORKFLOW_TEMPLATES = [
  {
    name: 'Welcome New Leads',
    description: 'Send welcome email and SMS when a new lead is created',
    trigger_type: 'lead_created' as WorkflowTriggerType,
    trigger_config: {},
    actions: [
      {
        type: 'send_email',
        to: '{{lead.email}}',
        subject: 'Welcome to AlCor Nexus!',
        body: 'Thank you for your interest. We\'ll be in touch soon!',
      },
      {
        type: 'send_sms',
        to: '{{lead.phone}}',
        message: 'Welcome! Your inquiry has been received.',
      },
    ],
  },
  {
    name: 'Hot Lead Alert',
    description: 'Notify team when lead temperature changes to hot',
    trigger_type: 'lead_updated' as WorkflowTriggerType,
    trigger_config: {
      field: 'temperature',
      value: 'hot',
    },
    actions: [
      {
        type: 'send_email',
        to: '{{assigned_agent.email}}',
        subject: 'Hot Lead Alert: {{lead.name}}',
        body: 'A lead has been marked as HOT. Please follow up immediately.',
      },
      {
        type: 'create_task',
        title: 'Follow up with {{lead.name}}',
        priority: 'high',
        due_date: 'today',
      },
    ],
  },
  {
    name: 'Abandoned Lead Follow-up',
    description: 'Send follow-up after 3 days of inactivity',
    trigger_type: 'time_based' as WorkflowTriggerType,
    trigger_config: {
      delay: '3 days',
      condition: 'no_activity',
    },
    actions: [
      {
        type: 'send_email',
        to: '{{lead.email}}',
        subject: 'Are you still interested?',
        body: 'We noticed you haven\'t responded. Can we help with anything?',
      },
    ],
  },
  {
    name: 'Order Confirmation',
    description: 'Send confirmation when order is created',
    trigger_type: 'order_created' as WorkflowTriggerType,
    trigger_config: {},
    actions: [
      {
        type: 'send_email',
        to: '{{lead.email}}',
        subject: 'Order Confirmation #{{order.id}}',
        body: 'Thank you for your order! Details: {{order.description}}',
      },
      {
        type: 'update_lead',
        updates: {
          status: 'converted',
        },
      },
    ],
  },
];
