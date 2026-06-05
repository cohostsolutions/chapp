import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  connectionType?: string;
}

type NavigatorWithConnection = Navigator & {
  connection?: {
    effectiveType?: string;
    addEventListener?: (type: string, listener: () => void) => void;
    removeEventListener?: (type: string, listener: () => void) => void;
  };
};

export function useNetworkStatus() {
  const { toast } = useToast();
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    wasOffline: false,
  });

  useEffect(() => {
    const handleOnline = () => {
      setStatus(prev => ({ 
        isOnline: true, 
        wasOffline: prev.wasOffline || !prev.isOnline,
        connectionType: (navigator as NavigatorWithConnection).connection?.effectiveType 
      }));
      
      // Show reconnection toast if was offline
      if (!status.isOnline) {
        toast({
          title: "Back online",
          description: "Your connection has been restored.",
        });
      }
    };

    const handleOffline = () => {
      setStatus(prev => ({ 
        ...prev, 
        isOnline: false 
      }));
      
      toast({
        title: "You're offline",
        description: "Some features may be unavailable until you reconnect.",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check connection type if available
    if ('connection' in navigator) {
      const connection = (navigator as NavigatorWithConnection).connection;
      setStatus(prev => ({
        ...prev,
        connectionType: connection?.effectiveType,
      }));

      const handleConnectionChange = () => {
        setStatus(prev => ({
          ...prev,
          connectionType: connection?.effectiveType,
        }));
      };

      connection?.addEventListener?.('change', handleConnectionChange);
      return () => {
        connection?.removeEventListener?.('change', handleConnectionChange);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [status.isOnline, toast]);

  return status;
}

// Hook for retry logic with exponential backoff
interface UseRetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number) => void;
  onMaxRetries?: () => void;
}

export function useRetry(options: UseRetryOptions = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    onRetry,
    onMaxRetries,
  } = options;

  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const retry = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    let attempt = 0;
    
    while (attempt <= maxRetries) {
      try {
        setIsRetrying(true);
        const result = await fn();
        setRetryCount(0);
        setIsRetrying(false);
        return result;
      } catch (error) {
        attempt++;
        setRetryCount(attempt);
        
        if (attempt > maxRetries) {
          setIsRetrying(false);
          onMaxRetries?.();
          throw error;
        }

        onRetry?.(attempt);
        
        // Exponential backoff
        const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    setIsRetrying(false);
    return null;
  }, [maxRetries, initialDelay, maxDelay, onRetry, onMaxRetries]);

  const reset = useCallback(() => {
    setRetryCount(0);
    setIsRetrying(false);
  }, []);

  return {
    retry,
    retryCount,
    isRetrying,
    reset,
  };
}
