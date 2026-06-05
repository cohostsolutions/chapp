import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildLanguageInstructions,
  conversationInstructions,
  getDateContext,
  imageInstructions,
  isExemptOrganization,
  type AgentType,
  agentConfigs as baseAgentConfigs,
} from "./ai-utils.ts";
import { checkRoomAvailability, type BookingSlot } from "./availability-service.ts";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ExtendedDatabase = any;
type SupabaseDB = SupabaseClient<any>;
type KnowledgeBaseEntry = any;
type BookingRow = ExtendedDatabase["public"]["Tables"]["bookings"]["Row"];
type CalendarSyncEventRow = ExtendedDatabase["public"]["Tables"]["calendar_sync_events"]["Row"];

type SalesProcessConfig = {
  opening?: { enabled?: boolean; message?: string };
  qualification?: { enabled?: boolean; description?: string; questions?: string[] };
  conversion?: {
    reservation?: { enabled?: boolean; description?: string; required_info?: string[] };
    sale?: { enabled?: boolean; description?: string; required_info?: string[] };
    order?: { enabled?: boolean; description?: string; required_info?: string[] };
    booking?: { enabled?: boolean; description?: string; required_info?: string[] };
  };
  confirmation?: { enabled?: boolean; process?: string };
  after_sales?: { enabled?: boolean; follow_up?: string };
} | null;

const leadStatusInstructions = `
## LEAD STATUS TRACKING - ACTION BLOCKS
When a lead's status should change based on the conversation, include an [ACTION] block at the END of your response:

STATUS DEFINITIONS:
- "new": Initial contact, no meaningful engagement yet
- "contacted": You've engaged in conversation, gathering information
- "qualified": Lead has shown clear interest, provided requirements (dates, preferences, budget, room needs, menu choices, scheduling needs)
- "booked": Lead has confirmed a booking/order/reservation/appointment
- "converted": Transaction completed (payment received, service delivered)
- "lost": Lead explicitly declined or is no longer interested

WHEN TO UPDATE STATUS:
1. After first meaningful exchange -> set_lead_status: "contacted"
2. When lead provides specific requirements -> set_lead_status: "qualified"
3. When a booking/order/appointment is confirmed -> set_lead_status: "booked"
4. When lead explicitly declines -> set_lead_status: "lost"

FORMAT (include at the very end of your response, after your message):
[ACTION]
{"set_lead_status": "qualified"}

IMPORTANT: Only include [ACTION] when status genuinely changes. Don't repeat the same status.
`;

const jayAppointmentActionInstructions = `
## JAY APPOINTMENT BOOKING - ACTION BLOCKS
When a lead explicitly confirms an appointment time and the schedule context shows that slot is available, include a single [ACTION] block at the END of your response to create the appointment.

RULES:
- Only create an appointment after the lead has explicitly agreed to a specific date and time.
- Do not create appointments for tentative discussions, suggestions, or unavailable/conflicting slots.
- Use explicit ISO 8601 timestamps with timezone offsets for start_time and end_time.
- Jay appointments must always be tied to the current lead and should use appointment_status "confirmed" unless the conversation clearly says the booking is only a request.
- Keep the visible message natural for the lead. The [ACTION] block is internal system data and must appear only once at the very end.

FORMAT:
[ACTION]
{
  "set_lead_status": "booked",
  "create_appointment": {
    "title": "Product consultation",
    "description": "Lead requested a consultation about available offerings.",
    "start_time": "2026-04-12T14:00:00+08:00",
    "end_time": "2026-04-12T14:30:00+08:00",
    "appointment_status": "confirmed",
    "location": "Phone call"
  }
}
`;

const mayActionInstructions = `
## MAY RESERVATION AND ORDER BOOKING - ACTION BLOCKS
When a customer explicitly confirms a reservation slot or pickup order and the schedule context shows it is available, include a single [ACTION] block at the END of your response.

RULES:
- Only create a reservation after the customer explicitly agrees to a specific available date and time.
- Only create an order after the customer explicitly confirms the final items, quantities, pricing, and pickup time.
- Use explicit ISO 8601 timestamps with timezone offsets.
- Use one [ACTION] block at the end of the message. Keep the visible reply natural and customer-facing.
- Reservation actions create internal calendar_events blocks. Order actions create orders records and trigger internal prep-task generation automatically.

RESERVATION FORMAT:
[ACTION]
{
  "set_lead_status": "booked",
  "create_reservation": {
    "title": "Dinner reservation for Ana",
    "description": "Table reservation confirmed by customer.",
    "start_time": "2026-04-12T19:00:00+08:00",
    "end_time": "2026-04-12T20:30:00+08:00",
    "location": "Main dining room"
  }
}

ORDER FORMAT:
[ACTION]
{
  "set_lead_status": "booked",
  "create_order": {
    "pickup_name": "Ana Santos",
    "pickup_time": "2026-04-12T18:30:00+08:00",
    "items": [
      { "name": "Chicken Inasal", "quantity": 2, "price": 220 },
      { "name": "Garlic Rice", "quantity": 2, "price": 35 }
    ],
    "notes": "No chili oil",
    "status": "confirmed"
  }
}
`;

const ceceBookingActionInstructions = `
## CECE BOOKING CREATION - ACTION BLOCKS
When a guest explicitly confirms a room, check-in/check-out dates, and guest count, and the room availability context shows the stay is available, include a single [ACTION] block at the END of your response to create the booking.

RULES:
- Only create a booking after the guest explicitly agrees to the room and stay dates.
- Never create a booking for a room marked unavailable or if dates are still ambiguous.
- Use the room ID shown in the room inventory context.
- Use YYYY-MM-DD dates for check_in and check_out.
- Use guest_count that matches the guest's confirmed occupancy.
- Keep the visible message natural for the guest. The [ACTION] block is internal system data and must appear only once at the very end.

FORMAT:
[ACTION]
{
  "set_lead_status": "booked",
  "create_booking": {
    "room_unit_id": "00000000-0000-0000-0000-000000000000",
    "check_in": "2026-04-12",
    "check_out": "2026-04-14",
    "guest_count": 2,
    "status": "confirmed",
    "notes": "Created by Cece AI after guest confirmed the stay details."
  }
}
`;

const detailedAgentConfigs = {
  jay: {
    ...baseAgentConfigs.jay,
    systemPrompt: `You are Jay, an intelligent AI sales assistant for AlCor Nexus. Your role is to:
- Qualify leads by understanding their investment goals, timeline, and budget
- Answer questions about investment products and services
- Guide potential customers through the sales process
- Identify hot leads ready for human agent handoff
- Be professional, friendly, and knowledgeable about financial products

IMPORTANT - SHOWCASING ALL OPTIONS:
- When discussing products or services, ALWAYS present ALL available options from your inventory, not just one.
- List each product/service with its key features so the lead can compare and choose.
- If a lead asks "what do you have?" or similar, give a complete overview of ALL offerings.
- Don't assume what the lead wants - show them everything available and let them decide.

When a lead seems ready to proceed (shows strong buying intent, asks about specific pricing, or requests to speak with someone), indicate they should be connected with a human agent.

Always maintain a professional tone while being warm and approachable. Ask clarifying questions to better understand the customer's needs.

ESCALATION - WHEN YOU CAN'T ANSWER:
If a lead asks something you don't know the answer to, or requests something outside your capabilities:
1. Be honest and apologize that you can't help with that specific request
2. Include the marker "[NEEDS_HUMAN_ASSISTANCE]" at the END of your response (this will trigger a notification to the team)
3. Let the lead know that someone from the team will reach out to help them

${imageInstructions}`,
  },
  may: {
    ...baseAgentConfigs.may,
    systemPrompt: `You are May, a friendly AI assistant for a restaurant. Your role is to:
- Help customers browse the menu and make recommendations
- Take food orders and customize them based on preferences
- Handle reservation requests
- Answer questions about ingredients, allergens, and dietary options
- Provide information about hours, location, and policies

IMPORTANT - SHOWCASING ALL OPTIONS:
- When discussing the menu, ALWAYS present ALL available items in each category, not just one or two.
- List dishes with prices and descriptions so customers can see the full selection.
- If a customer asks "what do you have?" or similar, give a complete menu overview.
- Don't assume what the customer wants - show them ALL options in relevant categories and let them decide.
- When recommending, mention multiple options with different price points or flavors.

Be warm, helpful, and knowledgeable about the menu. Make personalized recommendations based on customer preferences. Always confirm orders clearly before finalizing.

ESCALATION - WHEN YOU CAN'T ANSWER:
If a customer asks something you don't know the answer to, or requests something outside your capabilities:
1. Be honest and apologize that you can't help with that specific request
2. Include the marker "[NEEDS_HUMAN_ASSISTANCE]" at the END of your response (this will trigger a notification to the team)
3. Let the customer know that someone from the team will reach out to help them

${imageInstructions}`,
  },
  cece: {
    ...baseAgentConfigs.cece,
    systemPrompt: `You are Cece, a helpful AI concierge for a resort/accommodation. Your role is to:
- Help guests with room inquiries and bookings
- Provide information about amenities, facilities, and services
- Answer questions about availability and pricing
- Assist with check-in/check-out information
- Recommend activities and local attractions

CRITICAL - DETERMINISTIC AVAILABILITY CHECK:
- Availability is NOT decided by you. The system pre-calculates it.
- When checking availability, look for AVAILABLE or NOT AVAILABLE indicators in the room data.
- Report these results to the guest and do not speculate or override them.

CRITICAL - DATE HANDLING FOR BOOKINGS:
1. RELATIVE DATES ARE VALID. Accept casual date expressions like today, tomorrow, this weekend, or next Friday.
2. SINGLE DATE = ASK FOR CHECK-OUT.
3. DATE RANGES = READ AVAILABILITY FROM ROOM DATA.
4. ALWAYS CONFIRM WITH EXPLICIT DATES before giving a quote or confirmation.
5. NEVER ASSUME OR INVENT DATES.

CHECKOUT DAY = AVAILABLE FOR NEXT GUEST:
- If a guest checks out on January 15, January 15 is available for a new guest to check in.

IMPORTANT - SHOWCASING ALL ROOM OPTIONS:
- When discussing rooms or accommodations, ALWAYS present ALL available room units, not just one.
- List each room with its name, capacity, amenities, and availability status so guests can compare.
- When checking availability for specific dates, check and report availability for ALL rooms, not just one.

Be welcoming, professional, and knowledgeable about the property.

ESCALATION - WHEN YOU CAN'T ANSWER:
If a guest asks something you don't know the answer to, or requests something outside your capabilities:
1. Be honest and apologize that you can't help with that specific request
2. Include the marker "[NEEDS_HUMAN_ASSISTANCE]" at the END of your response (this will trigger a notification to the team)
3. Let the guest know that someone from the team will reach out to help them

${imageInstructions}`,
  },
};

function getBlockedDates(checkIn: Date, checkOut: Date): string[] {
  const blocked: string[] = [];
  const current = new Date(checkIn);
  current.setHours(0, 0, 0, 0);
  const end = new Date(checkOut);
  end.setHours(0, 0, 0, 0);

  while (current < end) {
    blocked.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return blocked;
}

export function getAgentMetadata(agentType: AgentType) {
  const agent = detailedAgentConfigs[agentType] || detailedAgentConfigs.jay;
  return { name: agent.name, title: agent.title };
}

async function getKnowledgeBase(supabase: SupabaseDB, organizationId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('knowledge_base_entries')
      .select('title, content, category')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .limit(15);

    if (error || !data || data.length === 0) return '';

    return data
      .map((entry: KnowledgeBaseEntry) => `## ${entry.title}${entry.category ? ` (${entry.category})` : ''}\n${entry.content}`)
      .join('\n\n');
  } catch (error) {
    console.error('Error fetching knowledge base:', error);
    return '';
  }
}

async function getOfferings(supabase: SupabaseDB, organizationId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('offerings')
      .select('name, description, price, category, image_url, image_urls')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('category')
      .limit(30);

    if (error || !data || data.length === 0) return '';

    const grouped: Record<string, typeof data> = {};
    data.forEach((item) => {
      const category = item.category || 'General';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(item);
    });

    let result = `PRODUCTS & SERVICES OFFERINGS (TOTAL: ${data.length} items):\n`;
    result += 'IMPORTANT: Always present ALL offerings when leads ask what you have.\n';

    for (const [category, items] of Object.entries(grouped)) {
      result += `\n### ${category}\n`;
      items.forEach((item) => {
        result += `- **${item.name}**`;
        const priceValue = item.price === null ? null : Number(item.price);
        if (priceValue !== null && !Number.isNaN(priceValue)) {
          result += ` - PHP ${priceValue.toLocaleString()}`;
        }
        const images = (item as any).image_urls && Array.isArray((item as any).image_urls) && (item as any).image_urls.length > 0
          ? (item as any).image_urls
          : (item.image_url ? [item.image_url] : []);
        images.forEach((imgUrl: string, index: number) => {
          result += ` [IMAGE${images.length > 1 ? ` ${index + 1}` : ''}: ${imgUrl}]`;
        });
        if (item.description) result += `\n  ${item.description}`;
        result += '\n';
      });
    }

    return result;
  } catch (error) {
    console.error('Error fetching offerings:', error);
    return '';
  }
}

async function getCalendarAppointments(supabase: SupabaseDB, organizationId: string): Promise<string> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threeMonthsLater = new Date();
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
    const todayStr = today.toISOString().split('T')[0];

    const { data: managedAppointments } = await supabase
      .from('calendar_events')
      .select('id, title, start_time, end_time, event_type, appointment_status')
      .eq('organization_id', organizationId)
      .in('appointment_status', ['requested', 'confirmed'])
      .gte('end_time', today.toISOString())
      .lte('start_time', threeMonthsLater.toISOString())
      .order('start_time', { ascending: true });

    const { data: syncedBusySlots } = await supabase
      .from('calendar_sync_events')
      .select('id, title, start_time, end_time, status')
      .eq('organization_id', organizationId)
      .gte('end_time', today.toISOString())
      .lte('start_time', threeMonthsLater.toISOString())
      .order('start_time', { ascending: true });

    const managed = managedAppointments || [];
    const external = syncedBusySlots || [];

    if (managed.length === 0 && external.length === 0) {
      return `CALENDAR APPOINTMENTS:\n- No scheduled appointments for the next 3 months.\n- You have full availability to schedule new appointments.`;
    }

    let result = `CALENDAR APPOINTMENTS (TOTAL: ${managed.length + external.length} blocked slots):\n`;
    result += `TODAY'S DATE: ${todayStr}\n\n`;
    result += `CRITICAL AVAILABILITY INSTRUCTIONS:\n- Appointment availability is deterministically calculated by code.\n- Report results and do not override the system's availability calculation.\n\n`;

    const formatWindow = (startTime: string, endTime: string) => {
      const startDate = new Date(startTime);
      const endDate = new Date(endTime);
      const startFormatted = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
      const endFormatted = endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return `${startFormatted} to ${endFormatted}`;
    };

    if (managed.length > 0) {
      result += `### MANAGED APPOINTMENTS ###\n`;
      managed.slice(0, 20).forEach((appointment) => {
        result += `- **${appointment.title || 'Appointment'}** (${appointment.appointment_status || 'confirmed'}): ${formatWindow(appointment.start_time, appointment.end_time)}\n`;
      });
      result += '\n';
    }

    if (external.length > 0) {
      result += `### EXTERNAL BUSY BLOCKS ###\n`;
      external.slice(0, 20).forEach((appointment) => {
        result += `- **${appointment.title || 'Busy'}**: ${formatWindow(appointment.start_time, appointment.end_time)}\n`;
      });
      result += '\n';
    }

    result += `### ALL BLOCKED TIME SLOTS ###\n`;
    [...managed, ...external].slice(0, 30).forEach((appointment) => {
      result += `- **${appointment.title || 'Appointment'}**: ${formatWindow(appointment.start_time, appointment.end_time)}\n`;
    });

    return result;
  } catch (error) {
    console.error('Error fetching calendar appointments:', error);
    return '';
  }
}

async function getMenuItems(supabase: SupabaseDB, organizationId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('offerings')
      .select('name, description, price, category, image_url, image_urls')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('category')
      .limit(50);

    if (error || !data || data.length === 0) return '';

    const grouped: Record<string, typeof data> = {};
    data.forEach((item) => {
      const category = item.category || 'Menu';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(item);
    });

    let result = `MENU ITEMS (TOTAL: ${data.length} items):\n`;
    result += 'IMPORTANT: Always present ALL menu items when customers ask what you have.\n';

    for (const [category, items] of Object.entries(grouped)) {
      result += `\n### ${category}\n`;
      items.forEach((item) => {
        result += `- **${item.name}**`;
        const priceValue = item.price === null ? null : Number(item.price);
        if (priceValue !== null && !Number.isNaN(priceValue)) {
          result += ` - PHP ${priceValue.toLocaleString()}`;
        }
        const images = (item as any).image_urls && Array.isArray((item as any).image_urls) && (item as any).image_urls.length > 0
          ? (item as any).image_urls
          : (item.image_url ? [item.image_url] : []);
        images.forEach((imgUrl: string, index: number) => {
          result += ` [IMAGE${images.length > 1 ? ` ${index + 1}` : ''}: ${imgUrl}]`;
        });
        if (item.description) result += `\n  ${item.description}`;
        result += '\n';
      });
    }

    return result;
  } catch (error) {
    console.error('Error fetching menu items:', error);
    return '';
  }
}

async function getTableReservations(supabase: SupabaseDB, organizationId: string): Promise<string> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneMonthLater = new Date();
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
    const todayStr = today.toISOString().split('T')[0];

    const { data: externalReservations } = await supabase
      .from('calendar_sync_events')
      .select('id, title, start_time, end_time, status')
      .eq('organization_id', organizationId)
      .gte('end_time', today.toISOString())
      .lte('start_time', oneMonthLater.toISOString())
      .order('start_time', { ascending: true });

    const { data: internalReservations } = await supabase
      .from('calendar_events')
      .select('id, title, start_time, end_time')
      .eq('organization_id', organizationId)
      .eq('event_type', 'reservation')
      .gte('end_time', today.toISOString())
      .lte('start_time', oneMonthLater.toISOString())
      .order('start_time', { ascending: true });

    const reservations = [
      ...(externalReservations || []).map((reservation) => ({ ...reservation, source: 'external' })),
      ...(internalReservations || []).map((reservation) => ({ ...reservation, source: 'internal' })),
    ].sort((left, right) => new Date(left.start_time).getTime() - new Date(right.start_time).getTime());

    const { data: upcomingOrders } = await supabase
      .from('orders')
      .select('id, pickup_name, pickup_time, status')
      .eq('organization_id', organizationId)
      .not('pickup_time', 'is', null)
      .not('status', 'in', '(picked_up,cancelled)')
      .gte('pickup_time', today.toISOString())
      .lte('pickup_time', oneMonthLater.toISOString())
      .order('pickup_time', { ascending: true });

    if (reservations.length === 0 && (!upcomingOrders || upcomingOrders.length === 0)) {
      return `TABLE RESERVATIONS AND PICKUP SCHEDULE:\n- No reservations or pickups for the next 30 days.\n- Full availability for new reservations and pickup scheduling.`;
    }

    let result = `TABLE RESERVATIONS AND PICKUP SCHEDULE:\n`;
    result += `TODAY'S DATE: ${todayStr}\n\n`;
    result += `CRITICAL AVAILABILITY INSTRUCTIONS:\n- Table availability is deterministically calculated by code.\n- Report results and do not override the system's calculation.\n\n`;

    reservations.slice(0, 20).forEach((reservation) => {
      const startDate = new Date(reservation.start_time);
      const endDate = new Date(reservation.end_time);
      result += `- **${reservation.title || 'Reservation'}**${reservation.source === 'internal' ? ' [internal]' : ''}: ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} to ${endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}\n`;
    });

    if (upcomingOrders && upcomingOrders.length > 0) {
      result += `\n### CUSTOMER PICKUPS ###\n`;
      upcomingOrders.slice(0, 20).forEach((order) => {
        const pickupDate = new Date(order.pickup_time);
        result += `- **${order.pickup_name || 'Pickup'}** (${order.status}): ${pickupDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${pickupDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}\n`;
      });
    }

    return result;
  } catch (error) {
    console.error('Error fetching table reservations:', error);
    return '';
  }
}

async function getRoomUnits(supabase: SupabaseDB, organizationId: string): Promise<string> {
  try {
    const { data: rooms, error } = await supabase
      .from('room_units')
      .select('id, name, description, capacity, amenities, image_url, calendar_ids')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .limit(30);

    if (error || !rooms || rooms.length === 0) return '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threeMonthsLater = new Date();
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
    const todayStr = today.toISOString().split('T')[0];

    const { data: bookings } = await supabase
      .from('bookings')
      .select('room_unit_id, check_in, check_out, status, lead:leads(name)')
      .eq('organization_id', organizationId)
      .in('status', ['confirmed', 'upcoming', 'checked_in'])
      .gt('check_out', todayStr)
      .lte('check_in', threeMonthsLater.toISOString().split('T')[0])
      .order('check_in', { ascending: true });

    const { data: calendarEvents } = await supabase
      .from('calendar_sync_events')
      .select('room_unit_id, title, start_time, end_time, status')
      .eq('organization_id', organizationId)
      .gt('end_time', today.toISOString())
      .lte('start_time', threeMonthsLater.toISOString())
      .order('start_time', { ascending: true });

    const bookingsByRoom = new Map<string, BookingRow[]>();
    const eventsByRoom = new Map<string, CalendarSyncEventRow[]>();

    (bookings || []).forEach((booking) => {
      if (!bookingsByRoom.has(booking.room_unit_id)) bookingsByRoom.set(booking.room_unit_id, []);
      bookingsByRoom.get(booking.room_unit_id)?.push(booking);
    });

    (calendarEvents || []).forEach((event) => {
      if (!eventsByRoom.has(event.room_unit_id)) eventsByRoom.set(event.room_unit_id, []);
      eventsByRoom.get(event.room_unit_id)?.push(event);
    });

    const roomsWithBookings = rooms.map((room) => {
      const roomBookings = bookingsByRoom.get(room.id) || [];
      const roomEvents = eventsByRoom.get(room.id) || [];
      const allBookings: BookingSlot[] = [
        ...roomBookings.map((booking) => ({
          startDate: booking.check_in,
          endDate: booking.check_out,
          title: (booking.lead as unknown as { name?: string })?.name || 'Guest',
          status: booking.status,
        })),
        ...roomEvents.map((event) => ({
          startDate: new Date(event.start_time).toISOString().split('T')[0],
          endDate: new Date(event.end_time).toISOString().split('T')[0],
          title: event.title || 'External Booking',
          status: 'confirmed',
        })),
      ];

      return { id: room.id, name: room.name, bookings: allBookings };
    });

    let result = `ROOM UNITS & ACCOMMODATIONS (TOTAL: ${rooms.length} rooms):\n`;
    result += `TODAY'S DATE: ${todayStr}\n`;
    result += 'IMPORTANT: Always present ALL rooms below when guests ask about availability or options.\n\n';

    const todayAvailability = checkRoomAvailability(
      {
        startDate: todayStr,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      roomsWithBookings,
      'Asia/Manila'
    );

    result += `### TODAY'S AVAILABILITY SUMMARY (${todayStr}) ###\n`;
    todayAvailability.forEach((availability) => {
      result += `- ${availability.roomName}: ${availability.available ? 'AVAILABLE TODAY' : 'OCCUPIED TODAY'}\n`;
    });
    result += '\n';

    type BookingWithLead = BookingRow & { lead?: { name?: string } | null };

    rooms.forEach((room) => {
      const roomBookings = bookingsByRoom.get(room.id) || [];
      const roomEvents = eventsByRoom.get(room.id) || [];
      const blockedDates = new Set<string>();

      (roomBookings as BookingWithLead[]).forEach((booking) => {
        getBlockedDates(new Date(booking.check_in), new Date(booking.check_out)).forEach((date) => blockedDates.add(date));
      });
      (roomEvents as CalendarSyncEventRow[]).forEach((event) => {
        getBlockedDates(new Date(event.start_time), new Date(event.end_time)).forEach((date) => blockedDates.add(date));
      });

      const blockedDatesArray = Array.from(blockedDates).sort();
      result += `### ${room.name} (ID: ${room.id})\n`;
      if (room.capacity) result += `- Capacity: ${room.capacity} guests\n`;
      if (room.image_url) result += `- [IMAGE: ${room.image_url}]\n`;
      if (room.description) result += `- ${room.description}\n`;
      if (room.amenities && Array.isArray(room.amenities) && room.amenities.length > 0) {
        result += `- Amenities: ${room.amenities.join(', ')}\n`;
      }
      if (blockedDatesArray.length > 0) {
        result += `- BLOCKED DATES: ${blockedDatesArray.slice(0, 20).join(', ')}${blockedDatesArray.length > 20 ? '...' : ''}\n`;
      } else {
        result += `- AVAILABLE: No blocked dates in the next 3 months\n`;
      }

      (roomBookings as BookingWithLead[]).slice(0, 10).forEach((booking) => {
        const guestName = booking.lead?.name || 'Guest';
        result += `  * ${booking.check_in} to ${booking.check_out} - ${booking.status} (${guestName})\n`;
      });
      result += '\n';
    });

    return result;
  } catch (error) {
    console.error('Error fetching room units:', error);
    return '';
  }
}

async function getLeadContext(supabase: SupabaseDB, leadId: string): Promise<string> {
  try {
    const { data: lead, error } = await supabase
      .from('leads')
      .select('name, email, phone, status, lead_temperature, notes, source')
      .eq('id', leadId)
      .maybeSingle();

    if (error || !lead) return '';

    return `
Current Lead Information:
- Name: ${lead.name}
- Email: ${lead.email || 'Not provided'}
- Phone: ${lead.phone || 'Not provided'}
- Status: ${lead.status}
- Temperature: ${lead.lead_temperature || 'Not set'}
- Source: ${lead.source || 'Unknown'}
- Notes: ${lead.notes || 'None'}
`;
  } catch (error) {
    console.error('Error fetching lead context:', error);
    return '';
  }
}

export async function buildAgentSystemPrompt(
  supabase: SupabaseDB,
  options: {
    organizationId: string;
    aiAgentType: AgentType;
    orgName: string;
    allowedLanguages: string[];
    languageLockEnabled: boolean;
    salesProcessConfig?: SalesProcessConfig;
    leadId?: string;
    additionalContext?: string;
  }
): Promise<string> {
  const {
    organizationId,
    aiAgentType,
    orgName,
    allowedLanguages,
    languageLockEnabled,
    salesProcessConfig = null,
    leadId,
    additionalContext,
  } = options;

  const agent = detailedAgentConfigs[aiAgentType] || detailedAgentConfigs.jay;
  const isExempt = isExemptOrganization(orgName);
  const languageInstructions = buildLanguageInstructions(allowedLanguages || ['en'], languageLockEnabled ?? true, isExempt);
  const dateContext = getDateContext('Asia/Manila');

  let systemPrompt = `${agent.systemPrompt}\n${languageInstructions}\n${conversationInstructions}\n${leadStatusInstructions}\n${dateContext}`;

  if (salesProcessConfig) {
    let salesInstructions = `\n\n---\nCRITICAL: SALES & BOOKING PROCESS GUIDELINES\nYou MUST follow these guidelines as your customer journey framework.\n\n`;

    if (salesProcessConfig.opening?.enabled && salesProcessConfig.opening?.message) {
      salesInstructions += `STAGE 1 - OPENING:\n${salesProcessConfig.opening.message}\n\n`;
    }

    if (salesProcessConfig.qualification?.enabled) {
      salesInstructions += `STAGE 2 - QUALIFICATION:\n`;
      if (salesProcessConfig.qualification.description) {
        salesInstructions += `When to consider a lead qualified: ${salesProcessConfig.qualification.description}\n`;
      }
      if (salesProcessConfig.qualification.questions && salesProcessConfig.qualification.questions.length > 0) {
        salesInstructions += `Key questions to naturally work into the conversation:\n${salesProcessConfig.qualification.questions.map((question) => `  - ${question}`).join('\n')}\n`;
      }
      salesInstructions += '\n';
    }

    if (salesProcessConfig.conversion) {
      const enabledCriteria = [];
      if (salesProcessConfig.conversion.reservation?.enabled && salesProcessConfig.conversion.reservation.description) {
        enabledCriteria.push({ type: 'Reservation', ...salesProcessConfig.conversion.reservation });
      }
      if (salesProcessConfig.conversion.sale?.enabled && salesProcessConfig.conversion.sale.description) {
        enabledCriteria.push({ type: 'Sale', ...salesProcessConfig.conversion.sale });
      }
      if (salesProcessConfig.conversion.order?.enabled && salesProcessConfig.conversion.order.description) {
        enabledCriteria.push({ type: 'Order', ...salesProcessConfig.conversion.order });
      }
      if (salesProcessConfig.conversion.booking?.enabled && salesProcessConfig.conversion.booking.description) {
        enabledCriteria.push({ type: 'Booking', ...salesProcessConfig.conversion.booking });
      }

      if (enabledCriteria.length > 0) {
        salesInstructions += 'STAGE 3 - CONVERSION:\n';
        enabledCriteria.forEach((criterion) => {
          salesInstructions += `  - ${criterion.type}: ${criterion.description}\n`;
          if (criterion.required_info && criterion.required_info.length > 0) {
            salesInstructions += `    Required information: ${criterion.required_info.join(', ')}\n`;
          }
        });
        salesInstructions += '\n';
      }
    }

    if (salesProcessConfig.confirmation?.enabled && salesProcessConfig.confirmation.process) {
      salesInstructions += `STAGE 4 - CONFIRMATION:\n${salesProcessConfig.confirmation.process}\n\n`;
    }

    if (salesProcessConfig.after_sales?.enabled && salesProcessConfig.after_sales.follow_up) {
      salesInstructions += `STAGE 5 - AFTER-SALES FOLLOW-UP:\n${salesProcessConfig.after_sales.follow_up}\n\n`;
    }

    salesInstructions += 'Adapt these guidelines naturally. Do not recite them verbatim.';
    systemPrompt += salesInstructions;
  }

  const knowledgeBase = await getKnowledgeBase(supabase, organizationId);
  if (knowledgeBase) {
    systemPrompt += `\n\n---\nKNOWLEDGE BASE - Use this information to answer questions:\n${knowledgeBase}`;
  }

  systemPrompt += `\n\n---\nDEFAULT BEHAVIOR - SHOWCASE ALL OPTIONS:\n1. Always present all relevant options unless the knowledge base explicitly says otherwise.\n2. Include key details like name, price, features, and availability so the customer can compare.\n3. Only narrow to a recommendation after showing the range of choices.`;

  if (aiAgentType === 'jay') {
    const offerings = await getOfferings(supabase, organizationId);
    if (offerings) {
      systemPrompt += `\n\n---\n${offerings}\n\nUse this offerings information to discuss products/services with leads.`;
    }
    const appointments = await getCalendarAppointments(supabase, organizationId);
    if (appointments) {
      systemPrompt += `\n\n---\n${appointments}\n\nUse this schedule to manage appointment bookings.`;
    }
    systemPrompt += `\n\n---\n${jayAppointmentActionInstructions}`;
  } else if (aiAgentType === 'may') {
    const menuItems = await getMenuItems(supabase, organizationId);
    if (menuItems) {
      systemPrompt += `\n\n---\n${menuItems}\n\nUse this menu to help customers order food.`;
    }
    const reservations = await getTableReservations(supabase, organizationId);
    if (reservations) {
      systemPrompt += `\n\n---\n${reservations}\n\nUse this schedule to manage table reservations.`;
    }
    systemPrompt += `\n\n---\n${mayActionInstructions}`;
  } else {
    const roomUnits = await getRoomUnits(supabase, organizationId);
    if (roomUnits) {
      systemPrompt += `\n\n---\n${roomUnits}\n\nUse this room information to help guests with bookings.`;
    }
    systemPrompt += `\n\n---\n${ceceBookingActionInstructions}`;
  }

  if (leadId) {
    const leadContext = await getLeadContext(supabase, leadId);
    if (leadContext) {
      systemPrompt += `\n\n---\n${leadContext}`;
    }
  }

  if (additionalContext?.trim()) {
    systemPrompt += `\n\n---\n${additionalContext.trim()}`;
  }

  return systemPrompt;
}