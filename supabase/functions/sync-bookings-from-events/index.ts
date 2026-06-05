import { serve } from "std/http/server";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createInternalAuthErrorResponse, isAuthorizedInternalRequest } from "../_shared/internal-auth.ts";
import { differenceInDays, parseISO } from "https://esm.sh/date-fns@3.6.0";

interface PricingTier {
  guests: number;
  price: number;
}

interface StayDiscount {
  min_nights: number;
  discount_percent: number;
}

interface OrgUser {
  id: string;
  email: string | null;
  full_name: string | null;
}

interface UserRole {
  user_id: string;
  role: string;
}

// Calculate booking price based on room pricing tiers and discounts
function calculateBookingPrice(
  checkIn: string,
  checkOut: string,
  guestCount: number,
  pricingTiers: PricingTier[],
  stayDiscounts: StayDiscount[]
): number | null {
  if (!pricingTiers || pricingTiers.length === 0) {
    return null;
  }

  const nights = differenceInDays(parseISO(checkOut), parseISO(checkIn));
  if (nights <= 0) return null;

  // Find applicable tier
  const sortedTiers = [...pricingTiers].sort((a, b) => b.guests - a.guests);
  const applicableTier = sortedTiers.find(tier => guestCount >= tier.guests) || sortedTiers[sortedTiers.length - 1];
  if (!applicableTier) return null;

  let totalPrice = applicableTier.price * nights;

  // Apply discount if applicable
  if (stayDiscounts && stayDiscounts.length > 0) {
    const sortedDiscounts = [...stayDiscounts].sort((a, b) => b.min_nights - a.min_nights);
    const applicableDiscount = sortedDiscounts.find(d => nights >= d.min_nights);
    if (applicableDiscount && applicableDiscount.discount_percent > 0) {
      totalPrice = totalPrice * (1 - applicableDiscount.discount_percent / 100);
    }
  }

  return Math.round(totalPrice * 100) / 100;
}

// Send notifications for pending booking (Cece orgs only)
async function notifyPendingBooking(
  supabase: SupabaseClient<any, "public", any>,
  organizationId: string,
  bookingId: string,
  leadName: string,
  checkIn: string,
  checkOut: string,
  roomName: string
) {
  console.log(`[Booking Sync] Sending pending booking notifications for org ${organizationId}`);
  
  try {
    // Get all agents and client admins for this org
    const { data: orgUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (usersError) {
      console.error('[Booking Sync] Error fetching org users:', usersError);
      return;
    }

    const typedOrgUsers = (orgUsers || []) as OrgUser[];

    // Get user roles to identify agents and admins
    const userIds = typedOrgUsers.map(u => u.id);
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', userIds);

    const typedUserRoles = (userRoles || []) as UserRole[];

    const roleMap = new Map<string, string[]>();
    for (const ur of typedUserRoles) {
      if (!roleMap.has(ur.user_id)) {
        roleMap.set(ur.user_id, []);
      }
      roleMap.get(ur.user_id)!.push(ur.role);
    }

    // Filter to agents and client_admins
    const notifyUsers = typedOrgUsers.filter((user: OrgUser) => {
      const roles = roleMap.get(user.id) || [];
      return roles.includes('agent') || roles.includes('client_admin');
    });

    const title = 'New Pending Booking';
    const message = `${leadName} has a pending booking at ${roomName} from ${checkIn} to ${checkOut}. Please review and confirm.`;

    // Create in-app notifications for each user
    for (const user of notifyUsers) {
      await supabase.from('notification_history').insert({
        user_id: user.id,
        organization_id: organizationId,
        title,
        message,
        type: 'booking',
        channel: 'in_app',
        related_id: bookingId,
        is_read: false
      });
    }

    // Send email notifications
    const emailRecipients = notifyUsers
      .filter((u: OrgUser) => u.email)
      .map((u: OrgUser) => u.email);

    if (emailRecipients.length > 0) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      
      // Call send-email function for each recipient
      for (const email of emailRecipients) {
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              to: email,
              subject: `[Action Required] ${title}`,
              html: `
                <h2>New Pending Booking Requires Confirmation</h2>
                <p><strong>Guest:</strong> ${leadName}</p>
                <p><strong>Room:</strong> ${roomName}</p>
                <p><strong>Check-in:</strong> ${checkIn}</p>
                <p><strong>Check-out:</strong> ${checkOut}</p>
                <p>Please log in to review and confirm this booking.</p>
              `
            }
          });
        } catch (emailError) {
          console.error(`[Booking Sync] Error sending email to ${email}:`, emailError);
        }
      }
    }

    console.log(`[Booking Sync] Sent notifications to ${notifyUsers.length} users`);
  } catch (error) {
    console.error('[Booking Sync] Error sending notifications:', error);
  }
}

// Sync calendar_sync_events to bookings table
serve(async (req) => {
  const corsHeaders = createCorsHeaders(req, 'x-internal-function-secret');
  
  const preflightResponse = handleCorsPreflightRequest(req, 'x-internal-function-secret');
  if (preflightResponse) return preflightResponse;

  console.log('[Booking Sync] Starting sync from calendar_sync_events to bookings...');

  try {
    if (!isAuthorizedInternalRequest(req)) {
      return createInternalAuthErrorResponse(corsHeaders);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const today = new Date().toISOString().split('T')[0];
    
    // Get all calendar_sync_events that don't have corresponding bookings
    const { data: calendarEvents, error: eventsError } = await supabase
      .from('calendar_sync_events')
      .select('*')
      .gte('end_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Last 7 days + future
    
    if (eventsError) {
      console.error('[Booking Sync] Error fetching events:', eventsError);
      throw eventsError;
    }
    
    // Fetch all organizations to check agent type and notification settings
    const { data: organizations, error: orgsError } = await supabase
      .from('organizations')
      .select('id, ai_agent_type, notify_pending_bookings');
    
    if (orgsError) {
      console.error('[Booking Sync] Error fetching organizations:', orgsError);
    }
    
    const orgMap = new Map(
      (organizations || []).map(o => [o.id, { 
        ai_agent_type: o.ai_agent_type,
        notify_pending_bookings: o.notify_pending_bookings ?? true
      }])
    );
    
    // Fetch all room units with pricing info
    const { data: roomUnits, error: roomsError } = await supabase
      .from('room_units')
      .select('id, name, pricing_tiers, stay_discounts');
    
    if (roomsError) {
      console.error('[Booking Sync] Error fetching room units:', roomsError);
    }
    
    const roomPricingMap = new Map(
      (roomUnits || []).map(r => [r.id, { 
        name: r.name,
        pricing_tiers: (r.pricing_tiers || []) as PricingTier[], 
        stay_discounts: (r.stay_discounts || []) as StayDiscount[] 
      }])
    );
    
    console.log(`[Booking Sync] Found ${calendarEvents?.length || 0} calendar events to process`);
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const event of calendarEvents || []) {
      try {
        // Skip cancelled events
        if (event.status === 'cancelled') {
          skipped++;
          continue;
        }
        
        // Parse dates
        const checkIn = event.start_time.split('T')[0];
        const checkOut = event.end_time.split('T')[0];
        
        // Get org info
        const orgInfo = orgMap.get(event.organization_id);
        const isCeceOrg = orgInfo?.ai_agent_type === 'cece';
        
        // Check if a booking already exists for this calendar event
        const { data: existingBookings } = await supabase
          .from('bookings')
          .select('id, status')
          .eq('calendar_event_id', event.google_event_id)
          .eq('room_unit_id', event.room_unit_id)
          .limit(1);
        
        const existingBooking = existingBookings && existingBookings.length > 0 ? existingBookings[0] : null;
        
        // Determine booking status based on dates. External platform bookings are already confirmed.
        let bookingStatus: string;
        if (checkOut <= today) {
          bookingStatus = 'checked_out';
        } else if (checkIn <= today && checkOut > today) {
          bookingStatus = 'checked_in';
        } else {
          bookingStatus = 'upcoming';
        }
        
        // Get room pricing info
        const roomInfo = roomPricingMap.get(event.room_unit_id);
        const guestCount = event.guest_count || 1;
        const totalPrice = roomInfo 
          ? calculateBookingPrice(checkIn, checkOut, guestCount, roomInfo.pricing_tiers, roomInfo.stay_discounts)
          : null;
        
        if (existingBooking) {
          if (existingBooking.status !== 'cancelled') {
            // Determine new status based on dates
            let newStatus = existingBooking.status;
            if (checkOut <= today) {
              newStatus = 'checked_out';
            } else if (checkIn <= today && checkOut > today && existingBooking.status === 'upcoming') {
              newStatus = 'checked_in';
            }
            
            await supabase
              .from('bookings')
              .update({
                status: newStatus,
                check_in: checkIn,
                check_out: checkOut,
                guest_count: guestCount,
                notes: event.raw_description,
                total_price: totalPrice,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingBooking.id);
            updated++;
          } else {
            skipped++;
          }
        } else {
          // Find or create a lead for this booking
          let leadId: string | null = null;
          
          // Try to find existing lead by email or phone
          if (event.guest_email || event.guest_phone) {
            const orConditions: string[] = [];
            if (event.guest_email) orConditions.push(`email.eq.${event.guest_email}`);
            if (event.guest_phone) orConditions.push(`phone.eq.${event.guest_phone}`);
            
            const { data: existingLead } = await supabase
              .from('leads')
              .select('id')
              .eq('organization_id', event.organization_id)
              .or(orConditions.join(','))
              .limit(1)
              .single();
            
            if (existingLead) {
              leadId = existingLead.id;
            }
          }
          
          // If no lead found, try by name
          if (!leadId && event.guest_name) {
            const { data: existingLead } = await supabase
              .from('leads')
              .select('id')
              .eq('organization_id', event.organization_id)
              .ilike('name', event.guest_name)
              .limit(1)
              .single();
            
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
                organization_id: event.organization_id,
                name: leadName,
                email: event.guest_email,
                phone: event.guest_phone,
                source: event.source_platform || 'calendar',
                status: 'booked',
                // For Cece orgs: set is_ai_managed to false so agent handles it
                is_ai_managed: isCeceOrg ? false : true
              })
              .select('id')
              .single();
            
            if (!leadError && newLead) {
              leadId = newLead.id;
            } else {
              console.error('[Booking Sync] Failed to create lead:', leadError);
              skipped++;
              continue;
            }
          } else if (isCeceOrg) {
            // For existing leads in Cece orgs, set is_ai_managed to false
            await supabase
              .from('leads')
              .update({ is_ai_managed: false, updated_at: new Date().toISOString() })
              .eq('id', leadId);
          }
          
          // Create the booking with calculated price
          const { data: newBooking, error: bookingError } = await supabase
            .from('bookings')
            .insert({
              organization_id: event.organization_id,
              room_unit_id: event.room_unit_id,
              lead_id: leadId,
              calendar_event_id: event.google_event_id,
              check_in: checkIn,
              check_out: checkOut,
              guest_count: guestCount,
              status: bookingStatus,
              notes: event.raw_description,
              total_price: totalPrice
            })
            .select('id')
            .single();
          
          if (bookingError) {
            console.error('[Booking Sync] Failed to create booking:', bookingError);
            skipped++;
          } else {
            console.log(`[Booking Sync] Created booking for ${event.guest_name || event.title} (${checkIn} - ${checkOut}) - Status: ${bookingStatus}`);
            created++;
            
          }
        }
      } catch (err) {
        console.error('[Booking Sync] Error processing event:', err);
        skipped++;
      }
    }
    
    // For non-Cece orgs, run booking status updates based on dates
    await supabase.rpc('run_booking_status_updates');
    
    console.log(`[Booking Sync] Complete: ${created} created, ${updated} updated, ${skipped} skipped`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        created,
        updated,
        skipped,
        message: `Synced bookings: ${created} created, ${updated} updated`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Booking Sync] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});