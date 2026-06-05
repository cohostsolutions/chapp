import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CustomStatus {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface CustomLeadStatuses {
  default_statuses: Record<string, { enabled: boolean; color: string; order: number }>;
  custom_statuses: CustomStatus[];
}

export interface AgentTakeoverCriteria {
  enabled: boolean;
  criteria_prompt: string;
  examples: string[];
  auto_notify_agent: boolean;
}

export interface AIHandbackCriteria {
  enabled: boolean;
  criteria_prompt: string;
  examples: string[];
  auto_notify: boolean;
}

export interface ConversionStep {
  enabled: boolean;
  description: string;
  required_info: string[];
}

export interface SalesProcessConfig {
  opening: { enabled: boolean; message: string };
  qualification: { enabled: boolean; description: string; questions: string[] };
  conversion: {
    reservation: ConversionStep;
    sale: ConversionStep;
    order: ConversionStep;
  };
  confirmation: { enabled: boolean; process: string };
  after_sales: { enabled: boolean; follow_up: string };
}

export interface KnowledgeBaseSettingsSnapshot {
  salesProcessConfig: SalesProcessConfig;
  customLeadStatuses?: CustomLeadStatuses;
  takeoverCriteria?: AgentTakeoverCriteria;
  agentTakeoverMessage?: string;
  aiHandbackMessage?: string;
  handbackCriteria?: AIHandbackCriteria;
}

interface UseKnowledgeBaseSettingsOptions {
  organizationId?: string;
}

export function useKnowledgeBaseSettings({ organizationId }: UseKnowledgeBaseSettingsOptions) {
  const { toast } = useToast();

  const normalizeConversionStep = useCallback((value: unknown): ConversionStep => {
    const candidate = (typeof value === 'object' && value !== null
      ? value
      : {}) as Partial<ConversionStep>;

    return {
      enabled: candidate.enabled ?? true,
      description: typeof candidate.description === 'string' ? candidate.description : '',
      required_info: Array.isArray(candidate.required_info)
        ? candidate.required_info.filter((item): item is string => typeof item === 'string')
        : [],
    };
  }, []);

  const normalizeSalesProcessConfig = useCallback((raw: unknown): SalesProcessConfig => {
    const config = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<SalesProcessConfig>;
    const conversionConfig = (config.conversion ?? {}) as Partial<SalesProcessConfig['conversion']>;

    return {
      opening: {
        enabled: config.opening?.enabled ?? true,
        message: typeof config.opening?.message === 'string' ? config.opening.message : '',
      },
      qualification: {
        enabled: config.qualification?.enabled ?? true,
        description: typeof config.qualification?.description === 'string'
          ? config.qualification.description
          : '',
        questions: Array.isArray(config.qualification?.questions)
          ? config.qualification.questions.filter((item): item is string => typeof item === 'string')
          : [],
      },
      conversion: {
        reservation: normalizeConversionStep(conversionConfig.reservation),
        sale: normalizeConversionStep(conversionConfig.sale),
        order: normalizeConversionStep(conversionConfig.order),
      },
      confirmation: {
        enabled: config.confirmation?.enabled ?? true,
        process: typeof config.confirmation?.process === 'string' ? config.confirmation.process : '',
      },
      after_sales: {
        enabled: config.after_sales?.enabled ?? true,
        follow_up: typeof config.after_sales?.follow_up === 'string' ? config.after_sales.follow_up : '',
      },
    };
  }, [normalizeConversionStep]);

  const loadSettings = useCallback(async (): Promise<KnowledgeBaseSettingsSnapshot | null> => {
    if (!organizationId) {
      return null;
    }

    const { data, error } = await supabase
      .from('organizations')
      .select('sales_process_config, custom_lead_statuses, agent_takeover_criteria, agent_takeover_message, ai_handback_message, ai_handback_criteria')
      .eq('id', organizationId)
      .single();

    if (error) {
      throw error;
    }

    const snapshot: KnowledgeBaseSettingsSnapshot = {
      salesProcessConfig: normalizeSalesProcessConfig(data?.sales_process_config),
    };

    if (data?.custom_lead_statuses) {
      snapshot.customLeadStatuses = data.custom_lead_statuses as unknown as CustomLeadStatuses;
    }

    if (data?.agent_takeover_criteria) {
      snapshot.takeoverCriteria = data.agent_takeover_criteria as unknown as AgentTakeoverCriteria;
    }

    if (typeof data?.agent_takeover_message === 'string') {
      snapshot.agentTakeoverMessage = data.agent_takeover_message;
    }

    if (typeof data?.ai_handback_message === 'string') {
      snapshot.aiHandbackMessage = data.ai_handback_message;
    }

    if (data?.ai_handback_criteria) {
      snapshot.handbackCriteria = data.ai_handback_criteria as unknown as AIHandbackCriteria;
    }

    return snapshot;
  }, [normalizeSalesProcessConfig, organizationId]);

  const saveSalesProcess = useCallback(async (salesProcessConfig: SalesProcessConfig) => {
    if (!organizationId) {
      throw new Error('Organization not found.');
    }

    const { data, error } = await supabase
      .from('organizations')
      .update({ sales_process_config: salesProcessConfig })
      .eq('id', organizationId)
      .select('sales_process_config')
      .single();

    if (error) {
      throw error;
    }

    toast({
      title: 'Success',
      description: 'Sales process configuration saved successfully',
    });

    return normalizeSalesProcessConfig(data?.sales_process_config);
  }, [normalizeSalesProcessConfig, organizationId, toast]);

  const saveCustomStatuses = useCallback(async (customLeadStatuses: CustomLeadStatuses) => {
    if (!organizationId) {
      throw new Error('Organization not found.');
    }

    const { error } = await supabase
      .from('organizations')
      .update({ custom_lead_statuses: JSON.parse(JSON.stringify(customLeadStatuses)) })
      .eq('id', organizationId);

    if (error) {
      throw error;
    }

    toast({
      title: 'Success',
      description: 'Lead statuses saved successfully',
    });
  }, [organizationId, toast]);

  const saveTakeoverCriteria = useCallback(async ({
    takeoverCriteria,
    agentTakeoverMessage,
    aiHandbackMessage,
  }: {
    takeoverCriteria: AgentTakeoverCriteria;
    agentTakeoverMessage: string;
    aiHandbackMessage: string;
  }) => {
    if (!organizationId) {
      throw new Error('Organization not found.');
    }

    const { error } = await supabase
      .from('organizations')
      .update({
        agent_takeover_criteria: JSON.parse(JSON.stringify(takeoverCriteria)),
        agent_takeover_message: agentTakeoverMessage,
        ai_handback_message: aiHandbackMessage,
      })
      .eq('id', organizationId);

    if (error) {
      throw error;
    }

    toast({
      title: 'Success',
      description: 'Agent takeover configuration saved successfully',
    });
  }, [organizationId, toast]);

  const saveHandbackCriteria = useCallback(async ({
    handbackCriteria,
    aiHandbackMessage,
  }: {
    handbackCriteria: AIHandbackCriteria;
    aiHandbackMessage: string;
  }) => {
    if (!organizationId) {
      throw new Error('Organization not found.');
    }

    const { error } = await supabase
      .from('organizations')
      .update({
        ai_handback_criteria: JSON.parse(JSON.stringify(handbackCriteria)),
        ai_handback_message: aiHandbackMessage,
      })
      .eq('id', organizationId);

    if (error) {
      throw error;
    }

    toast({
      title: 'Success',
      description: 'AI handback configuration saved successfully',
    });
  }, [organizationId, toast]);

  return {
    loadSettings,
    saveSalesProcess,
    saveCustomStatuses,
    saveTakeoverCriteria,
    saveHandbackCriteria,
    normalizeSalesProcessConfig,
  };
}
