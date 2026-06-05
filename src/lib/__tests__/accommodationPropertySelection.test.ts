import { describe, expect, it } from 'vitest';
import {
  getAccommodationWritePropertyId,
  normalizeAccommodationSelectedPropertyId,
  requiresAccommodationPropertySelection,
} from '@/lib/accommodationPropertySelection';

describe('accommodationPropertySelection', () => {
  it('preserves the all-properties selection for browsing', () => {
    expect(
      normalizeAccommodationSelectedPropertyId('all', [
        { id: 'property-1' },
        { id: 'property-2' },
      ])
    ).toBe('all');
  });

  it('falls back to all when the selected property no longer exists', () => {
    expect(
      normalizeAccommodationSelectedPropertyId('missing-property', [
        { id: 'property-1' },
        { id: 'property-2' },
      ])
    ).toBe('all');
  });

  it('requires an explicit property when all properties are selected', () => {
    expect(
      getAccommodationWritePropertyId('all', [
        { id: 'property-1' },
        { id: 'property-2' },
      ])
    ).toBeNull();
  });

  it('allows writes when there is only one property', () => {
    expect(getAccommodationWritePropertyId('all', [{ id: 'property-1' }])).toBe('property-1');
  });

  it('uses the selected property directly when one is chosen', () => {
    expect(
      getAccommodationWritePropertyId('property-2', [
        { id: 'property-1' },
        { id: 'property-2' },
      ])
    ).toBe('property-2');
  });

  it('blocks writes when the selected property no longer exists', () => {
    expect(
      getAccommodationWritePropertyId('missing-property', [
        { id: 'property-1' },
        { id: 'property-2' },
      ])
    ).toBeNull();
  });

  it('flags create actions when all properties are selected across multiple properties', () => {
    expect(
      requiresAccommodationPropertySelection('all', [
        { id: 'property-1' },
        { id: 'property-2' },
      ])
    ).toBe(true);
  });

  it('allows create actions when only one property exists', () => {
    expect(requiresAccommodationPropertySelection('all', [{ id: 'property-1' }])).toBe(false);
  });
});