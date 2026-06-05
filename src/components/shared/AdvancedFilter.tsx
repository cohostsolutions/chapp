import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Filter, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: unknown;
}

export interface FilterConfig {
  field: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'boolean';
  operators?: string[];
  options?: { label: string; value: string }[];
}

const DEFAULT_OPERATORS = {
  text: ['contains', 'equals', 'starts_with', 'ends_with', 'not_contains'],
  number: ['equals', 'greater_than', 'less_than', 'between'],
  select: ['equals', 'not_equals', 'in'],
  date: ['equals', 'after', 'before', 'between'],
  boolean: ['equals'],
};

const OPERATOR_LABELS: Record<string, string> = {
  contains: 'Contains',
  equals: 'Equals',
  not_equals: 'Not equals',
  starts_with: 'Starts with',
  ends_with: 'Ends with',
  not_contains: 'Does not contain',
  greater_than: 'Greater than',
  less_than: 'Less than',
  between: 'Between',
  after: 'After',
  before: 'Before',
  in: 'Is one of',
};

interface AdvancedFilterProps {
  configs: FilterConfig[];
  filters: FilterCondition[];
  onChange: (filters: FilterCondition[]) => void;
  className?: string;
}

export function AdvancedFilter({ configs, filters, onChange, className }: AdvancedFilterProps) {
  const [open, setOpen] = useState(false);

  const addFilter = useCallback(() => {
    const newFilter: FilterCondition = {
      id: Math.random().toString(36).substring(7),
      field: configs[0].field,
      operator: DEFAULT_OPERATORS[configs[0].type][0],
      value: '',
    };
    onChange([...filters, newFilter]);
  }, [configs, filters, onChange]);

  const updateFilter = useCallback(
    (id: string, updates: Partial<FilterCondition>) => {
      onChange(
        filters.map((f) =>
          f.id === id ? { ...f, ...updates } : f
        )
      );
    },
    [filters, onChange]
  );

  const removeFilter = useCallback(
    (id: string) => {
      onChange(filters.filter((f) => f.id !== id));
    },
    [filters, onChange]
  );

  const clearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const activeFiltersCount = filters.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('gap-2', className)}>
          <Filter className="h-4 w-4" />
          Filters
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-4" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Advanced Filters</h4>
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Clear all
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {filters.map((filter) => (
              <FilterRow
                key={filter.id}
                filter={filter}
                configs={configs}
                onUpdate={updateFilter}
                onRemove={removeFilter}
              />
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={addFilter} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add filter
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface FilterRowProps {
  filter: FilterCondition;
  configs: FilterConfig[];
  onUpdate: (id: string, updates: Partial<FilterCondition>) => void;
  onRemove: (id: string) => void;
}

function FilterRow({ filter, configs, onUpdate, onRemove }: FilterRowProps) {
  const config = configs.find((c) => c.field === filter.field);
  if (!config) return null;

  const operators = config.operators || DEFAULT_OPERATORS[config.type];

  return (
    <div className="flex items-start gap-2 p-3 rounded-lg border bg-card">
      <div className="flex-1 space-y-2">
        {/* Field selector */}
        <Select
          value={filter.field}
          onValueChange={(field) => {
            const newConfig = configs.find((c) => c.field === field);
            if (newConfig) {
              onUpdate(filter.id, {
                field,
                operator: DEFAULT_OPERATORS[newConfig.type][0],
                value: '',
              });
            }
          }}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {configs.map((c) => (
              <SelectItem key={c.field} value={c.field}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Operator selector */}
        <Select
          value={filter.operator}
          onValueChange={(operator) => onUpdate(filter.id, { operator })}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op} value={op}>
                {OPERATOR_LABELS[op] || op}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Value input */}
        <FilterValueInput
          config={config}
          operator={filter.operator}
          value={filter.value}
          onChange={(value) => onUpdate(filter.id, { value })}
        />
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={() => onRemove(filter.id)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface FilterValueInputProps {
  config: FilterConfig;
  operator: string;
  value: unknown;
  onChange: (value: unknown) => void;
}

function FilterValueInput({ config, operator, value, onChange }: FilterValueInputProps) {
  const stringValue = typeof value === 'string' ? value : '';
  if (config.type === 'select' && config.options) {
    return (
      <Select value={stringValue} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Select value..." />
        </SelectTrigger>
        <SelectContent>
          {config.options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (config.type === 'boolean') {
    return (
      <Select value={value?.toString()} onValueChange={(v) => onChange(v === 'true')}>
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Yes</SelectItem>
          <SelectItem value="false">No</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (operator === 'between') {
    const [min, max] = Array.isArray(value) ? value : ['', ''];
    return (
      <div className="flex gap-2">
        <Input
          type={config.type === 'number' ? 'number' : 'text'}
          placeholder="Min"
          value={min}
          onChange={(e) => onChange([e.target.value, max])}
          className="h-9"
        />
        <Input
          type={config.type === 'number' ? 'number' : 'text'}
          placeholder="Max"
          value={max}
          onChange={(e) => onChange([min, e.target.value])}
          className="h-9"
        />
      </div>
    );
  }

  const inputValue = typeof value === 'string' || typeof value === 'number' ? value : '';
  return (
    <Input
      type={config.type === 'number' ? 'number' : config.type === 'date' ? 'date' : 'text'}
      placeholder="Enter value..."
      value={inputValue}
      onChange={(e) => onChange(e.target.value)}
      className="h-9"
    />
  );
}

/**
 * Convert filter conditions to Supabase query
 */
export function applyFiltersToQuery<T extends { eq: (field: string, value: unknown) => T; neq: (field: string, value: unknown) => T; ilike: (field: string, value: string) => T; not: (field: string, operator: string, value: string) => T; gt: (field: string, value: unknown) => T; gte: (field: string, value: unknown) => T; lt: (field: string, value: unknown) => T; lte: (field: string, value: unknown) => T; is: (field: string, value: null) => T }>(query: T, filters: FilterCondition[]): T {
  let modifiedQuery = query;

  filters.forEach((filter) => {
    const { field, operator, value } = filter;

    switch (operator) {
      case 'equals':
        modifiedQuery = modifiedQuery.eq(field, value);
        break;
      case 'not_equals':
        modifiedQuery = modifiedQuery.neq(field, value);
        break;
      case 'contains':
        modifiedQuery = modifiedQuery.ilike(field, `%${value}%`);
        break;
      case 'not_contains':
        modifiedQuery = modifiedQuery.not(field, 'ilike', `%${value}%`);
        break;
      case 'starts_with':
        modifiedQuery = modifiedQuery.ilike(field, `${value}%`);
        break;
      case 'ends_with':
        modifiedQuery = modifiedQuery.ilike(field, `%${value}`);
        break;
      case 'greater_than':
        modifiedQuery = modifiedQuery.gt(field, value);
        break;
      case 'less_than':
        modifiedQuery = modifiedQuery.lt(field, value);
        break;
      case 'after':
        modifiedQuery = modifiedQuery.gt(field, value);
        break;
      case 'before':
        modifiedQuery = modifiedQuery.lt(field, value);
        break;
      case 'between':
        if (Array.isArray(value) && value.length === 2) {
          modifiedQuery = modifiedQuery.gte(field, value[0]).lte(field, value[1]);
        }
        break;
      case 'in':
        if (Array.isArray(value)) {
          modifiedQuery = (modifiedQuery as any).in(field, value);
        }
        break;
    }
  });

  return modifiedQuery;
}
