import { useState, useCallback } from 'react';
import { devWarn } from '@/lib/logger';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getSupabaseFunctionAuthHeaders } from '@/lib/supabaseFunctionHeaders';

const GOOGLE_CALLBACK_PATH = '/google-callback';
const GOOGLE_OAUTH_STATE_KEY = 'google_oauth_state';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  allDay?: boolean;
  attendees?: string[];
  calendarId?: string;
  calendarName?: string;
  calendarTimeZone?: string;
  isPrimary?: boolean;
  recurrenceRule?: string; // e.g., "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"
  recurringEventId?: string; // ID of the recurring series this event belongs to
  isRecurringEvent?: boolean; // True if this is part of a recurring series
}

export interface GoogleCalendar {
  id: string;
  name: string;
  description?: string;
  primary: boolean;
  accessRole: string;
  backgroundColor?: string;
  foregroundColor?: string;
  selected?: boolean;
  timeZone?: string;
}

interface CalendarConnection {
  connected: boolean;
  message?: string;
  setup_required?: boolean;
}

interface AvailabilityCheck {
  available: boolean;
  roomName?: string;
  conflictingEvents?: Array<{
    calendarId: string;
    eventId: string;
    title: string;
    start: string;
    end: string;
  }>;
  calendarsChecked?: number;
  message?: string;
}

export function useGoogleCalendar() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getRedirectUri = (path = GOOGLE_CALLBACK_PATH) => {
    return `${window.location.origin}${path}`;
  };

  const invokeGoogleCalendar = useCallback(async (body: Record<string, unknown>) => {
    const headers = await getSupabaseFunctionAuthHeaders();
    return supabase.functions.invoke('google-calendar', {
      body,
      headers,
    });
  }, []);

  const getFunctionErrorMessage = useCallback(async (err: unknown, fallback: string) => {
    if (err instanceof FunctionsHttpError) {
      try {
        const payload = await err.context.json();
        if (payload?.error && typeof payload.error === 'string') {
          return payload.error;
        }
        if (payload?.message && typeof payload.message === 'string') {
          return payload.message;
        }
      } catch {
        try {
          const text = await err.context.text();
          if (text) return text;
        } catch {
          // ignore and fall back below
        }
      }
    }

    return err instanceof Error ? err.message : fallback;
  }, []);

  const initiateOAuth = async (): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const state = crypto.randomUUID();
      localStorage.setItem(GOOGLE_OAUTH_STATE_KEY, state);

      const { data, error: fnError } = await invokeGoogleCalendar({
          action: 'get_auth_url',
          redirectUri: getRedirectUri(),
          state,
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      return data?.authUrl || null;
    } catch (err) {
      const errorMessage = await getFunctionErrorMessage(err, 'Failed to get auth URL');
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const exchangeCode = useCallback(async (code: string, redirectPath = GOOGLE_CALLBACK_PATH): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await invokeGoogleCalendar({
          action: 'exchange_code',
          code,
          redirectUri: getRedirectUri(redirectPath)
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      return data?.success || false;
    } catch (err) {
      const errorMessage = await getFunctionErrorMessage(err, 'Failed to exchange code');
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [invokeGoogleCalendar, getFunctionErrorMessage]);

  const checkConnection = useCallback(async (): Promise<CalendarConnection> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { connected: false, message: 'Not authenticated' };
      }

      const { data, error: fnError } = await invokeGoogleCalendar({ action: 'check_connection' });

      if (fnError) throw fnError;
      return data as CalendarConnection;
    } catch (err) {
      const errorMessage = await getFunctionErrorMessage(err, 'Failed to check connection');
      setError(errorMessage);
      return { connected: false, message: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reportIssue = useCallback(async (issue: {
    issueType: string;
    stage: string;
    message: string;
    severity?: 'info' | 'warning' | 'error';
    context?: Record<string, unknown>;
  }): Promise<void> => {
    try {
      const { error: fnError } = await invokeGoogleCalendar({
        action: 'report_issue',
        issueType: issue.issueType,
        stage: issue.stage,
        message: issue.message,
        severity: issue.severity ?? 'error',
        context: issue.context ?? {},
      });

      if (fnError) {
        devWarn('Failed to report Google OAuth issue', fnError);
      }
    } catch (reportError) {
      devWarn('Failed to report Google OAuth issue', reportError);
    }
  }, [invokeGoogleCalendar]);

  const disconnect = async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await invokeGoogleCalendar({ action: 'disconnect' });

      if (fnError) throw fnError;
      return data?.success || false;
    } catch (err) {
      const errorMessage = await getFunctionErrorMessage(err, 'Failed to disconnect');
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const listCalendars = async (): Promise<GoogleCalendar[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await invokeGoogleCalendar({ action: 'list_calendars' });

      if (fnError) throw fnError;
      return data?.calendars || [];
    } catch (err) {
      const errorMessage = await getFunctionErrorMessage(err, 'Failed to list calendars');
      setError(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const listEvents = async (calendarIds?: string[]): Promise<CalendarEvent[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await invokeGoogleCalendar({ action: 'list_events', calendarIds });

      if (fnError) throw fnError;
      return data?.events || [];
    } catch (err) {
      const errorMessage = await getFunctionErrorMessage(err, 'Failed to list events');
      setError(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const createEvent = async (event: Omit<CalendarEvent, 'id'>): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await invokeGoogleCalendar({
          action: 'create_event',
          title: event.title,
          description: event.description,
          startTime: event.startTime,
          endTime: event.endTime,
          attendees: event.attendees
      });

      if (fnError) throw fnError;
      return data?.success || false;
    } catch (err) {
      const errorMessage = await getFunctionErrorMessage(err, 'Failed to create event');
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const checkAvailability = async (
    calendarIds: string[], 
    startDate: string, 
    endDate: string, 
    roomName?: string
  ): Promise<AvailabilityCheck> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await invokeGoogleCalendar({
          action: 'check_availability',
          calendarIds,
          startDate,
          endDate,
          roomName
      });

      if (fnError) throw fnError;
      return data as AvailabilityCheck;
    } catch (err) {
      const errorMessage = await getFunctionErrorMessage(err, 'Failed to check availability');
      setError(errorMessage);
      return { available: false, message: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const updateEvent = async (
    calendarId: string,
    eventId: string,
    eventData: {
      title: string;
      description?: string;
      startDate: string;
      endDate: string;
      startTime?: string;
      endTime?: string;
      attendees?: string[];
      allDay?: boolean;
    }
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await invokeGoogleCalendar({
          action: 'update_event',
          calendarId,
          eventId,
          ...eventData
      });

      if (fnError) throw fnError;
      return data?.success || false;
    } catch (err) {
      const errorMessage = await getFunctionErrorMessage(err, 'Failed to update event');
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteEvent = async (calendarId: string, eventId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await invokeGoogleCalendar({
          action: 'delete_event',
          calendarId,
          eventId
      });

      if (fnError) throw fnError;
      return data?.success || false;
    } catch (err) {
      const errorMessage = await getFunctionErrorMessage(err, 'Failed to delete event');
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return { 
    initiateOAuth,
    exchangeCode,
    checkConnection, 
    disconnect,
    listCalendars,
    listEvents, 
    createEvent,
    updateEvent,
    deleteEvent,
    checkAvailability,
    reportIssue,
    getRedirectUri,
    isLoading, 
    error 
  };
}
