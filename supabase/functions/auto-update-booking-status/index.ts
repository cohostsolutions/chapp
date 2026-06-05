import { serve } from "std/http/server";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createInternalAuthErrorResponse, isAuthorizedInternalRequest } from "../_shared/internal-auth.ts";

// Multilingual keywords for check-in detection
const CHECK_IN_KEYWORDS: Record<string, string[]> = {
  en: ['checked in', 'check in', 'arrived', 'here now', 'just arrived', 'i\'m here', 'we arrived', 'we\'re here', 'at the property', 'at the hotel', 'keys received', 'got the keys'],
  es: ['llegué', 'llegamos', 'ya llegué', 'ya llegamos', 'estoy aquí', 'estamos aquí', 'llegada', 'entrada', 'check in', 'me registré', 'nos registramos', 'recibí las llaves'],
  fr: ['arrivé', 'arrivée', 'je suis arrivé', 'nous sommes arrivés', 'entrée', 'enregistrement', 'clés reçues'],
  de: ['angekommen', 'eingecheckt', 'ich bin da', 'wir sind da', 'schlüssel erhalten', 'check in'],
  it: ['arrivato', 'arrivata', 'sono arrivato', 'siamo arrivati', 'check in', 'chiavi ricevute'],
  pt: ['cheguei', 'chegamos', 'estou aqui', 'estamos aqui', 'check in', 'recebi as chaves'],
};

// Multilingual keywords for check-out detection  
const CHECK_OUT_KEYWORDS: Record<string, string[]> = {
  en: ['checked out', 'check out', 'leaving', 'left', 'departed', 'checking out', 'keys returned', 'returned keys', 'goodbye', 'leaving now'],
  es: ['salí', 'salimos', 'me voy', 'nos vamos', 'salida', 'check out', 'devolví las llaves', 'adiós', 'hasta luego'],
  fr: ['parti', 'partie', 'départ', 'je pars', 'nous partons', 'clés rendues', 'check out', 'au revoir'],
  de: ['ausgecheckt', 'abreise', 'ich gehe', 'wir gehen', 'schlüssel zurückgegeben', 'check out', 'auf wiedersehen'],
  it: ['partito', 'partita', 'parto', 'partiamo', 'check out', 'chiavi restituite', 'arrivederci'],
  pt: ['saí', 'saímos', 'estou saindo', 'estamos saindo', 'check out', 'devolvi as chaves', 'adeus', 'tchau'],
};

// Get keywords for specific languages
function getKeywordsForLanguages(keywordMap: Record<string, string[]>, languages: string[]): string[] {
  const keywords: string[] = [];
  for (const lang of languages) {
    const langCode = lang.toLowerCase().substring(0, 2);
    if (keywordMap[langCode]) {
      keywords.push(...keywordMap[langCode]);
    }
  }
  // Always include English as fallback
  if (!languages.some(l => l.toLowerCase().startsWith('en'))) {
    keywords.push(...keywordMap['en']);
  }
  return [...new Set(keywords)]; // Remove duplicates
}

// Check if text contains any keywords (case-insensitive)
function containsKeyword(text: string, keywords: string[]): boolean {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req, 'x-internal-function-secret');

  const preflightResponse = handleCorsPreflightRequest(req, 'x-internal-function-secret');
  if (preflightResponse) return preflightResponse;

  try {
    if (!isAuthorizedInternalRequest(req)) {
      return createInternalAuthErrorResponse(corsHeaders);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    console.log(`Running auto-update for date: ${today}`);

    // Get optional organization_id filter from request body
    let organizationId: string | null = null;
    try {
      const body = await req.json();
      organizationId = body?.organizationId || null;
    } catch {
      // No body or invalid JSON - that's fine, we'll update all orgs
    }

    // Fetch all organizations to check agent type
    const { data: organizations, error: orgsError } = await supabase
      .from('organizations')
      .select('id, ai_agent_type, allowed_languages')
      .eq('is_archived', false);

    if (orgsError) {
      console.error('Error fetching organizations:', orgsError);
    }

    // Create set of Cece org IDs - these need manual pending→upcoming
    const ceceOrgIds = new Set(
      (organizations || [])
        .filter(o => o.ai_agent_type === 'cece')
        .map(o => o.id)
    );

    // ========== DATE-BASED AUTO CHECK-IN ==========
    // ONLY for UPCOMING (confirmed) bookings (not pending)
    // For Cece orgs: Only process upcoming→checked_in (pending must be manually confirmed first)
    let checkInQuery = supabase
      .from('bookings')
      .update({ status: 'checked_in', updated_at: new Date().toISOString() })
      .eq('status', 'upcoming')
      .lte('check_in', today)
      .gte('check_out', today);

    if (organizationId) {
      checkInQuery = checkInQuery.eq('organization_id', organizationId);
    }

    const { data: toCheckIn, error: checkInError } = await checkInQuery.select('id');

    if (checkInError) {
      console.error('Error auto-checking in (date-based):', checkInError);
    } else {
      console.log(`Date-based auto-checked in ${toCheckIn?.length || 0} bookings`);
    }

    // ========== DATE-BASED AUTO CHECK-OUT ==========
    // Guest should be checked_out if: check_out < today (checkout date has PASSED)
    let checkOutQuery = supabase
      .from('bookings')
      .update({ status: 'checked_out', updated_at: new Date().toISOString() })
      .eq('status', 'checked_in')
      .lt('check_out', today);

    if (organizationId) {
      checkOutQuery = checkOutQuery.eq('organization_id', organizationId);
    }

    const { data: toCheckOut, error: checkOutError } = await checkOutQuery.select('id');

    if (checkOutError) {
      console.error('Error auto-checking out (date-based):', checkOutError);
    } else {
      console.log(`Date-based auto-checked out ${toCheckOut?.length || 0} bookings`);
    }

    // Also check-out stale upcoming bookings (only for non-Cece orgs)
    // For Cece orgs, we don't auto-process pending or stale upcoming bookings
    let staleUpcomingQuery = supabase
      .from('bookings')
      .update({ status: 'checked_out', updated_at: new Date().toISOString() })
      .eq('status', 'upcoming')
      .lt('check_out', today);

    // Exclude Cece orgs from stale upcoming processing
    if (ceceOrgIds.size > 0) {
      const nonCeceOrgs = (organizations || [])
        .filter(o => o.ai_agent_type !== 'cece')
        .map(o => o.id);
      
      if (nonCeceOrgs.length > 0) {
        staleUpcomingQuery = staleUpcomingQuery.in('organization_id', nonCeceOrgs);
      }
    }

    if (organizationId) {
      // If specific org requested and it's Cece, skip this
      if (ceceOrgIds.has(organizationId)) {
        console.log('Skipping stale upcoming check-out for Cece org - requires manual confirmation');
      } else {
        staleUpcomingQuery = staleUpcomingQuery.eq('organization_id', organizationId);
      }
    }

    const { data: staleCheckOut, error: staleError } = await staleUpcomingQuery.select('id');

    if (staleError) {
      console.error('Error checking out stale upcoming bookings:', staleError);
    } else {
      console.log(`Auto-checked out ${staleCheckOut?.length || 0} stale upcoming bookings`);
    }

    // ========== KEYWORD-BASED DETECTION ==========
    let keywordCheckIns = 0;
    let keywordCheckOuts = 0;

    // Process each organization
    for (const org of organizations || []) {
      // Skip if filtering to a specific org that's not this one
      if (organizationId && org.id !== organizationId) continue;

      const languages = org.allowed_languages || ['en'];
      const checkInKeywords = getKeywordsForLanguages(CHECK_IN_KEYWORDS, languages);
      const checkOutKeywords = getKeywordsForLanguages(CHECK_OUT_KEYWORDS, languages);
      const isCeceOrg = org.ai_agent_type === 'cece';

      // Get upcoming bookings for this org that might have keyword-based check-ins
      // Note: For Cece orgs, this still only processes UPCOMING bookings
      // Pending bookings must be manually confirmed first
      const { data: upcomingBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, lead_id, room_unit_id, check_in, check_out')
        .eq('organization_id', org.id)
        .eq('status', 'upcoming')
        .lte('check_in', today)
        .gte('check_out', today);

      if (bookingsError) {
        console.error(`Error fetching bookings for org ${org.id}:`, bookingsError);
        continue;
      }

      // Check communications for check-in keywords
      for (const booking of upcomingBookings || []) {
        // Look for recent inbound communications from the lead
        const { data: messages } = await supabase
          .from('communications')
          .select('content')
          .eq('lead_id', booking.lead_id)
          .eq('direction', 'inbound')
          .gte('created_at', yesterday)
          .order('created_at', { ascending: false })
          .limit(10);

        const hasCheckInKeyword = messages?.some(m => containsKeyword(m.content || '', checkInKeywords));

        if (hasCheckInKeyword) {
          const { error: updateError } = await supabase
            .from('bookings')
            .update({ status: 'checked_in', updated_at: new Date().toISOString() })
            .eq('id', booking.id);

          if (!updateError) {
            console.log(`Keyword-based check-in for booking ${booking.id}`);
            keywordCheckIns++;
          }
        }
      }

      // Get checked_in bookings for this org that might have keyword-based check-outs
      const { data: checkedInBookings, error: checkedInError } = await supabase
        .from('bookings')
        .select('id, lead_id, check_out')
        .eq('organization_id', org.id)
        .eq('status', 'checked_in')
        .lte('check_out', today);

      if (checkedInError) {
        console.error(`Error fetching checked-in bookings for org ${org.id}:`, checkedInError);
        continue;
      }

      // Check communications for check-out keywords
      for (const booking of checkedInBookings || []) {
        const { data: messages } = await supabase
          .from('communications')
          .select('content')
          .eq('lead_id', booking.lead_id)
          .eq('direction', 'inbound')
          .gte('created_at', yesterday)
          .order('created_at', { ascending: false })
          .limit(10);

        const hasCheckOutKeyword = messages?.some(m => containsKeyword(m.content || '', checkOutKeywords));

        if (hasCheckOutKeyword) {
          const { error: updateError } = await supabase
            .from('bookings')
            .update({ status: 'checked_out', updated_at: new Date().toISOString() })
            .eq('id', booking.id);

          if (!updateError) {
            console.log(`Keyword-based check-out for booking ${booking.id}`);
            keywordCheckOuts++;
          }
        }
      }

      // Also check calendar_sync_events for keywords (only for non-Cece orgs)
      // Cece orgs need manual confirmation
      if (!isCeceOrg) {
        const { data: syncEvents } = await supabase
          .from('calendar_sync_events')
          .select('id, room_unit_id, title, raw_description, start_time, end_time')
          .eq('organization_id', org.id)
          .gte('start_time', yesterday)
          .lte('start_time', today);

        for (const event of syncEvents || []) {
          const eventText = `${event.title || ''} ${event.raw_description || ''}`;
          
          // Check for check-in keywords in calendar events
          if (containsKeyword(eventText, checkInKeywords)) {
            // Find matching booking by room and date
            const { data: matchingBooking } = await supabase
              .from('bookings')
              .select('id')
              .eq('room_unit_id', event.room_unit_id)
              .eq('status', 'upcoming')
              .lte('check_in', event.start_time.split('T')[0])
              .gte('check_out', event.start_time.split('T')[0])
              .single();

            if (matchingBooking) {
              const { error: updateError } = await supabase
                .from('bookings')
                .update({ status: 'checked_in', updated_at: new Date().toISOString() })
                .eq('id', matchingBooking.id);

              if (!updateError) {
                console.log(`Calendar keyword-based check-in for booking ${matchingBooking.id}`);
                keywordCheckIns++;
              }
            }
          }
        }
      }
    }

    const totalCheckedIn = (toCheckIn?.length || 0) + keywordCheckIns;
    const totalCheckedOut = (toCheckOut?.length || 0) + (staleCheckOut?.length || 0) + keywordCheckOuts;

    console.log(`Summary - Check-ins: ${totalCheckedIn} (${toCheckIn?.length || 0} date-based, ${keywordCheckIns} keyword-based)`);
    console.log(`Summary - Check-outs: ${totalCheckedOut} (${(toCheckOut?.length || 0) + (staleCheckOut?.length || 0)} date-based, ${keywordCheckOuts} keyword-based)`);

    // ========== AUTO-REVERT EXPIRED PENDING BOOKINGS/ORDERS ==========
    // For Cece orgs: Revert pending bookings that are 1+ days past check-in date
    // For May orgs: Revert pending orders that are 1+ days past pickup time
    // Also: Revert 'new' bookings that are 1+ days old
    let revertedBookings = 0;
    let revertedOrders = 0;
    let revertedNewBookings = 0;

    try {
      // Auto-revert expired pending bookings (Cece)
      const { data: bookingRevertResult, error: bookingRevertError } = await supabase
        .rpc('auto_revert_expired_pending_bookings');

      if (bookingRevertError) {
        console.error('Error auto-reverting expired pending bookings:', bookingRevertError);
      } else if (bookingRevertResult && bookingRevertResult.length > 0) {
        revertedBookings = bookingRevertResult[0].reverted_count || 0;
        console.log(`Auto-reverted ${revertedBookings} expired pending bookings (Cece)`);
      }

      // Auto-revert expired pending orders (May)
      const { data: orderRevertResult, error: orderRevertError } = await supabase
        .rpc('auto_revert_expired_pending_orders');

      if (orderRevertError) {
        console.error('Error auto-reverting expired pending orders:', orderRevertError);
      } else if (orderRevertResult && orderRevertResult.length > 0) {
        revertedOrders = orderRevertResult[0].reverted_count || 0;
        console.log(`Auto-reverted ${revertedOrders} expired pending orders (May)`);
      }

      // Auto-revert expired 'new' bookings (1+ day grace period)
      const { data: newBookingRevertResult, error: newBookingRevertError } = await supabase
        .rpc('auto_revert_expired_new_bookings');

      if (newBookingRevertError) {
        console.error('Error auto-reverting expired new bookings:', newBookingRevertError);
      } else if (newBookingRevertResult && newBookingRevertResult.length > 0) {
        revertedNewBookings = newBookingRevertResult[0].reverted_count || 0;
        console.log(`Auto-reverted ${revertedNewBookings} expired new bookings (1+ day old)`);
      }
    } catch (revertError) {
      console.error('Exception during auto-revert process:', revertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked_in: totalCheckedIn,
        checked_in_date_based: toCheckIn?.length || 0,
        checked_in_keyword_based: keywordCheckIns,
        checked_out: totalCheckedOut,
        checked_out_date_based: (toCheckOut?.length || 0) + (staleCheckOut?.length || 0),
        checked_out_keyword_based: keywordCheckOuts,
        reverted_bookings: revertedBookings,
        reverted_orders: revertedOrders,
        reverted_new_bookings: revertedNewBookings,
        date: today
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Auto-update error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});