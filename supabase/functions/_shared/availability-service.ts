/**
 * Shared Availability Service
 * 
 * Provides DETERMINISTIC (code-based, not generative) availability checking
 * for all agents: Cece (hospitality), Jay (sales), May (food)
 * 
 * KEY PRINCIPLE: Availability decisions must be made by CODE, not by AI hallucination.
 * The AI never "guesses" if a slot is free - the code always tells it TRUE/FALSE.
 */

/**
 * Represents a booked time slot
 */
export interface BookingSlot {
  startDate: string; // YYYY-MM-DD in property's local timezone
  endDate: string;   // YYYY-MM-DD in property's local timezone
  title?: string;
  status?: string;
}

/**
 * Represents a time slot that needs to be checked
 */
export interface AvailabilityRequest {
  startDate: string; // YYYY-MM-DD in property's local timezone
  endDate: string;   // YYYY-MM-DD in property's local timezone
}

/**
 * Result of availability check
 */
export interface AvailabilityResult {
  available: boolean;
  conflictingBooking?: BookingSlot;
  reason?: string;
  explanation?: string; // Human-friendly message
}

/**
 * Parse a date string and ensure it's in YYYY-MM-DD format
 * @throws Error if date is invalid
 */
export function parseDate(dateStr: string): Date {
  const date = new Date(dateStr + 'T00:00:00'); // Add time to avoid timezone issues
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return date;
}

/**
 * Convert a Date to YYYY-MM-DD string in the property's local timezone
 */
export function formatDateToISO(date: Date, timezone: string = 'Asia/Manila'): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  });
  return formatter.format(date);
}

/**
 * Calculate all NIGHT dates for a stay
 * IMPORTANT: checkout date is EXCLUDED (guest leaves that day, doesn't occupy the room)
 * 
 * Example:
 *   checkIn: "2026-01-16", checkOut: "2026-01-18"
 *   Nights: ["2026-01-16", "2026-01-17"] (NOT 2026-01-18, because they leave on the 18th)
 *   So checkout date IS available for next guest to check in
 */
export function calculateNightsDates(
  checkInStr: string,
  checkOutStr: string,
  timezone: string = 'Asia/Manila'
): string[] {
  const nights: string[] = [];
  
  try {
    const current = parseDate(checkInStr);
    const checkOut = parseDate(checkOutStr);
    
    // Generate all nights EXCEPT the checkout date
    while (current < checkOut) {
      nights.push(formatDateToISO(current, timezone));
      current.setDate(current.getDate() + 1);
    }
    
    return nights;
  } catch (e) {
    throw new Error(`Invalid date range: ${checkInStr} to ${checkOutStr}: ${e}`);
  }
}

/**
 * Convert raw bookings to a set of blocked nights
 * Handles timezone normalization automatically
 */
export function getBlockedNights(
  bookings: BookingSlot[],
  timezone: string = 'Asia/Manila'
): Set<string> {
  const blocked = new Set<string>();
  
  for (const booking of bookings) {
    try {
      const nights = calculateNightsDates(booking.startDate, booking.endDate, timezone);
      nights.forEach(night => blocked.add(night));
    } catch (e) {
      console.error(`Error processing booking from ${booking.startDate} to ${booking.endDate}:`, e);
    }
  }
  
  return blocked;
}

/**
 * CHECK AVAILABILITY - Main function
 * 
 * Returns TRUE if ALL requested nights are available
 * Returns FALSE if ANY requested night is blocked
 * 
 * CRITICAL LOGIC:
 * - This is DETERMINISTIC code, not AI guessing
 * - Returns a strict boolean
 * - Always explains conflicts
 */
export function checkAvailability(
  request: AvailabilityRequest,
  bookings: BookingSlot[],
  timezone: string = 'Asia/Manila'
): AvailabilityResult {
  try {
    // Get all nights the guest wants to occupy
    const requestedNights = calculateNightsDates(request.startDate, request.endDate, timezone);
    
    // Get all nights that are blocked by existing bookings
    const blockedNights = getBlockedNights(bookings, timezone);
    
    // Check if ANY requested night is blocked
    for (const night of requestedNights) {
      if (blockedNights.has(night)) {
        // Find the conflicting booking for explanation
        const conflicting = bookings.find(b => {
          const nights = calculateNightsDates(b.startDate, b.endDate, timezone);
          return nights.includes(night);
        });
        
        return {
          available: false,
          conflictingBooking: conflicting,
          reason: `Conflict on ${night}`,
          explanation: `Not available from ${request.startDate} to ${request.endDate}. ` +
            (conflicting ? `There is an existing booking from ${conflicting.startDate} to ${conflicting.endDate}.` : ''),
        };
      }
    }
    
    // All nights are clear
    return {
      available: true,
      explanation: `Available from ${request.startDate} to ${request.endDate}.`,
    };
  } catch (e) {
    return {
      available: false,
      reason: `Error checking availability: ${e instanceof Error ? e.message : String(e)}`,
      explanation: 'Unable to check availability. Please contact support.',
    };
  }
}

/**
 * Normalize a date to a property's local timezone
 * Converts UTC or any timezone to the property's timezone at midnight
 */
export function normalizeDateToTimezone(
  date: Date,
  timezone: string = 'Asia/Manila'
): Date {
  // Get the local midnight in the property's timezone
  const isoString = formatDateToISO(date, timezone);
  return parseDate(isoString);
}

/**
 * Format availability result for AI to understand (deterministic output)
 */
export function formatAvailabilityForAI(result: AvailabilityResult): string {
  if (!result.available) {
    return `⛔ NOT AVAILABLE: ${result.explanation}`;
  }
  return `✅ AVAILABLE: ${result.explanation}`;
}

/**
 * Multi-room availability check (for Cece)
 * Returns availability status for each room
 */
export interface RoomAvailabilityCheck {
  roomId: string;
  roomName: string;
  available: boolean;
  blockedNights?: string[];
  reason?: string;
}

export function checkRoomAvailability(
  request: AvailabilityRequest,
  rooms: Array<{
    id: string;
    name: string;
    bookings: BookingSlot[];
  }>,
  timezone: string = 'Asia/Manila'
): RoomAvailabilityCheck[] {
  return rooms.map(room => {
    const result = checkAvailability(request, room.bookings, timezone);
    const blockedNightsArray = result.available 
      ? undefined 
      : Array.from(getBlockedNights(room.bookings, timezone));
    
    return {
      roomId: room.id,
      roomName: room.name,
      available: result.available,
      blockedNights: blockedNightsArray,
      reason: result.reason,
    };
  });
}

/**
 * Appointment slot availability (for Jay)
 * Checks if a time slot is available for scheduling
 */
export function checkAppointmentSlotAvailable(
  requestedTime: { date: string; time: string }, // time in HH:MM format
  duration: number, // in minutes
  bookedSlots: Array<{ date: string; time: string; duration: number }>,
  _timezone: string = 'Asia/Manila'
): { available: boolean; reason: string } {
  try {
    const [reqHour, reqMinute] = requestedTime.time.split(':').map(Number);
    const reqStartMinutes = reqHour * 60 + reqMinute;
    const reqEndMinutes = reqStartMinutes + duration;
    
    // Check if requested date matches any bookings
    const slotsOnDate = bookedSlots.filter(s => s.date === requestedTime.date);
    
    for (const slot of slotsOnDate) {
      const [hour, minute] = slot.time.split(':').map(Number);
      const slotStartMinutes = hour * 60 + minute;
      const slotEndMinutes = slotStartMinutes + slot.duration;
      
      // Check for overlap
      if (!(reqEndMinutes <= slotStartMinutes || reqStartMinutes >= slotEndMinutes)) {
        return {
          available: false,
          reason: `Time slot conflict: ${slot.time} to ${Math.floor(slotEndMinutes / 60)}:${slotEndMinutes % 60} is already booked`,
        };
      }
    }
    
    return {
      available: true,
      reason: `Slot available at ${requestedTime.time} on ${requestedTime.date}`,
    };
  } catch (e) {
    return {
      available: false,
      reason: `Error checking slot: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Table availability check (for May)
 * Checks if a restaurant table is available for a given time
 */
export interface TableAvailabilityRequest {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  duration: number; // minutes
  partySize: number;
}

export interface TableAvailability {
  tableId: string;
  tableName: string;
  available: boolean;
  reason?: string;
}

export function checkTableAvailability(
  request: TableAvailabilityRequest,
  table: {
    id: string;
    name: string;
    capacity: number;
    bookings: Array<{ startTime: string; duration: number; partySize: number }>;
  },
  restaurantHours?: { open: string; close: string }
): TableAvailability {
  // Check restaurant hours
  if (restaurantHours) {
    const [reqHour] = request.startTime.split(':').map(Number);
    const [openHour] = restaurantHours.open.split(':').map(Number);
    const [closeHour] = restaurantHours.close.split(':').map(Number);
    
    if (reqHour < openHour || reqHour >= closeHour) {
      return {
        tableId: table.id,
        tableName: table.name,
        available: false,
        reason: `Restaurant is closed at ${request.startTime}. Hours: ${restaurantHours.open} - ${restaurantHours.close}`,
      };
    }
  }
  
  // Check party size
  if (request.partySize > table.capacity) {
    return {
      tableId: table.id,
      tableName: table.name,
      available: false,
      reason: `Table capacity (${table.capacity}) is less than party size (${request.partySize})`,
    };
  }
  
  // Check for time conflicts
  const [reqHour, reqMinute] = request.startTime.split(':').map(Number);
  const reqStartMinutes = reqHour * 60 + reqMinute;
  const reqEndMinutes = reqStartMinutes + request.duration;
  
  for (const booking of table.bookings) {
    const [bookHour, bookMinute] = booking.startTime.split(':').map(Number);
    const bookStartMinutes = bookHour * 60 + bookMinute;
    const bookEndMinutes = bookStartMinutes + booking.duration;
    
    // Check for overlap
    if (!(reqEndMinutes <= bookStartMinutes || reqStartMinutes >= bookEndMinutes)) {
      return {
        tableId: table.id,
        tableName: table.name,
        available: false,
        reason: `Table is booked from ${booking.startTime} (${booking.partySize} guests)`,
      };
    }
  }
  
  return {
    tableId: table.id,
    tableName: table.name,
    available: true,
    reason: `Table available for ${request.partySize} guests at ${request.startTime}`,
  };
}
