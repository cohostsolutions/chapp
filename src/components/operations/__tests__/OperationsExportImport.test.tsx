import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OperationsExportImport } from '@/components/operations/OperationsExportImport';

const toastMock = vi.fn();
const exportCsvMock = vi.fn();
const exportExcelMock = vi.fn();
const exportPdfExpensesMock = vi.fn();
const exportPdfAnalyticsMock = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/hooks/useMultiCurrency', () => ({
  useCurrencySymbol: () => '$',
}));

vi.mock('@/lib/operationsExport', () => ({
  exportExpensesToCSV: exportCsvMock,
  exportExpensesToExcel: exportExcelMock,
  exportExpensesToPDF: exportPdfExpensesMock,
  exportAnalyticsToPDF: exportPdfAnalyticsMock,
}));

vi.mock('@/components/operations/ExpenseImportDialog', () => ({
  ExpenseImportDialog: ({ open, onImport }: { open: boolean; onImport: (expenses: unknown[]) => Promise<void> }) => {
    if (!open) return null;
    return (
      <div data-testid="mock-import-dialog">
        <button
          type="button"
          onClick={() => {
            void onImport([
              {
                expense_date: '2026-06-01',
                expense_type: 'Imported Expense',
                category: 'daily',
                amount: 55,
                is_paid: false,
              },
            ]);
          }}
        >
          Complete Import
        </button>
      </div>
    );
  },
}));

describe('OperationsExportImport', () => {
  const allExpenses = [
    {
      id: 'expense-1',
      organization_id: 'org-1',
      room_unit_id: null,
      category: 'daily' as const,
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
      created_by: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    exportExcelMock.mockResolvedValue(undefined);
  });

  test('exports filtered expenses to CSV from header control', async () => {
    const user = userEvent.setup();

    render(
      <OperationsExportImport
        allExpenses={allExpenses}
        filteredExpenses={allExpenses}
        onImportComplete={vi.fn().mockResolvedValue(undefined)}
        filenamePrefix="operations"
      />
    );

    await user.click(screen.getByRole('button', { name: /export/i }));
    await user.click(screen.getByText('Export as CSV'));
    await user.click(screen.getByRole('button', { name: /^Export$/ }));

    expect(exportCsvMock).toHaveBeenCalledWith(
      allExpenses,
      expect.objectContaining({ filename: 'operations_filtered' })
    );
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Export complete' })
    );
  });

  test('shows no-data error when filtered export has no rows', async () => {
    const user = userEvent.setup();

    render(
      <OperationsExportImport
        allExpenses={allExpenses}
        filteredExpenses={[]}
        onImportComplete={vi.fn().mockResolvedValue(undefined)}
        filenamePrefix="operations"
      />
    );

    await user.click(screen.getByRole('button', { name: /export/i }));
    await user.click(screen.getByText('Export as CSV'));
    await user.click(screen.getByRole('button', { name: /^Export$/ }));

    expect(exportCsvMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'No data to export',
        variant: 'destructive',
      })
    );
  });

  test('imports expenses via import action and reports success', async () => {
    const user = userEvent.setup();
    const onImportComplete = vi.fn().mockResolvedValue(undefined);

    render(
      <OperationsExportImport
        allExpenses={allExpenses}
        filteredExpenses={allExpenses}
        onImportComplete={onImportComplete}
      />
    );

    await user.click(screen.getByRole('button', { name: /import/i }));
    await user.click(screen.getByRole('button', { name: 'Complete Import' }));

    await waitFor(() => {
      expect(onImportComplete).toHaveBeenCalledTimes(1);
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Import complete' })
      );
    });
  });
});