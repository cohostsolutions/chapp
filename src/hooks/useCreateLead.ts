import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrganizationPhone } from '@/hooks/useOrganizationPhone';
import { getPhoneValidationMessage, isValidPhoneNumber, normalizePhoneNumber } from '@/lib/phone';

export interface CreateLeadInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  source?: string;
  notes?: string | null;
  status?: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  lead_temperature?: 'cold' | 'warm' | 'hot';
}

export interface CreateLeadResult {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  notes: string | null;
  status: string;
  lead_temperature: string | null;
  created_at: string;
}

export function useCreateLead() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { defaultCountryCode } = useOrganizationPhone();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createLead = useCallback(
    async (leadData: CreateLeadInput): Promise<CreateLeadResult | null> => {
      if (!profile?.organization_id) {
        const errorMsg = 'Organization not found';
        setError(errorMsg);
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive',
        });
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const normalizedPhone = leadData.phone?.trim()
          ? normalizePhoneNumber(leadData.phone, defaultCountryCode)
          : null;

        if (normalizedPhone && !isValidPhoneNumber(normalizedPhone, defaultCountryCode)) {
          throw new Error(getPhoneValidationMessage(defaultCountryCode));
        }

        const { data, error: supabaseError } = await supabase
          .from('leads')
          .insert({
            organization_id: profile.organization_id,
            name: leadData.name.trim(),
            phone: normalizedPhone,
            email: leadData.email?.trim() || null,
            source: leadData.source || 'manual',
            notes: leadData.notes || null,
            status: leadData.status || 'new',
            lead_temperature: leadData.lead_temperature || 'cold',
          })
          .select()
          .single();

        if (supabaseError) throw supabaseError;
        if (!data) throw new Error('Failed to create lead');

        return data as CreateLeadResult;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to create lead';
        setError(errorMsg);
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive',
        });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [defaultCountryCode, profile?.organization_id, toast]
  );

  return {
    createLead,
    isLoading,
    error,
  };
}
