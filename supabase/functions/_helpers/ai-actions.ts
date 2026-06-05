// Deterministic AI action runner
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type AppointmentStatus = 'requested' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready';

type AppointmentAction = {
  title?: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  appointment_status?: AppointmentStatus;
  location?: string | null;
};

type ReservationAction = {
  title?: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  location?: string | null;
};

type OrderItemAction = {
  name: string;
  quantity: number;
  price: number;
  notes?: string | null;
};

type OrderAction = {
  pickup_name?: string;
  pickup_time: string;
  items: OrderItemAction[];
  notes?: string | null;
  status?: OrderStatus;
};

type BookingStatus = 'pending' | 'confirmed' | 'upcoming' | 'checked_in' | 'checked_out' | 'cancelled';

type BookingAction = {
  room_unit_id: string;
  check_in: string;
  check_out: string;
  guest_count: number;
  status?: BookingStatus;
  notes?: string | null;
};

type SupportedActions = {
  set_lead_status?: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost' | 'skipped' | 'booked';
  set_qualification_status?: 'unqualified' | 'qualifying' | 'qualified' | 'assigned';
  assign_agent_id?: string | null;
  create_appointment?: AppointmentAction;
  create_reservation?: ReservationAction;
  create_order?: OrderAction;
  create_booking?: BookingAction;
};

export type PreparedAIResponse = {
  cleanText: string;
  actions: SupportedActions | null;
};

export async function runAIAction(
  supabase: SupabaseClient,
  leadId: string,
  actions: SupportedActions,
  actor = 'ai'
): Promise<{ applied: boolean; details?: string }> {
  try {
    const updates: Record<string, unknown> = {};
    const actionDetails: string[] = [];

    let leadRecord:
      | {
          organization_id: string;
          assigned_agent_id: string | null;
          name: string | null;
        }
      | null = null;

    if (actions.create_appointment || actions.create_reservation || actions.create_order) {
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('organization_id, assigned_agent_id, name')
        .eq('id', leadId)
        .maybeSingle();

      if (leadError || !lead) {
        return {
          applied: false,
          details: `Failed to load lead for appointment action: ${(leadError as any)?.message || 'Lead not found'}`,
        };
      }

      leadRecord = lead;

      if (!actions.set_lead_status) {
        updates.status = 'booked';
      }
    }

    if (actions.create_appointment && leadRecord) {
      const startAt = new Date(actions.create_appointment.start_time);
      const endAt = new Date(actions.create_appointment.end_time);

      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
        return { applied: false, details: 'Appointment action requires valid ISO start_time and end_time' };
      }

      if (startAt >= endAt) {
        return { applied: false, details: 'Appointment end_time must be after start_time' };
      }

      const normalizedStart = startAt.toISOString();
      const normalizedEnd = endAt.toISOString();

      const { data: existingAppointment, error: existingAppointmentError } = await supabase
        .from('calendar_events')
        .select('id')
        .eq('organization_id', lead.organization_id)
        .eq('related_lead_id', leadId)
        .eq('event_type', 'appointment')
        .eq('start_time', normalizedStart)
        .eq('end_time', normalizedEnd)
        .maybeSingle();

      if (existingAppointmentError) {
        return {
          applied: false,
          details: `Failed to verify existing appointment: ${(existingAppointmentError as any).message || existingAppointmentError}`,
        };
      }

      if (!existingAppointment) {
        const appointmentStatus = actions.create_appointment.appointment_status || 'confirmed';
        const title = actions.create_appointment.title?.trim() || `Appointment with ${leadRecord.name?.trim() || 'Lead'}`;
        const description = actions.create_appointment.description?.trim() || null;
        const location = actions.create_appointment.location?.trim() || null;

        const { error: appointmentInsertError } = await supabase.from('calendar_events').insert({
          organization_id: leadRecord.organization_id,
          user_id: leadRecord.assigned_agent_id,
          title,
          description,
          start_time: normalizedStart,
          end_time: normalizedEnd,
          all_day: false,
          location,
          event_type: 'appointment',
          related_lead_id: leadId,
          appointment_status: appointmentStatus,
          appointment_source: 'jay_ai',
          metadata: {
            created_by_ai: true,
            actor,
          },
        } as never);

        if (appointmentInsertError) {
          return {
            applied: false,
            details: `Appointment insert failed: ${(appointmentInsertError as any).message || appointmentInsertError}`,
          };
        }

        actionDetails.push(`Created appointment ${normalizedStart} -> ${normalizedEnd}`);
      } else {
        actionDetails.push(`Appointment already existed for ${normalizedStart} -> ${normalizedEnd}`);
      }
    }

    if (actions.create_reservation && leadRecord) {
      const startAt = new Date(actions.create_reservation.start_time);
      const endAt = new Date(actions.create_reservation.end_time);

      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
        return { applied: false, details: 'Reservation action requires valid ISO start_time and end_time' };
      }

      if (startAt >= endAt) {
        return { applied: false, details: 'Reservation end_time must be after start_time' };
      }

      const normalizedStart = startAt.toISOString();
      const normalizedEnd = endAt.toISOString();

      const { data: existingReservation, error: existingReservationError } = await supabase
        .from('calendar_events')
        .select('id')
        .eq('organization_id', leadRecord.organization_id)
        .eq('related_lead_id', leadId)
        .eq('event_type', 'reservation')
        .eq('start_time', normalizedStart)
        .eq('end_time', normalizedEnd)
        .maybeSingle();

      if (existingReservationError) {
        return {
          applied: false,
          details: `Failed to verify existing reservation: ${(existingReservationError as any).message || existingReservationError}`,
        };
      }

      if (!existingReservation) {
        const title = actions.create_reservation.title?.trim() || `Reservation for ${leadRecord.name?.trim() || 'Guest'}`;
        const description = actions.create_reservation.description?.trim() || null;
        const location = actions.create_reservation.location?.trim() || null;

        const { error: reservationInsertError } = await supabase.from('calendar_events').insert({
          organization_id: leadRecord.organization_id,
          user_id: leadRecord.assigned_agent_id,
          title,
          description,
          start_time: normalizedStart,
          end_time: normalizedEnd,
          all_day: false,
          location,
          event_type: 'reservation',
          related_lead_id: leadId,
          metadata: {
            created_by_ai: true,
            actor,
            ai_action_type: 'reservation',
          },
        } as never);

        if (reservationInsertError) {
          return {
            applied: false,
            details: `Reservation insert failed: ${(reservationInsertError as any).message || reservationInsertError}`,
          };
        }

        actionDetails.push(`Created reservation ${normalizedStart} -> ${normalizedEnd}`);
      } else {
        actionDetails.push(`Reservation already existed for ${normalizedStart} -> ${normalizedEnd}`);
      }
    }

    if (actions.create_order && leadRecord) {
      const pickupAt = new Date(actions.create_order.pickup_time);

      if (Number.isNaN(pickupAt.getTime())) {
        return { applied: false, details: 'Order action requires a valid ISO pickup_time' };
      }

      if (!Array.isArray(actions.create_order.items) || actions.create_order.items.length === 0) {
        return { applied: false, details: 'Order action requires at least one item' };
      }

      const normalizedPickupTime = pickupAt.toISOString();
      const normalizedItems = actions.create_order.items.map((item) => ({
        name: item.name?.trim(),
        quantity: Number(item.quantity),
        price: Number(item.price),
        notes: item.notes?.trim() || null,
      }));

      const invalidItem = normalizedItems.find((item) => !item.name || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.price) || item.price < 0);
      if (invalidItem) {
        return { applied: false, details: 'Order action contains an invalid item payload' };
      }

      const { data: existingOrders, error: existingOrderError } = await supabase
        .from('orders')
        .select('id')
        .eq('organization_id', leadRecord.organization_id)
        .eq('lead_id', leadId)
        .eq('pickup_time', normalizedPickupTime)
        .neq('status', 'cancelled')
        .limit(1);

      if (existingOrderError) {
        return {
          applied: false,
          details: `Failed to verify existing order: ${(existingOrderError as any).message || existingOrderError}`,
        };
      }

      if (!existingOrders || existingOrders.length === 0) {
        const totalAmount = normalizedItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
        const pickupName = actions.create_order.pickup_name?.trim() || leadRecord.name?.trim() || 'Customer';
        const notes = actions.create_order.notes?.trim() || null;
        const status = actions.create_order.status || 'confirmed';

        const { error: orderInsertError } = await supabase.from('orders').insert({
          organization_id: leadRecord.organization_id,
          lead_id: leadId,
          pickup_name: pickupName,
          pickup_time: normalizedPickupTime,
          status,
          notes,
          order_items: normalizedItems,
          total_amount: totalAmount,
        } as never);

        if (orderInsertError) {
          return {
            applied: false,
            details: `Order insert failed: ${(orderInsertError as any).message || orderInsertError}`,
          };
        }

        actionDetails.push(`Created order for pickup ${normalizedPickupTime}`);
      } else {
        actionDetails.push(`Order already existed for pickup ${normalizedPickupTime}`);
      }
    }

    if (actions.create_booking && leadRecord) {
      const roomUnitId = actions.create_booking.room_unit_id?.trim();
      const guestCount = Number(actions.create_booking.guest_count);
      const status = actions.create_booking.status || 'confirmed';
      const notes = actions.create_booking.notes?.trim() || 'Created by Cece AI after the guest confirmed the stay details.';

      if (!roomUnitId) {
        return { applied: false, details: 'Booking action requires room_unit_id' };
      }

      if (!Number.isFinite(guestCount) || guestCount <= 0) {
        return { applied: false, details: 'Booking action requires a valid guest_count' };
      }

      const normalizeDate = (value: string) => {
        const trimmed = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          return trimmed;
        }

        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) {
          return null;
        }

        return parsed.toISOString().split('T')[0];
      };

      const normalizedCheckIn = normalizeDate(actions.create_booking.check_in);
      const normalizedCheckOut = normalizeDate(actions.create_booking.check_out);

      if (!normalizedCheckIn || !normalizedCheckOut) {
        return { applied: false, details: 'Booking action requires valid check_in and check_out dates' };
      }

      if (normalizedCheckOut <= normalizedCheckIn) {
        return { applied: false, details: 'Booking check_out must be after check_in' };
      }

      const { data: roomUnit, error: roomUnitError } = await supabase
        .from('room_units')
        .select('id, property_id')
        .eq('id', roomUnitId)
        .maybeSingle();

      if (roomUnitError || !roomUnit) {
        return {
          applied: false,
          details: `Booking action could not load room unit: ${(roomUnitError as any)?.message || 'Room not found'}`,
        };
      }

      const { data: existingBookings, error: existingBookingError } = await supabase
        .from('bookings')
        .select('id, check_in, check_out, status')
        .eq('organization_id', leadRecord.organization_id)
        .eq('room_unit_id', roomUnitId)
        .limit(50);

      if (existingBookingError) {
        return {
          applied: false,
          details: `Failed to verify existing bookings: ${(existingBookingError as any).message || existingBookingError}`,
        };
      }

      const bookingRows = (existingBookings || []) as Array<{ id: string; check_in: string; check_out: string; status: string }>;
      const exactMatch = bookingRows.find((booking) =>
        booking.check_in === normalizedCheckIn &&
        booking.check_out === normalizedCheckOut &&
        ['pending', 'confirmed', 'upcoming', 'checked_in'].includes(String(booking.status))
      );

      if (exactMatch) {
        actionDetails.push(`Booking already existed for ${normalizedCheckIn} -> ${normalizedCheckOut}`);
      } else {
        const overlappingConflict = bookingRows.find((booking) =>
          ['confirmed', 'upcoming', 'checked_in'].includes(String(booking.status)) &&
          booking.check_in < normalizedCheckOut &&
          booking.check_out > normalizedCheckIn
        );

        if (overlappingConflict) {
          return {
            applied: false,
            details: `Booking conflicts with an existing stay from ${overlappingConflict.check_in} to ${overlappingConflict.check_out}`,
          };
        }

        const { error: bookingInsertError } = await supabase.from('bookings').insert({
          organization_id: leadRecord.organization_id,
          lead_id: leadId,
          room_unit_id: roomUnitId,
          check_in: normalizedCheckIn,
          check_out: normalizedCheckOut,
          guest_count: guestCount,
          status,
          property_id: roomUnit.property_id,
          notes,
        } as never);

        if (bookingInsertError) {
          return {
            applied: false,
            details: `Booking insert failed: ${(bookingInsertError as any).message || bookingInsertError}`,
          };
        }

        actionDetails.push(`Created booking ${normalizedCheckIn} -> ${normalizedCheckOut}`);
      }
    }

    if (actions.set_lead_status) updates.status = actions.set_lead_status;
    if (actions.set_qualification_status) updates.qualification_status = actions.set_qualification_status;
    if (typeof actions.assign_agent_id !== 'undefined') updates.assigned_agent_id = actions.assign_agent_id;

    if (Object.keys(updates).length === 0 && actionDetails.length === 0) {
      return { applied: false, details: 'No supported actions found' };
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('leads')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', leadId);

      if (error) {
        return { applied: false, details: `DB update failed: ${(error as any).message || error}` };
      }
    }

    // Audit entry in notification_history for traceability
    try {
      await supabase.from('notification_history').insert({
        user_id: null,
        organization_id: leadRecord?.organization_id || null,
        type: 'ai_action',
        title: `AI updated lead ${leadId}`,
        message: `AI (${actor}) applied actions: ${JSON.stringify(actions)}${actionDetails.length > 0 ? ` | ${actionDetails.join(' | ')}` : ''}`,
        related_id: leadId,
        channel: 'system'
      });
    } catch (_e) {
      // non-fatal
    }

    return { applied: true };
  } catch (err) {
    return { applied: false, details: (err as Error).message };
  }
}

// Parse a simple ACTION block from AI output. Expect marker like "[ACTION]\n{...json...}" or a trailing JSON block.
export function parseActionsFromText(text: string): SupportedActions | null {
  try {
    const actionMatch = text.match(/\[ACTION\]\s*([\s\S]*?)\s*$/);
    let jsonText = null;
    if (actionMatch?.[1]) {
      jsonText = actionMatch[1].trim();
    } else {
      const lastBrace = text.lastIndexOf('{');
      if (lastBrace !== -1) {
        const candidate = text.slice(lastBrace);
        if (
          candidate.includes('"set_lead_status"') ||
          candidate.includes('"set_qualification_status"') ||
          candidate.includes('"create_appointment"') ||
          candidate.includes('"create_reservation"') ||
          candidate.includes('"create_order"') ||
          candidate.includes('"create_booking"')
        ) {
          jsonText = candidate;
        }
      }
    }

    if (!jsonText) return null;

    // Trim code fences if present
    jsonText = jsonText.replace(/```json|```/g, '').trim();

    const parsed = JSON.parse(jsonText) as SupportedActions;
    return parsed;
  } catch (err) {
    return null;
  }
}

export function stripActionBlockFromText(text: string): string {
  return text.replace(/\s*\[ACTION\]\s*[\s\S]*$/m, '').trim();
}

export function prepareAIResponseForDelivery(text: string): PreparedAIResponse {
  return {
    cleanText: stripActionBlockFromText(text),
    actions: parseActionsFromText(text),
  };
}

export async function applyPreparedAIResponseActions(
  supabase: SupabaseClient,
  leadId: string | null | undefined,
  actions: SupportedActions | null,
  actor = 'ai'
): Promise<{ applied: boolean; details?: string }> {
  if (!leadId || !actions) {
    return { applied: false, details: 'No lead or actions provided' };
  }

  return await runAIAction(supabase, leadId, actions, actor);
}
