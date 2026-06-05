import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGoogleCalendar } from './useGoogleCalendar';

export function useBookingCalendarSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const { checkConnection } = useGoogleCalendar();

  const syncBooking = async (bookingId: string): Promise<{ success: boolean; message: string }> => {
    setIsSyncing(true);
    try {
      // First check if connected to Google Calendar
      const connection = await checkConnection();
      if (!connection.connected) {
        return { 
          success: false, 
          message: 'Please connect to Google Calendar in Settings first' 
        };
      }

      const { data, error } = await supabase.functions.invoke('sync-booking-calendar', {
        body: { action: 'sync_booking', bookingId }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      
      return { 
        success: true, 
        message: data?.message || 'Booking synced to calendar' 
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync booking';
      return { success: false, message: errorMessage };
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteCalendarEvent = async (bookingId: string): Promise<{ success: boolean; message: string }> => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-booking-calendar', {
        body: { action: 'delete_event', bookingId }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      
      return { 
        success: true, 
        message: 'Calendar event removed' 
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove calendar event';
      return { success: false, message: errorMessage };
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    syncBooking,
    deleteCalendarEvent,
    isSyncing,
  };
}
