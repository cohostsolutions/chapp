/**
 * Unit tests for _helpers/ai-actions.ts
 *
 * Run with: deno test supabase/functions/_tests/ai-actions.test.ts
 */

import {
  assertEquals,
  assertExists,
  assertStringIncludes,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";

import {
  applyPreparedAIResponseActions,
  parseActionsFromText,
  prepareAIResponseForDelivery,
  runAIAction,
  stripActionBlockFromText,
} from "../_helpers/ai-actions.ts";

type LeadRecord = {
  id: string;
  organization_id: string;
  assigned_agent_id: string | null;
  name: string | null;
  status?: string;
  qualification_status?: string;
  updated_at?: string;
};

type CalendarEventRecord = Record<string, unknown>;
type OrderRecord = Record<string, unknown>;
type NotificationRecord = Record<string, unknown>;
type BookingRecord = Record<string, unknown>;
type RoomUnitRecord = Record<string, unknown>;

class MockSupabaseClient {
  public leads: LeadRecord[];
  public calendarEvents: CalendarEventRecord[];
  public orders: OrderRecord[];
  public notifications: NotificationRecord[];
  public bookings: BookingRecord[];
  public roomUnits: RoomUnitRecord[];

  constructor({
    leads,
    calendarEvents = [],
    orders = [],
    notifications = [],
    bookings = [],
    roomUnits = [{ id: 'room-1', property_id: 'property-1' }],
  }: {
    leads: LeadRecord[];
    calendarEvents?: CalendarEventRecord[];
    orders?: OrderRecord[];
    notifications?: NotificationRecord[];
    bookings?: BookingRecord[];
    roomUnits?: RoomUnitRecord[];
  }) {
    this.leads = leads;
    this.calendarEvents = calendarEvents;
    this.orders = orders;
    this.notifications = notifications;
    this.bookings = bookings;
    this.roomUnits = roomUnits;
  }

  from(table: string) {
    return new MockQueryBuilder(this, table);
  }
}

class MockQueryBuilder {
  private filters: Array<{ field: string; operator: 'eq' | 'neq'; value: unknown }> = [];
  private updatePayload: Record<string, unknown> | null = null;
  private limitCount: number | null = null;

  constructor(private client: MockSupabaseClient, private table: string) {}

  select(_columns: string) {
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push({ field, operator: 'eq', value });
    return this;
  }

  neq(field: string, value: unknown) {
    this.filters.push({ field, operator: 'neq', value });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.updatePayload = payload;
    return this;
  }

  async maybeSingle() {
    const rows = this.getFilteredRows();
    return { data: rows[0] ?? null, error: null };
  }

  async insert(payload: Record<string, unknown>) {
    if (this.table === 'calendar_events') {
      this.client.calendarEvents.push(payload);
      return { error: null };
    }

    if (this.table === 'orders') {
      this.client.orders.push(payload);
      return { error: null };
    }

    if (this.table === 'bookings') {
      this.client.bookings.push(payload);
      return { error: null };
    }

    if (this.table === 'notification_history') {
      this.client.notifications.push(payload);
      return { error: null };
    }

    return { error: new Error(`Unsupported insert table: ${this.table}`) };
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private async execute() {
    if (this.updatePayload) {
      if (this.table !== 'leads') {
        return { data: null, error: new Error(`Unsupported update table: ${this.table}`) };
      }

      const matchingRows = this.getFilteredRows() as LeadRecord[];
      matchingRows.forEach((row) => Object.assign(row, this.updatePayload));
      return { data: matchingRows, error: null };
    }

    const rows = this.getFilteredRows();
    const limitedRows = this.limitCount == null ? rows : rows.slice(0, this.limitCount);
    return { data: limitedRows, error: null };
  }

  private getFilteredRows() {
    const sourceRows =
      this.table === 'leads'
        ? this.client.leads
        : this.table === 'calendar_events'
          ? this.client.calendarEvents
          : this.table === 'orders'
            ? this.client.orders
              : this.table === 'bookings'
                ? this.client.bookings
                : this.table === 'room_units'
                  ? this.client.roomUnits
            : this.table === 'notification_history'
              ? this.client.notifications
              : [];

    return sourceRows.filter((row) =>
      this.filters.every((filter) => {
        const currentValue = row[filter.field];
        if (filter.operator === 'eq') {
          return currentValue === filter.value;
        }
        return currentValue !== filter.value;
      }),
    );
  }
}

function createClient(overrides?: Partial<{
  leads: LeadRecord[];
  calendarEvents: CalendarEventRecord[];
  orders: OrderRecord[];
  notifications: NotificationRecord[];
  bookings: BookingRecord[];
  roomUnits: RoomUnitRecord[];
}>) {
  return new MockSupabaseClient({
    leads: overrides?.leads || [{
      id: 'lead-1',
      organization_id: 'org-1',
      assigned_agent_id: 'agent-1',
      name: 'Alex Rivera',
      status: 'qualified',
    }],
    calendarEvents: overrides?.calendarEvents || [],
    orders: overrides?.orders || [],
    notifications: overrides?.notifications || [],
    bookings: overrides?.bookings || [],
    roomUnits: overrides?.roomUnits || [{ id: 'room-1', property_id: 'property-1' }],
  });
}

Deno.test("parseActionsFromText parses appointment and order payloads from action block", () => {
  const parsed = parseActionsFromText(`Confirmed.\n[ACTION]\n{\n  "set_lead_status": "booked",\n  "create_order": {\n    "pickup_time": "2026-04-12T18:30:00+08:00",\n    "items": [{ "name": "Burger", "quantity": 2, "price": 120 }]\n  }\n}`);

  assertExists(parsed);
  assertEquals(parsed?.set_lead_status, 'booked');
  assertEquals(parsed?.create_order?.items[0].name, 'Burger');
});

Deno.test("stripActionBlockFromText removes internal action payload from visible response", () => {
  const cleaned = stripActionBlockFromText(`Your pickup is confirmed for 6:30 PM.\n\n[ACTION]\n{"set_lead_status":"booked"}`);
  assertEquals(cleaned, 'Your pickup is confirmed for 6:30 PM.');
});

Deno.test("prepareAIResponseForDelivery returns clean text and parsed actions together", () => {
  const prepared = prepareAIResponseForDelivery(`Reservation confirmed for 7:00 PM.\n[ACTION]\n{"create_reservation":{"start_time":"2026-04-12T19:00:00+08:00","end_time":"2026-04-12T20:30:00+08:00"}}`);

  assertEquals(prepared.cleanText, 'Reservation confirmed for 7:00 PM.');
  assertExists(prepared.actions);
  assertExists(prepared.actions?.create_reservation);
});

Deno.test("runAIAction creates a Jay appointment and updates the lead", async () => {
  const client = createClient();

  const result = await runAIAction(client as never, 'lead-1', {
    create_appointment: {
      title: 'Product consultation',
      start_time: '2026-04-12T14:00:00+08:00',
      end_time: '2026-04-12T14:30:00+08:00',
      appointment_status: 'confirmed',
      location: 'Phone call',
    },
  }, 'test');

  assertEquals(result.applied, true);
  assertEquals(client.calendarEvents.length, 1);
  assertEquals(client.calendarEvents[0].event_type, 'appointment');
  assertEquals(client.calendarEvents[0].appointment_source, 'jay_ai');
  assertEquals(client.leads[0].status, 'booked');
  assertEquals(client.notifications.length, 1);
});

Deno.test("runAIAction creates a May reservation without requiring appointment fields", async () => {
  const client = createClient();

  const result = await runAIAction(client as never, 'lead-1', {
    create_reservation: {
      title: 'Dinner reservation',
      start_time: '2026-04-12T19:00:00+08:00',
      end_time: '2026-04-12T20:30:00+08:00',
      location: 'Main dining room',
    },
  }, 'test');

  assertEquals(result.applied, true);
  assertEquals(client.calendarEvents.length, 1);
  assertEquals(client.calendarEvents[0].event_type, 'reservation');
  assertEquals(client.calendarEvents[0].title, 'Dinner reservation');
  assertEquals(client.leads[0].status, 'booked');
});

Deno.test("runAIAction creates a May order and computes total_amount", async () => {
  const client = createClient();

  const result = await runAIAction(client as never, 'lead-1', {
    create_order: {
      pickup_name: 'Alex Rivera',
      pickup_time: '2026-04-12T18:30:00+08:00',
      items: [
        { name: 'Chicken Inasal', quantity: 2, price: 220 },
        { name: 'Garlic Rice', quantity: 2, price: 35 },
      ],
      status: 'confirmed',
      notes: 'No chili oil',
    },
  }, 'test');

  assertEquals(result.applied, true);
  assertEquals(client.orders.length, 1);
  assertEquals(client.orders[0].status, 'confirmed');
  assertEquals(client.orders[0].total_amount, 510);
  assertEquals(client.leads[0].status, 'booked');
});

Deno.test("runAIAction creates a Cece booking and updates the lead", async () => {
  const client = createClient();

  const result = await runAIAction(client as never, 'lead-1', {
    create_booking: {
      room_unit_id: 'room-1',
      check_in: '2026-04-12',
      check_out: '2026-04-14',
      guest_count: 2,
      status: 'confirmed',
      notes: 'Created by test',
    },
  }, 'test');

  assertEquals(result.applied, true);
  assertEquals(client.bookings.length, 1);
  assertEquals(client.bookings[0].room_unit_id, 'room-1');
  assertEquals(client.bookings[0].status, 'confirmed');
  assertEquals(client.leads[0].status, 'booked');
});

Deno.test("runAIAction rejects conflicting Cece bookings", async () => {
  const client = createClient({
    bookings: [{
      id: 'booking-1',
      organization_id: 'org-1',
      room_unit_id: 'room-1',
      check_in: '2026-04-12',
      check_out: '2026-04-14',
      status: 'confirmed',
    }],
  });

  const result = await runAIAction(client as never, 'lead-1', {
    create_booking: {
      room_unit_id: 'room-1',
      check_in: '2026-04-13',
      check_out: '2026-04-15',
      guest_count: 2,
    },
  }, 'test');

  assertEquals(result.applied, false);
  assertStringIncludes(result.details || '', 'conflicts with an existing stay');
  assertEquals(client.bookings.length, 1);
});

Deno.test("runAIAction dedupes duplicate appointment slots for the same lead", async () => {
  const client = createClient({
    calendarEvents: [{
      id: 'event-1',
      organization_id: 'org-1',
      related_lead_id: 'lead-1',
      event_type: 'appointment',
      start_time: '2026-04-12T06:00:00.000Z',
      end_time: '2026-04-12T06:30:00.000Z',
    }],
  });

  const result = await runAIAction(client as never, 'lead-1', {
    create_appointment: {
      start_time: '2026-04-12T14:00:00+08:00',
      end_time: '2026-04-12T14:30:00+08:00',
    },
  }, 'test');

  assertEquals(result.applied, true);
  assertEquals(client.calendarEvents.length, 1);
  assertStringIncludes(String(client.notifications[0].message), 'Appointment already existed');
});

Deno.test("runAIAction rejects invalid order payloads", async () => {
  const client = createClient();

  const result = await runAIAction(client as never, 'lead-1', {
    create_order: {
      pickup_time: '2026-04-12T18:30:00+08:00',
      items: [{ name: 'Burger', quantity: 0, price: 120 }],
    },
  }, 'test');

  assertEquals(result.applied, false);
  assertStringIncludes(result.details || '', 'invalid item payload');
  assertEquals(client.orders.length, 0);
});

Deno.test("integration - prepared response actions can be applied without leaking control text", async () => {
  const client = createClient();
  const rawResponse = `Your order is confirmed for pickup at 6:30 PM.\n\n[ACTION]\n{
    "set_lead_status": "booked",
    "create_order": {
      "pickup_name": "Alex Rivera",
      "pickup_time": "2026-04-12T18:30:00+08:00",
      "items": [{ "name": "Burger", "quantity": 2, "price": 120 }],
      "status": "confirmed"
    }
  }`;

  const prepared = prepareAIResponseForDelivery(rawResponse);
  const result = await applyPreparedAIResponseActions(client as never, 'lead-1', prepared.actions, 'test');

  assertEquals(prepared.cleanText, 'Your order is confirmed for pickup at 6:30 PM.');
  assertEquals(result.applied, true);
  assertEquals(client.orders.length, 1);
  assertEquals(client.leads[0].status, 'booked');
});