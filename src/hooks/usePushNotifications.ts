import { useState, useEffect, useCallback } from 'react';
import { devError, devWarn } from '@/lib/logger';
import { toast } from 'sonner';

interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: 'default',
    isSubscribed: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Check support and current state
  useEffect(() => {
    const isSupported = 'Notification' in window && 'serviceWorker' in navigator;
    
    setState((prev) => ({
      ...prev,
      isSupported,
      permission: isSupported ? Notification.permission : 'denied',
    }));

    if (isSupported && Notification.permission === 'granted') {
      checkSubscription();
    }
  }, []);

  // Check if already subscribed
  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setState((prev) => ({ ...prev, isSubscribed: !!subscription }));
    } catch (error) {
      devError('Failed to check push subscription:', error);
    }
  };

  // Request permission and subscribe
  const requestPermission = useCallback(async () => {
    if (!state.isSupported) {
      toast.error('Push notifications are not supported in this browser');
      return false;
    }

    setIsLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setState((prev) => ({ ...prev, permission }));

      if (permission === 'granted') {
        toast.success('Notifications enabled!');
        return true;
      } else if (permission === 'denied') {
        toast.error('Notification permission denied');
        return false;
      }
      return false;
    } catch (error) {
      devError('Failed to request notification permission:', error);
      toast.error('Failed to enable notifications');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [state.isSupported]);

  // Show a local notification
  const showNotification = useCallback(
    async (title: string, options?: NotificationOptions) => {
      if (!state.isSupported || state.permission !== 'granted') {
        devWarn('Cannot show notification: permission not granted');
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          ...options,
        });
      } catch (error) {
        devError('Failed to show notification:', error);
      }
    },
    [state.isSupported, state.permission]
  );

  // Notify about sync events
  const notifySyncComplete = useCallback(
    async (successCount: number, failedCount: number) => {
      if (successCount === 0 && failedCount === 0) return;

      const title = failedCount > 0 ? 'Sync Partially Complete' : 'Sync Complete';
      const body =
        failedCount > 0
          ? `${successCount} synced, ${failedCount} failed`
          : `${successCount} changes synced successfully`;

      await showNotification(title, {
        body,
        tag: 'sync-status',
        data: { type: 'sync', successCount, failedCount },
      });
    },
    [showNotification]
  );

  // Notify about offline status
  const notifyOfflineStatus = useCallback(
    async (isOnline: boolean) => {
      if (!isOnline) {
        await showNotification('You are offline', {
          body: 'Changes will be synced when you reconnect',
          tag: 'offline-status',
          requireInteraction: false,
        });
      } else {
        await showNotification('Back online', {
          body: 'Syncing pending changes...',
          tag: 'offline-status',
          requireInteraction: false,
        });
      }
    },
    [showNotification]
  );

  // Notify about new data
  const notifyNewData = useCallback(
    async (type: string, message: string) => {
      await showNotification(`New ${type}`, {
        body: message,
        tag: `new-${type}`,
        data: { type: 'new-data', dataType: type },
      });
    },
    [showNotification]
  );

  return {
    ...state,
    isLoading,
    requestPermission,
    showNotification,
    notifySyncComplete,
    notifyOfflineStatus,
    notifyNewData,
  };
}
