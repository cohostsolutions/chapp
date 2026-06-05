/**
 * Export utilities for downloading data as CSV or Excel
 * 
 * For Excel support, uses exceljs library
 * 
 * SECURITY: File validation is performed on all imports
 */

import { validateFileUpload } from './fileValidation';
import { AuditLogger } from './auditLogger';
import { devError } from './logger';

/**
 * Convert array of objects to CSV string
 */
export function convertToCSV<T extends Record<string, unknown>>(data: T[], columns?: Array<keyof T | string>): string {
  if (data.length === 0) return '';

  // Get headers
  const headers = columns ? columns.map(String) : Object.keys(data[0]);
  
  // Build CSV rows
  const rows = data.map((item) =>
    headers
      .map((header) => {
        const raw = (item as Record<string, unknown>)[header];

        // Handle null/undefined
        if (raw === null || raw === undefined) return '';

        const value = String(raw);

        // Escape quotes and wrap in quotes if contains comma, newline, or quote
        if (value.includes(',') || value.includes('\n') || value.includes('"')) {
          return `"${value.replace(/"/g, '""')}"`;
        }

        return value;
      })
      .join(',')
  );
  
  // Combine headers and rows
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Download CSV file
 */
export function downloadCSV<T extends Record<string, unknown>>(data: T[], filename: string, columns?: Array<keyof T | string>) {
  const csv = convertToCSV(data, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Download Excel file (requires exceljs library)
 */
export async function downloadExcel<T extends Record<string, unknown>>(data: T[], filename: string, sheetName = 'Sheet1') {
  try {
    // Import exceljs
    const { Workbook } = await import('exceljs');
    
    // Create workbook
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet(sheetName);
    
    // Add headers from first item
    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      worksheet.columns = headers.map(header => ({
        header: header,
        key: header,
        width: 20
      }));
      
      // Add data rows
      data.forEach(item => {
        worksheet.addRow(item);
      });
    }
    
    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Download
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    downloadBlob(blob, `${filename}.xlsx`);
  } catch (error) {
    devError('Failed to export Excel. Make sure exceljs is installed:', error);
    // Fallback to CSV
    downloadCSV(data, filename);
  }
}

/**
 * Download JSON file
 */
export function downloadJSON(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, `${filename}.json`);
}

/**
 * Helper to trigger file download
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Export leads data with formatted columns
 */
type LeadExport = {
  name: string;
  email?: string;
  phone?: string;
  status: string;
  source?: string;
  lead_temperature?: string;
  assigned_agent?: { full_name?: string; email?: string };
  notes?: string;
  created_at: string | number | Date;
  updated_at: string | number | Date;
};

export function exportLeads(leads: LeadExport[], format: 'csv' | 'excel' = 'csv') {
  const formattedData = leads.map((lead) => ({
    Name: lead.name,
    Email: lead.email || '',
    Phone: lead.phone || '',
    Status: lead.status,
    Source: lead.source || '',
    Temperature: lead.lead_temperature || '',
    'Assigned Agent': lead.assigned_agent?.full_name || lead.assigned_agent?.email || 'Unassigned',
    Notes: lead.notes || '',
    'Created At': new Date(lead.created_at).toLocaleString(),
    'Updated At': new Date(lead.updated_at).toLocaleString(),
  }));

  const filename = `leads_export_${new Date().toISOString().split('T')[0]}`;
  
  if (format === 'excel') {
    downloadExcel(formattedData, filename);
  } else {
    downloadCSV(formattedData, filename);
  }
}

/**
 * Export orders data
 */
type OrderExport = {
  id: string;
  lead?: { name?: string };
  total_amount?: number;
  status: string;
  pickup_name?: string;
  pickup_time?: string | number | Date | null;
  notes?: string;
  created_at: string | number | Date;
};

export function exportOrders(orders: OrderExport[], format: 'csv' | 'excel' = 'csv') {
  const formattedData = orders.map((order) => ({
    'Order ID': order.id,
    'Lead Name': order.lead?.name || '',
    'Total Amount': order.total_amount || 0,
    Status: order.status,
    'Pickup Name': order.pickup_name || '',
    'Pickup Time': order.pickup_time ? new Date(order.pickup_time).toLocaleString() : '',
    Notes: order.notes || '',
    'Created At': new Date(order.created_at).toLocaleString(),
  }));

  const filename = `orders_export_${new Date().toISOString().split('T')[0]}`;
  
  if (format === 'excel') {
    downloadExcel(formattedData, filename);
  } else {
    downloadCSV(formattedData, filename);
  }
}

/**
 * Export conversations data
 */
type ConversationExport = {
  lead?: { name?: string };
  status: string;
  message_count?: number;
  last_message_at?: string | number | Date | null;
  created_at: string | number | Date;
};

export function exportConversations(conversations: ConversationExport[], format: 'csv' | 'excel' = 'csv') {
  const formattedData = conversations.map((conv) => ({
    'Lead Name': conv.lead?.name || '',
    Status: conv.status,
    'Message Count': conv.message_count || 0,
    'Last Message': conv.last_message_at ? new Date(conv.last_message_at).toLocaleString() : '',
    'Created At': new Date(conv.created_at).toLocaleString(),
  }));

  const filename = `conversations_export_${new Date().toISOString().split('T')[0]}`;
  
  if (format === 'excel') {
    downloadExcel(formattedData, filename);
  } else {
    downloadCSV(formattedData, filename);
  }
}

/**
 * Parse CSV file to JSON
 */
export function parseCSV(csvString: string): Record<string, string>[] {
  const lines = csvString.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const data: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    data.push(row);
  }

  return data;
}

/**
 * Read file as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/**
 * Import CSV file
 * SECURITY: Validates file before processing
 */
export async function importCSV(file: File): Promise<Record<string, string>[]> {
  // Validate file before processing
  const validation = validateFileUpload(file, 'document');
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file');
  }

  const text = await readFileAsText(file);
  return parseCSV(text);
}

/**
 * Import Excel file (requires exceljs library)
 * SECURITY: Validates file before processing
 */
export async function importExcel(file: File): Promise<Record<string, unknown>[]> {
  // Validate file before processing
  const validation = validateFileUpload(file, 'document');
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file');
  }

  try {
    const { Workbook } = await import('exceljs');
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const workbook = new Workbook();
          const buffer = e.target?.result as ArrayBuffer;
          await workbook.xlsx.load(buffer);
          
          // Get first sheet
          const worksheet = workbook.worksheets[0];
          const jsonData: Record<string, unknown>[] = [];
          
          // Get headers from first row
          const headers: string[] = [];
          const firstRow = worksheet.getRow(1);
          firstRow.eachCell((cell) => {
            headers.push(String(cell.value || ''));
          });
          
          // Get data rows
          for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            const rowData: Record<string, unknown> = {};
            headers.forEach((header, index) => {
              rowData[header] = row.getCell(index + 1).value;
            });
            jsonData.push(rowData);
          }
          
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  } catch (error) {
    devError('Failed to import Excel. Make sure exceljs is installed:', error);
    throw error;
  }
}
