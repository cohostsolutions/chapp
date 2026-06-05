import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import BookingsTabContent from '../BookingsTabContent';

const mockToast = vi.fn();
const mockUpdateFilters = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { organization_id: 'org-1' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/hooks/useOrganizationPhone', () => ({
  useOrganizationPhone: () => ({ defaultCountryCode: '+1', phonePlaceholder: 'Phone' }),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/hooks/useUndoableAction', () => ({
  useUndoableAction: () => ({ executeUndoable: vi.fn() }),
}));

vi.mock('@/hooks/usePricingMarketProfiles', () => ({
  usePricingMarketProfiles: () => ({ activeProfiles: [] }),
}));

vi.mock('@/hooks/useDeletedBookingArchives', () => ({
  useDeletedBookingArchives: () => ({
    archives: [],
    restoreArchive: { isPending: false, mutateAsync: vi.fn() },
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useFilterPresets', () => ({
  useFilterPresets: () => ({
    presets: [],
    defaultPreset: null,
    savePreset: vi.fn(),
  }),
}));

vi.mock('@/hooks/useBookingNotes', () => ({
  useBookingNotes: () => ({ addNoteHistory: vi.fn(), history: [] }),
}));

vi.mock('@/components/conversations/ConversationDateFilter', () => ({
  ConversationDateFilter: () => <div>ConversationDateFilterMock</div>,
}));

vi.mock('@/components/leads/ClickableLeadName', () => ({
  ClickableLeadName: ({ lead }: { lead: { name: string } }) => <span>{lead.name}</span>,
}));

vi.mock('@/components/accommodation/CreateBookingDialog', () => ({
  CreateBookingDialog: () => null,
}));

vi.mock('@/components/bookings/LinkGuestConversationDialog', () => ({
  LinkGuestConversationDialog: () => null,
}));

vi.mock('@/components/accommodation/DynamicPricingSuggestion', () => ({
  DynamicPricingSuggestionComponent: () => null,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn() })),
      delete: vi.fn(() => ({ eq: vi.fn() })),
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn() })) })),
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })),
      in: vi.fn(),
    })),
    rpc: vi.fn(),
  },
}));

function makeAccommodationData(overrides: Record<string, unknown> = {}) {
  return {
    properties: [{ id: 'property-1', name: 'Main Property' }],
    rooms: [{ id: 'room-1', name: 'Room 101', is_active: true }],
    bookings: [],
    allBookingsWithExternal: [],
    orphanLeads: [],
    filters: {
      searchTerm: '',
      searchScope: 'all',
      statusFilter: 'all',
      roomFilter: 'all',
      dateFilter: 'upcoming',
      customDateRange: { from: undefined, to: undefined },
      sortOption: 'check_in_asc',
    },
    updateFilters: mockUpdateFilters,
    resetFilters: vi.fn(),
    selectedPropertyId: 'property-1',
    isLoading: false,
    isUpdatingBooking: false,
    refetchAll: vi.fn(),
    checkBookingOverlap: vi.fn(() => false),
    ...overrides,
  };
}

const defaultProps = {
  syncBooking: vi.fn(),
  deleteCalendarEvent: vi.fn(),
  isSyncing: false,
  formatCurrency: (amount: number) => `$${amount}`,
};

describe('BookingsTabContent targeted behaviors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  test('debounces search input updates', async () => {
    vi.useFakeTimers();

    render(
      <BookingsTabContent
        accommodationData={makeAccommodationData() as never}
        {...defaultProps}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search all fields...');
    fireEvent.change(searchInput, { target: { value: 'garcia' } });

    expect(mockUpdateFilters).not.toHaveBeenCalledWith({ searchTerm: 'garcia' });

    vi.advanceTimersByTime(299);
    expect(mockUpdateFilters).not.toHaveBeenCalledWith({ searchTerm: 'garcia' });

    vi.advanceTimersByTime(1);

    await waitFor(() => {
      expect(mockUpdateFilters).toHaveBeenCalledWith({ searchTerm: 'garcia' });
    });
  });

  test('shows external-only booking content instead of empty-state card', async () => {
    render(
      <BookingsTabContent
        accommodationData={makeAccommodationData({
          bookings: [],
          allBookingsWithExternal: [
            {
              id: 'external-1',
              room_unit_id: 'room-1',
              check_in: '2026-06-10',
              check_out: '2026-06-12',
              status: 'external',
              isExternal: true,
              lead: null,
              room: { name: 'Room 101' },
              guest_name: 'Airbnb Guest',
              created_at: '2026-06-01T00:00:00.000Z',
            },
          ],
        }) as never}
        {...defaultProps}
      />
    );

    expect(screen.queryByText('No bookings yet')).not.toBeInTheDocument();
    expect(screen.getByText('Room 101')).toBeInTheDocument();
  });

  test('batch status dialog uses accommodation statuses and excludes external', async () => {
    render(
      <BookingsTabContent
        accommodationData={makeAccommodationData({
          bookings: [
            {
              id: 'booking-1',
              room_unit_id: 'room-1',
              check_in: '2026-06-10',
              check_out: '2026-06-12',
              status: 'pending',
              isExternal: false,
              lead: { name: 'Jane Doe' },
              room: { name: 'Room 101' },
              created_at: '2026-06-01T00:00:00.000Z',
            },
          ],
          allBookingsWithExternal: [
            {
              id: 'booking-1',
              room_unit_id: 'room-1',
              check_in: '2026-06-10',
              check_out: '2026-06-12',
              status: 'pending',
              isExternal: false,
              lead: { name: 'Jane Doe' },
              room: { name: 'Room 101' },
              created_at: '2026-06-01T00:00:00.000Z',
            },
          ],
        }) as never}
        {...defaultProps}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    fireEvent.click(await screen.findByRole('button', { name: 'Change Status' }));

    const statusTrigger = screen.getByLabelText('New Status');
    fireEvent.pointerDown(statusTrigger);

    expect(await screen.findByText('New')).toBeInTheDocument();
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.queryByText('External')).not.toBeInTheDocument();
  });

  test('disables New Booking when writable property context cannot be resolved', () => {
    render(
      <BookingsTabContent
        accommodationData={makeAccommodationData({
          selectedPropertyId: 'all',
          properties: [],
          rooms: [{ id: 'room-1', name: 'Room 101', is_active: true, property_id: null }],
        }) as never}
        {...defaultProps}
      />
    );

    expect(screen.getByRole('button', { name: 'New Booking' })).toBeDisabled();
  });
});
