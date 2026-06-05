import React from 'react';
import { EnhancedEmptyState, InlineEmptyState } from './EnhancedEmptyState';
import { CardListSkeleton, TableSkeleton } from './skeletons';
import { SectionErrorBoundary } from '@/components/ErrorBoundary';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface DataListProps<T> {
  data: T[] | undefined;
  isLoading: boolean;
  error?: Error | null;
  emptyState: {
    type?: 'leads' | 'orders' | 'bookings' | 'conversations' | 'reports' | 'search' | 'custom';
    title?: string;
    description?: string;
    icon?: LucideIcon;
    action?: {
      label: string;
      onClick: () => void;
      icon?: LucideIcon;
    };
  };
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
  skeletonCount?: number;
  skeletonType?: 'cards' | 'table';
  tableColumns?: number;
  className?: string;
  listClassName?: string;
  sectionName?: string;
}

/**
 * Generic data list component with consistent loading, empty, and error states
 */
export function DataList<T>({
  data,
  isLoading,
  error,
  emptyState,
  renderItem,
  keyExtractor,
  skeletonCount = 5,
  skeletonType = 'cards',
  tableColumns = 6,
  className,
  listClassName,
  sectionName = 'Data list',
}: DataListProps<T>) {
  // Loading state
  if (isLoading) {
    return (
      <div className={className} role="status" aria-label="Loading">
        {skeletonType === 'table' ? (
          <TableSkeleton rows={skeletonCount} columns={tableColumns} />
        ) : (
          <CardListSkeleton count={skeletonCount} />
        )}
        <span className="sr-only">Loading {sectionName}...</span>
      </div>
    );
  }

  // Error state - handled by parent error boundary
  if (error) {
    throw error;
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className={className}>
        <EnhancedEmptyState
          type={emptyState.type}
          title={emptyState.title}
          description={emptyState.description}
          icon={emptyState.icon}
          action={emptyState.action}
        />
      </div>
    );
  }

  // Data list
  return (
    <SectionErrorBoundary name={sectionName}>
      <div 
        className={cn("space-y-4", className)}
        role="list"
        aria-label={sectionName}
      >
        <div className={listClassName}>
          {data.map((item, index) => (
            <div key={keyExtractor(item)} role="listitem">
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </SectionErrorBoundary>
  );
}

interface DataTableProps<T> {
  data: T[] | undefined;
  isLoading: boolean;
  columns: {
    key: string;
    header: string;
    render: (item: T) => React.ReactNode;
    className?: string;
  }[];
  emptyState: {
    title: string;
    description: string;
    icon?: LucideIcon;
    action?: {
      label: string;
      onClick: () => void;
    };
  };
  keyExtractor: (item: T) => string;
  skeletonRows?: number;
  className?: string;
  sectionName?: string;
  onRowClick?: (item: T) => void;
}

/**
 * Generic data table with consistent loading, empty, and error states
 */
export function DataTable<T>({
  data,
  isLoading,
  columns,
  emptyState,
  keyExtractor,
  skeletonRows = 5,
  className,
  sectionName = 'Data table',
  onRowClick,
}: DataTableProps<T>) {
  // Loading state
  if (isLoading) {
    return (
      <div className={className} role="status" aria-label="Loading">
        <TableSkeleton rows={skeletonRows} columns={columns.length} />
        <span className="sr-only">Loading {sectionName}...</span>
      </div>
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className={className}>
        <InlineEmptyState
          message={emptyState.description}
          action={emptyState.action}
        />
      </div>
    );
  }

  // Data table
  return (
    <SectionErrorBoundary name={sectionName}>
      <div className={cn("overflow-x-auto", className)}>
        <table className="w-full" role="table" aria-label={sectionName}>
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn("py-3 px-4 text-left text-sm font-medium text-muted-foreground", col.className)}
                  scope="col"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className={cn(
                  "border-b border-border transition-colors",
                  onRowClick && "cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50"
                )}
                onClick={() => onRowClick?.(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onRowClick?.(item);
                  }
                }}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? "button" : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn("py-3 px-4", col.className)}>
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionErrorBoundary>
  );
}
