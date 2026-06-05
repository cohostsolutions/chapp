import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  getPricingCityOptions,
  getPricingCountryOptions,
  getPricingDistrictOptions,
  getPricingRegionOptions,
  type PricingLocationSelection,
} from '@/lib/pricingLocationCatalog';
import { cn } from '@/lib/utils';

interface LocationPickerFieldsProps {
  value: PricingLocationSelection;
  onChange: (nextValue: PricingLocationSelection) => void;
  extraCountries?: Array<string | null | undefined>;
  extraRegions?: Array<string | null | undefined>;
  extraCities?: Array<string | null | undefined>;
  extraDistricts?: Array<string | null | undefined>;
  className?: string;
}

interface SearchableLocationFieldProps {
  label: string;
  placeholder: string;
  emptyLabel: string;
  value?: string | null;
  options: string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}

function SearchableLocationField({
  label,
  placeholder,
  emptyLabel,
  value,
  options,
  onSelect,
  disabled = false,
}: SearchableLocationFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'w-full justify-between font-normal',
              !value && 'text-muted-foreground'
            )}
          >
            <span className="truncate">{value || placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => {
                    onSelect(option);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === option ? 'opacity-100' : 'opacity-0')} />
                  <span>{option}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function LocationPickerFields({
  value,
  onChange,
  extraCountries = [],
  extraRegions = [],
  extraCities = [],
  extraDistricts = [],
  className,
}: LocationPickerFieldsProps) {
  const countryOptions = useMemo(
    () => getPricingCountryOptions([value.country, ...extraCountries]),
    [extraCountries, value.country]
  );

  const regionOptions = useMemo(
    () => getPricingRegionOptions(value.country, [value.region, ...extraRegions]),
    [extraRegions, value.country, value.region]
  );

  const cityOptions = useMemo(
    () => getPricingCityOptions(value.country, value.region, [value.city, ...extraCities]),
    [extraCities, value.city, value.country, value.region]
  );

  const districtOptions = useMemo(
    () => getPricingDistrictOptions(value.country, value.region, value.city, [value.district, ...extraDistricts]),
    [extraDistricts, value.city, value.country, value.district, value.region]
  );

  return (
    <div className={cn('grid gap-4 md:grid-cols-2', className)}>
      <SearchableLocationField
        label="Country"
        placeholder="Select country"
        emptyLabel="No country options"
        value={value.country}
        options={countryOptions}
        onSelect={(country) => onChange({ country, region: '', city: '', district: '' })}
      />
      <SearchableLocationField
        label="Region"
        placeholder="Select region"
        emptyLabel={value.country ? 'No region options' : 'Select a country first'}
        value={value.region}
        options={regionOptions}
        onSelect={(region) => onChange({ ...value, region, city: '', district: '' })}
        disabled={!value.country}
      />
      <SearchableLocationField
        label="City"
        placeholder="Select city"
        emptyLabel={value.country && value.region ? 'No city options' : 'Select a region first'}
        value={value.city}
        options={cityOptions}
        onSelect={(city) => onChange({ ...value, city, district: '' })}
        disabled={!value.country || !value.region}
      />
      <SearchableLocationField
        label="District"
        placeholder={districtOptions.length > 0 ? 'Select district' : 'No district options'}
        emptyLabel={value.country && value.region && value.city ? 'No district options' : 'Select a city first'}
        value={value.district}
        options={districtOptions}
        onSelect={(district) => onChange({ ...value, district })}
        disabled={!value.country || !value.region || !value.city || districtOptions.length === 0}
      />
    </div>
  );
}