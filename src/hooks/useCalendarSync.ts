import { useState, useCallback, useEffect, useMemo } from 'react';
import { devError, devLog } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  CALENDAR_SYNC_INTERVAL_MS,
  CalendarSyncHealth,
  getCalendarSyncHealth,
} from '@/lib/calendarSyncHealth';

interface CalendarSyncResult {
  synced: number;
  errors: number;
  message: string;
}

// Cache to track when we last synced (per session)
const syncCache = {
  lastSyncTime: 0,
  minIntervalMs: CALENDAR_SYNC_INTERVAL_MS,
};

export function useCalendarSync() {
  const { profile } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [integratedRoomCount, setIntegratedRoomCount] = useState(0);

  const refreshSyncStatus = useCallback(async () => {
    if (!profile?.organization_id) {
      setIntegratedRoomCount(0);
      setLastSyncTime(null);
      return;
    }

    const { data: rooms, error: roomsError } = await supabase
      .from('room_units')
      .select('id, calendar_ids')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .not('calendar_ids', 'is', null);

    if (roomsError) {
      devError('[CalendarSync] Failed to load room integrations:', roomsError);
      return;
    }

    const integratedRoomIds = (rooms ?? [])
      .filter((room) => Array.isArray(room.calendar_ids) && room.calendar_ids.length > 0)
      .map((room) => room.id);

    setIntegratedRoomCount(integratedRoomIds.length);

    if (integratedRoomIds.length === 0) {
      setLastSyncTime(null);
      syncCache.lastSyncTime = 0;
      return;
    }

    const { data: latestSyncRow, error: latestSyncError } = await supabase
      .from('calendar_sync_events')
      .select('synced_at')
      .eq('organization_id', profile.organization_id)
      .in('room_unit_id', integratedRoomIds)
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestSyncError) {
      devError('[CalendarSync] Failed to load latest sync time:', latestSyncError);
      return;
    }

    const nextLastSyncTime = latestSyncRow?.synced_at ? new Date(latestSyncRow.synced_at) : null;
    setLastSyncTime(nextLastSyncTime);
    syncCache.lastSyncTime = nextLastSyncTime?.getTime() ?? 0;
  }, [profile?.organization_id]);

  // Check if rooms have calendar IDs configured
  const checkHasCalendarIntegration = useCallback(async (): Promise<boolean> => {
    if (!profile?.organization_id) return false;

    const { data } = await supabase
      .from('room_units')
      .select('id, calendar_ids')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .not('calendar_ids', 'is', null);

    return (data?.length ?? 0) > 0;
  }, [profile?.organization_id]);


  // Trigger a calendar sync
  // Note: sync-calendar-events already handles syncing to bookings table internally via syncEventsToBookings()
  // No need to call sync-bookings-from-events separately - that would cause duplicate processing
  const syncCalendars = useCallback(async (showToast = true): Promise<CalendarSyncResult | null> => {
    if (isSyncing) return null;
    
    setIsSyncing(true);
    try {
      // Sync from Google Calendar to calendar_sync_events AND to bookings table
      // The edge function handles both steps internally
      const { data, error } = await supabase.functions.invoke('sync-calendar-events');

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const result: CalendarSyncResult = {
        synced: data?.synced || 0,
        errors: data?.errors || 0,
        message: data?.message || 'Calendar sync completed',
      };

      await refreshSyncStatus();

      if (showToast) {
        toast.success('Calendar and bookings synced');
      }

      return result;
    } catch (error) {
      devError('[CalendarSync] Error:', error);
      if (showToast) {
        toast.error('Failed to sync calendars');
      }
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshSyncStatus]);

  // Auto-sync on mount if enough time has passed
  const autoSync = useCallback(async () => {
    const now = Date.now();
    const timeSinceLastSync = now - syncCache.lastSyncTime;
    
    // Only auto-sync if enough time has passed
    if (timeSinceLastSync < syncCache.minIntervalMs) {
      devLog('[CalendarSync] Skipping auto-sync, last sync was', Math.round(timeSinceLastSync / 1000), 'seconds ago');
      return;
    }

    // Check if there are calendar integrations
    const hasIntegration = await checkHasCalendarIntegration();
    if (!hasIntegration) {
      devLog('[CalendarSync] No calendar integrations configured');
      return;
    }

    devLog('[CalendarSync] Auto-syncing calendars...');
    await syncCalendars(false); // Silent sync on page load
  }, [checkHasCalendarIntegration, syncCalendars]);

  // Effect to auto-sync on mount and keep sync fresh while the app is open.
  useEffect(() => {
    if (!profile?.organization_id) return;

    void refreshSyncStatus().then(() => autoSync());

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void refreshSyncStatus().then(() => autoSync());
    }, syncCache.minIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [profile?.organization_id, autoSync, refreshSyncStatus]);

  const syncHealth: CalendarSyncHealth = useMemo(
    () => getCalendarSyncHealth(lastSyncTime, integratedRoomCount),
    [lastSyncTime, integratedRoomCount],
  );

  return {
    syncCalendars,
    isSyncing,
    lastSyncTime,
    syncHealth,
    refreshSyncStatus,
    checkHasCalendarIntegration,
  };
}
