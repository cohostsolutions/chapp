import { format } from 'date-fns';
import { OperationalExpense } from '@/hooks/useOperationalExpenses';

export function exportExpensesToCSV(
  expenses: OperationalExpense[],
  filename: string = 'expenses'
): void {
  // Define CSV headers
  const headers = [
    'Date',
    'Type',
    'Category',
    'Amount',
    'Room',
    'Vendor',
    'Due Date',
    'Status',
    'Notes',
  ];

  // Format expense data
  const rows = expenses.map((expense) => [
    format(new Date(expense.expense_date), 'yyyy-MM-dd'),
    expense.expense_type,
    expense.category,
    expense.amount.toString(),
    expense.room_unit?.name || 'Organization-wide',
    expense.vendor || '',
    expense.due_date ? format(new Date(expense.due_date), 'yyyy-MM-dd') : '',
    expense.is_paid ? 'Paid' : 'Unpaid',
    expense.notes || '',
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row
        .map((cell) => {
          // Escape cells that contain commas, quotes, or newlines
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(',')
    ),
  ].join('\n');

  // Create and download the file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateExpenseSummary(expenses: OperationalExpense[]): {
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  dailyTotal: number;
  monthlyTotal: number;
  byType: Record<string, number>;
  byRoom: Record<string, number>;
} {
  const summary = {
    totalAmount: 0,
    paidAmount: 0,
    unpaidAmount: 0,
    dailyTotal: 0,
    monthlyTotal: 0,
    byType: {} as Record<string, number>,
    byRoom: {} as Record<string, number>,
  };

  expenses.forEach((expense) => {
    const amount = Number(expense.amount);
    summary.totalAmount += amount;

    if (expense.is_paid) {
      summary.paidAmount += amount;
    } else {
      summary.unpaidAmount += amount;
    }

    if (expense.category === 'daily') {
      summary.dailyTotal += amount;
    } else {
      summary.monthlyTotal += amount;
    }

    // By type
    const type = expense.expense_type;
    summary.byType[type] = (summary.byType[type] || 0) + amount;

    // By room
    const room = expense.room_unit?.name || 'Organization-wide';
    summary.byRoom[room] = (summary.byRoom[room] || 0) + amount;
  });

  return summary;
}
