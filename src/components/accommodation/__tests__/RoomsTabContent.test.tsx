import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import RoomsTabContent from '../RoomsTabContent';

const mockToast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/hooks/useUndoableAction', () => ({
  useUndoableAction: () => ({ execute: vi.fn() }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('@/components/shared/LocationPickerFields', () => ({
  LocationPickerFields: () => <div>LocationPickerFieldsMock</div>,
}));

vi.mock('@/components/shared/MultiImageUpload', () => ({
  MultiImageUpload: () => <div>MultiImageUploadMock</div>,
}));

vi.mock('@/components/rooms/CalendarSelector', () => ({
  CalendarSelector: () => <div>CalendarSelectorMock</div>,
}));

function buildAccommodationData(overrides: Record<string, unknown> = {}) {
  return {
    rooms: [],
    stats: {
      activeRooms: 0,
      totalCapacity: 0,
      roomsWithCalendar: 0,
      roomsWithoutCalendar: 0,
    },
    isLoading: false,
    refetchAll: vi.fn(),
    selectedPropertyId: 'property-1',
    properties: [{ id: 'property-1', name: 'Main Property' }],
    ...overrides,
  };
}

describe('RoomsTabContent targeted behaviors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('shows a property selector when multiple properties are available', () => {
    render(
      <RoomsTabContent
        accommodationData={buildAccommodationData({
          selectedPropertyId: 'all',
          properties: [
            { id: 'property-1', name: 'Main Property' },
            { id: 'property-2', name: 'Second Property' },
          ],
        }) as never}
        formatCurrency={(amount) => `$${amount}`}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Room' }));

    expect(screen.getByText('Property')).toBeInTheDocument();
  });

  test('disables Add Room when writable property cannot be resolved', () => {
    render(
      <RoomsTabContent
        accommodationData={buildAccommodationData({
          selectedPropertyId: 'all',
          properties: [],
        }) as never}
        formatCurrency={(amount) => `$${amount}`}
      />
    );

    expect(screen.getByRole('button', { name: 'Add Room' })).toBeDisabled();
  });

  test('shows no matching rooms state when filters remove all rooms', () => {
    render(
      <RoomsTabContent
        accommodationData={buildAccommodationData({
          rooms: [
            {
              id: 'room-1',
              name: 'Suite A',
              category: 'Suite',
              description: null,
              is_active: true,
              calendar_ids: [],
              pricing_tiers: [],
              stay_discounts: [],
              image_urls: [],
              image_url: null,
              price_per_night: 120,
              pricing_country: null,
              pricing_region: null,
              pricing_city: null,
              pricing_district: null,
            },
          ],
        }) as never}
        formatCurrency={(amount) => `$${amount}`}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Search rooms...'), {
      target: { value: 'unmatched-query' },
    });

    expect(screen.getByText('No matching rooms')).toBeInTheDocument();
  });

  test('filters rooms by selected category', async () => {
    render(
      <RoomsTabContent
        accommodationData={buildAccommodationData({
          rooms: [
            {
              id: 'room-1',
              name: 'Suite A',
              category: 'Suite',
              description: null,
              is_active: true,
              calendar_ids: [],
              pricing_tiers: [],
              stay_discounts: [],
              image_urls: [],
              image_url: null,
              price_per_night: 120,
              pricing_country: null,
              pricing_region: null,
              pricing_city: null,
              pricing_district: null,
            },
            {
              id: 'room-2',
              name: 'Standard B',
              category: 'Standard',
              description: null,
              is_active: true,
              calendar_ids: [],
              pricing_tiers: [],
              stay_discounts: [],
              image_urls: [],
              image_url: null,
              price_per_night: 95,
              pricing_country: null,
              pricing_region: null,
              pricing_city: null,
              pricing_district: null,
            },
          ],
        }) as never}
        formatCurrency={(amount) => `$${amount}`}
      />
    );

    fireEvent.pointerDown(screen.getByRole('combobox', { name: 'All Categories' }));
    fireEvent.click(await screen.findByText('Suite'));

    expect(screen.getByText('Suite A')).toBeInTheDocument();
    expect(screen.queryByText('Standard B')).not.toBeInTheDocument();
  });

  test('shows base price per night when pricing tiers are absent', () => {
    render(
      <RoomsTabContent
        accommodationData={buildAccommodationData({
          rooms: [
            {
              id: 'room-1',
              name: 'Standard 101',
              category: 'Standard',
              description: null,
              is_active: true,
              calendar_ids: [],
              pricing_tiers: [],
              stay_discounts: [],
              image_urls: [],
              image_url: null,
              price_per_night: 89,
              pricing_country: null,
              pricing_region: null,
              pricing_city: null,
              pricing_district: null,
            },
          ],
        }) as never}
        formatCurrency={(amount) => `$${amount}`}
      />
    );

    expect(screen.getByText('$89/night')).toBeInTheDocument();
  });
});
