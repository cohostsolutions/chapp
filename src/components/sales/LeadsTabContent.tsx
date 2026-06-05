import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toggle } from '@/components/ui/toggle';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Users,
  Phone,
  Mail,
  Search,
  Plus,
  LayoutGrid,
  List,
  Filter,
  XCircle,
  Loader2,
  User,
  Thermometer,
  MessageSquare,
  Briefcase,
} from 'lucide-react';
import { LeadsKanbanBoard } from '@/components/sales/LeadsKanbanBoard';
import { LeadInfoDialog, type LeadInfo } from '@/components/LeadInfoDialog';
import type { useSalesData } from '@/hooks/useSalesData';
import { useAuth } from '@/contexts/AuthContext';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';
import { useOrganizationPhone } from '@/hooks/useOrganizationPhone';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getPhoneValidationMessage, isValidPhoneNumber, normalizePhoneNumber } from '@/lib/phone';

interface LeadsTabContentProps {
  salesData: ReturnType<typeof useSalesData>;
}

interface OfferingSelectItem {
  id: string;
  name: string;
  price: number | null;
  category: string | null;
}

type SortOption = 'created_at_desc' | 'created_at_asc' | 'name_asc' | 'temperature';

const statusConfig: Record<string, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-blue-500/20 text-blue-700 border-blue-200' },
  contacted: { label: 'Contacted', color: 'bg-purple-500/20 text-purple-700 border-purple-200' },
  qualified: { label: 'Qualified', color: 'bg-green-500/20 text-green-700 border-green-200' },
  converted: { label: 'Converted', color: 'bg-emerald-500/20 text-emerald-700 border-emerald-200' },
  lost: { label: 'Lost', color: 'bg-red-500/20 text-red-700 border-red-200' },
};

const temperatureConfig: Record<string, { label: string; color: string }> = {
  hot: { label: 'Hot', color: 'bg-red-500/20 text-red-700 border-red-200' },
  warm: { label: 'Warm', color: 'bg-orange-500/20 text-orange-700 border-orange-200' },
  cold: { label: 'Cold', color: 'bg-blue-500/20 text-blue-700 border-blue-200' },
};

const sourceOptions = ['Facebook', 'Website', 'Referral', 'Instagram', 'Google Ads', 'WhatsApp', 'Social Media', 'manual'] as const;

export default function LeadsTabContent({ salesData }: LeadsTabContentProps) {
  const { leads, offerings, refetchAll } = salesData;
  const { profile } = useAuth();
  const formatCurrency = useFormatCurrency();
  const { defaultCountryCode, phonePlaceholder } = useOrganizationPhone();
  const { toast } = useToast();
  
  // View & filter state
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [temperatureFilter, setTemperatureFilter] = useState('all');
  const [sortOption, setSortOption] = useState<SortOption>('created_at_desc');

  // New sale state
  const [newSaleOpen, setNewSaleOpen] = useState(false);
  const [creatingSale, setCreatingSale] = useState(false);
  const [selectedOfferings, setSelectedOfferings] = useState<string[]>([]);
  const [newSale, setNewSale] = useState({
    name: '',
    phone: '',
    email: '',
    source: 'manual',
    notes: '',
    temperature: 'cold',
  });

  // Lead detail dialog state
  const [selectedLead, setSelectedLead] = useState<LeadInfo | null>(null);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Handle lead click for detail view
  const handleLeadClick = useCallback((lead: ReturnType<typeof useSalesData>['leads'][0]) => {
    setSelectedLead({
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      status: lead.status,
      source: lead.source,
      notes: lead.notes,
      created_at: lead.created_at,
      lead_temperature: lead.lead_temperature,
    });
    setLeadDialogOpen(true);
  }, []);

  // Handle status change from Kanban drag
  const handleStatusChange = useCallback(async (leadId: string, newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus as 'new' | 'contacted' | 'qualified' | 'converted' | 'lost' })
        .eq('id', leadId);

      if (error) throw error;

      toast({
        title: 'Status Updated',
        description: `Lead status changed to ${newStatus}`,
      });
      refetchAll();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  }, [toast, refetchAll]);

  // Handle lead update from dialog
  const handleLeadUpdate = useCallback(() => {
    refetchAll();
    setLeadDialogOpen(false);
  }, [refetchAll]);

  // Apply filters
  const filteredLeads = useMemo(() => {
    let result = [...leads];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(lead =>
        lead.name.toLowerCase().includes(term) ||
        lead.email?.toLowerCase().includes(term) ||
        lead.phone?.includes(term)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(lead => lead.status === statusFilter);
    }

    // Source filter
    if (sourceFilter !== 'all') {
      result = result.filter(lead => lead.source === sourceFilter);
    }

    // Temperature filter
    if (temperatureFilter !== 'all') {
      result = result.filter(lead => lead.lead_temperature === temperatureFilter);
    }

    // Sorting
    switch (sortOption) {
      case 'created_at_desc':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'created_at_asc':
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'name_asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'temperature':
        const tempOrder = { hot: 0, warm: 1, cold: 2 };
        result.sort((a, b) => 
          (tempOrder[a.lead_temperature as keyof typeof tempOrder] ?? 3) - 
          (tempOrder[b.lead_temperature as keyof typeof tempOrder] ?? 3)
        );
        break;
    }

    return result;
  }, [leads, searchTerm, statusFilter, sourceFilter, temperatureFilter, sortOption]);

  const leadsByStatus = useMemo(() => {
    const grouped: Record<string, typeof leads> = {
      new: [],
      contacted: [],
      qualified: [],
      converted: [],
      lost: [],
    };

    filteredLeads.forEach(lead => {
      const status = lead.status as keyof typeof grouped;
      if (grouped[status]) {
        grouped[status].push(lead);
      }
    });

    return grouped;
  }, [filteredLeads]);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('all');
    setSourceFilter('all');
    setTemperatureFilter('all');
    setSortOption('created_at_desc');
  }, []);

  const handleCreateSale = useCallback(async () => {
    if (!newSale.name.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please enter a customer name.',
        variant: 'destructive',
      });
      return;
    }

    if (!profile?.organization_id) {
      toast({
        title: 'Error',
        description: 'Organization not found.',
        variant: 'destructive',
      });
      return;
    }

    setCreatingSale(true);

    try {
      const normalizedPhone = newSale.phone.trim()
        ? normalizePhoneNumber(newSale.phone, defaultCountryCode)
        : null;

      if (normalizedPhone && !isValidPhoneNumber(normalizedPhone, defaultCountryCode)) {
        toast({
          title: 'Invalid Phone Number',
          description: getPhoneValidationMessage(defaultCountryCode),
          variant: 'destructive',
        });
        return;
      }

      // Create the lead/sale
      const { data: createdLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          organization_id: profile.organization_id,
          name: newSale.name.trim(),
          phone: normalizedPhone,
          email: newSale.email.trim() || null,
          source: newSale.source || 'manual',
          notes: newSale.notes || null,
          lead_temperature: newSale.temperature as 'cold' | 'warm' | 'hot',
          status: 'new',
        })
        .select('id')
        .single();

      if (leadError) throw leadError;
      if (!createdLead) throw new Error('Failed to create sale');

      // Link offerings to the sale
      // Note: lead_offerings junction table not yet implemented
      // For now, offering association is tracked at UI level only
      if (selectedOfferings.length > 0) {
        // Future: Implement when lead_offerings table is created via migration
      }

      const offeringNames = selectedOfferings
        .map(id => offerings.find(o => o.id === id)?.name)
        .filter(Boolean)
        .join(', ');

      toast({
        title: 'Sale Created',
        description: `${newSale.name} has been added as a new sale${offeringNames ? ` for ${offeringNames}` : ''}`,
      });

      setNewSaleOpen(false);
      setNewSale({
        name: '',
        phone: '',
        email: '',
        source: 'manual',
        notes: '',
        temperature: 'cold',
      });
      setSelectedOfferings([]);
      refetchAll();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create sale',
        variant: 'destructive',
      });
    } finally {
      setCreatingSale(false);
    }
  }, [newSale, selectedOfferings, profile?.organization_id, offerings, toast, refetchAll]);

  const hasActiveFilters = statusFilter !== 'all' || 
    sourceFilter !== 'all' || 
    temperatureFilter !== 'all' ||
    sortOption !== 'created_at_desc';

  return (
    <div className="space-y-4 p-4">
      {/* Toolbar */}
      <div className="space-y-2">
        <div className="flex gap-2 md:gap-3 items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 md:pl-10 h-8 md:h-9 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 md:h-9 gap-1.5 shrink-0"
            onClick={() => setNewSaleOpen(true)}
          >
            <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="hidden sm:inline">New Lead</span>
          </Button>
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="icon"
            className="h-8 w-8 md:h-9 md:w-9 shrink-0"
            onClick={() => setShowFilters(!showFilters)}
            title="Toggle filters"
          >
            <Filter className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </Button>
          <div className="flex items-center gap-0.5 p-0.5 md:p-1 bg-secondary/50 rounded-lg shrink-0">
            <Toggle
              pressed={viewMode === 'kanban'}
              onPressedChange={() => setViewMode('kanban')}
              size="sm"
              className="h-7 w-7 md:h-8 md:w-8 p-0 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              <LayoutGrid className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </Toggle>
            <Toggle
              pressed={viewMode === 'list'}
              onPressedChange={() => setViewMode('list')}
              size="sm"
              className="h-7 w-7 md:h-8 md:w-8 p-0 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              <List className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </Toggle>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-secondary/30 border border-border animate-fade-in">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(statusConfig).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="all">All Sources</SelectItem>
                {sourceOptions.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={temperatureFilter} onValueChange={setTemperatureFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Temperature" />
              </SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="all">All Temps</SelectItem>
                {Object.entries(temperatureConfig).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    <div className="flex items-center gap-1.5">
                      <Thermometer className="w-3 h-3" />
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="created_at_desc">Newest First</SelectItem>
                <SelectItem value="created_at_asc">Oldest First</SelectItem>
                <SelectItem value="name_asc">Name A-Z</SelectItem>
                <SelectItem value="temperature">Hottest First</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
                <XCircle className="w-3 h-3 mr-1" />
                Clear
              </Button>
            )}

            <div className="flex items-center ml-auto text-xs text-muted-foreground">
              {filteredLeads.length} of {leads.length} sales
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {leads.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="p-8 md:p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No sales yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
              Sales from conversations or manually created will appear here.
            </p>
            <Button onClick={() => setNewSaleOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Sale
            </Button>
          </CardContent>
        </Card>
      ) : filteredLeads.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="p-8 md:p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No matching sales</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
              No sales match your current filters.
            </p>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <XCircle className="w-4 h-4 mr-2" />
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'kanban' ? (
        <LeadsKanbanBoard 
          leads={leadsByStatus} 
          onLeadClick={handleLeadClick}
          onStatusChange={handleStatusChange}
          isUpdating={isUpdatingStatus}
        />
      ) : (
        <div className="grid gap-3">
          {filteredLeads.map(lead => (
            <Card 
              key={lead.id} 
              className="glass hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => handleLeadClick(lead)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{lead.name}</h3>
                    <div className="flex flex-col gap-1 mt-2 text-sm text-muted-foreground">
                      {lead.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5" />
                          {lead.email}
                        </div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5" />
                          {lead.phone}
                        </div>
                      )}
                    </div>
                    {lead.offerings && lead.offerings.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {lead.offerings.slice(0, 3).map(offering => (
                          <Badge key={offering.id} variant="secondary" className="text-xs">
                            {offering.name}
                          </Badge>
                        ))}
                        {lead.offerings.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{lead.offerings.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={statusConfig[lead.status as keyof typeof statusConfig]?.color}>
                      {statusConfig[lead.status as keyof typeof statusConfig]?.label}
                    </Badge>
                    {lead.lead_temperature && (
                      <Badge className={temperatureConfig[lead.lead_temperature as keyof typeof temperatureConfig]?.color}>
                        {temperatureConfig[lead.lead_temperature as keyof typeof temperatureConfig]?.label}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Sale Dialog */}
      <Dialog open={newSaleOpen} onOpenChange={setNewSaleOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              New Sale
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="saleName">Customer Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="saleName"
                  placeholder="Enter customer name"
                  value={newSale.name}
                  onChange={(e) => setNewSale(prev => ({ ...prev, name: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="salePhone">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="salePhone"
                    placeholder={phonePlaceholder}
                    value={newSale.phone}
                    onChange={(e) => setNewSale(prev => ({ ...prev, phone: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="saleEmail">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="saleEmail"
                    placeholder="Email address"
                    type="email"
                    value={newSale.email}
                    onChange={(e) => setNewSale(prev => ({ ...prev, email: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Offerings Selection */}
            {offerings.length > 0 && (
              <div className="space-y-2">
                <Label>Products/Services (Optional)</Label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-lg p-3">
                  {offerings.map((offering) => (
                    <label key={offering.id} className="flex items-center gap-2 cursor-pointer hover:bg-secondary/50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={selectedOfferings.includes(offering.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOfferings(prev => [...prev, offering.id]);
                          } else {
                            setSelectedOfferings(prev => prev.filter(id => id !== offering.id));
                          }
                        }}
                        className="rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground">{offering.name}</div>
                        {offering.category && <div className="text-xs text-muted-foreground">{offering.category}</div>}
                      </div>
                      {offering.price && <div className="text-sm font-semibold text-primary">{formatCurrency(offering.price)}</div>}
                    </label>
                  ))}
                </div>
                {selectedOfferings.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedOfferings.map(id => {
                      const offering = offerings.find(o => o.id === id);
                      return offering ? (
                        <Badge key={id} variant="secondary" className="text-xs">
                          {offering.name}
                          <button
                            className="ml-1 hover:text-foreground"
                            onClick={() => setSelectedOfferings(prev => prev.filter(oid => oid !== id))}
                          >
                            ×
                          </button>
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="saleSource">Source</Label>
                <Select 
                  value={newSale.source} 
                  onValueChange={(v) => setNewSale(prev => ({ ...prev, source: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceOptions.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="saleTemperature">Temperature</Label>
                <Select 
                  value={newSale.temperature} 
                  onValueChange={(v) => setNewSale(prev => ({ ...prev, temperature: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select temp" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cold">
                      <div className="flex items-center gap-1.5">
                        <Thermometer className="w-3 h-3 text-blue-500" />
                        Cold
                      </div>
                    </SelectItem>
                    <SelectItem value="warm">
                      <div className="flex items-center gap-1.5">
                        <Thermometer className="w-3 h-3 text-orange-500" />
                        Warm
                      </div>
                    </SelectItem>
                    <SelectItem value="hot">
                      <div className="flex items-center gap-1.5">
                        <Thermometer className="w-3 h-3 text-red-500" />
                        Hot
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="saleNotes">Notes</Label>
              <Textarea
                id="saleNotes"
                placeholder="Additional notes about this sale..."
                value={newSale.notes}
                onChange={(e) => setNewSale(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSaleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSale} disabled={creatingSale}>
              {creatingSale ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Sale
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Detail Dialog */}
      <LeadInfoDialog
        lead={selectedLead}
        open={leadDialogOpen}
        onOpenChange={setLeadDialogOpen}
        onUpdate={handleLeadUpdate}
      />
    </div>
  );
}
