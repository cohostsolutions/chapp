/**
 * Export utilities for Operations expenses in CSV, Excel, and PDF formats
 */

import { format } from 'date-fns';
import type { OperationalExpense } from '@/hooks/useOperationalExpenses';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { devError } from './logger';

// ==================== CSV Export ====================

export interface ExportOptions {
  includeFiltered?: boolean;
  filename?: string;
  currencySymbol?: string;
}

export function exportExpensesToCSV(
  expenses: OperationalExpense[],
  options: ExportOptions = {}
): void {
  const { filename = 'expenses' } = options;

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
    'Paid At',
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
    expense.paid_at ? format(new Date(expense.paid_at), 'yyyy-MM-dd HH:mm') : '',
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

// ==================== Excel Export ====================

export async function exportExpensesToExcel(
  expenses: OperationalExpense[],
  options: ExportOptions = {}
): Promise<void> {
  const { filename = 'expenses' } = options;

  try {
    // Dynamically import exceljs
    const { Workbook } = await import('exceljs');
    
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Expenses');

    // Define columns
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Type', key: 'type', width: 20 },
      { header: 'Category', key: 'category', width: 12 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Room', key: 'room', width: 20 },
      { header: 'Vendor', key: 'vendor', width: 20 },
      { header: 'Due Date', key: 'dueDate', width: 12 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Paid At', key: 'paidAt', width: 18 },
      { header: 'Notes', key: 'notes', width: 30 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data rows
    expenses.forEach((expense) => {
      worksheet.addRow({
        date: format(new Date(expense.expense_date), 'yyyy-MM-dd'),
        type: expense.expense_type,
        category: expense.category,
        amount: expense.amount,
        room: expense.room_unit?.name || 'Organization-wide',
        vendor: expense.vendor || '',
        dueDate: expense.due_date ? format(new Date(expense.due_date), 'yyyy-MM-dd') : '',
        status: expense.is_paid ? 'Paid' : 'Unpaid',
        paidAt: expense.paid_at ? format(new Date(expense.paid_at), 'yyyy-MM-dd HH:mm') : '',
        notes: expense.notes || '',
      });
    });

    // Add summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    const summary = generateExpenseSummary(expenses);
    
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
    ];

    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    summarySheet.addRows([
      { metric: 'Total Expenses', value: expenses.length },
      { metric: 'Total Amount', value: summary.totalAmount.toFixed(2) },
      { metric: 'Paid Amount', value: summary.paidAmount.toFixed(2) },
      { metric: 'Unpaid Amount', value: summary.unpaidAmount.toFixed(2) },
      { metric: 'Daily Expenses Total', value: summary.dailyTotal.toFixed(2) },
      { metric: 'Monthly Expenses Total', value: summary.monthlyTotal.toFixed(2) },
      { metric: '', value: '' },
      { metric: 'By Type:', value: '' },
      ...Object.entries(summary.byType).map(([type, amount]) => ({
        metric: `  ${type}`,
        value: amount.toFixed(2)
      })),
      { metric: '', value: '' },
      { metric: 'By Room:', value: '' },
      ...Object.entries(summary.byRoom).map(([room, amount]) => ({
        metric: `  ${room}`,
        value: amount.toFixed(2)
      })),
    ]);

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Download
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    devError('Failed to export Excel:', error);
    throw new Error('Excel export failed. Please try CSV format.');
  }
}

// ==================== PDF Export ====================

export function exportExpensesToPDF(
  expenses: OperationalExpense[],
  options: ExportOptions & { 
    title?: string;
    includeAnalytics?: boolean;
  } = {}
): void {
  const { 
    filename = 'expenses',
    title = 'Expense Report',
    includeAnalytics = true,
    currencySymbol = '$'
  } = options;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, 20);

  // Date range
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, margin, 28);
  doc.text(`Total Expenses: ${expenses.length}`, margin, 34);

  let yPos = 45;

  // Summary analytics
  if (includeAnalytics) {
    const summary = generateExpenseSummary(expenses);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Summary', margin, yPos);
    yPos += 10;

    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Amount']],
      body: [
        ['Total Amount', `${currencySymbol}${summary.totalAmount.toFixed(2)}`],
        ['Paid Amount', `${currencySymbol}${summary.paidAmount.toFixed(2)}`],
        ['Unpaid Amount', `${currencySymbol}${summary.unpaidAmount.toFixed(2)}`],
        ['Daily Expenses', `${currencySymbol}${summary.dailyTotal.toFixed(2)}`],
        ['Monthly Expenses', `${currencySymbol}${summary.monthlyTotal.toFixed(2)}`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      margin: { left: margin, right: margin },
      tableWidth: 'auto',
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // By Type breakdown
    if (Object.keys(summary.byType).length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Expenses by Type', margin, yPos);
      yPos += 7;

      autoTable(doc, {
        startY: yPos,
        head: [['Type', 'Amount']],
        body: Object.entries(summary.byType).map(([type, amount]) => [
          type,
          `${currencySymbol}${amount.toFixed(2)}`
        ]),
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        margin: { left: margin, right: margin },
        tableWidth: 'auto',
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // Check if we need a new page
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }
  }

  // Expenses table
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Expense Details', margin, yPos);
  yPos += 7;

  const tableData = expenses.map((expense) => [
    format(new Date(expense.expense_date), 'MMM dd, yyyy'),
    expense.expense_type,
    expense.category,
    `${currencySymbol}${expense.amount.toFixed(2)}`,
    expense.room_unit?.name || 'Org-wide',
    expense.is_paid ? 'Paid' : 'Unpaid',
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Date', 'Type', 'Category', 'Amount', 'Room', 'Status']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: margin, right: margin },
    styles: { fontSize: 9 },
  });

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount} • ${title}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Download
  doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

// ==================== Analytics PDF Export ====================

export function exportAnalyticsToPDF(
  expenses: OperationalExpense[],
  options: ExportOptions & { title?: string } = {}
): void {
  const { 
    filename = 'analytics',
    title = 'Expense Analytics Report',
    currencySymbol = '$'
  } = options;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, margin, 28);
  doc.text(`Analysis Period: All Time`, margin, 34);

  const summary = generateExpenseSummary(expenses);
  let yPos = 50;

  // Overall Summary
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Overall Summary', margin, yPos);
  yPos += 10;

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Value']],
    body: [
      ['Total Expenses', expenses.length.toString()],
      ['Total Amount', `${currencySymbol}${summary.totalAmount.toFixed(2)}`],
      ['Paid Amount', `${currencySymbol}${summary.paidAmount.toFixed(2)}`],
      ['Unpaid Amount', `${currencySymbol}${summary.unpaidAmount.toFixed(2)}`],
      ['Payment Rate', `${expenses.length > 0 ? ((summary.paidAmount / summary.totalAmount) * 100).toFixed(1) : 0}%`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] },
    margin: { left: margin, right: margin },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Category Breakdown
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Category Breakdown', margin, yPos);
  yPos += 10;

  autoTable(doc, {
    startY: yPos,
    head: [['Category', 'Amount', 'Percentage']],
    body: [
      ['Daily Expenses', `${currencySymbol}${summary.dailyTotal.toFixed(2)}`, `${summary.totalAmount > 0 ? ((summary.dailyTotal / summary.totalAmount) * 100).toFixed(1) : 0}%`],
      ['Monthly Expenses', `${currencySymbol}${summary.monthlyTotal.toFixed(2)}`, `${summary.totalAmount > 0 ? ((summary.monthlyTotal / summary.totalAmount) * 100).toFixed(1) : 0}%`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] },
    margin: { left: margin, right: margin },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // By Type
  if (Object.keys(summary.byType).length > 0) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Expenses by Type', margin, yPos);
    yPos += 10;

    const typeData = Object.entries(summary.byType)
      .sort(([, a], [, b]) => b - a)
      .map(([type, amount]) => [
        type,
        `${currencySymbol}${amount.toFixed(2)}`,
        `${summary.totalAmount > 0 ? ((amount / summary.totalAmount) * 100).toFixed(1) : 0}%`
      ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Type', 'Amount', 'Percentage']],
      body: typeData,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // By Room
  if (Object.keys(summary.byRoom).length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Expenses by Room', margin, yPos);
    yPos += 10;

    const roomData = Object.entries(summary.byRoom)
      .sort(([, a], [, b]) => b - a)
      .map(([room, amount]) => [
        room,
        `${currencySymbol}${amount.toFixed(2)}`,
        `${summary.totalAmount > 0 ? ((amount / summary.totalAmount) * 100).toFixed(1) : 0}%`
      ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Room', 'Amount', 'Percentage']],
      body: roomData,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: margin, right: margin },
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount} • ${title}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

// ==================== Helper Functions ====================

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
    if (!summary.byType[expense.expense_type]) {
      summary.byType[expense.expense_type] = 0;
    }
    summary.byType[expense.expense_type] += amount;

    // By room
    const roomName = expense.room_unit?.name || 'Organization-wide';
    if (!summary.byRoom[roomName]) {
      summary.byRoom[roomName] = 0;
    }
    summary.byRoom[roomName] += amount;
  });

  return summary;
}
