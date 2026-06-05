import { useState, useRef, useMemo } from 'react';
import { devError } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizationPhone } from '@/hooks/useOrganizationPhone';
import { isValidPhoneNumber, normalizePhoneNumber } from '@/lib/phone';
import { Upload, Download, FileSpreadsheet, Loader2, AlertCircle, CheckCircle, Copy, Merge, SkipForward, PlusCircle, ArrowRight, ArrowLeft, Settings2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  created_at: string;
}

interface LeadImportExportProps {
  leads: Lead[];
  onImportComplete: () => void;
}

interface ParsedLead {
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  notes?: string;
  status?: string;
  isDuplicate?: boolean;
  duplicateReason?: string;
  matchingLeadId?: string;
}

type DuplicateAction = 'skip' | 'merge' | 'create';
type ImportStep = 'mapping' | 'review' | 'results';
type LeadField = 'name' | 'email' | 'phone' | 'source' | 'notes' | 'status' | 'skip';

interface FieldMapping {
  [csvColumn: string]: LeadField;
}

const LEAD_FIELDS: { value: LeadField; label: string; required?: boolean }[] = [
  { value: 'name', label: 'Name', required: true },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'source', label: 'Source' },
  { value: 'notes', label: 'Notes' },
  { value: 'status', label: 'Status' },
  { value: 'skip', label: "Don't import" },
];

export function LeadImportExport({ leads, onImportComplete }: LeadImportExportProps) {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importStep, setImportStep] = useState<ImportStep>('mapping');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; failed: number; skipped: number; merged: number } | null>(null);
  const [parsedLeads, setParsedLeads] = useState<ParsedLead[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<DuplicateAction>('skip');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { profile } = useAuth();
  const { defaultCountryCode } = useOrganizationPhone();

  const normalizeImportedPhone = (phone?: string) => {
    if (!phone?.trim()) return undefined;
    const normalizedPhone = normalizePhoneNumber(phone, defaultCountryCode);
    return isValidPhoneNumber(normalizedPhone, defaultCountryCode) ? normalizedPhone : phone.trim();
  };

  // Check for duplicates against existing leads
  const checkDuplicates = (parsed: ParsedLead[]): ParsedLead[] => {
    const emailToLeadId = new Map<string, string>();
    const phoneToLeadId = new Map<string, string>();
    
    leads.forEach(l => {
      if (l.email) emailToLeadId.set(l.email.toLowerCase(), l.id);
      if (l.phone) phoneToLeadId.set(normalizePhoneNumber(l.phone, defaultCountryCode).replace(/\D/g, ''), l.id);
    });
    
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();

    return parsed.map(lead => {
      const reasons: string[] = [];
      const normalizedEmail = lead.email?.toLowerCase();
      const normalizedPhone = normalizeImportedPhone(lead.phone)?.replace(/\D/g, '');
      let matchingLeadId: string | undefined;

      if (normalizedEmail && emailToLeadId.has(normalizedEmail)) {
        reasons.push('Email exists');
        matchingLeadId = emailToLeadId.get(normalizedEmail);
      }
      if (normalizedPhone && normalizedPhone.length >= 10 && phoneToLeadId.has(normalizedPhone)) {
        reasons.push('Phone exists');
        if (!matchingLeadId) matchingLeadId = phoneToLeadId.get(normalizedPhone);
      }

      if (normalizedEmail) {
        if (seenEmails.has(normalizedEmail)) reasons.push('Duplicate in file');
        seenEmails.add(normalizedEmail);
      }
      if (normalizedPhone && normalizedPhone.length >= 10) {
        if (seenPhones.has(normalizedPhone) && !reasons.includes('Duplicate in file')) {
          reasons.push('Duplicate in file');
        }
        seenPhones.add(normalizedPhone);
      }

      return { ...lead, isDuplicate: reasons.length > 0, duplicateReason: reasons.join(', '), matchingLeadId };
    });
  };

  const duplicateStats = useMemo(() => {
    const duplicates = parsedLeads.filter(l => l.isDuplicate);
    const unique = parsedLeads.filter(l => !l.isDuplicate);
    return { duplicates: duplicates.length, unique: unique.length };
  }, [parsedLeads]);

  const parseCSVRaw = (content: string): { headers: string[]; data: string[][] } => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) throw new Error('CSV file must have a header row and at least one data row');

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    const data = lines.slice(1).map(line => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim().replace(/"/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/"/g, ''));
      return values;
    });

    return { headers, data };
  };

  const autoDetectMapping = (headers: string[]): FieldMapping => {
    const mapping: FieldMapping = {};
    const fieldAliases: { [key in LeadField]?: string[] } = {
      name: ['name', 'full name', 'fullname', 'contact name', 'lead name', 'customer', 'client'],
      email: ['email', 'e-mail', 'email address', 'mail'],
      phone: ['phone', 'telephone', 'mobile', 'cell', 'phone number', 'contact number', 'tel'],
      source: ['source', 'lead source', 'channel', 'origin', 'referral'],
      notes: ['notes', 'note', 'comments', 'comment', 'description', 'details'],
      status: ['status', 'lead status', 'stage'],
    };

    headers.forEach(header => {
      const normalizedHeader = header.toLowerCase().trim();
      for (const [field, aliases] of Object.entries(fieldAliases)) {
        if (aliases?.some(alias => normalizedHeader === alias || normalizedHeader.includes(alias))) {
          mapping[header] = field as LeadField;
          return;
        }
      }
      mapping[header] = 'skip';
    });

    return mapping;
  };

  const applyMappingToData = (data: string[][], headers: string[], mapping: FieldMapping): ParsedLead[] => {
    const validStatuses = ['new', 'contacted', 'qualified', 'converted', 'lost'];
    
    return data.map((row, idx) => {
      const lead: ParsedLead = { name: '' };
      
      headers.forEach((header, colIdx) => {
        const field = mapping[header];
        const value = row[colIdx]?.trim() || '';
        
        if (field && field !== 'skip' && value) {
          if (field === 'status') {
            lead[field] = validStatuses.includes(value.toLowerCase()) ? value.toLowerCase() : 'new';
          } else if (field === 'phone') {
            lead[field] = normalizeImportedPhone(value) || value;
          } else {
            lead[field] = value;
          }
        }
      });

      if (!lead.name) {
        throw new Error(`Row ${idx + 2}: Name is required. Please map a column to the Name field.`);
      }
      
      return lead;
    });
  };

  const isNameMapped = useMemo(() => {
    return Object.values(fieldMapping).includes('name');
  }, [fieldMapping]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setParsedLeads([]);
    setImportResults(null);
    setImportStep('mapping');

    const isCSV = file.name.endsWith('.csv') || file.type === 'text/csv';
    
    if (!isCSV) {
      setParseError('Please upload a CSV file (.csv)');
      return;
    }

    try {
      const content = await file.text();
      const { headers, data } = parseCSVRaw(content);
      setCsvHeaders(headers);
      setCsvData(data);
      const autoMapping = autoDetectMapping(headers);
      setFieldMapping(autoMapping);
      setImportDialogOpen(true);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Failed to parse file');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleProceedToReview = () => {
    try {
      const parsed = applyMappingToData(csvData, csvHeaders, fieldMapping);
      const withDuplicates = checkDuplicates(parsed);
      setParsedLeads(withDuplicates);
      setImportStep('review');
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Failed to apply mapping');
    }
  };

  const handleImport = async () => {
    if (!profile?.organization_id || parsedLeads.length === 0) return;

    setIsImporting(true);
    setImportProgress(0);
    let success = 0;
    let failed = 0;
    let skipped = 0;
    let merged = 0;

    const duplicateLeads = parsedLeads.filter(l => l.isDuplicate && l.matchingLeadId);
    const uniqueLeads = parsedLeads.filter(l => !l.isDuplicate);
    const fileOnlyDuplicates = parsedLeads.filter(l => l.isDuplicate && !l.matchingLeadId);

    let leadsToProcess: ParsedLead[] = [];

    switch (duplicateAction) {
      case 'skip':
        leadsToProcess = uniqueLeads;
        skipped = duplicateLeads.length + fileOnlyDuplicates.length;
        break;
      case 'merge':
        leadsToProcess = [...uniqueLeads, ...duplicateLeads];
        skipped = fileOnlyDuplicates.length;
        break;
      case 'create':
        leadsToProcess = parsedLeads;
        break;
    }

    for (let i = 0; i < leadsToProcess.length; i++) {
      const lead = leadsToProcess[i];
      
      try {
        if (duplicateAction === 'merge' && lead.isDuplicate && lead.matchingLeadId) {
          // Update existing lead
          const updateData: Record<string, unknown> = { name: lead.name };
          if (lead.email) updateData.email = lead.email;
          if (lead.phone) updateData.phone = lead.phone;
          if (lead.source) updateData.source = lead.source;
          if (lead.notes) updateData.notes = lead.notes;
          if (lead.status) updateData.status = lead.status;

          const { error } = await supabase
            .from('leads')
            .update(updateData)
            .eq('id', lead.matchingLeadId);

          if (error) throw error;
          merged++;
        } else {
          // Insert new lead
          const { error } = await supabase
            .from('leads')
            .insert([{
              name: lead.name,
              email: lead.email || null,
              phone: lead.phone || null,
              source: lead.source || null,
              notes: lead.notes || null,
              status: ((lead.status as string) || 'new') as 'new' | 'contacted' | 'qualified' | 'converted' | 'lost',
              organization_id: profile.organization_id,
            }]);

          if (error) throw error;
          success++;
        }
      } catch (error) {
        devError(`Failed to import/merge lead ${lead.name}:`, error);
        failed++;
      }

      setImportProgress(Math.round(((i + 1) / leadsToProcess.length) * 100));
    }

    setImportResults({ success, failed, skipped, merged });
    setIsImporting(false);
    
    if (success > 0 || merged > 0) {
      onImportComplete();
      const parts = [];
      if (success > 0) parts.push(`${success} imported`);
      if (merged > 0) parts.push(`${merged} merged`);
      if (skipped > 0) parts.push(`${skipped} skipped`);
      if (failed > 0) parts.push(`${failed} failed`);
      
      toast({
        title: "Import Complete",
        description: parts.join(', '),
      });
    }
  };

  const exportToCSV = () => {
    if (leads.length === 0) {
      toast({
        title: "No Data",
        description: "There are no leads to export",
        variant: "destructive",
      });
      return;
    }

    const headers = ['Name', 'Email', 'Phone', 'Status', 'Source', 'Notes', 'Created At'];
    const rows = leads.map(lead => [
      lead.name,
      lead.email || '',
      lead.phone || '',
      lead.status,
      lead.source || '',
      lead.notes || '',
      new Date(lead.created_at).toLocaleString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leads_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: `Exported ${leads.length} leads to CSV`,
    });
  };

  const downloadTemplate = () => {
    const headers = 'name,email,phone,source,notes,status';
    const example = '"John Doe","john@example.com","+639123456789","Facebook","Interested in products","new"';
    const csvContent = `${headers}\n${example}`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'leads_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Template Downloaded",
      description: "Fill in the template and upload to import leads",
    });
  };

  const closeDialog = () => {
    setImportDialogOpen(false);
    setParsedLeads([]);
    setImportResults(null);
    setImportProgress(0);
    setParseError(null);
    setDuplicateAction('skip');
    setImportStep('mapping');
    setCsvHeaders([]);
    setCsvData([]);
    setFieldMapping({});
  };

  const updateMapping = (csvColumn: string, field: LeadField) => {
    setFieldMapping(prev => ({ ...prev, [csvColumn]: field }));
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-4 h-4 mr-2" />
          Import
        </Button>
        <Button variant="outline" size="sm" onClick={exportToCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {parseError && (
        <Alert variant="destructive" className="mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

      <Dialog open={importDialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Import Leads
            </DialogTitle>
            <DialogDescription>
              {importStep === 'mapping' && 'Map your CSV columns to lead fields'}
              {importStep === 'review' && 'Review the leads to import from your CSV file'}
            </DialogDescription>
          </DialogHeader>

          {importStep === 'mapping' && (
            <>
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Settings2 className="w-4 h-4" />
                  <span>Match columns from your CSV to lead fields</span>
                </div>
                
                {parseError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{parseError}</AlertDescription>
                  </Alert>
                )}

                <div className="max-h-[300px] overflow-y-auto space-y-2">
                  {csvHeaders.map((header, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 bg-secondary/30 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{header}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          e.g. {csvData[0]?.[idx] || 'empty'}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      <Select
                        value={fieldMapping[header] || 'skip'}
                        onValueChange={(v) => updateMapping(header, v as LeadField)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_FIELDS.map(f => (
                            <SelectItem key={f.value} value={f.value}>
                              <span className={f.required ? 'font-medium' : ''}>
                                {f.label}
                                {f.required && <span className="text-destructive ml-1">*</span>}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                {!isNameMapped && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>You must map a column to the Name field to proceed.</AlertDescription>
                  </Alert>
                )}
              </div>

              <DialogFooter className="gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="mr-auto">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Template
                </Button>
                <Button variant="glow" onClick={handleProceedToReview} disabled={!isNameMapped}>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </DialogFooter>
            </>
          )}

          {importStep === 'review' && !importResults && (
            <>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs font-medium text-muted-foreground">Total</p>
                    <p className="text-xl font-bold text-foreground">{parsedLeads.length}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs font-medium text-muted-foreground">Unique</p>
                    <p className="text-xl font-bold text-success">{duplicateStats.unique}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs font-medium text-muted-foreground">Duplicates</p>
                    <p className="text-xl font-bold text-warning">{duplicateStats.duplicates}</p>
                  </div>
                </div>

                {duplicateStats.duplicates > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">How to handle duplicates?</p>
                    <RadioGroup value={duplicateAction} onValueChange={(v) => setDuplicateAction(v as DuplicateAction)}>
                      <div className="flex items-start space-x-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors">
                        <RadioGroupItem value="skip" id="skip" className="mt-0.5" />
                        <Label htmlFor="skip" className="cursor-pointer flex-1">
                          <div className="flex items-center gap-2">
                            <SkipForward className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">Skip duplicates</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">Only import new leads, ignore duplicates</p>
                        </Label>
                      </div>
                      <div className="flex items-start space-x-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors">
                        <RadioGroupItem value="merge" id="merge" className="mt-0.5" />
                        <Label htmlFor="merge" className="cursor-pointer flex-1">
                          <div className="flex items-center gap-2">
                            <Merge className="w-4 h-4 text-primary" />
                            <span className="font-medium">Merge & update</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">Update existing leads with new data</p>
                        </Label>
                      </div>
                      <div className="flex items-start space-x-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors">
                        <RadioGroupItem value="create" id="create" className="mt-0.5" />
                        <Label htmlFor="create" className="cursor-pointer flex-1">
                          <div className="flex items-center gap-2">
                            <PlusCircle className="w-4 h-4 text-warning" />
                            <span className="font-medium">Create all anyway</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">Import all leads including duplicates</p>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {parsedLeads.length > 0 && (
                  <div className="max-h-[140px] overflow-y-auto space-y-2">
                    <p className="text-sm text-muted-foreground">Preview:</p>
                    {parsedLeads.slice(0, 6).map((lead, idx) => (
                      <div 
                        key={idx} 
                        className={`text-sm p-2 rounded flex items-center justify-between ${
                          lead.isDuplicate ? 'bg-warning/10 border border-warning/30' : 'bg-secondary/30'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {lead.isDuplicate && <Copy className="w-3 h-3 text-warning shrink-0" />}
                          <span className="font-medium truncate">{lead.name}</span>
                          {lead.email && <span className="text-muted-foreground text-xs truncate hidden sm:inline">• {lead.email}</span>}
                        </div>
                        {lead.isDuplicate && (
                          <Badge variant="outline" className="text-xs bg-warning/20 text-warning border-warning/30 shrink-0 ml-2">
                            {duplicateAction === 'merge' ? 'Will merge' : lead.duplicateReason}
                          </Badge>
                        )}
                      </div>
                    ))}
                    {parsedLeads.length > 6 && (
                      <p className="text-xs text-muted-foreground">...and {parsedLeads.length - 6} more</p>
                    )}
                  </div>
                )}

                {isImporting && (
                  <div className="space-y-2">
                    <Progress value={importProgress} />
                    <p className="text-sm text-muted-foreground text-center">{importProgress}% complete</p>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setImportStep('mapping')} disabled={isImporting}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button 
                  variant="glow" 
                  onClick={handleImport} 
                  disabled={isImporting || parsedLeads.length === 0}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Import Leads
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}

          {importResults && (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <CheckCircle className="w-16 h-16 text-success" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-lg font-semibold">Import Complete</p>
                  {importResults.success > 0 && (
                    <p className="text-muted-foreground">{importResults.success} leads imported</p>
                  )}
                  {importResults.merged > 0 && (
                    <p className="text-sm text-primary">{importResults.merged} leads merged/updated</p>
                  )}
                  {importResults.skipped > 0 && (
                    <p className="text-sm text-warning">{importResults.skipped} duplicates skipped</p>
                  )}
                  {importResults.failed > 0 && (
                    <p className="text-sm text-destructive">{importResults.failed} failed</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="glow" onClick={closeDialog}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
