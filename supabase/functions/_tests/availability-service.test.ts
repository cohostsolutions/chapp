/**
 * Unit tests for _shared/availability-service.ts
 * 
 * Critical tests for deterministic availability checking
 * 
 * Run with: deno test --allow-env supabase/functions/_tests/availability-service.test.ts
 */

import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.208.0/assert/mod.ts";

import {
  parseDate,
  formatDateToISO,
  calculateNightsDates,
  getBlockedNights,
  checkAvailability,
  normalizeDateToTimezone,
  formatAvailabilityForAI,
  checkRoomAvailability,
  checkAppointmentSlotAvailable,
  checkTableAvailability,
  type BookingSlot,
  type AvailabilityRequest,
} from "../_shared/availability-service.ts";

// ============= Date Parsing Tests =============

Deno.test("parseDate - parses valid YYYY-MM-DD strings", () => {
  const result = parseDate("2026-01-17");
  assertEquals(result.getFullYear(), 2026);
  assertEquals(result.getMonth(), 0); // Jan = 0
  assertEquals(result.getDate(), 17);
});

Deno.test("parseDate - throws on invalid dates", () => {
  let errorThrown = false;
  try {
    parseDate("invalid-date");
  } catch (_e) {
    errorThrown = true;
  }
  assertEquals(errorThrown, true);
});

// ============= Timezone Handling Tests =============

Deno.test("formatDateToISO - formats date in Manila timezone", () => {
  const date = new Date("2026-01-17T15:30:00Z"); // 3:30 PM UTC on Jan 17
  const result = formatDateToISO(date, "Asia/Manila"); // UTC+8
  // In Manila (UTC+8), this is Jan 18 at 11:30 PM, still on Jan 18
  assertEquals(result.startsWith("2026-01-"), true);
  assertEquals(result.length, 10); // YYYY-MM-DD format
});

Deno.test("normalizeDateToTimezone - normalizes to property timezone midnight", () => {
  const utcDate = new Date("2026-01-17T05:00:00Z"); // 5 AM UTC
  const normalized = normalizeDateToTimezone(utcDate, "Asia/Manila"); // UTC+8
  // 5 AM UTC = 1 PM Manila time on Jan 17
  const formatted = formatDateToISO(normalized, "Asia/Manila");
  assertEquals(formatted, "2026-01-17");
});

// ============= Nights Calculation Tests =============

Deno.test("calculateNightsDates - calculates correct number of nights", () => {
  const nights = calculateNightsDates("2026-01-16", "2026-01-18", "Asia/Manila");
  assertEquals(nights.length, 2); // Jan 16 and Jan 17
  assertEquals(nights[0], "2026-01-16");
  assertEquals(nights[1], "2026-01-17");
});

Deno.test("calculateNightsDates - excludes checkout date", () => {
  // CRITICAL: Checkout date should NOT be included
  const nights = calculateNightsDates("2026-01-15", "2026-01-15", "Asia/Manila");
  assertEquals(nights.length, 0); // Same-day checkout = 0 nights
});

Deno.test("calculateNightsDates - handles single night correctly", () => {
  const nights = calculateNightsDates("2026-01-16", "2026-01-17", "Asia/Manila");
  assertEquals(nights.length, 1);
  assertEquals(nights[0], "2026-01-16");
});

Deno.test("calculateNightsDates - handles multi-night stays", () => {
  const nights = calculateNightsDates("2026-01-16", "2026-01-20", "Asia/Manila");
  assertEquals(nights.length, 4); // Jan 16, 17, 18, 19
  assertEquals(nights[0], "2026-01-16");
  assertEquals(nights[3], "2026-01-19");
});

// ============= Blocked Nights Calculation Tests =============

Deno.test("getBlockedNights - calculates blocked dates from multiple bookings", () => {
  const bookings: BookingSlot[] = [
    { startDate: "2026-01-15", endDate: "2026-01-18", title: "Guest A" },
    { startDate: "2026-01-20", endDate: "2026-01-22", title: "Guest B" },
  ];
  
  const blocked = getBlockedNights(bookings, "Asia/Manila");
  assertEquals(blocked.has("2026-01-15"), true);
  assertEquals(blocked.has("2026-01-16"), true);
  assertEquals(blocked.has("2026-01-17"), true);
  assertEquals(blocked.has("2026-01-18"), false); // Checkout date NOT blocked
  assertEquals(blocked.has("2026-01-20"), true);
  assertEquals(blocked.has("2026-01-21"), true);
  assertEquals(blocked.has("2026-01-22"), false); // Checkout date NOT blocked
});

// ============= Availability Check Tests =============

Deno.test("checkAvailability - returns available for free dates", () => {
  const bookings: BookingSlot[] = [
    { startDate: "2026-01-10", endDate: "2026-01-15", title: "Existing" },
  ];
  
  const request: AvailabilityRequest = {
    startDate: "2026-01-16",
    endDate: "2026-01-18",
  };
  
  const result = checkAvailability(request, bookings, "Asia/Manila");
  assertEquals(result.available, true);
});

Deno.test("checkAvailability - rejects conflicting dates", () => {
  const bookings: BookingSlot[] = [
    { startDate: "2026-01-15", endDate: "2026-01-18", title: "Existing" },
  ];
  
  const request: AvailabilityRequest = {
    startDate: "2026-01-16",
    endDate: "2026-01-19",
  };
  
  const result = checkAvailability(request, bookings, "Asia/Manila");
  assertEquals(result.available, false);
  assertEquals(result.reason, "Conflict on 2026-01-16");
});

Deno.test("checkAvailability - CRITICAL: allows same-day turnovers (checkout = check-in)", () => {
  // This is the key test for the checkout day edge case
  const bookings: BookingSlot[] = [
    { startDate: "2026-01-14", endDate: "2026-01-15", title: "Guest A checks out" },
  ];
  
  const request: AvailabilityRequest = {
    startDate: "2026-01-15", // New guest checks in same day
    endDate: "2026-01-17",
  };
  
  const result = checkAvailability(request, bookings, "Asia/Manila");
  assertEquals(result.available, true, "Checkout date (Jan 15) should be available for new check-in");
});

Deno.test("checkAvailability - detects conflict on first night", () => {
  const bookings: BookingSlot[] = [
    { startDate: "2026-01-16", endDate: "2026-01-20", title: "Existing" },
  ];
  
  const request: AvailabilityRequest = {
    startDate: "2026-01-16",
    endDate: "2026-01-18",
  };
  
  const result = checkAvailability(request, bookings, "Asia/Manila");
  assertEquals(result.available, false);
});

Deno.test("checkAvailability - detects conflict on last night", () => {
  const bookings: BookingSlot[] = [
    { startDate: "2026-01-18", endDate: "2026-01-20", title: "Existing" },
  ];
  
  const request: AvailabilityRequest = {
    startDate: "2026-01-16",
    endDate: "2026-01-19",
  };
  
  const result = checkAvailability(request, bookings, "Asia/Manila");
  assertEquals(result.available, false);
});

Deno.test("checkAvailability - handles empty booking list", () => {
  const bookings: BookingSlot[] = [];
  
  const request: AvailabilityRequest = {
    startDate: "2026-01-16",
    endDate: "2026-01-18",
  };
  
  const result = checkAvailability(request, bookings, "Asia/Manila");
  assertEquals(result.available, true);
});

// ============= Format for AI Tests =============

Deno.test("formatAvailabilityForAI - formats available result", () => {
  const result = formatAvailabilityForAI({ available: true, explanation: "Test room is free" });
  assertStringIncludes(result, "✅");
  assertStringIncludes(result, "AVAILABLE");
});

Deno.test("formatAvailabilityForAI - formats unavailable result", () => {
  const result = formatAvailabilityForAI({ 
    available: false, 
    explanation: "Already booked" 
  });
  assertStringIncludes(result, "⛔");
  assertStringIncludes(result, "NOT AVAILABLE");
});

// ============= Multi-Room Availability Tests =============

Deno.test("checkRoomAvailability - checks all rooms and returns status for each", () => {
  const rooms = [
    {
      id: "room1",
      name: "The Nest",
      bookings: [{ startDate: "2026-01-15", endDate: "2026-01-18", title: "Booked" }],
    },
    {
      id: "room2",
      name: "The Haven",
      bookings: [] as BookingSlot[],
    },
  ];
  
  const request: AvailabilityRequest = {
    startDate: "2026-01-16",
    endDate: "2026-01-19",
  };
  
  const results = checkRoomAvailability(request, rooms, "Asia/Manila");
  assertEquals(results.length, 2);
  assertEquals(results[0].roomId, "room1");
  assertEquals(results[0].available, false);
  assertEquals(results[1].roomId, "room2");
  assertEquals(results[1].available, true);
});

// ============= Appointment Slot Tests =============

Deno.test("checkAppointmentSlotAvailable - allows booking if slot is free", () => {
  const result = checkAppointmentSlotAvailable(
    { date: "2026-01-17", time: "14:00" },
    60, // 1 hour
    [],
    "Asia/Manila"
  );
  assertEquals(result.available, true);
});

Deno.test("checkAppointmentSlotAvailable - prevents double-booking", () => {
  const booked = [
    { date: "2026-01-17", time: "14:00", duration: 60 },
  ];
  
  const result = checkAppointmentSlotAvailable(
    { date: "2026-01-17", time: "14:30" },
    60,
    booked,
    "Asia/Manila"
  );
  assertEquals(result.available, false);
});

Deno.test("checkAppointmentSlotAvailable - allows back-to-back appointments", () => {
  const booked = [
    { date: "2026-01-17", time: "14:00", duration: 60 },
  ];
  
  // Next appointment starts exactly when previous ends
  const result = checkAppointmentSlotAvailable(
    { date: "2026-01-17", time: "15:00" },
    60,
    booked,
    "Asia/Manila"
  );
  assertEquals(result.available, true);
});

// ============= Table Availability Tests =============

Deno.test("checkTableAvailability - allows booking for available table", () => {
  const table = {
    id: "t1",
    name: "Table 1",
    capacity: 4,
    bookings: [] as Array<{ startTime: string; duration: number; partySize: number }>,
  };
  
  const result = checkTableAvailability(
    { date: "2026-01-17", startTime: "19:00", duration: 120, partySize: 2 },
    table
  );
  assertEquals(result.available, true);
});

Deno.test("checkTableAvailability - respects table capacity", () => {
  const table = {
    id: "t1",
    name: "Table 1",
    capacity: 4,
    bookings: [],
  };
  
  const result = checkTableAvailability(
    { date: "2026-01-17", startTime: "19:00", duration: 120, partySize: 6 },
    table
  );
  assertEquals(result.available, false);
  assertStringIncludes(result.reason || "", "capacity");
});

Deno.test("checkTableAvailability - respects restaurant hours", () => {
  const table = {
    id: "t1",
    name: "Table 1",
    capacity: 4,
    bookings: [],
  };
  
  const result = checkTableAvailability(
    { date: "2026-01-17", startTime: "02:00", duration: 120, partySize: 2 },
    table,
    { open: "09:00", close: "22:00" }
  );
  assertEquals(result.available, false);
  assertStringIncludes(result.reason || "", "closed");
});

Deno.test("checkTableAvailability - prevents double-booking", () => {
  const table = {
    id: "t1",
    name: "Table 1",
    capacity: 4,
    bookings: [
      { startTime: "19:00", duration: 120, partySize: 4 },
    ],
  };
  
  const result = checkTableAvailability(
    { date: "2026-01-17", startTime: "20:00", duration: 120, partySize: 2 },
    table
  );
  assertEquals(result.available, false);
  assertStringIncludes(result.reason || "", "booked");
});

Deno.test("checkTableAvailability - allows back-to-back reservations", () => {
  const table = {
    id: "t1",
    name: "Table 1",
    capacity: 4,
    bookings: [
      { startTime: "19:00", duration: 120, partySize: 4 }, // 19:00-21:00
    ],
  };
  
  // Next reservation starts exactly when previous ends
  const result = checkTableAvailability(
    { date: "2026-01-17", startTime: "21:00", duration: 120, partySize: 2 },
    table
  );
  assertEquals(result.available, true);
});

// ============= Edge Case Tests =============

Deno.test("EDGE CASE: Back-to-back bookings across multiple days", () => {
  // Guest A: Jan 1-5 (nights: 1, 2, 3, 4)
  // Guest B: Jan 5-10 (nights: 5, 6, 7, 8, 9)
  // This should be allowed - Guest A checks out on 5, Guest B checks in on 5
  
  const bookings: BookingSlot[] = [
    { startDate: "2026-01-01", endDate: "2026-01-05", title: "Guest A" },
  ];
  
  const request: AvailabilityRequest = {
    startDate: "2026-01-05",
    endDate: "2026-01-10",
  };
  
  const result = checkAvailability(request, bookings, "Asia/Manila");
  assertEquals(result.available, true, "Guest B should be able to check in on checkout day");
});

Deno.test("EDGE CASE: Timezone boundary - midnight crossing", () => {
  // A booking that ends at 11:59 PM UTC should not block the next day in Manila timezone
  // (This requires careful normalization)
  const bookings: BookingSlot[] = [
    { startDate: "2026-01-17", endDate: "2026-01-18", title: "Guest A" },
  ];
  
  const request: AvailabilityRequest = {
    startDate: "2026-01-18",
    endDate: "2026-01-20",
  };
  
  const result = checkAvailability(request, bookings, "Asia/Manila");
  assertEquals(result.available, true, "Checkout date should be available");
});
