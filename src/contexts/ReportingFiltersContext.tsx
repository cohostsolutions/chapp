import { createContext, useContext, useMemo } from 'react';
import { endOfDay, endOfToday, startOfDay, startOfToday, subDays } from 'date-fns';

export type ReportingDateRange = 'today' | '7days' | '30days' | '90days' | 'custom';

export interface ReportingFiltersValue {
  dateRange: ReportingDateRange;
  startDate: string;
  endDate: string;
  selectedAgent: string;
}

export interface ResolvedReportingDateRange {
  start: Date | null;
  end: Date | null;
}

const ReportingFiltersContext = createContext<ReportingFiltersValue | undefined>(undefined);

export function resolveReportingDateRange(filters: Pick<ReportingFiltersValue, 'dateRange' | 'startDate' | 'endDate'>): ResolvedReportingDateRange {
  switch (filters.dateRange) {
    case 'today':
      return { start: startOfToday(), end: endOfToday() };
    case '7days':
      return { start: startOfDay(subDays(new Date(), 6)), end: endOfToday() };
    case '30days':
      return { start: startOfDay(subDays(new Date(), 29)), end: endOfToday() };
    case '90days':
      return { start: startOfDay(subDays(new Date(), 89)), end: endOfToday() };
    case 'custom':
      return {
        start: filters.startDate ? startOfDay(new Date(filters.startDate)) : null,
        end: filters.endDate ? endOfDay(new Date(filters.endDate)) : null,
      };
    default:
      return { start: null, end: null };
  }
}

export function ReportingFiltersProvider({ value, children }: { value: ReportingFiltersValue; children: React.ReactNode }) {
  const memoizedValue = useMemo(() => value, [value]);
  return <ReportingFiltersContext.Provider value={memoizedValue}>{children}</ReportingFiltersContext.Provider>;
}

export function useReportingFilters() {
  const context = useContext(ReportingFiltersContext);
  if (!context) {
    return {
      dateRange: '30days' as ReportingDateRange,
      startDate: '',
      endDate: '',
      selectedAgent: 'all',
    };
  }

  return context;
}