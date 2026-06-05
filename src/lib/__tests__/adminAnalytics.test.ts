import { describe, expect, test } from 'vitest';

import {
  CECE_REVENUE_STATUSES,
  getAgentRevenueEvents,
  getAgentRevenueTotal,
  getAgentTransactionCount,
} from '../adminAnalytics';

describe('adminAnalytics', () => {
  test('uses eligible booking revenue for Cece totals and transaction counts', () => {
    const orders = [
      { created_at: '2026-04-01T00:00:00.000Z', total_amount: 900 },
    ];
    const bookings = [
      { created_at: '2026-04-01T10:00:00.000Z', total_price: 2500, status: 'confirmed' },
      { created_at: '2026-04-02T10:00:00.000Z', total_price: 1800, status: 'checked_in' },
      { created_at: '2026-04-03T10:00:00.000Z', total_price: 9999, status: 'cancelled' },
    ];

    expect(CECE_REVENUE_STATUSES).toContain('confirmed');
    expect(getAgentRevenueTotal('cece', orders, bookings)).toBe(4300);
    expect(getAgentTransactionCount('cece', orders, bookings)).toBe(2);
  });

  test('keeps Jay and May revenue tied to orders', () => {
    const orders = [
      { created_at: '2026-04-01T00:00:00.000Z', total_amount: 1250 },
      { created_at: '2026-04-02T00:00:00.000Z', total_amount: 750 },
    ];
    const bookings = [
      { created_at: '2026-04-01T10:00:00.000Z', total_price: 5000, status: 'confirmed' },
    ];

    expect(getAgentRevenueTotal('jay', orders, bookings)).toBe(2000);
    expect(getAgentRevenueTotal('may', orders, bookings)).toBe(2000);
    expect(getAgentTransactionCount('jay', orders, bookings)).toBe(2);
  });

  test('returns booking-based revenue events for Cece trend charts', () => {
    const revenueEvents = getAgentRevenueEvents(
      'cece',
      [{ created_at: '2026-04-01T00:00:00.000Z', total_amount: 400 }],
      [
        { created_at: '2026-04-05T12:30:00.000Z', total_price: 2200, status: 'upcoming' },
        { created_at: '2026-04-06T12:30:00.000Z', total_price: 700, status: 'pending' },
      ]
    );

    expect(revenueEvents).toEqual([
      { createdAt: '2026-04-05T12:30:00.000Z', amount: 2200 },
    ]);
  });
});