import { useState } from 'react';
import { devError } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Trash2, Edit, Send, Archive, Tag, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { devLog } from '@/lib/logger';

export interface BulkAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline';
  requiresConfirmation?: boolean;
  confirmationTitle?: string;
  confirmationDescription?: string;
  action: (selectedIds: string[]) => Promise<void>;
}

interface BulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  actions: BulkAction[];
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  className?: string;
}

export function BulkActionsBar({
  selectedCount,
  totalCount,
  actions,
  onSelectAll,
  onClearSelection,
  className,
}: BulkActionsBarProps) {
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleAction = async (action: BulkAction) => {
    if (action.requiresConfirmation) {
      setPendingAction(action);
    } else {
      await executeAction(action);
    }
  };

  const executeAction = async (action: BulkAction) => {
    setIsExecuting(true);
    try {
      // This would be passed selected IDs from parent
      await action.action([]);
      onClearSelection?.();
    } catch (error) {
      devError('Bulk action failed:', error);
    } finally {
      setIsExecuting(false);
      setPendingAction(null);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <div
        className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
          'bg-background border rounded-lg shadow-lg p-3',
          'flex items-center gap-3 min-w-[400px]',
          'animate-in slide-in-from-bottom-5',
          className
        )}
      >
        <Badge variant="secondary" className="px-3 py-1">
          {selectedCount} selected
        </Badge>

        {onSelectAll && selectedCount < totalCount && (
          <Button variant="link" size="sm" onClick={onSelectAll} className="h-auto p-0">
            Select all {totalCount}
          </Button>
        )}

        {onClearSelection && (
          <Button variant="link" size="sm" onClick={onClearSelection} className="h-auto p-0">
            Clear
          </Button>
        )}

        <div className="flex-1" />

        <div className="flex gap-2">
          {actions.map((action) => (
            <Button
              key={action.id}
              variant={action.variant || 'outline'}
              size="sm"
              onClick={() => handleAction(action)}
              disabled={isExecuting}
              className="gap-2"
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!pendingAction} onOpenChange={() => setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.confirmationTitle || 'Confirm Action'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.confirmationDescription ||
                `Are you sure you want to perform this action on ${selectedCount} item(s)?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isExecuting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingAction && executeAction(pendingAction)}
              disabled={isExecuting}
            >
              {isExecuting ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Common bulk actions for leads
 */
export const leadBulkActions: BulkAction[] = [
  {
    id: 'assign',
    label: 'Assign Agent',
    icon: <UserPlus className="h-4 w-4" />,
    action: async (ids) => {
      devLog('Assign agent to:', ids);
    },
  },
  {
    id: 'update-status',
    label: 'Update Status',
    icon: <Edit className="h-4 w-4" />,
    action: async (ids) => {
      devLog('Update status for:', ids);
    },
  },
  {
    id: 'add-tag',
    label: 'Add Tag',
    icon: <Tag className="h-4 w-4" />,
    action: async (ids) => {
      devLog('Add tag to:', ids);
    },
  },
  {
    id: 'send-message',
    label: 'Send Message',
    icon: <Send className="h-4 w-4" />,
    action: async (ids) => {
      devLog('Send message to:', ids);
    },
  },
  {
    id: 'archive',
    label: 'Archive',
    icon: <Archive className="h-4 w-4" />,
    requiresConfirmation: true,
    confirmationTitle: 'Archive Leads',
    confirmationDescription: 'Are you sure you want to archive these leads?',
    action: async (ids) => {
      devLog('Archive:', ids);
    },
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: <Trash2 className="h-4 w-4" />,
    variant: 'destructive',
    requiresConfirmation: true,
    confirmationTitle: 'Delete Leads',
    confirmationDescription: 'This action cannot be undone. Are you sure?',
    action: async (ids) => {
      devLog('Delete:', ids);
    },
  },
];

/**
 * Hook for managing bulk selection
 */
export function useBulkSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  };

  const selectAll = () => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const isSelected = (id: string) => selectedIds.has(id);

  const isAllSelected = items.length > 0 && selectedIds.size === items.length;

  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < items.length;

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggleSelection,
    toggleAll,
    selectAll,
    clearSelection,
    isSelected,
    isAllSelected,
    isSomeSelected,
  };
}
