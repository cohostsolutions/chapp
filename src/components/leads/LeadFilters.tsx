import { Search, Users, Thermometer } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Toggle } from '@/components/ui/toggle';
import { useAgents } from '@/hooks/useLeads';
import { FilterTogglePanel } from '@/components/shared/FilterTogglePanel';
import type { LeadFilters as LeadFiltersType } from '@/types/database';

interface LeadFiltersProps {
  filters: LeadFiltersType;
  onFiltersChange: (filters: LeadFiltersType) => void;
  showTemperature?: boolean;
}

const statusOptions = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;
const sourceOptions = ['Facebook', 'Website', 'Referral', 'Instagram', 'Google Ads', 'WhatsApp', 'Social Media'] as const;
const temperatureOptions = ['cold', 'warm', 'hot'] as const;

export function LeadFilters({ filters, onFiltersChange, showTemperature = true }: LeadFiltersProps) {
  const { agents } = useAgents();

  const updateFilter = <K extends keyof LeadFiltersType>(key: K, value: LeadFiltersType[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleFilter = <K extends keyof LeadFiltersType>(key: K, value: string) => {
    const currentValue = filters[key];
    if (currentValue === value) {
      updateFilter(key, 'all' as LeadFiltersType[K]);
    } else {
      updateFilter(key, value as LeadFiltersType[K]);
    }
  };

  const clearAllFilters = () => {
    onFiltersChange({
      search: filters.search || '',
      status: 'all',
      source: 'all',
      temperature: 'all',
      assignedAgentId: 'all',
      organizationId: filters.organizationId || 'all',
    });
  };

  const activeFilterCount = 
    (filters.status !== 'all' && filters.status ? 1 : 0) +
    (filters.source !== 'all' && filters.source ? 1 : 0) +
    (filters.temperature !== 'all' && filters.temperature ? 1 : 0) +
    (filters.assignedAgentId !== 'all' && filters.assignedAgentId ? 1 : 0);

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full">
      <div className="relative flex-1 w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search leads..."
          value={filters.search || ''}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="pl-10"
        />
      </div>
      
      <FilterTogglePanel
        activeFilterCount={activeFilterCount}
        onClearAll={clearAllFilters}
      >
        {/* Status Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium min-w-[50px]">Status:</span>
          {statusOptions.map((status) => (
            <Toggle
              key={status}
              size="sm"
              pressed={filters.status === status}
              onPressedChange={() => toggleFilter('status', status)}
              className="h-7 px-2 text-xs capitalize data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {status}
            </Toggle>
          ))}
        </div>

        {/* Source Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium min-w-[50px]">Source:</span>
          {sourceOptions.map((source) => (
            <Toggle
              key={source}
              size="sm"
              pressed={filters.source === source}
              onPressedChange={() => toggleFilter('source', source)}
              className="h-7 px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {source}
            </Toggle>
          ))}
        </div>

        {/* Temperature Filter */}
        {showTemperature && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium min-w-[50px] flex items-center gap-1">
              <Thermometer className="h-3 w-3" />
              Temp:
            </span>
            {temperatureOptions.map((temp) => (
              <Toggle
                key={temp}
                size="sm"
                pressed={filters.temperature === temp}
                onPressedChange={() => toggleFilter('temperature', temp)}
                className={`h-7 px-2 text-xs capitalize ${
                  temp === 'hot' 
                    ? 'data-[state=on]:bg-red-500 data-[state=on]:text-white' 
                    : temp === 'warm' 
                      ? 'data-[state=on]:bg-orange-500 data-[state=on]:text-white' 
                      : 'data-[state=on]:bg-blue-500 data-[state=on]:text-white'
                }`}
              >
                {temp}
              </Toggle>
            ))}
          </div>
        )}

        {/* Agent Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium min-w-[50px] flex items-center gap-1">
            <Users className="h-3 w-3" />
            Agent:
          </span>
          <Toggle
            size="sm"
            pressed={filters.assignedAgentId === 'unassigned'}
            onPressedChange={() => toggleFilter('assignedAgentId', 'unassigned')}
            className="h-7 px-2 text-xs data-[state=on]:bg-muted-foreground data-[state=on]:text-white"
          >
            Unassigned
          </Toggle>
          {agents.map((agent) => (
            <Toggle
              key={agent.id}
              size="sm"
              pressed={filters.assignedAgentId === agent.id}
              onPressedChange={() => toggleFilter('assignedAgentId', agent.id)}
              className="h-7 px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {agent.full_name?.split(' ')[0] || agent.email?.split('@')[0] || 'Agent'}
            </Toggle>
          ))}
        </div>
      </FilterTogglePanel>
    </div>
  );
}
