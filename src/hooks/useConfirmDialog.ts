import { useState, useCallback } from 'react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

interface UseConfirmDialogOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: 'default' | 'destructive';
}

export function useConfirmDialog(options: UseConfirmDialogOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const confirm = useCallback((action: () => void | Promise<void>) => {
    setPendingAction(() => async () => {
      setIsLoading(true);
      try {
        await action();
      } finally {
        setIsLoading(false);
        setIsOpen(false);
      }
    });
    setIsOpen(true);
  }, []);

  const handleConfirm = useCallback(() => {
    if (pendingAction) {
      pendingAction();
    }
  }, [pendingAction]);

  const dialogProps = {
    open: isOpen,
    onOpenChange: setIsOpen,
    onConfirm: handleConfirm,
    isLoading,
    ...options,
  };

  return { confirm, dialogProps, ConfirmDialog };
}
