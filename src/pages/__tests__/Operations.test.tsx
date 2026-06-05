import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Operations from '../Operations';

const fetchExpensesMock = vi.fn();
const createExpenseMock = vi.fn();
const checkConnectionMock = vi.fn();
const listCalendarsMock = vi.fn();
const listEventsMock = vi.fn();
const syncCalendarsMock = vi.fn();

let mockAiAgentType: 'cece' | 'jay' | 'may' = 'cece';

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: 'user-1', organization_id: 'org-1' },
    aiAgentType: mockAiAgentType,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: vi.fn().mockResolvedValue({ data: [{ id: 'room-1', name: 'Room 1' }], error: null }),
          }),
        }),
      }),
    }),
  },
}));

vi.mock('@/hooks/useGoogleCalendar', () => ({
  useGoogleCalendar: () => ({
    checkConnection: checkConnectionMock,
    listCalendars: listCalendarsMock,
    listEvents: listEventsMock,
    createEvent: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useCalendarSync', () => ({
  useCalendarSync: () => ({
    syncCalendars: syncCalendarsMock,
    isSyncing: false,
  }),
}));

vi.mock('@/hooks/useOperationalExpenses', () => ({
  useOperationalExpenses: () => ({
    expenses: [
      {
        id: 'expense-1',
        organization_id: 'org-1',
        room_unit_id: null,
        category: 'daily',
        expense_type: 'Cleaning',
        amount: 100,
        expense_date: '2026-06-01',
        due_date: null,
        is_paid: false,
        paid_at: null,
        notes: null,
        vendor: null,
        calendar_event_id: null,
        expense_calendar_event_id: null,
        is_recurring: false,
        recurrence_pattern: null,
        recurrence_day_of_week: null,
        recurrence_day_of_month: null,
        parent_expense_id: null,
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
        created_by: 'user-1',
      },
    ],
    loading: false,
    saving: false,
    summary: {},
    unsyncedCount: 0,
    fetchExpenses: fetchExpensesMock,
    createExpense: createExpenseMock,
    updateExpense: vi.fn(),
    markAsPaid: vi.fn(),
    markAsUnpaid: vi.fn(),
    deleteExpense: vi.fn(),
    syncExpensesToCalendar: vi.fn(),
  }),
}));

vi.mock('@/hooks/useMaintenanceBlocks', () => ({
  useMaintenanceBlocks: () => ({
    blocks: [],
    loading: false,
    saving: false,
    createBlock: vi.fn(),
    updateBlock: vi.fn(),
    deleteBlock: vi.fn(),
  }),
}));

vi.mock('@/hooks/useMultiCurrency', () => ({
  useFormatCurrency: () => (amount: number) => `$${amount.toFixed(2)}`,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/components/operations/ExpenseSummaryCards', () => ({
  ExpenseSummaryCards: () => <div data-testid="expense-summary-cards" />,
}));

vi.mock('@/components/operations/ExpenseList', () => ({
  ExpenseList: () => <div data-testid="expense-list" />,
}));

vi.mock('@/components/operations/ExpenseBreakdownChart', () => ({
  ExpenseBreakdownChart: () => <div data-testid="expense-breakdown-chart" />,
}));

vi.mock('@/components/operations/AllExpensesDialog', () => ({
  AllExpensesDialog: () => <div data-testid="all-expenses-dialog" />,
}));

vi.mock('@/components/operations/PeriodFilter', () => ({
  PeriodFilter: () => <div data-testid="period-filter" />,
  getDateRangeFromPeriod: () => ({ start: undefined, end: undefined }),
}));

vi.mock('@/components/operations/OperationsExportImport', () => ({
  OperationsExportImport: () => <div data-testid="operations-export-import" />,
}));

vi.mock('@/components/operations/MaintenanceBlocksList', () => ({
  MaintenanceBlocksList: () => <div data-testid="maintenance-blocks-list" />,
}));

vi.mock('@/components/operations/AddOperationalEventDialog', () => ({
  AddOperationalEventDialog: () => <div data-testid="add-operational-event-dialog" />,
}));

vi.mock('@/components/operations/EditMaintenanceBlockDialog', () => ({
  EditMaintenanceBlockDialog: () => <div data-testid="edit-maintenance-dialog" />,
}));

vi.mock('@/components/operations/DayEventsDialog', () => ({
  DayEventsDialog: () => <div data-testid="day-events-dialog" />,
}));

vi.mock('@/components/operations/EventDetailDialog', () => ({
  EventDetailDialog: () => <div data-testid="event-detail-dialog" />,
}));

vi.mock('@/components/operations/EditExpenseDialog', () => ({
  EditExpenseDialog: () => <div data-testid="edit-expense-dialog" />,
}));

vi.mock('@/components/operations/AddExpenseDialog', () => ({
  AddExpenseDialog: ({ open }: { open: boolean }) => (
    <div data-testid="add-expense-dialog-state">{open ? 'open' : 'closed'}</div>
  ),
}));

describe('Operations header actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAiAgentType = 'cece';
    checkConnectionMock.mockResolvedValue({ connected: false });
    listCalendarsMock.mockResolvedValue([]);
    listEventsMock.mockResolvedValue([]);
  });

  test('renders restricted state for non-Cece organizations', () => {
    mockAiAgentType = 'jay';

    render(<Operations />);

    expect(screen.getByText('This page is only available for Cece AI organizations (hotels/vacation rentals).')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
  });

  test('refresh action refetches expenses', async () => {
    const user = userEvent.setup();
    render(<Operations />);

    await waitFor(() => expect(checkConnectionMock).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(fetchExpensesMock).toHaveBeenCalledTimes(1);
  });

  test('refresh action reloads calendar data when connected', async () => {
    const user = userEvent.setup();
    checkConnectionMock.mockResolvedValue({ connected: true });

    render(<Operations />);

    await waitFor(() => {
      expect(listCalendarsMock).toHaveBeenCalled();
      expect(listEventsMock).toHaveBeenCalled();
    });

    listCalendarsMock.mockClear();
    listEventsMock.mockClear();
    fetchExpensesMock.mockClear();

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(fetchExpensesMock).toHaveBeenCalledTimes(1);
      expect(listCalendarsMock).toHaveBeenCalledTimes(1);
      expect(listEventsMock).toHaveBeenCalledTimes(1);
    });
  });

  test('add expense action opens add expense dialog', async () => {
    const user = userEvent.setup();
    render(<Operations />);

    expect(screen.getByTestId('add-expense-dialog-state')).toHaveTextContent('closed');

    await user.click(screen.getByRole('button', { name: 'Add Expense' }));

    expect(screen.getByTestId('add-expense-dialog-state')).toHaveTextContent('open');
  });

  test('renders export and import control in header actions', () => {
    render(<Operations />);

    expect(screen.getByTestId('operations-export-import')).toBeInTheDocument();
  });
});