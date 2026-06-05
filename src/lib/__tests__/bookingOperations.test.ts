import { describe, expect, it } from 'vitest';
import { getActionableBookings, getRecoveryWindowLabel, hasBookingOverlap } from '../bookingOperations';

describe('hasBookingOverlap', () => {
  it('treats external calendar bookings as hard conflicts', () => {
    const overlapping = hasBookingOverlap(
      [
        {
          id: 'external-1',
          room_unit_id: 'room-1',
          check_in: '2026-04-10',
          check_out: '2026-04-12',
          status: 'external',
        },
      ],
      'room-1',
      '2026-04-11',
      '2026-04-13'
    );

    expect(overlapping).toBe(true);
  });

  it('ignores cancelled and checked out bookings', () => {
    const overlapping = hasBookingOverlap(
      [
        {
          id: 'booking-1',
          room_unit_id: 'room-1',
          check_in: '2026-04-10',
          check_out: '2026-04-12',
          status: 'cancelled',
        },
        {
          id: 'booking-2',
          room_unit_id: 'room-1',
          check_in: '2026-04-10',
          check_out: '2026-04-12',
          status: 'checked_out',
        },
      ],
      'room-1',
      '2026-04-11',
      '2026-04-13'
    );

    expect(overlapping).toBe(false);
  });
});

describe('getActionableBookings', () => {
  it('excludes external bookings from batch actions', () => {
    const actionable = getActionableBookings([
      { id: 'booking-1' },
      { id: 'external-1', isExternal: true },
      { id: 'external-2' },
    ]);

    expect(actionable).toEqual([{ id: 'booking-1' }]);
  });
});

describe('getRecoveryWindowLabel', () => {
  it('formats remaining recovery time', () => {
    const label = getRecoveryWindowLabel('2026-04-04T14:30:00.000Z', new Date('2026-04-04T12:00:00.000Z'));
    expect(label).toBe('2h 30m remaining');
  });
});