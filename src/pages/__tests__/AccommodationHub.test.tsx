import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import AccommodationHub from '../AccommodationHub';

const mockSetSelectedPropertyId = vi.fn();
const mockRefetchAll = vi.fn();
const mockSyncCalendars = vi.fn().mockResolvedValue(undefined);
const mockSyncBooking = vi.fn().mockResolvedValue({ success: true });
const mockDeleteCalendarEvent = vi.fn().mockResolvedValue(undefined);

const accommodationData = {
  properties: [
    { id: 'property-1', name: 'Beach Villa' },
    { id: 'property-2', name: 'City Loft' },
  ],
  rooms: [],
  bookings: [],
  allBookingsWithExternal: [],
  filteredBookings: [],
  availabilityBookings: [],
  calendarEvents: [],
  allCalendarEvents: [],
  calendarDays: [],
  stats: {
    pending: 0,
    upcoming: 0,
    checkedIn: 0,
    arrivingToday: 0,
    departingToday: 0,
    totalRooms: 0,
    activeRooms: 0,
    occupiedToday: 0,
    totalCapacity: 0,
    roomsWithCalendar: 0,
    roomsWithoutCalendar: 0,
  },
  orphanLeads: [],
  isLoading: false,
  propertiesLoading: false,
  roomsLoading: false,
  bookingsLoading: false,
  calendarEventsLoading: false,
  allCalendarEventsLoading: false,
  orphanLeadsLoading: false,
  selectedPropertyId: 'all',
  setSelectedPropertyId: mockSetSelectedPropertyId,
  filters: {
    searchTerm: '',
    searchScope: 'all',
    statusFilter: 'all',
    roomFilter: 'all',
    dateFilter: 'upcoming',
    customDateRange: { from: undefined, to: undefined },
    sortOption: 'check_in_asc',
  },
  updateFilters: vi.fn(),
  resetFilters: vi.fn(),
  currentDate: new Date('2026-04-04T00:00:00Z'),
  setCurrentDate: vi.fn(),
  viewMode: 'week',
  setViewMode: vi.fn(),
  createBooking: vi.fn(),
  updateBooking: vi.fn(),
  deleteBooking: vi.fn(),
  createRoom: vi.fn(),
  updateRoom: vi.fn(),
  deleteRoom: vi.fn(),
  isCreatingBooking: false,
  isUpdatingBooking: false,
  isDeletingBooking: false,
  isCreatingRoom: false,
  isUpdatingRoom: false,
  isDeletingRoom: false,
  refetchAll: mockRefetchAll,
  getRoomPricing: vi.fn(),
  checkBookingOverlap: vi.fn(() => false),
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ aiAgentType: null }),
}));

vi.mock('@/hooks/useAccommodationData', () => ({
  useAccommodationData: () => accommodationData,
}));

vi.mock('@/hooks/useCalendarSync', () => ({
  useCalendarSync: () => ({ syncCalendars: mockSyncCalendars, isSyncing: false }),
}));

vi.mock('@/hooks/useBookingCalendarSync', () => ({
  useBookingCalendarSync: () => ({
    syncBooking: mockSyncBooking,
    deleteCalendarEvent: mockDeleteCalendarEvent,
    isSyncing: false,
  }),
}));

vi.mock('@/hooks/useMultiCurrency', () => ({
  useFormatCurrency: () => (amount: number) => `$${amount}`,
}));

vi.mock('@/components/accommodation/BookingsTabContent', () => ({
  default: () => <div>Bookings Tab Mock</div>,
}));

vi.mock('@/components/accommodation/RoomsTabContent', () => ({
  default: () => <div>Rooms Tab Mock</div>,
}));

vi.mock('@/components/accommodation/AvailabilityTabContent', () => ({
  default: () => <div>Availability Tab Mock</div>,
}));

vi.mock('@/components/accommodation/AnalyticsTabContent', () => ({
  AnalyticsTabContent: ({ propertyName }: { propertyName: string }) => <div>Analytics for {propertyName}</div>,
}));

describe('AccommodationHub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('keeps the all-properties selection visible after data loads', async () => {
    render(
      <MemoryRouter initialEntries={['/accommodation?tab=analytics']}>
        <AccommodationHub />
      </MemoryRouter>
    );

    expect(await screen.findByText('Analytics for All Properties')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveTextContent('All properties');
  });

  test('switches the selected property from the page selector', async () => {
    render(
      <MemoryRouter initialEntries={['/accommodation?tab=analytics']}>
        <AccommodationHub />
      </MemoryRouter>
    );

    fireEvent.pointerDown(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('Beach Villa'));

    await waitFor(() => {
      expect(mockSetSelectedPropertyId).toHaveBeenCalledWith('property-1');
    });
  });
});