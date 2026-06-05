import { describe, expect, test } from 'vitest';
import { calculateDynamicPricing, getPropertyPricingContext } from '../bookingPricing';

const pricingConfig = {
  pricing_tiers: [{ guests: 1, price: 100 }],
  stay_discounts: [],
};

describe('calculateDynamicPricing', () => {
  test('applies premium market pricing when the property is in a high-cost city', () => {
    const suggestion = calculateDynamicPricing(
      '2026-07-10',
      '2026-07-12',
      1,
      pricingConfig,
      [],
      10,
      {
        propertyName: 'Harbor House',
        city: 'Singapore',
        country: 'Singapore',
      }
    );

    expect(suggestion).not.toBeNull();
    expect(suggestion?.locationMultiplier).toBeGreaterThan(1);
    expect(suggestion?.marketPositioning).toBe('Premium global urban market');
    expect(suggestion?.adjustmentReason).toContain('premium city market');
  });

  test('uses explicit city pricing profiles for metro markets', () => {
    const suggestion = calculateDynamicPricing(
      '2026-07-10',
      '2026-07-12',
      1,
      pricingConfig,
      [],
      10,
      {
        propertyName: 'City Suites',
        city: 'Taguig',
        country: 'Philippines',
      }
    );

    expect(suggestion).not.toBeNull();
    expect(suggestion?.locationMultiplier).toBe(1.12);
    expect(suggestion?.marketPositioning).toBe('Premium business district market');
    expect(suggestion?.adjustmentReason).toContain('business district premium');
  });

  test('matches newly supported destination cities in the pricing profiles', () => {
    const suggestion = calculateDynamicPricing(
      '2026-07-10',
      '2026-07-12',
      1,
      pricingConfig,
      [],
      10,
      {
        propertyName: 'Highland View Suites',
        city: 'Tagaytay',
        country: 'Philippines',
      }
    );

    expect(suggestion).not.toBeNull();
    expect(suggestion?.locationMultiplier).toBe(1.12);
    expect(suggestion?.marketPositioning).toBe('Destination resort market');
  });

  test('prioritizes city pricing over generic resort keywords when city data is available', () => {
    const suggestion = calculateDynamicPricing(
      '2026-07-10',
      '2026-07-12',
      1,
      pricingConfig,
      [],
      10,
      {
        propertyName: 'Downtown Harbor Suites',
        propertyDescription: 'Beachfront stay close to ferries and island tours',
        city: 'Cebu City',
        country: 'Philippines',
      }
    );

    expect(suggestion).not.toBeNull();
    expect(suggestion?.locationMultiplier).toBe(1.08);
    expect(suggestion?.marketPositioning).toBe('High-demand urban market');
    expect(suggestion?.adjustmentReason).toContain('high-demand city market');
  });

  test('allows a room pricing city override to win over the property city', () => {
    const locationContext = getPropertyPricingContext(
      {
        propertyName: 'Harbor Annex',
        city: 'Singapore',
        country: 'Singapore',
      },
      {
        country: 'Philippines',
        region: 'Metro Manila',
        city: 'Taguig',
        district: 'Bonifacio Global City',
      }
    );

    const suggestion = calculateDynamicPricing(
      '2026-07-10',
      '2026-07-12',
      1,
      pricingConfig,
      [],
      10,
      locationContext
    );

    expect(suggestion).not.toBeNull();
    expect(suggestion?.locationMultiplier).toBe(1.18);
    expect(suggestion?.marketPositioning).toBe('Prime district market');
  });

  test('prioritizes district pricing over city pricing when a district is provided', () => {
    const suggestion = calculateDynamicPricing(
      '2026-07-10',
      '2026-07-12',
      1,
      pricingConfig,
      [],
      10,
      {
        country: 'Philippines',
        region: 'Metro Manila',
        city: 'Makati',
        district: 'Rockwell Center',
      }
    );

    expect(suggestion).not.toBeNull();
    expect(suggestion?.locationMultiplier).toBe(1.1);
    expect(suggestion?.marketPositioning).toBe('High-traffic lifestyle district');
  });

  test('infers resort pricing from property metadata when explicit city data is missing', () => {
    const suggestion = calculateDynamicPricing(
      '2026-04-10',
      '2026-04-12',
      1,
      pricingConfig,
      [],
      10,
      {
        propertyName: 'Sunset Beach Resort',
        propertyDescription: 'Steps from the waterfront and island ferries',
      }
    );

    expect(suggestion).not.toBeNull();
    expect(suggestion?.locationMultiplier).toBeGreaterThan(1);
    expect(suggestion?.marketPositioning).toBe('Destination resort market');
  });

  test('counts confirmed and weighted pending bookings in occupancy demand', () => {
    const suggestion = calculateDynamicPricing(
      '2026-05-01',
      '2026-05-03',
      1,
      pricingConfig,
      [
        { check_in: '2026-05-01', check_out: '2026-05-03', status: 'confirmed' },
        { check_in: '2026-05-01', check_out: '2026-05-03', status: 'pending' },
      ],
      2,
      null
    );

    expect(suggestion).not.toBeNull();
    expect(suggestion?.occupancyRate).toBeGreaterThan(50);
    expect(suggestion?.occupancyMultiplier).toBeGreaterThan(1);
  });
});