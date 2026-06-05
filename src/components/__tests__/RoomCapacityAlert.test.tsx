import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { RoomCapacityAlert } from '../accommodation/RoomCapacityAlert';

const mockToast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('RoomCapacityAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders capacity warning without firing a toast during render', () => {
    render(
      <RoomCapacityAlert
        guestCount={4}
        roomCapacity={2}
        roomName="Garden Suite"
      />
    );

    expect(screen.getByText(/garden suite capacity is 2 guests, but you entered 4/i)).toBeInTheDocument();
    expect(screen.getByText(/2 guests cannot be accommodated/i)).toBeInTheDocument();
    expect(mockToast).not.toHaveBeenCalled();
  });

  test('renders full-capacity messaging without firing a toast during render', () => {
    render(
      <RoomCapacityAlert
        guestCount={2}
        roomCapacity={2}
        roomName="Garden Suite"
      />
    );

    expect(screen.getByText(/this booking will fill garden suite to capacity/i)).toBeInTheDocument();
    expect(mockToast).not.toHaveBeenCalled();
  });
});