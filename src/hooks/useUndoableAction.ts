import { useRef, useCallback } from 'react';
import { devError } from '@/lib/logger';
import { toast } from 'sonner';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const maybeError = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
      error_description?: unknown;
    };

    if (typeof maybeError.message === 'string' && maybeError.message.trim() !== '') {
      return maybeError.message;
    }

    if (typeof maybeError.error_description === 'string' && maybeError.error_description.trim() !== '') {
      return maybeError.error_description;
    }

    if (typeof maybeError.details === 'string' && maybeError.details.trim() !== '') {
      return maybeError.details;
    }

    if (typeof maybeError.hint === 'string' && maybeError.hint.trim() !== '') {
      return maybeError.hint;
    }

    if (typeof maybeError.code === 'string' && maybeError.code.trim() !== '') {
      return `Error code: ${maybeError.code}`;
    }
  }

  return 'An error occurred.';
}

interface UndoableActionOptions<T> {
  /** The action to perform */
  action: () => Promise<T>;
  /** The undo action to reverse the changes */
  undoAction: () => Promise<void>;
  /** Success message shown in toast */
  successMessage: string;
  /** Optional description for success toast */
  successDescription?: string;
  /** Duration in milliseconds before undo expires (default: 10000) */
  duration?: number;
  /** Callback after successful action */
  onSuccess?: (result: T) => void;
  /** Callback after successful undo */
  onUndo?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Hook for performing actions with undo capability
 * Shows a toast notification with an undo button for 10 seconds
 */
export function useUndoableAction() {
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUndoingRef = useRef(false);

  const execute = useCallback(async <T>({
    action,
    undoAction,
    successMessage,
    successDescription,
    duration = 10000,
    onSuccess,
    onUndo,
    onError,
  }: UndoableActionOptions<T>): Promise<T | null> => {
    try {
      // Execute the action
      const result = await action();
      
      // Clear any previous timeout
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }

      // Show toast with undo button
      const toastId = toast.success(successMessage, {
        description: successDescription,
        duration,
        action: {
          label: 'Undo',
          onClick: async () => {
            if (isUndoingRef.current) return;
            
            isUndoingRef.current = true;
            try {
              await undoAction();
              toast.success('Action undone', {
                description: 'The change has been reversed.',
                duration: 3000,
              });
              onUndo?.();
            } catch (error) {
              devError('Undo failed:', error);
              toast.error('Undo failed', {
                description: 'Could not reverse the action.',
                duration: 3000,
              });
            } finally {
              isUndoingRef.current = false;
            }
          },
        },
      });

      onSuccess?.(result);
      return result;
    } catch (error) {
      const normalizedMessage = getErrorMessage(error);

      devError('Action failed:', error);
      toast.error('Action failed', {
        description: normalizedMessage,
        duration: 5000,
      });
      onError?.(error instanceof Error ? error : new Error(normalizedMessage));
      return null;
    }
  }, []);

  return { execute };
}

/**
 * Helper to create a simple undoable update for a Supabase table
 */
type SupabaseUpdateClient<T> = {
  from: (table: string) => {
    update: (values: Partial<T>) => {
      eq: (column: string, value: string) => Promise<{ error?: unknown }>;
    };
  };
};

export function createUndoableUpdate<T extends Record<string, unknown>>(
  supabase: SupabaseUpdateClient<T>,
  table: string,
  id: string,
  newValues: Partial<T>,
  previousValues: Partial<T>
) {
  return {
    action: async () => {
      const { error } = await supabase
        .from(table)
        .update(newValues)
        .eq('id', id);
      if (error) throw error;
      return { id, newValues };
    },
    undoAction: async () => {
      const { error } = await supabase
        .from(table)
        .update(previousValues)
        .eq('id', id);
      if (error) throw error;
    },
  };
}
