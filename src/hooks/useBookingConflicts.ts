import { useMemo } from 'react';

/**
 * Minimal booking interface for conflict checking
 */
export interface BookingForConflictCheck {
  id: string;
  room_unit_id: string;
  check_in: string;
  check_out: string;
  status: string;
  lead?: { name?: string } | null;
}

/**
 * Check if two date ranges overlap
 * Same-day turnovers allowed (checkout date = check-in date is OK)
 */
function dateRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  // Allow same-day turnovers: checkout_A = checkin_B is permitted
  // Only conflict if there's actual overlap of nights stayed
  return startA < endB && startB < endA;
}

export interface BookingConflict {
  booking: BookingForConflictCheck;
  message: string;
}

/**
 * Hook to check for booking conflicts when creating or editing a booking
 */
export function useBookingConflicts(
  roomId: string | null,
  checkIn: string | null,
  checkOut: string | null,
  existingBookings: BookingForConflictCheck[],
  excludeBookingId?: string
) {
  const conflicts = useMemo(() => {
    if (!roomId || !checkIn || !checkOut) return [];
    
    // Only consider upcoming (confirmed) bookings for the same room
    // Pending bookings are non-blocking until confirmed to upcoming
    // Include 'external' status as it represents calendar sync events that block availability
    const activeBookings = existingBookings.filter(b => 
      b.room_unit_id === roomId &&
      (b.status === 'confirmed' || b.status === 'upcoming' || b.status === 'checked_in' || b.status === 'external') &&
      b.id !== excludeBookingId
    );
    
    const conflicting: BookingConflict[] = [];
    
    for (const booking of activeBookings) {
      if (dateRangesOverlap(checkIn, checkOut, booking.check_in, booking.check_out)) {
        conflicting.push({
          booking,
          message: `Conflicts with ${booking.lead?.name || 'booking'} (${booking.check_in} - ${booking.check_out})`
        });
      }
    }
    
    return conflicting;
  }, [roomId, checkIn, checkOut, existingBookings, excludeBookingId]);

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
  };
}
