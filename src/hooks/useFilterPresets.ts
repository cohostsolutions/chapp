import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { AccommodationFilters } from '@/hooks/useAccommodationData';
import { archiveRecoverableRecordDeletion, confirmRecoverableDeletion, DeletionCancelledError, RECOVERY_WINDOW_HOURS } from '@/lib/recoverableDeletion';

export interface FilterPreset {
  id: string;
  user_id: string;
  organization_id: string;
  name: string;
  filters: AccommodationFilters;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// Helper to access the filter_presets table (not in generated types)
const presetsTable = () => (supabase as any).from('filter_presets');

export function useFilterPresets() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all filter presets for the current user
  const {
    data: presets = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['filter-presets', profile?.id, profile?.organization_id],
    queryFn: async () => {
      if (!profile?.id || !profile?.organization_id) return [];

      const { data, error } = await presetsTable()
        .select('*')
        .eq('user_id', profile.id)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as FilterPreset[];
    },
    enabled: !!profile?.id && !!profile?.organization_id,
  });

  // Find default preset
  const defaultPreset = presets.find(p => p.is_default);

  // Save a new preset
  const savePresetMutation = useMutation({
    mutationFn: async ({ name, filters, isDefault = false }: { 
      name: string; 
      filters: AccommodationFilters; 
      isDefault?: boolean;
    }) => {
      if (!profile?.id || !profile?.organization_id) {
        throw new Error('User not authenticated');
      }

      // If setting as default, first unset any existing default
      if (isDefault) {
        await presetsTable()
          .update({ is_default: false })
          .eq('user_id', profile.id)
          .eq('organization_id', profile.organization_id);
      }

      const { data, error } = await presetsTable()
        .insert({
          user_id: profile.id,
          organization_id: profile.organization_id,
          name,
          filters,
          is_default: isDefault,
        })
        .select()
        .single();

      if (error) throw error;
      return data as FilterPreset;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filter-presets'] });
      toast({
        title: 'Preset Saved',
        description: 'Filter preset saved successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to save preset: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Update an existing preset
  const updatePresetMutation = useMutation({
    mutationFn: async ({ id, name, filters, isDefault }: { 
      id: string; 
      name?: string; 
      filters?: AccommodationFilters;
      isDefault?: boolean;
    }) => {
      if (!profile?.id || !profile?.organization_id) {
        throw new Error('User not authenticated');
      }

      // If setting as default, first unset any existing default
      if (isDefault) {
        await presetsTable()
          .update({ is_default: false })
          .eq('user_id', profile.id)
          .eq('organization_id', profile.organization_id);
      }

      const updateData: Partial<FilterPreset> = {};
      if (name !== undefined) updateData.name = name;
      if (filters !== undefined) updateData.filters = filters;
      if (isDefault !== undefined) updateData.is_default = isDefault;

      const { data, error } = await presetsTable()
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as FilterPreset;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filter-presets'] });
      toast({
        title: 'Preset Updated',
        description: 'Filter preset updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update preset: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Delete a preset
  const deletePresetMutation = useMutation({
    mutationFn: async (id: string) => {
      const presetName = presets.find((preset) => preset.id === id)?.name || 'this filter preset';
      if (!confirmRecoverableDeletion(presetName)) throw new DeletionCancelledError();
      await archiveRecoverableRecordDeletion('filter_presets', id, presetName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filter-presets'] });
      toast({
        title: 'Preset Deleted',
        description: `Filter preset deleted. It can be restored from Deleted Items for ${RECOVERY_WINDOW_HOURS} hours.`,
      });
    },
    onError: (error: Error) => {
      if (error instanceof DeletionCancelledError) return;
      toast({
        title: 'Error',
        description: `Failed to delete preset: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const savePreset = useCallback((name: string, filters: AccommodationFilters, isDefault = false) => {
    return savePresetMutation.mutateAsync({ name, filters, isDefault });
  }, [savePresetMutation]);

  const updatePreset = useCallback((id: string, name?: string, filters?: AccommodationFilters, isDefault?: boolean) => {
    return updatePresetMutation.mutateAsync({ id, name, filters, isDefault });
  }, [updatePresetMutation]);

  const deletePreset = useCallback((id: string) => {
    return deletePresetMutation.mutateAsync(id);
  }, [deletePresetMutation]);

  return {
    presets,
    defaultPreset,
    isLoading,
    savePreset,
    updatePreset,
    deletePreset,
    isSaving: savePresetMutation.isPending || updatePresetMutation.isPending,
    isDeleting: deletePresetMutation.isPending,
    refetch,
  };
}
