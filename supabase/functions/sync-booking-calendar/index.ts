import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

// Helper to safely extract Zod validation errors
function getValidationErrors(result: { success: boolean; error?: z.ZodError }): z.ZodIssue[] {
  return result.success ? [] : (result.error?.issues || []);
}
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { initVault, vaultDecrypt, vaultEncrypt } from "../_shared/vault.ts";

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

function getCandidateCalendarIds(room: { calendar_ids?: unknown; calendar_sources?: unknown } | null | undefined): string[] {
  const calendarIds = Array.isArray(room?.calendar_ids)
    ? room.calendar_ids.filter((calendarId): calendarId is string => typeof calendarId === 'string' && calendarId.trim().length > 0)
    : [];
  const calendarSources = room?.calendar_sources && typeof room.calendar_sources === 'object'
    ? room.calendar_sources as Record<string, string>
    : {};

  const preferredSourceOrder = ['google', 'direct', 'manual'];
  const preferred = calendarIds.filter((calendarId) => preferredSourceOrder.includes(String(calendarSources[calendarId] || '').toLowerCase()));
  const remainder = calendarIds.filter((calendarId) => !preferred.includes(calendarId));

  return [...new Set([...preferred, ...remainder, 'primary'])];
}

async function updateExistingCalendarEvent(
  accessToken: string,
  calendarIds: string[],
  eventId: string,
  eventBody: Record<string, unknown>,
): Promise<boolean> {
  for (const calendarId of calendarIds) {
    const updateResponse = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );

    if (updateResponse.ok) {
      return true;
    }

    if (![403, 404].includes(updateResponse.status)) {
      const errorText = await updateResponse.text();
      console.error(`[Sync Booking Calendar] Failed updating event ${eventId} on ${calendarId}:`, errorText);
    }
  }

  return false;
}

async function createCalendarEvent(
  accessToken: string,
  calendarIds: string[],
  eventBody: Record<string, unknown>,
): Promise<{ eventId: string; calendarId: string } | null> {
  for (const calendarId of calendarIds) {
    const createResponse = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    });

    if (createResponse.ok) {
      const createdEvent = await createResponse.json();
      return { eventId: createdEvent.id, calendarId };
    }

    if (createResponse.status !== 403) {
      const errorText = await createResponse.text();
      console.error(`[Sync Booking Calendar] Failed creating event on ${calendarId}:`, errorText);
    }
  }

  return null;
}

async function deleteExistingCalendarEvent(
  accessToken: string,
  calendarIds: string[],
  eventId: string,
): Promise<boolean> {
  for (const calendarId of calendarIds) {
    const deleteResponse = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (deleteResponse.ok || deleteResponse.status === 404) {
      return true;
    }
  }

  return false;
}

// Input validation schema with action whitelisting
const calendarSyncRequestSchema = z.object({
  action: z.enum(['sync_booking', 'delete_event'], { 
    errorMap: () => ({ message: "Action must be 'sync_booking' or 'delete_event'" })
  }),
  bookingId: z.string().uuid({ message: "Invalid booking ID format" }),
});

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clientId = Deno.env.get('OAuth_Client_ID');
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const vaultEnabled = await initVault(supabase);
    console.log('[Sync Booking Calendar] Vault encryption:', vaultEnabled ? 'enabled' : 'disabled');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate request body
    const body = await req.json();
    const validationResult = calendarSyncRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errors = getValidationErrors(validationResult);
      console.error('Validation error:', errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request data', 
          details: errors.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { action, bookingId } = validationResult.data;
    console.log('Sync booking calendar action:', action, 'Booking:', bookingId);

    // Helper function to get valid access token
    async function getValidAccessToken(userId: string): Promise<string | null> {
      const { data: tokenData, error } = await supabase
        .from('google_calendar_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !tokenData) {
        return null;
      }

      let accessToken = tokenData.access_token as string;
      let refreshToken = tokenData.refresh_token as string;

      if (vaultEnabled) {
        try {
          accessToken = await vaultDecrypt(supabase, accessToken);
          refreshToken = await vaultDecrypt(supabase, refreshToken);
        } catch (decryptErr) {
          console.error('[Sync Booking Calendar] Token decryption failed:', decryptErr);
          // Corrupted/mismatched token format → force reconnect
          await supabase.from('google_calendar_tokens').delete().eq('user_id', userId);
          return null;
        }
      }

      // Check if token is expired
      if (new Date(tokenData.token_expiry) <= new Date()) {
        const refreshResponse = await fetch(GOOGLE_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId!,
            client_secret: clientSecret!,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
          }),
        });

        const refreshData = await refreshResponse.json();

        if (refreshData.error) {
          console.error('[Sync Booking Calendar] Token refresh error:', refreshData);
          await supabase.from('google_calendar_tokens').delete().eq('user_id', userId);
          return null;
        }

        const newEncryptedAccessToken = vaultEnabled
          ? await vaultEncrypt(supabase, refreshData.access_token)
          : refreshData.access_token;

        const newExpiry = new Date(Date.now() + refreshData.expires_in * 1000);
        await supabase
          .from('google_calendar_tokens')
          .update({
            access_token: newEncryptedAccessToken,
            token_expiry: newExpiry.toISOString(),
          })
          .eq('user_id', userId);

        return refreshData.access_token;
      }

      return accessToken;
    }

    if (action === 'sync_booking') {
      const accessToken = await getValidAccessToken(user.id);
      
      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: 'Not connected to Google Calendar', success: false }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get booking details
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          room:room_units(name, description, calendar_ids, calendar_sources),
          lead:leads(name, phone, email)
        `)
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        return new Response(
          JSON.stringify({ error: 'Booking not found', success: false }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create calendar event
      const eventBody = {
        summary: `🏨 ${booking.room?.name || 'Room'} - ${booking.lead?.name || 'Guest'}`,
        description: `Hotel Booking\n\nGuest: ${booking.lead?.name || 'Unknown'}\nPhone: ${booking.lead?.phone || 'N/A'}\nEmail: ${booking.lead?.email || 'N/A'}\nGuests: ${booking.guest_count || 1}\nStatus: ${booking.status}\n\nNotes: ${booking.notes || 'None'}`,
        start: { 
          date: booking.check_in,
        },
        end: { 
          date: booking.check_out,
        },
        colorId: '9', // Blue
      };
      const candidateCalendarIds = getCandidateCalendarIds(booking.room);

      // If booking already has a calendar event, update it
      if (booking.calendar_event_id) {
        const updated = await updateExistingCalendarEvent(
          accessToken,
          candidateCalendarIds,
          booking.calendar_event_id,
          eventBody,
        );

        if (updated) {
          return new Response(
            JSON.stringify({ success: true, message: 'Calendar event updated' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Create new event
      const createdEvent = await createCalendarEvent(accessToken, candidateCalendarIds, eventBody);

      if (!createdEvent) {
        return new Response(
          JSON.stringify({ error: 'Failed to create calendar event', success: false }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update booking with calendar event ID
      await supabase
        .from('bookings')
        .update({ calendar_event_id: createdEvent.eventId })
        .eq('id', bookingId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          eventId: createdEvent.eventId,
          message: `Booking synced to Google Calendar (${createdEvent.calendarId})` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete_event') {
      const accessToken = await getValidAccessToken(user.id);
      
      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: 'Not connected to Google Calendar', success: false }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get booking to find calendar event ID
      const { data: booking } = await supabase
        .from('bookings')
        .select('calendar_event_id, room:room_units(calendar_ids, calendar_sources)')
        .eq('id', bookingId)
        .single();

      if (booking?.calendar_event_id) {
        await deleteExistingCalendarEvent(
          accessToken,
          getCandidateCalendarIds(booking.room),
          booking.calendar_event_id,
        );

        // Clear calendar event ID from booking
        await supabase
          .from('bookings')
          .update({ calendar_event_id: null })
          .eq('id', bookingId);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Calendar event removed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-booking-calendar:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
