/**
 * Expense Import Dialog with CSV field mapping
 * Allows users to import expenses from CSV files with flexible field mapping
 */

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X, Download } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';

interface ExpenseImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (expenses: ImportedExpense[]) => Promise<void>;
  availableRooms?: Array<{ id: string; name: string }>;
}

export interface ImportedExpense {
  expense_date: string;
  expense_type: string;
  category: 'daily' | 'monthly';
  amount: number;
  room_unit_id?: string | null;
  vendor?: string | null;
  due_date?: string | null;
  is_paid: boolean;
  notes?: string | null;
}

type ExpenseField = keyof ImportedExpense;

const REQUIRED_FIELDS: ExpenseField[] = ['expense_date', 'expense_type', 'category', 'amount'];

const FIELD_OPTIONS: Array<{ value: ExpenseField | 'skip'; label: string; required?: boolean }> = [
  { value: 'skip', label: '(Skip this column)' },
  { value: 'expense_date', label: 'Expense Date *', required: true },
  { value: 'expense_type', label: 'Type *', required: true },
  { value: 'category', label: 'Category (daily/monthly) *', required: true },
  { value: 'amount', label: 'Amount *', required: true },
  { value: 'room_unit_id', label: 'Room ID (optional)' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'due_date', label: 'Due Date' },
  { value: 'is_paid', label: 'Is Paid (true/false)' },
  { value: 'notes', label: 'Notes' },
];

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

export function ExpenseImportDialog({ open, onOpenChange, onImport, availableRooms = [] }: ExpenseImportDialogProps) {
  const formatCurrency = useFormatCurrency();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, ExpenseField | 'skip'>>({});
  const [parsedExpenses, setParsedExpenses] = useState<ImportedExpense[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [successCount, setSuccessCount] = useState(0);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        parseCSV(text);
      } catch (error) {
        setErrors(['Failed to read CSV file']);
      }
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      setErrors(['CSV file must have at least a header row and one data row']);
      return;
    }

    // Parse header
    const headers = parseCSVLine(lines[0]);
    setCsvHeaders(headers);

    // Parse data rows
    const data = lines.slice(1).map(line => parseCSVLine(line));
    setCsvData(data);

    // Auto-detect field mappings
    const autoMapping: Record<string, ExpenseField | 'skip'> = {};
    headers.forEach((header) => {
      const normalized = header.toLowerCase().trim();
      
      if (normalized.includes('date') && !normalized.includes('due')) {
        autoMapping[header] = 'expense_date';
      } else if (normalized.includes('due') && normalized.includes('date')) {
        autoMapping[header] = 'due_date';
      } else if (normalized.includes('type')) {
        autoMapping[header] = 'expense_type';
      } else if (normalized.includes('category')) {
        autoMapping[header] = 'category';
      } else if (normalized.includes('amount')) {
        autoMapping[header] = 'amount';
      } else if (normalized.includes('room')) {
        autoMapping[header] = 'room_unit_id';
      } else if (normalized.includes('vendor')) {
        autoMapping[header] = 'vendor';
      } else if (normalized.includes('paid') || normalized.includes('status')) {
        autoMapping[header] = 'is_paid';
      } else if (normalized.includes('note')) {
        autoMapping[header] = 'notes';
      } else {
        autoMapping[header] = 'skip';
      }
    });

    setFieldMapping(autoMapping);
    setStep('mapping');
    setErrors([]);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  };

  const updateMapping = (csvColumn: string, field: ExpenseField | 'skip') => {
    setFieldMapping(prev => ({ ...prev, [csvColumn]: field }));
  };

  const validateMapping = (): boolean => {
    const mappedFields = Object.values(fieldMapping).filter(f => f !== 'skip');
    const missingRequired = REQUIRED_FIELDS.filter(
      field => !mappedFields.includes(field)
    );

    if (missingRequired.length > 0) {
      setErrors([`Missing required fields: ${missingRequired.join(', ')}`]);
      return false;
    }

    return true;
  };

  const handlePreview = () => {
    if (!validateMapping()) return;

    const newErrors: string[] = [];
    const expenses: ImportedExpense[] = [];

    csvData.forEach((row, index) => {
      try {
        const expense: Partial<ImportedExpense> = {};

        csvHeaders.forEach((header, colIndex) => {
          const field = fieldMapping[header];
          if (field === 'skip') return;

          const value = row[colIndex]?.trim();
          if (!value && REQUIRED_FIELDS.includes(field as ExpenseField)) {
            throw new Error(`Missing required field "${field}" in row ${index + 2}`);
          }

          switch (field) {
            case 'expense_date':
            case 'due_date':
              if (value) {
                const parsedDate = parseDateString(value);
                if (!parsedDate) {
                  throw new Error(`Invalid date format "${value}" in row ${index + 2}`);
                }
                expense[field] = parsedDate;
              }
              break;

            case 'amount':
              const amount = parseFloat(value.replace(/[^\d.-]/g, ''));
              if (isNaN(amount)) {
                throw new Error(`Invalid amount "${value}" in row ${index + 2}`);
              }
              expense.amount = amount;
              break;

            case 'category':
              if (value.toLowerCase() !== 'daily' && value.toLowerCase() !== 'monthly') {
                throw new Error(`Category must be "daily" or "monthly" in row ${index + 2}`);
              }
              expense.category = value.toLowerCase() as 'daily' | 'monthly';
              break;

            case 'is_paid':
              expense.is_paid = value.toLowerCase() === 'true' || 
                                value.toLowerCase() === 'yes' || 
                                value.toLowerCase() === 'paid' ||
                                value === '1';
              break;

            case 'room_unit_id':
              // Try to match room by name or ID
              if (value) {
                const room = availableRooms.find(
                  r => r.name.toLowerCase() === value.toLowerCase() || r.id === value
                );
                expense.room_unit_id = room?.id || null;
              }
              break;

            default:
              if (value) {
                expense[field] = value;
              }
          }
        });

        // Validate required fields
        if (!expense.expense_date || !expense.expense_type || !expense.category || expense.amount === undefined) {
          throw new Error(`Missing required fields in row ${index + 2}`);
        }

        expenses.push(expense as ImportedExpense);
      } catch (error) {
        newErrors.push(error instanceof Error ? error.message : `Error in row ${index + 2}`);
      }
    });

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    setParsedExpenses(expenses);
    setStep('preview');
    setErrors([]);
  };

  const parseDateString = (dateStr: string): string | null => {
    const formats = [
      'yyyy-MM-dd',
      'MM/dd/yyyy',
      'dd/MM/yyyy',
      'M/d/yyyy',
      'd/M/yyyy',
      'MMM dd, yyyy',
      'dd MMM yyyy',
    ];

    for (const formatStr of formats) {
      try {
        const parsed = parse(dateStr, formatStr, new Date());
        if (isValid(parsed)) {
          return format(parsed, 'yyyy-MM-dd');
        }
      } catch {
        continue;
      }
    }

    return null;
  };

  const handleImport = async () => {
    setStep('importing');
    setImportProgress(0);
    setSuccessCount(0);

    try {
      await onImport(parsedExpenses);
      setSuccessCount(parsedExpenses.length);
      setImportProgress(100);
      setStep('complete');
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Import failed']);
      setStep('preview');
    }
  };

  const downloadTemplate = () => {
    const headers = 'expense_date,expense_type,category,amount,vendor,due_date,is_paid,notes';
    const example = '2026-01-19,Cleaning,daily,500,"Cleaning Service",2026-01-20,false,"Deep cleaning"';
    const csvContent = `${headers}\n${example}`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'expense_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetDialog = () => {
    setStep('upload');
    setCsvHeaders([]);
    setCsvData([]);
    setFieldMapping({});
    setParsedExpenses([]);
    setErrors([]);
    setImportProgress(0);
    setSuccessCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Import Expenses from CSV
          </DialogTitle>
          <DialogDescription>
            Import multiple expenses from a CSV file. Download the template to see the expected format.
          </DialogDescription>
        </DialogHeader>

        {/* Upload Step */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">Upload CSV File</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Select a CSV file with your expense data
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()}>
                Choose File
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={downloadTemplate} className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </div>

            {errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errors[0]}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Mapping Step */}
        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                Found {csvData.length} rows. Map your CSV columns to expense fields:
              </p>
            </div>

            <ScrollArea className="h-[300px] border rounded-lg p-4">
              <div className="space-y-3">
                {csvHeaders.map((header) => (
                  <div key={header} className="flex items-center gap-3">
                    <div className="flex-1">
                      <Label className="text-sm font-medium">{header}</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Example: {csvData[0]?.[csvHeaders.indexOf(header)] || 'N/A'}
                      </p>
                    </div>
                    <div className="w-[200px]">
                      <Select
                        value={fieldMapping[header] || 'skip'}
                        onValueChange={(value) => updateMapping(header, value as ExpenseField | 'skip')}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errors[0]}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={resetDialog} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handlePreview} className="flex-1">
                Preview Import
              </Button>
            </div>
          </div>
        )}

        {/* Preview Step */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">Ready to import</p>
                <p className="text-sm text-muted-foreground">
                  {parsedExpenses.length} expenses will be imported
                </p>
              </div>
              <Badge variant="secondary">{parsedExpenses.length} rows</Badge>
            </div>

            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-4 space-y-2">
                {parsedExpenses.slice(0, 10).map((expense, index) => (
                  <div key={index} className="border rounded-lg p-3 text-sm">
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">{expense.expense_type}</span>
                      <Badge variant={expense.category === 'daily' ? 'default' : 'secondary'}>
                        {expense.category}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground space-y-1">
                      <div>Date: {format(new Date(expense.expense_date), 'MMM dd, yyyy')}</div>
                      <div>Amount: {formatCurrency(expense.amount)}</div>
                      {expense.vendor && <div>Vendor: {expense.vendor}</div>}
                    </div>
                  </div>
                ))}
                {parsedExpenses.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    ... and {parsedExpenses.length - 10} more
                  </p>
                )}
              </div>
            </ScrollArea>

            {errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    {errors.slice(0, 5).map((error, i) => (
                      <div key={i}>{error}</div>
                    ))}
                    {errors.length > 5 && <div>... and {errors.length - 5} more errors</div>}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('mapping')} className="flex-1">
                Back to Mapping
              </Button>
              <Button onClick={handleImport} className="flex-1">
                Import {parsedExpenses.length} Expenses
              </Button>
            </div>
          </div>
        )}

        {/* Importing Step */}
        {step === 'importing' && (
          <div className="space-y-4 py-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <FileSpreadsheet className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <h3 className="font-medium mb-2">Importing expenses...</h3>
              <p className="text-sm text-muted-foreground">
                Please wait while we import your expenses
              </p>
            </div>
            <Progress value={importProgress} className="w-full" />
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <div className="space-y-4 py-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 mb-4">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <h3 className="font-medium mb-2">Import Complete!</h3>
              <p className="text-sm text-muted-foreground">
                Successfully imported {successCount} expenses
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
