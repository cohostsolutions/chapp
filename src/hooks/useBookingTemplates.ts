import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { archiveRecoverableRecordDeletion, confirmRecoverableDeletion, DeletionCancelledError, RECOVERY_WINDOW_HOURS } from '@/lib/recoverableDeletion';

export interface BookingTemplate {
  id: string;
  user_id: string;
  organization_id: string;
  name: string;
  room_id: string | null;
  template_data: {
    guestName?: string;
    guestEmail?: string;
    guestPhone?: string;
    guestCount?: number;
    notes?: string;
    bookingSource?: string;
    nightCount?: number;
  };
  created_at: string;
  updated_at: string;
}

// Helper to access the booking_templates table (not in generated types)
const templatesTable = () => (supabase as any).from('booking_templates');

export function useBookingTemplates() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all booking templates
  const {
    data: templates = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['booking-templates', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await templatesTable()
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as BookingTemplate[];
    },
    enabled: !!profile?.organization_id,
  });

  // Save a new template
  const saveTemplateMutation = useMutation({
    mutationFn: async ({ 
      name, 
      roomId, 
      templateData 
    }: { 
      name: string; 
      roomId?: string | null;
      templateData: BookingTemplate['template_data'];
    }) => {
      if (!profile?.id || !profile?.organization_id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await templatesTable()
        .insert({
          user_id: profile.id,
          organization_id: profile.organization_id,
          name,
          room_id: roomId || null,
          template_data: templateData,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BookingTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-templates'] });
      toast({
        title: 'Template Saved',
        description: 'Booking template saved successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to save template: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Update an existing template
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ 
      id, 
      name, 
      roomId, 
      templateData 
    }: { 
      id: string; 
      name?: string; 
      roomId?: string | null;
      templateData?: BookingTemplate['template_data'];
    }) => {
      const updateData: Partial<BookingTemplate> = {};
      if (name !== undefined) updateData.name = name;
      if (roomId !== undefined) updateData.room_id = roomId;
      if (templateData !== undefined) updateData.template_data = templateData;

      const { data, error } = await templatesTable()
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BookingTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-templates'] });
      toast({
        title: 'Template Updated',
        description: 'Booking template updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update template: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Delete a template
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const templateName = templates.find((template) => template.id === id)?.name || 'this booking template';
      if (!confirmRecoverableDeletion(templateName)) throw new DeletionCancelledError();
      await archiveRecoverableRecordDeletion('booking_templates', id, templateName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-templates'] });
      toast({
        title: 'Template Deleted',
        description: `Booking template deleted. It can be restored from Deleted Items for ${RECOVERY_WINDOW_HOURS} hours.`,
      });
    },
    onError: (error: Error) => {
      if (error instanceof DeletionCancelledError) return;
      toast({
        title: 'Error',
        description: `Failed to delete template: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const saveTemplate = useCallback((
    name: string, 
    templateData: BookingTemplate['template_data'],
    roomId?: string | null
  ) => {
    return saveTemplateMutation.mutateAsync({ name, roomId, templateData });
  }, [saveTemplateMutation]);

  const updateTemplate = useCallback((
    id: string, 
    name?: string, 
    templateData?: BookingTemplate['template_data'],
    roomId?: string | null
  ) => {
    return updateTemplateMutation.mutateAsync({ id, name, roomId, templateData });
  }, [updateTemplateMutation]);

  const deleteTemplate = useCallback((id: string) => {
    return deleteTemplateMutation.mutateAsync(id);
  }, [deleteTemplateMutation]);

  return {
    templates,
    isLoading,
    saveTemplate,
    updateTemplate,
    deleteTemplate,
    isSaving: saveTemplateMutation.isPending || updateTemplateMutation.isPending,
    isDeleting: deleteTemplateMutation.isPending,
    refetch,
  };
}
