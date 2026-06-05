import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCreateLead, CreateLeadInput } from './useCreateLead';
import { useQueryClient } from '@tanstack/react-query';

export interface BookingData {
  guestName: string;
  checkIn: string;
  checkOut: string;
  roomId: string;
  guestCount: number;
  specialRequests?: string | null;
  leadSource?: string;
}

export function useCreateBooking() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { createLead } = useCreateLead();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createBooking = useCallback(
    async (bookingData: BookingData): Promise<{ id: string } | null> => {
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
        // Step 1: Create the lead
        const leadInput: CreateLeadInput = {
          name: bookingData.guestName,
          source: bookingData.leadSource || 'booking',
          status: 'contacted',
          lead_temperature: 'warm',
        };

        const lead = await createLead(leadInput);
        if (!lead) {
          throw new Error('Failed to create guest lead');
        }

        // Step 2: Create the booking
        const { data, error: bookingError } = await supabase
          .from('bookings')
          .insert({
            organization_id: profile.organization_id,
            lead_id: lead.id,
            room_unit_id: bookingData.roomId,
            check_in: bookingData.checkIn,
            check_out: bookingData.checkOut,
            guest_count: bookingData.guestCount,
            notes: bookingData.specialRequests || null,
            status: 'pending',
          })
          .select()
          .single();

        if (bookingError) throw bookingError;
        if (!data) throw new Error('Failed to create booking');

        // Invalidate related queries
        await queryClient.invalidateQueries({ queryKey: ['accommodation_bookings'] });
        await queryClient.invalidateQueries({ queryKey: ['accommodation_data'] });

        toast({
          title: 'Success',
          description: `Booking created for ${bookingData.guestName}`,
        });

        return { id: data.id };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to create booking';
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
    [profile?.organization_id, createLead, toast, queryClient]
  );

  return {
    createBooking,
    isLoading,
    error,
  };
}
