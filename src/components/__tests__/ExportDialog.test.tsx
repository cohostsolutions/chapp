import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExportDialog } from '@/components/ExportDialog';
import { CalendarEvent } from '@/hooks/useGoogleCalendar';
import { format, addDays } from 'date-fns';

// Mock dependencies
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const { mockDownload, mockCopy } = vi.hoisted(() => ({
  mockDownload: vi.fn(),
  mockCopy: vi.fn(() => Promise.resolve(true))
}));

vi.mock('@/lib/ics-generator', () => ({
  generateICS: vi.fn(() => `BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR`),
  downloadICS: mockDownload,
  copyICSToClipboard: mockCopy,
  generateICSForDateRange: vi.fn(),
}));

const mockEvents: CalendarEvent[] = [
  {
    id: '1',
    title: 'Test Event',
    description: 'Test Description',
    startTime: '2024-01-15T10:00:00Z',
    endTime: '2024-01-15T11:00:00Z',
    allDay: false,
    attendees: ['test@example.com'],
    calendarId: 'primary',
  },
  {
    id: '2',
    title: 'All Day Event',
    description: 'All day test',
    startTime: '2024-01-15T00:00:00Z',
    endTime: '2024-01-16T00:00:00Z',
    allDay: true,
    calendarId: 'primary',
  },
];

const selectedDate = new Date('2024-01-15T12:00:00Z');

describe('ExportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog when open', () => {
    const onOpenChange = vi.fn();
    render(
      <ExportDialog
        isOpen={true}
        onOpenChange={onOpenChange}
        events={mockEvents}
        selectedDate={selectedDate}
      />
    );

    expect(screen.getByText('Export Events to ICS')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const onOpenChange = vi.fn();
    const { container } = render(
      <ExportDialog
        isOpen={false}
        onOpenChange={onOpenChange}
        events={mockEvents}
        selectedDate={selectedDate}
      />
    );

    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('displays calendar name input', () => {
    const onOpenChange = vi.fn();
    render(
      <ExportDialog
        isOpen={true}
        onOpenChange={onOpenChange}
        events={mockEvents}
        selectedDate={selectedDate}
      />
    );

    const input = screen.getByDisplayValue('My Calendar') as HTMLInputElement;
    expect(input).toBeInTheDocument();
  });

  it('shows event count for today tab', async () => {
    const onOpenChange = vi.fn();
    render(
      <ExportDialog
        isOpen={true}
        onOpenChange={onOpenChange}
        events={mockEvents}
        selectedDate={selectedDate}
      />
    );

    // Click Today tab
    const todayTab = screen.getByRole('tab', { name: /Today/ });
    fireEvent.mouseDown(todayTab);
    fireEvent.click(todayTab);

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const count = mockEvents.filter((event) => event.startTime.startsWith(dateStr)).length;
    const expected = new RegExp(`${count} event${count !== 1 ? 's' : ''} on`);

    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  it('shows event count for all events', () => {
    const onOpenChange = vi.fn();
    render(
      <ExportDialog
        isOpen={true}
        onOpenChange={onOpenChange}
        events={mockEvents}
        selectedDate={selectedDate}
      />
    );

    // Click All tab
    const allTab = screen.getByRole('tab', { name: /All/ });
    fireEvent.click(allTab);

    expect(screen.getByText(/All 2 events will be exported/)).toBeInTheDocument();
  });

  it('displays download button', () => {
    const onOpenChange = vi.fn();
    render(
      <ExportDialog
        isOpen={true}
        onOpenChange={onOpenChange}
        events={mockEvents}
        selectedDate={selectedDate}
      />
    );

    const downloadBtn = screen.getByRole('button', { name: /Download/ });
    expect(downloadBtn).toBeInTheDocument();
  });

  it('displays copy button', () => {
    const onOpenChange = vi.fn();
    render(
      <ExportDialog
        isOpen={true}
        onOpenChange={onOpenChange}
        events={mockEvents}
        selectedDate={selectedDate}
      />
    );

    const copyBtn = screen.getByRole('button', { name: /Copy/ });
    expect(copyBtn).toBeInTheDocument();
  });

  it('allows changing calendar name', () => {
    const onOpenChange = vi.fn();
    render(
      <ExportDialog
        isOpen={true}
        onOpenChange={onOpenChange}
        events={mockEvents}
        selectedDate={selectedDate}
      />
    );

    const input = screen.getByDisplayValue('My Calendar') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Work Calendar' } });

    expect(input.value).toBe('Work Calendar');
  });

  it('shows empty state when no events for selected range', () => {
    const onOpenChange = vi.fn();
    render(
      <ExportDialog
        isOpen={true}
        onOpenChange={onOpenChange}
        events={[]}
        selectedDate={selectedDate}
      />
    );

    expect(screen.getByText(/0 events ready to export/)).toBeInTheDocument();
  });
});
