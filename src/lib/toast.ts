import { toast as sonnerToast } from 'sonner';

/**
 * Enhanced toast notifications with consistent styling
 */

export const toast = {
  /**
   * Success toast
   */
  success: (message: string, description?: string) => {
    sonnerToast.success(message, {
      description,
      duration: 4000,
    });
  },

  /**
   * Error toast
   */
  error: (message: string, description?: string) => {
    sonnerToast.error(message, {
      description,
      duration: 5000,
    });
  },

  /**
   * Warning toast
   */
  warning: (message: string, description?: string) => {
    sonnerToast.warning(message, {
      description,
      duration: 4000,
    });
  },

  /**
   * Info toast
   */
  info: (message: string, description?: string) => {
    sonnerToast.info(message, {
      description,
      duration: 4000,
    });
  },

  /**
   * Loading toast (returns ID for dismissal)
   */
  loading: (message: string, description?: string) => {
    return sonnerToast.loading(message, {
      description,
    });
  },

  /**
   * Promise toast (automatically shows loading, then success/error)
   */
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: unknown) => string);
    }
  ) => {
    return sonnerToast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
    });
  },

  /**
   * Dismiss a specific toast
   */
  dismiss: (toastId?: string | number) => {
    sonnerToast.dismiss(toastId);
  },

  /**
   * Custom toast with action button
   */
  custom: (
    message: string,
    options: {
      description?: string;
      action?: {
        label: string;
        onClick: () => void;
      };
      duration?: number;
    }
  ) => {
    sonnerToast(message, {
      description: options.description,
      duration: options.duration || 4000,
      action: options.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
    });
  },
};

/**
 * Common toast messages for CRUD operations
 */
export const toastMessages = {
  create: {
    success: (entity: string) => `${entity} created successfully`,
    error: (entity: string) => `Failed to create ${entity}`,
  },
  update: {
    success: (entity: string) => `${entity} updated successfully`,
    error: (entity: string) => `Failed to update ${entity}`,
  },
  delete: {
    success: (entity: string) => `${entity} deleted successfully`,
    error: (entity: string) => `Failed to delete ${entity}`,
  },
  fetch: {
    error: (entity: string) => `Failed to fetch ${entity}`,
  },
};
