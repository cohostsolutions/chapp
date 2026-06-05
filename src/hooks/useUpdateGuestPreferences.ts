import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { GuestPreferencesFormData } from '@/lib/validations';

/**
 * Hook to update guest preferences in the guest_preferences table
 * TODO: Requires guest_preferences table schema:
 * - id (uuid, pk)
 * - guest_id (uuid, fk to guests)
 * - organization_id (uuid, fk to organizations)
 * - previous_stay_notes (text)
 * - preferred_room_types (text[])
 * - preferred_configurations (jsonb)
 * - special_requests (jsonb[])
 * - created_at (timestamp)
 * - updated_at (timestamp)
 */
export function useUpdateGuestPreferences() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: { guestId: string; preferences: GuestPreferencesFormData }) => {
      if (!user || !profile?.organization_id) {
        throw new Error('Must be authenticated');
      }

      throw new Error(
        'Guest preferences are not available yet because the guest_preferences table has not been deployed.'
      );

      /* Actual implementation when table exists:
      const { data: result, error } = await supabase
        .from('guest_preferences')
        .upsert({
          guest_id: data.guestId,
          organization_id: profile.organization_id,
          previous_stay_notes: data.preferences.previousStayNotes,
          preferred_room_types: data.preferences.preferredRoomTypes,
          preferred_configurations: data.preferences.preferredConfigurations,
          special_requests: data.preferences.specialRequests,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'guest_id',
        })
        .select()
        .single();

      if (error) throw error;
      return result;
      */
    },
    onSuccess: () => {
      // Invalidate guest preferences queries
      queryClient.invalidateQueries({ queryKey: ['guest-preferences'] });
      
      toast({
        title: 'Success',
        description: 'Guest preferences saved successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save guest preferences',
        variant: 'destructive',
      });
      throw error;
    },
  });

  return {
    updateGuestPreferences: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}
