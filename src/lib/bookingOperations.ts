import { BookingWithRelations } from '@/hooks/useAccommodationData';

type OverlapBooking = Pick<BookingWithRelations, 'id' | 'room_unit_id' | 'check_in' | 'check_out' | 'status'>;

export function hasBookingOverlap(
  bookings: OverlapBooking[],
  roomId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string
): boolean {
  return bookings.some((booking) => {
    if (booking.id === excludeBookingId) return false;
    if (booking.room_unit_id !== roomId) return false;
    if (['cancelled', 'checked_out'].includes(booking.status)) return false;
    return checkIn < booking.check_out && checkOut > booking.check_in;
  });
}

export function getActionableBookings<T extends { isExternal?: boolean; id: string }>(bookings: T[]): T[] {
  return bookings.filter((booking) => !booking.isExternal && !booking.id.startsWith('external-'));
}

export function getRecoveryWindowLabel(expiresAt: string, now = new Date()): string {
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  if (diffMs <= 0) return 'Expired';

  const totalMinutes = Math.ceil(diffMs / (60 * 1000));
  if (totalMinutes < 60) {
    return `${totalMinutes}m remaining`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) {
    return `${hours}h remaining`;
  }

  return `${hours}h ${minutes}m remaining`;
}