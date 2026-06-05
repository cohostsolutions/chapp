import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { addDays, format } from 'date-fns';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import AvailabilityTabContent from '../AvailabilityTabContent';

const mockToast = vi.fn();
const mockRefetchAll = vi.fn();

let leadLookupResponse: { data: Array<{ id: string }>; error: unknown } = { data: [], error: null };
const mockLeadsInsert = vi.fn();
const mockLeadsDeleteEq = vi.fn();
const mockBookingsInsert = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { organization_id: 'org-1' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/hooks/useUndoableAction', () => ({
  useUndoableAction: () => ({ execute: vi.fn() }),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/hooks/useOrganizationPhone', () => ({
  useOrganizationPhone: () => ({ defaultCountryCode: '+63', phonePlaceholder: '+63 912 345 6789' }),
}));

vi.mock('@/hooks/useBookingConflicts', () => ({
  useBookingConflicts: () => ({ hasConflicts: false, conflicts: [] }),
}));

vi.mock('@/lib/phone', () => ({
  normalizePhoneNumber: (value: string) => value.trim(),
  isValidPhoneNumber: () => true,
  getPhoneValidationMessage: () => 'Invalid phone number',
}));

vi.mock('@/components/leads/ClickableLeadName', () => ({
  ClickableLeadName: ({ lead }: { lead: { name: string } }) => <span>{lead.name}</span>,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'leads') {
        const selectBuilder = {
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn(async () => leadLookupResponse),
        };

        return {
          select: vi.fn(() => selectBuilder),
          insert: mockLeadsInsert,
          delete: vi.fn(() => ({ eq: mockLeadsDeleteEq })),
          update: vi.fn(() => ({ eq: vi.fn() })),
        };
      }

      if (table === 'bookings') {
        return {
          insert: mockBookingsInsert,
          update: vi.fn(() => ({ eq: vi.fn() })),
          delete: vi.fn(() => ({ eq: vi.fn() })),
        };
      }

      return {
        select: vi.fn(() => ({ eq: vi.fn().mockReturnThis(), limit: vi.fn(async () => ({ data: [], error: null })) })),
        insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: null, error: null })) })) })),
        update: vi.fn(() => ({ eq: vi.fn() })),
        delete: vi.fn(() => ({ eq: vi.fn() })),
      };
    },
  },
}));

function makeAccommodationData(overrides: Record<string, unknown> = {}) {
  const today = new Date();
  const day = addDays(today, 1);

  return {
    rooms: [
      {
        id: 'room-1',
        name: 'Room 101',
        capacity: 2,
        is_active: true,
        property_id: 'property-1',
      },
    ],
    availabilityBookings: [],
    calendarDays: [day],
    stats: {},
    isLoading: false,
    currentDate: day,
    setCurrentDate: vi.fn(),
    viewMode: 'day',
    setViewMode: vi.fn(),
    refetchAll: mockRefetchAll,
    selectedPropertyId: 'property-1',
    properties: [{ id: 'property-1', name: 'Main Property' }],
    ...overrides,
  };
}

describe('AvailabilityTabContent targeted behaviors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leadLookupResponse = { data: [], error: null };

    mockLeadsInsert.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { id: 'new-lead-id' }, error: null })),
      })),
    });

    mockBookingsInsert.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { id: 'booking-1' }, error: null })),
      })),
    });
  });

  test('external calendar bookings are view-only in booking details', async () => {
    const today = new Date();
    const checkIn = addDays(today, 1);
    const checkOut = addDays(today, 3);

    render(
      <AvailabilityTabContent
        accommodationData={makeAccommodationData({
          availabilityBookings: [
            {
              id: 'external-1',
              room_unit_id: 'room-1',
              check_in: format(checkIn, 'yyyy-MM-dd'),
              check_out: format(checkOut, 'yyyy-MM-dd'),
              status: 'external',
              isExternal: true,
              guest_name: 'External Guest',
              lead: null,
              room: { name: 'Room 101' },
            },
          ],
          calendarDays: [checkIn],
          currentDate: checkIn,
        }) as never}
        formatCurrency={(amount) => `$${amount}`}
      />
    );

    fireEvent.click(screen.getByLabelText('Open booking External Guest'));

    expect(await screen.findByText('External (view-only)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  test('reuses existing lead by phone before creating booking', async () => {
    const today = new Date();
    const bookingDay = addDays(today, 1);
    const dateKey = format(bookingDay, 'yyyy-MM-dd');

    leadLookupResponse = { data: [{ id: 'existing-lead-id' }], error: null };

    render(
      <AvailabilityTabContent
        accommodationData={makeAccommodationData({
          calendarDays: [bookingDay],
          currentDate: bookingDay,
        }) as never}
        formatCurrency={(amount) => `$${amount}`}
      />
    );

    fireEvent.click(screen.getByTestId(`availability-add-room-1-${dateKey}`));

    fireEvent.change(screen.getByLabelText('Guest Name *'), {
      target: { value: 'Test Guest' },
    });

    fireEvent.change(screen.getByLabelText('Phone Number'), {
      target: { value: '+63 912 345 6789' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Booking' }));

    await waitFor(() => {
      expect(mockBookingsInsert).toHaveBeenCalled();
    });

    expect(mockLeadsInsert).not.toHaveBeenCalled();

    const bookingInsertPayload = mockBookingsInsert.mock.calls[0][0];
    expect(bookingInsertPayload.lead_id).toBe('existing-lead-id');
  });

  test('requires phone or email before creating booking', async () => {
    const today = new Date();
    const bookingDay = addDays(today, 1);
    const dateKey = format(bookingDay, 'yyyy-MM-dd');

    render(
      <AvailabilityTabContent
        accommodationData={makeAccommodationData({
          calendarDays: [bookingDay],
          currentDate: bookingDay,
        }) as never}
        formatCurrency={(amount) => `$${amount}`}
      />
    );

    fireEvent.click(screen.getByTestId(`availability-add-room-1-${dateKey}`));

    fireEvent.change(screen.getByLabelText('Guest Name *'), {
      target: { value: 'Test Guest' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Booking' }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Contact required',
      }));
    });

    expect(mockLeadsInsert).not.toHaveBeenCalled();
    expect(mockBookingsInsert).not.toHaveBeenCalled();
  });

  test('reuses existing lead by email when phone is not provided', async () => {
    const today = new Date();
    const bookingDay = addDays(today, 1);
    const dateKey = format(bookingDay, 'yyyy-MM-dd');

    leadLookupResponse = { data: [{ id: 'existing-email-lead-id' }], error: null };

    render(
      <AvailabilityTabContent
        accommodationData={makeAccommodationData({
          calendarDays: [bookingDay],
          currentDate: bookingDay,
        }) as never}
        formatCurrency={(amount) => `$${amount}`}
      />
    );

    fireEvent.click(screen.getByTestId(`availability-add-room-1-${dateKey}`));

    fireEvent.change(screen.getByLabelText('Guest Name *'), {
      target: { value: 'Email Guest' },
    });

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'guest@example.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Booking' }));

    await waitFor(() => {
      expect(mockBookingsInsert).toHaveBeenCalled();
    });

    expect(mockLeadsInsert).not.toHaveBeenCalled();
    const bookingInsertPayload = mockBookingsInsert.mock.calls[0][0];
    expect(bookingInsertPayload.lead_id).toBe('existing-email-lead-id');
  });

  test('does not allow creating bookings on past dates', () => {
    const today = new Date();
    const pastDay = addDays(today, -1);

    render(
      <AvailabilityTabContent
        accommodationData={makeAccommodationData({
          calendarDays: [pastDay],
          currentDate: pastDay,
        }) as never}
        formatCurrency={(amount) => `$${amount}`}
      />
    );

    const dateKey = format(pastDay, 'yyyy-MM-dd');
    expect(screen.queryByTestId(`availability-add-room-1-${dateKey}`)).not.toBeInTheDocument();
  });
});
