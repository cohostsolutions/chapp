import { useState, useEffect, useCallback, useRef } from 'react';
import { devError, devWarn } from '@/lib/logger';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAInstallState {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isStandalone: boolean;
}

type NavigatorWithPWA = Navigator & { standalone?: boolean };
type ServiceWorkerWithSync = ServiceWorkerContainer & {
  sync?: {
    register: (tag: string) => Promise<void>;
  };
};

/**
 * Hook for managing PWA installation
 */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [state, setState] = useState<PWAInstallState>({
    isInstallable: false,
    isInstalled: false,
    isIOS: false,
    isStandalone: false,
  });

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as NavigatorWithPWA).standalone === true;
    
    // Check if iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    setState(prev => ({
      ...prev,
      isStandalone,
      isInstalled: isStandalone,
      isIOS,
    }));

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setState(prev => ({ ...prev, isInstallable: true }));
    };

    // Listen for successful install
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setState(prev => ({ 
        ...prev, 
        isInstallable: false, 
        isInstalled: true,
        isStandalone: true,
      }));
      toast.success('App installed successfully!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      if (state.isIOS) {
        toast.info('To install on iOS:', {
          description: 'Tap the Share button, then "Add to Home Screen"',
          duration: 7000,
        });
      } else {
        toast.error('Installation not available', {
          description: 'Please try refreshing the page or use a different browser.',
        });
      }
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setState(prev => ({ ...prev, isInstallable: false }));
        toast.success('Installing...', {
          description: 'The app will be added to your home screen shortly.',
        });
        return true;
      } else {
        toast.info('Installation cancelled', {
          description: 'You can install later from the menu.',
        });
      }
      return false;
    } catch (error) {
      devError('Install prompt error:', error);
      toast.error('Installation failed', {
        description: 'Please try again or check your browser settings.',
      });
      return false;
    }
  }, [deferredPrompt, state.isIOS]);

  const dismissInstall = useCallback(() => {
    setDeferredPrompt(null);
    setState(prev => ({ ...prev, isInstallable: false }));
    // Store dismissal in localStorage
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  }, []);

  const shouldShowPrompt = useCallback(() => {
    if (state.isInstalled || state.isStandalone) return false;
    
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      // Don't show for 7 days after dismissal
      const dismissedTime = parseInt(dismissed, 10);
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return false;
      }
    }
    
    return state.isInstallable || state.isIOS;
  }, [state]);

  return {
    ...state,
    promptInstall,
    dismissInstall,
    shouldShowPrompt,
  };
}

/**
 * Hook for offline detection and sync status
 */
export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online!', { description: 'Syncing pending changes...' });
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You\'re offline', { 
        description: 'Changes will be saved and synced when you\'re back online.' 
      });
    };

    // Listen for service worker messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'SYNC_SUCCESS') {
        setPendingSyncs(prev => Math.max(0, prev - 1));
        setLastSyncTime(new Date());
      } else if (event.data.type === 'SYNC_QUEUED') {
        setPendingSyncs(prev => prev + 1);
      } else if (event.data.type === 'BACKEND_ERROR') {
        toast.error('Connection issue', {
          description: 'Some features may not work properly.',
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    navigator.serviceWorker?.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, []);

  const forceSync = useCallback(async () => {
    if (!isOnline) {
      toast.warning('Still offline', {
        description: 'Sync will start automatically when you\'re back online.',
      });
      return;
    }
    
    try {
      const serviceWorkerWithSync = navigator.serviceWorker as ServiceWorkerWithSync | undefined;
      if ('serviceWorker' in navigator && serviceWorkerWithSync?.sync) {
        const registration = await serviceWorkerWithSync.ready;
        await serviceWorkerWithSync.sync.register('sync-failed-requests');
        toast.success('Syncing...', {
          description: 'Your changes are being synchronized.',
        });
      } else {
        toast.info('Manual sync not available', {
          description: 'Changes will sync automatically.',
        });
      }
    } catch (error) {
      devError('Sync error:', error);
      toast.error('Sync failed', {
        description: 'Please try again in a moment.',
      });
    }
  }, [isOnline]);

  return {
    isOnline,
    pendingSyncs,
    lastSyncTime,
    forceSync,
  };
}

/**
 * Hook for PWA update detection
 */
export function usePWAUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const applyingUpdateRef = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleUpdate = () => {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setUpdateAvailable(true);
        }
      });
    };

    // Check on load
    handleUpdate();

    // Prevent surprise reloads while users are editing (only reload after user clicks "Update")
    const onControllerChange = () => {
      if (applyingUpdateRef.current) {
        window.location.reload();
      } else {
        // An update took control unexpectedly; surface the banner instead of reloading.
        handleUpdate();
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // Check periodically
    const interval = setInterval(handleUpdate, 60000);

    return () => {
      clearInterval(interval);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      applyingUpdateRef.current = true;
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      toast.info('Updating app...', { description: 'The page will reload shortly.' });
    }
  }, [waitingWorker]);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  return {
    updateAvailable,
    applyUpdate,
    dismissUpdate,
  };
}
