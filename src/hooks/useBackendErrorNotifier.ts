import { useEffect } from 'react';
import { toast } from 'sonner';

interface BackendErrorData {
  type: 'BACKEND_ERROR';
  url: string;
  error: string;
  timestamp: number;
}

/**
 * Hook that listens for backend error messages from the service worker
 * and displays toast notifications to help users distinguish between
 * offline mode and actual server issues.
 */
export function useBackendErrorNotifier() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BACKEND_ERROR') {
        const { url, error } = event.data as BackendErrorData;
        
        // Extract function/endpoint name from URL for cleaner message
        let endpoint = 'Backend';
        try {
          const urlObj = new URL(url);
          if (urlObj.pathname.includes('/functions/')) {
            const parts = urlObj.pathname.split('/functions/');
            endpoint = parts[1]?.split('/')[0] || 'Backend function';
          } else if (urlObj.pathname.includes('/rest/')) {
            endpoint = 'Database';
          }
        } catch {
          // Keep default
        }

        // Create retry function
        const handleRetry = async () => {
          try {
            const response = await fetch(url);
            if (response.ok) {
              toast.success('Request succeeded', {
                description: 'The retry was successful.',
                duration: 3000,
              });
            } else {
              toast.error('Retry failed', {
                description: `Server returned ${response.status}`,
                duration: 3000,
              });
            }
          } catch (retryError) {
            toast.error('Retry failed', {
              description: 'Could not reach the server.',
              duration: 3000,
            });
          }
        };

        toast.error(`${endpoint} error`, {
          description: error || 'A server error occurred. Please try again.',
          duration: 8000,
          action: {
            label: 'Retry',
            onClick: handleRetry,
          },
        });
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);
}

