/**
 * Export/Import Control Component for Operations Pages
 * Provides buttons and dialogs for exporting and importing expense data
 */

import { useState } from 'react';
import { devError } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Download, Upload, FileSpreadsheet, FileText, Loader2, ChevronDown } from 'lucide-react';
import { useCurrencySymbol } from '@/hooks/useMultiCurrency';
import { useToast } from '@/hooks/use-toast';
import type { OperationalExpense } from '@/hooks/useOperationalExpenses';
import {
  exportExpensesToCSV,
  exportExpensesToExcel,
  exportExpensesToPDF,
  exportAnalyticsToPDF,
} from '@/lib/operationsExport';
import { ExpenseImportDialog, type ImportedExpense } from './ExpenseImportDialog';

interface OperationsExportImportProps {
  /** All expenses for the operation */
  allExpenses: OperationalExpense[];
  /** Currently filtered/visible expenses */
  filteredExpenses: OperationalExpense[];
  /** Callback when import is complete */
  onImportComplete: (expenses: ImportedExpense[]) => Promise<void>;
  /** Available rooms for import mapping */
  availableRooms?: Array<{ id: string; name: string }>;
  /** Filename prefix for exports */
  filenamePrefix?: string;
  /** Page title for PDF exports */
  pageTitle?: string;
  /** Disable import button */
  disableImport?: boolean;
  /** Disable export button */
  disableExport?: boolean;
  /** Size of the buttons */
  size?: 'default' | 'sm' | 'lg';
}

type ExportFormat = 'csv' | 'excel' | 'pdf-expenses' | 'pdf-analytics';
type ExportScope = 'filtered' | 'all';

export function OperationsExportImport({
  allExpenses,
  filteredExpenses,
  onImportComplete,
  availableRooms = [],
  filenamePrefix = 'expenses',
  pageTitle = 'Operations',
  disableImport = false,
  disableExport = false,
  size = 'sm',
}: OperationsExportImportProps) {
  const { toast } = useToast();
  const currencySymbol = useCurrencySymbol();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [exportScope, setExportScope] = useState<ExportScope>('filtered');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const expensesToExport = exportScope === 'filtered' ? filteredExpenses : allExpenses;

      if (expensesToExport.length === 0) {
        toast({
          title: 'No data to export',
          description: 'There are no expenses to export.',
          variant: 'destructive',
        });
        return;
      }

      const filename = `${filenamePrefix}_${exportScope}`;

      switch (exportFormat) {
        case 'csv':
          exportExpensesToCSV(expensesToExport, { filename });
          toast({
            title: 'Export complete',
            description: `Exported ${expensesToExport.length} expenses to CSV`,
          });
          break;

        case 'excel':
          await exportExpensesToExcel(expensesToExport, { filename });
          toast({
            title: 'Export complete',
            description: `Exported ${expensesToExport.length} expenses to Excel with summary`,
          });
          break;

        case 'pdf-expenses':
          exportExpensesToPDF(expensesToExport, {
            filename,
            title: `${pageTitle} - Expense Report`,
            includeAnalytics: true,
            currencySymbol,
          });
          toast({
            title: 'Export complete',
            description: `Exported ${expensesToExport.length} expenses to PDF`,
          });
          break;

        case 'pdf-analytics':
          exportAnalyticsToPDF(expensesToExport, {
            filename: `${filename}_analytics`,
            title: `${pageTitle} - Analytics Report`,
            currencySymbol,
          });
          toast({
            title: 'Export complete',
            description: 'Exported analytics report to PDF',
          });
          break;
      }

      setExportDialogOpen(false);
    } catch (error) {
      devError('Export error:', error);
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'An error occurred during export',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (expenses: ImportedExpense[]) => {
    await onImportComplete(expenses);
    toast({
      title: 'Import complete',
      description: `Successfully imported ${expenses.length} expenses`,
    });
    setImportDialogOpen(false);
  };

  const hasFiltered = filteredExpenses.length !== allExpenses.length;

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Import Button */}
        <Button
          variant="outline"
          size={size}
          onClick={() => setImportDialogOpen(true)}
          disabled={disableImport}
        >
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>

        {/* Export Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size={size} disabled={disableExport || allExpenses.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Export Format</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => { setExportFormat('csv'); setExportDialogOpen(true); }}>
              <FileText className="h-4 w-4 mr-2" />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setExportFormat('excel'); setExportDialogOpen(true); }}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export as Excel
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>PDF Reports</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => { setExportFormat('pdf-expenses'); setExportDialogOpen(true); }}>
              <FileText className="h-4 w-4 mr-2" />
              Expenses Report (PDF)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setExportFormat('pdf-analytics'); setExportDialogOpen(true); }}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Analytics Report (PDF)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Export Options Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Export Options</DialogTitle>
            <DialogDescription>
              Choose what data to export
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Export Scope */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Export Scope</Label>
              <RadioGroup value={exportScope} onValueChange={(value) => setExportScope(value as ExportScope)}>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="filtered" id="filtered" />
                  <div className="flex-1">
                    <Label htmlFor="filtered" className="font-normal cursor-pointer">
                      Filtered expenses only
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Export {filteredExpenses.length} currently visible expense{filteredExpenses.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <div className="flex-1">
                    <Label htmlFor="all" className="font-normal cursor-pointer">
                      All expenses
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Export all {allExpenses.length} expense{allExpenses.length !== 1 ? 's' : ''}
                      {hasFiltered && ' (ignoring current filters)'}
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Format Info */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-start gap-2">
                {exportFormat === 'csv' && (
                  <>
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium">CSV Format</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        Simple spreadsheet format, opens in Excel or Google Sheets
                      </p>
                    </div>
                  </>
                )}
                {exportFormat === 'excel' && (
                  <>
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium">Excel Format</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        .xlsx file with expenses and summary sheets
                      </p>
                    </div>
                  </>
                )}
                {exportFormat === 'pdf-expenses' && (
                  <>
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium">Expenses PDF Report</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        Formatted expense report with summary analytics
                      </p>
                    </div>
                  </>
                )}
                {exportFormat === 'pdf-analytics' && (
                  <>
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium">Analytics PDF Report</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        Detailed breakdown by category, type, and room
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setExportDialogOpen(false)}
              className="flex-1"
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button onClick={handleExport} className="flex-1" disabled={isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <ExpenseImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={handleImport}
        availableRooms={availableRooms}
      />
    </>
  );
}
