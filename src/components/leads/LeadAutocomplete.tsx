import { useState, useEffect, useCallback, useRef } from 'react';
import { devError } from '@/lib/logger';
import { Check, ChevronsUpDown, Plus, User, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/useDebounce';

export interface LeadOption {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
}

interface LeadAutocompleteProps {
  value: LeadOption | null;
  onChange: (lead: LeadOption | null) => void;
  onCreateNew?: (name: string, phone?: string, email?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  // For new lead creation inline
  allowCreate?: boolean;
}

export function LeadAutocomplete({
  value,
  onChange,
  onCreateNew,
  placeholder = "Select or search lead...",
  disabled = false,
  className,
  allowCreate = true,
}: LeadAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch leads based on search
  const fetchLeads = useCallback(async (query: string) => {
    setIsLoading(true);
    try {
      let queryBuilder = supabase
        .from('leads')
        .select('id, name, email, phone, status')
        .order('name')
        .limit(20);

      if (query.trim()) {
        queryBuilder = queryBuilder.or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      devError('Error fetching leads:', error);
      setLeads([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and search-based fetch
  useEffect(() => {
    if (open) {
      fetchLeads(debouncedSearch);
    }
  }, [open, debouncedSearch, fetchLeads]);

  const handleSelect = (lead: LeadOption) => {
    onChange(lead);
    setOpen(false);
    setSearchQuery('');
  };

  const handleCreateNew = () => {
    if (onCreateNew && searchQuery.trim()) {
      onCreateNew(searchQuery.trim());
      setOpen(false);
      setSearchQuery('');
    }
  };

  const displayValue = value?.name || '';
  const showCreateOption = allowCreate && searchQuery.trim() && !leads.some(l => 
    l.name.toLowerCase() === searchQuery.trim().toLowerCase()
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">
            {value ? (
              <span className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 shrink-0" />
                {displayValue}
                {value.phone && (
                  <span className="text-xs text-muted-foreground">• {value.phone}</span>
                )}
              </span>
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Search by name, phone, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <CommandEmpty>
                  {searchQuery.trim() ? (
                    <div className="py-2 text-center text-sm text-muted-foreground">
                      No leads found matching "{searchQuery}"
                    </div>
                  ) : (
                    <div className="py-2 text-center text-sm text-muted-foreground">
                      Start typing to search leads
                    </div>
                  )}
                </CommandEmpty>
                
                {leads.length > 0 && (
                  <CommandGroup heading="Existing Leads">
                    {leads.map((lead) => (
                      <CommandItem
                        key={lead.id}
                        value={lead.id}
                        onSelect={() => handleSelect(lead)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Check
                          className={cn(
                            "h-4 w-4",
                            value?.id === lead.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{lead.name}</span>
                            {lead.status && (
                              <Badge variant="outline" className="text-[10px] h-4">
                                {lead.status}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {lead.phone && <span>{lead.phone}</span>}
                            {lead.phone && lead.email && <span>•</span>}
                            {lead.email && <span className="truncate">{lead.email}</span>}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {showCreateOption && onCreateNew && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        onSelect={handleCreateNew}
                        className="flex items-center gap-2 cursor-pointer text-primary"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Create new lead: "{searchQuery.trim()}"</span>
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
