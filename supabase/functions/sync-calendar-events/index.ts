import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// deno-lint-ignore no-explicit-any
type SupabaseClientAny = any;
import { initVault, vaultDecrypt, vaultEncrypt } from "../_shared/vault.ts";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createInternalAuthErrorResponse, isAuthorizedInternalRequest } from "../_shared/internal-auth.ts";

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// Platform detection patterns
const PLATFORM_PATTERNS = {
  airbnb: [/airbnb/i, /abnb/i, /reserved\s*-?\s*airbnb/i],
  booking_com: [/booking\.com/i, /booking/i, /bdc/i],
  vrbo: [/vrbo/i, /homeaway/i, /vacation\s*rental/i],
  expedia: [/expedia/i],
  agoda: [/agoda/i],
  tripadvisor: [/tripadvisor/i, /trip\s*advisor/i],
  direct: [/direct/i, /website/i, /walk-?in/i],
  facebook: [/facebook/i, /fb/i, /messenger/i],
  manual: [/manual/i, /phone/i, /call/i],
};

// Parse guest info from event title and description
function parseGuestInfo(title: string | null, description: string | null): {
  guest_name: string | null;
  guest_phone: string | null;
  guest_email: string | null;
  guest_count: number;
} {
  const result = {
    guest_name: null as string | null,
    guest_phone: null as string | null,
    guest_email: null as string | null,
    guest_count: 1,
  };

  const text = `${title || ''} ${description || ''}`;
  
  // Try to extract guest name from common patterns
  // Airbnb format: "Guest Name - Airbnb" or "Reserved - Guest Name"
  const airbnbMatch = title?.match(/^(.+?)\s*[-–]\s*(?:Airbnb|ABNB)/i) || 
                      title?.match(/^Reserved\s*[-–]\s*(.+)/i);
  if (airbnbMatch) {
    result.guest_name = airbnbMatch[1].trim();
  }
  
  // Booking.com format often in description
  const bookingNameMatch = description?.match(/(?:Guest|Name|Booked by)[:\s]+([^\n,]+)/i);
  if (!result.guest_name && bookingNameMatch) {
    result.guest_name = bookingNameMatch[1].trim();
  }
  
  // If no specific format, use the title if it looks like a name
  if (!result.guest_name && title) {
    // Exclude common non-name titles
    const excludePatterns = /^(blocked|busy|unavailable|reserved|booking|airbnb|vacation|holiday)/i;
    if (!excludePatterns.test(title) && title.length < 50) {
      result.guest_name = title.split(/[-–|]/)[0].trim();
    }
  }

  // Extract phone number (various formats)
  const phonePatterns = [
    /(?:phone|tel|mobile|contact)[:\s]*([+\d\s\-()]{8,20})/i,
    /(\+?[\d]{1,4}[\s\-]?[\d]{2,4}[\s\-]?[\d]{3,4}[\s\-]?[\d]{3,5})/,
  ];
  for (const pattern of phonePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.guest_phone = match[1].replace(/[^\d+]/g, '').trim();
      if (result.guest_phone.length >= 8) break;
      result.guest_phone = null;
    }
  }

  // Extract email
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    result.guest_email = emailMatch[1].toLowerCase();
  }

  // Extract guest count
  const guestCountPatterns = [
    /(\d+)\s*(?:guest|pax|person|people|adult)/i,
    /(?:guest|pax|persons?|people|adults?)[:\s]*(\d+)/i,
    /(?:for|x)\s*(\d+)\s*(?:guest|pax|person|people)?/i,
  ];
  for (const pattern of guestCountPatterns) {
    const match = text.match(pattern);
    if (match) {
      const count = parseInt(match[1], 10);
      if (count > 0 && count <= 50) {
        result.guest_count = count;
        break;
      }
    }
  }

  return result;
}

// Detect source platform from calendar ID, event title, or description
function detectPlatform(calendarId: string, title: string | null, description: string | null): string {
  const searchText = `${calendarId} ${title || ''} ${description || ''}`;
  
  // Check each platform pattern - order matters, check specific platforms first
  for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(searchText)) {
        console.log(`[Calendar Sync] Detected platform: ${platform} from pattern match in "${title}"`);
        return platform;
      }
    }
  }
  
  // If no platform detected and it's from Google Calendar import, mark as calendar import
  if (calendarId.includes('import.calendar.google') || calendarId.includes('ical')) {
    return 'calendar';
  }
  
  return 'unknown';
}

// Extract calendar name from calendar ID or fetch it
function getCalendarName(calendarId: string, platform: string): string {
  // Common platform calendar ID patterns
  if (calendarId.includes('airbnb')) return 'Airbnb Calendar';
  if (calendarId.includes('booking.com') || calendarId.includes('bdc')) return 'Booking.com';
  if (calendarId.includes('vrbo') || calendarId.includes('homeaway')) return 'VRBO';
  if (calendarId.includes('expedia')) return 'Expedia';
  if (calendarId.includes('agoda')) return 'Agoda';
  
  // Default based on detected platform
  const platformNames: Record<string, string> = {
    airbnb: 'Airbnb',
    booking_com: 'Booking.com',
    vrbo: 'VRBO',
    expedia: 'Expedia',
    agoda: 'Agoda',
    tripadvisor: 'TripAdvisor',
    direct: 'Direct Booking',
    facebook: 'Facebook/Messenger',
    manual: 'Manual Entry',
    google: 'Google Calendar',
    unknown: 'External Calendar',
  };
  
  return platformNames[platform] || 'External Calendar';
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req, 'x-internal-function-secret');
  
  const preflightResponse = handleCorsPreflightRequest(req, 'x-internal-function-secret');
  if (preflightResponse) return preflightResponse;

  const startTime = Date.now();
  console.log('[Calendar Sync] Starting calendar sync job...');

  try {
    if (!isAuthorizedInternalRequest(req)) {
      return createInternalAuthErrorResponse(corsHeaders);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clientId = Deno.env.get('OAuth_Client_ID');
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize vault encryption
    const vaultEnabled = await initVault(supabase);
    console.log('[Calendar Sync] Vault encryption:', vaultEnabled ? 'enabled' : 'disabled');

    if (!clientId || !clientSecret) {
      console.error('[Calendar Sync] OAuth credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Google OAuth credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all organizations with Cece (resort) agent type that have rooms with calendar_ids
    const { data: roomsWithCalendars, error: roomsError } = await supabase
      .from('room_units')
      .select(`
        id,
        name,
        calendar_ids,
        calendar_sources,
        organization_id,
        organizations!inner(id, name, ai_agent_type)
      `)
      .eq('is_active', true)
      .not('calendar_ids', 'is', null);

    if (roomsError) {
      console.error('[Calendar Sync] Error fetching rooms:', roomsError);
      throw roomsError;
    }

    console.log(`[Calendar Sync] Found ${roomsWithCalendars?.length || 0} rooms with calendar integrations`);

    if (!roomsWithCalendars || roomsWithCalendars.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No rooms with calendar integrations found', synced: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group rooms by organization
    const orgRooms = new Map<string, typeof roomsWithCalendars>();
    for (const room of roomsWithCalendars) {
      const orgId = room.organization_id;
      if (!orgRooms.has(orgId)) {
        orgRooms.set(orgId, []);
      }
      orgRooms.get(orgId)!.push(room);
    }

    let totalSynced = 0;
    let totalErrors = 0;

    // Process each organization
    for (const [orgId, rooms] of orgRooms) {
      console.log(`[Calendar Sync] Processing org ${orgId} with ${rooms.length} rooms`);

      // Find a user with Google Calendar connected in this organization
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id')
        .eq('organization_id', orgId)
        .eq('is_active', true);

      if (profilesError || !profiles || profiles.length === 0) {
        console.warn(`[Calendar Sync] No active users in org ${orgId}`);
        continue;
      }

      // Try to find a user with valid Google Calendar tokens
      let validAccessToken: string | null = null;
      let tokenUserId: string | null = null;

      for (const profile of profiles) {
        const token = await getValidAccessToken(supabase, profile.id, clientId, clientSecret, vaultEnabled);
        if (token) {
          validAccessToken = token;
          tokenUserId = profile.id;
          break;
        }
      }

      if (!validAccessToken) {
        console.warn(`[Calendar Sync] No valid Google Calendar token found for org ${orgId}`);
        continue;
      }

      console.log(`[Calendar Sync] Using token from user ${tokenUserId} for org ${orgId}`);

      // Sync each room's calendars
      for (const room of rooms) {
        const calendarIds = room.calendar_ids as string[];
        const calendarSources = (room.calendar_sources as Record<string, string>) || {};
        if (!calendarIds || calendarIds.length === 0) continue;

        console.log(`[Calendar Sync] Syncing ${calendarIds.length} calendar(s) for room: ${room.name}`);

        for (const calendarId of calendarIds) {
          try {
            // Get the source platform from the room's calendar_sources mapping
            // This is set by the user when connecting the calendar
            const configuredSource = calendarSources[calendarId];
            
            // Fetch calendar metadata to get its timezone
            const calendarTimezone = await fetchCalendarTimezone(validAccessToken, calendarId);
            const events = await fetchCalendarEvents(validAccessToken, calendarId);
            
            if (events.length > 0) {
              // Process and upsert events with enhanced data
              const eventRows = events.map((event: { id?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; [key: string]: unknown }) => {
                const title = String(event.summary || '');
                const description = String(event.description || '');
                
                // Parse guest information
                const guestInfo = parseGuestInfo(title, description);
                
                // Use the configured source from room settings, or fall back to detection
                const sourcePlatform = configuredSource || detectPlatform(calendarId, title, description);
                
                // Get calendar name based on source
                const calendarName = getCalendarName(calendarId, sourcePlatform);
                
                console.log(`[Calendar Sync] Event "${title}" from calendar mapped to source: ${sourcePlatform}`);
                
                return {
                  organization_id: orgId,
                  room_unit_id: room.id,
                  calendar_id: calendarId,
                  google_event_id: event.id,
                  title: title || 'Blocked',
                  start_time: event.start?.dateTime || event.start?.date || '',
                  end_time: event.end?.dateTime || event.end?.date || '',
                  all_day: !event.start?.dateTime,
                  status: event.status || 'confirmed',
                  synced_at: new Date().toISOString(),
                  calendar_timezone: calendarTimezone,
                  // Enhanced fields
                  guest_name: guestInfo.guest_name,
                  guest_phone: guestInfo.guest_phone,
                  guest_email: guestInfo.guest_email,
                  guest_count: guestInfo.guest_count,
                  source_platform: sourcePlatform,
                  calendar_name: calendarName,
                  raw_description: description,
                };
              });

              const { error: upsertError } = await supabase
                .from('calendar_sync_events')
                .upsert(eventRows, { 
                  onConflict: 'calendar_id,google_event_id',
                  ignoreDuplicates: false 
                });

              if (upsertError) {
                console.error(`[Calendar Sync] Error upserting events for calendar ${calendarId}:`, upsertError);
                totalErrors++;
              } else {
                totalSynced += events.length;
                console.log(`[Calendar Sync] Synced ${events.length} events from ${getCalendarName(calendarId, detectPlatform(calendarId, null, null))} (TZ: ${calendarTimezone})`);
                
                // Sync to bookings table
                await syncEventsToBookings(supabase, orgId, room.id, eventRows);
              }
            }

            // Clean up old events (past events older than 7 days)
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            
            await supabase
              .from('calendar_sync_events')
              .delete()
              .eq('calendar_id', calendarId)
              .lt('end_time', weekAgo.toISOString());

          } catch (calError) {
            console.error(`[Calendar Sync] Error syncing calendar ${calendarId}:`, calError);
            totalErrors++;
          }
        }
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[Calendar Sync] Completed in ${elapsed}ms. Synced: ${totalSynced}, Errors: ${totalErrors}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced: totalSynced,
        errors: totalErrors,
        durationMs: elapsed,
        message: `Synced ${totalSynced} calendar events across all organizations`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Calendar Sync] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to get valid access token (with refresh if needed)
async function getValidAccessToken(
  supabase: SupabaseClientAny, 
  userId: string, 
  clientId: string, 
  clientSecret: string,
  vaultEnabled: boolean
): Promise<string | null> {
  const { data: tokenData, error } = await supabase
    .from('google_calendar_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !tokenData) {
    return null;
  }

  // Decrypt tokens (when vault encryption is enabled)
  let accessToken: string;
  let refreshToken: string;

  try {
    accessToken = vaultEnabled
      ? await vaultDecrypt(supabase, tokenData.access_token)
      : tokenData.access_token;

    refreshToken = vaultEnabled
      ? await vaultDecrypt(supabase, tokenData.refresh_token)
      : tokenData.refresh_token;
  } catch (decryptError) {
    console.error('[Calendar Sync] Token decryption failed for user', userId, decryptError);
    return null;
  }

  // Check if token is expired
  if (new Date(tokenData.token_expiry) <= new Date()) {
    // Refresh the token
    try {
      const refreshResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      const refreshData = await refreshResponse.json();

      if (refreshData.error) {
        console.error('[Calendar Sync] Token refresh error for user', userId, refreshData);
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
    } catch (refreshError) {
      console.error('[Calendar Sync] Token refresh failed for user', userId, refreshError);
      return null;
    }
  }

  return accessToken;
}

// Fetch the timezone of a Google Calendar
async function fetchCalendarTimezone(accessToken: string, calendarId: string): Promise<string> {
  try {
    const calendarUrl = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}`;
    const response = await fetch(calendarUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.warn(`[Calendar Sync] Could not fetch calendar metadata for ${calendarId}: ${response.status}`);
      return 'UTC';
    }

    const data = await response.json();
    return data.timeZone || 'UTC';
  } catch (error) {
    console.error(`[Calendar Sync] Error fetching calendar timezone:`, error);
    return 'UTC';
  }
}

// Fetch events from a Google Calendar
async function fetchCalendarEvents(accessToken: string, calendarId: string): Promise<any[]> {
  // Include past events (7 days ago) to catch currently active bookings
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const threeMonthsLater = new Date();
  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

  const eventsUrl = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?` + 
    `timeMin=${encodeURIComponent(sevenDaysAgo.toISOString())}&` +
    `timeMax=${encodeURIComponent(threeMonthsLater.toISOString())}&` +
    `singleEvents=true&orderBy=startTime&maxResults=250`;

  const response = await fetch(eventsUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Calendar Sync] Failed to fetch events from ${calendarId}: ${response.status} ${errorText}`);
    return [];
  }

  const data = await response.json();
  
  // Filter out cancelled events
  return (data.items || []).filter((event: { status?: string; [key: string]: unknown }) => event.status !== 'cancelled');
}

// Sync calendar events to bookings table
async function syncEventsToBookings(
  supabase: SupabaseClientAny,
  orgId: string,
  roomId: string,
  eventRows: Array<Record<string, unknown>>
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  
  // Check if this is a Cece organization
  const { data: orgData } = await supabase
    .from('organizations')
    .select('ai_agent_type')
    .eq('id', orgId)
    .single();
  
  const isCeceOrg = orgData?.ai_agent_type === 'cece';
  
  for (const event of eventRows) {
    try {
      // Skip cancelled events
      if (event.status === 'cancelled') continue;
      
      // Parse dates - extract just the date portion for all-day events
      const checkIn = String(event.start_time || '').split('T')[0];
      const checkOut = String(event.end_time || '').split('T')[0];
      
      // Check if a booking already exists for this calendar event
      const { data: existingByEventId } = await supabase
        .from('bookings')
        .select('id, status')
        .eq('calendar_event_id', event.google_event_id)
        .eq('room_unit_id', roomId)
        .maybeSingle();
      
      // Determine booking status based on dates. External platform bookings are already confirmed.
      let bookingStatus: string;
      if (checkOut <= today) {
        bookingStatus = 'checked_out';
      } else if (checkIn <= today && checkOut > today) {
        bookingStatus = 'checked_in';
      } else {
        bookingStatus = 'upcoming';
      }
      
      if (existingByEventId) {
        const skipUpdate = existingByEventId.status === 'cancelled';
        
        if (!skipUpdate) {
          const updateData: Record<string, unknown> = {
            check_in: checkIn,
            check_out: checkOut,
            guest_count: event.guest_count || 1,
            notes: event.raw_description,
            updated_at: new Date().toISOString()
          };

          if (checkOut <= today) {
            updateData.status = 'checked_out';
          } else if (checkIn <= today && checkOut > today) {
            updateData.status = 'checked_in';
          } else {
            updateData.status = 'upcoming';
          }
          
          await supabase
            .from('bookings')
            .update(updateData)
            .eq('id', existingByEventId.id);
        }
        continue; // Skip to next event, booking already exists
      }
      
      // Check if a booking exists for same room with exact dates OR overlapping dates
      // This prevents creating duplicate/conflicting bookings from calendar sync
      const { data: existingBookings } = await supabase
        .from('bookings')
        .select('id, calendar_event_id, check_in, check_out, status')
        .eq('room_unit_id', roomId)
        .neq('status', 'cancelled')
        .neq('status', 'checked_out')
        .lt('check_in', checkOut)  // Overlaps if existing start < new end
        .gt('check_out', checkIn); // AND existing end > new start
      
      if (existingBookings && existingBookings.length > 0) {
        // Check for exact date match first - link calendar event if missing
        const exactMatch = existingBookings.find((b: { check_in: string; check_out: string; calendar_event_id: string | null }) => b.check_in === checkIn && b.check_out === checkOut);
        
        if (exactMatch && !exactMatch.calendar_event_id) {
          await supabase
            .from('bookings')
            .update({ 
              calendar_event_id: event.google_event_id,
              booking_source: event.source_platform || 'calendar',
              updated_at: new Date().toISOString()
            })
            .eq('id', exactMatch.id);
          console.log(`[Calendar Sync] Linked existing booking to calendar event: ${event.google_event_id}`);
        } else if (!exactMatch) {
          // There are overlapping bookings but no exact match - log a warning
          console.warn(`[Calendar Sync] Skipping event ${event.google_event_id} (${checkIn} to ${checkOut}) - conflicts with ${existingBookings.length} existing booking(s)`);
        }
        continue; // Skip to next event, booking already exists or conflicts
      }
      
      // Find or create a lead for this booking
      let leadId: string | null = null;
      
      // Try to find existing lead by email or phone
      if (event.guest_email || event.guest_phone) {
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id')
          .eq('organization_id', orgId)
          .or(`email.eq.${event.guest_email || 'NOMATCH'},phone.eq.${event.guest_phone || 'NOMATCH'}`)
          .limit(1)
          .maybeSingle();
        
        if (existingLead) {
          leadId = existingLead.id;
        }
      }
      
      // If no lead found, try by name
      if (!leadId && event.guest_name) {
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id')
          .eq('organization_id', orgId)
          .ilike('name', String(event.guest_name || ''))
          .limit(1)
          .maybeSingle();
        
        if (existingLead) {
          leadId = existingLead.id;
        }
      }
      
          // Create a new lead if none found
      if (!leadId) {
        const leadName = event.guest_name || event.title || 'Calendar Booking';
        const { data: newLead, error: leadError } = await supabase
          .from('leads')
          .insert({
            organization_id: orgId,
            name: leadName,
            email: event.guest_email,
            phone: event.guest_phone,
            source: event.source_platform || 'calendar',
            status: 'booked',
            // For Cece orgs: set is_ai_managed to false so agents handle the lead manually
            is_ai_managed: isCeceOrg ? false : true
          })
          .select('id')
          .single();
        
        if (!leadError && newLead) {
          leadId = newLead.id;
        } else {
          console.error('[Calendar Sync] Failed to create lead for booking:', leadError);
          continue;
        }
      } else if (isCeceOrg) {
        // For existing leads in Cece orgs, ensure is_ai_managed is false
        await supabase
          .from('leads')
          .update({ is_ai_managed: false, updated_at: new Date().toISOString() })
          .eq('id', leadId);
      }
      
      // Create the booking with source platform
      const { error: bookingError } = await supabase
        .from('bookings')
        .insert({
          organization_id: orgId,
          room_unit_id: roomId,
          lead_id: leadId,
          calendar_event_id: event.google_event_id,
          check_in: checkIn,
          check_out: checkOut,
          guest_count: event.guest_count || 1,
          status: bookingStatus,
          notes: event.raw_description,
          booking_source: event.source_platform || 'calendar'
        });
      
      if (bookingError) {
        console.error('[Calendar Sync] Failed to create booking:', bookingError);
      } else {
        console.log(`[Calendar Sync] Created booking for ${event.guest_name || event.title} (${checkIn} - ${checkOut})`);
      }
    } catch (err) {
      console.error('[Calendar Sync] Error syncing event to booking:', err);
    }
  }
}
