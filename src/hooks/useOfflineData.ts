import { useState, useEffect, useCallback, useRef } from 'react';
import { devError } from '@/lib/logger';
import { useQueryClient } from '@tanstack/react-query';
import {
  openDatabase,
  getAll,
  getById,
  putMany,
  put,
  remove,
  getSyncMetadata,
  updateSyncMetadata,
  addPendingChange,
  getPendingChanges,
  removePendingChange,
  isIndexedDBSupported,
} from '@/lib/indexedDB';
import { supabase } from '@/integrations/supabase/client';
import { usePushNotifications } from './usePushNotifications';
import { toast } from 'sonner';

interface UseOfflineDataOptions {
  storeName: string;
  tableName: string;
  queryKey: string[];
  staleTime?: number; // How long before data is considered stale (ms)
  enabled?: boolean;
}

interface OfflineDataState<T> {
  data: T[];
  isLoading: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  pendingChangesCount: number;
}

// Helper to make dynamic table queries
 
const dynamicFrom = (tableName: string) => (supabase as any).from(tableName);

export function useOfflineData<T extends Record<string, unknown> & { id: string }>({
  storeName,
  tableName,
  queryKey,
  staleTime = 5 * 60 * 1000, // 5 minutes default
  enabled = true,
}: UseOfflineDataOptions) {
  const [state, setState] = useState<OfflineDataState<T>>({
    data: [],
    isLoading: true,
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncedAt: null,
    pendingChangesCount: 0,
  });

  const queryClient = useQueryClient();
  const { notifySyncComplete } = usePushNotifications();
  const syncInProgress = useRef(false);
  const dbSupported = useRef(isIndexedDBSupported());

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOnline: true }));
      syncWithServer();
    };

    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load data from IndexedDB on mount
  useEffect(() => {
    if (!enabled || !dbSupported.current) return;

    const loadOfflineData = async () => {
      try {
        await openDatabase();
        const offlineData = await getAll<T>(storeName);
        const metadata = await getSyncMetadata(storeName);
        const pendingChanges = await getPendingChanges(storeName);

        setState((prev) => ({
          ...prev,
          data: offlineData,
          isLoading: false,
          lastSyncedAt: metadata?.last_synced_at ?? null,
          pendingChangesCount: pendingChanges.length,
        }));

        // Check if data is stale and we're online
        if (navigator.onLine) {
          const isStale =
            !metadata?.last_synced_at ||
            Date.now() - new Date(metadata.last_synced_at).getTime() > staleTime;

          if (isStale) {
            syncWithServer();
          }
        }
      } catch (error) {
        devError('Failed to load offline data:', error);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    loadOfflineData();
  }, [enabled, storeName, staleTime]);

  // Sync with server
  const syncWithServer = useCallback(async () => {
    if (!navigator.onLine || syncInProgress.current || !dbSupported.current) return;

    syncInProgress.current = true;
    setState((prev) => ({ ...prev, isSyncing: true }));

    try {
      // First, push pending changes
      const pendingChanges = await getPendingChanges(storeName);
      let successCount = 0;
      let failedCount = 0;

      for (const change of pendingChanges) {
        try {
          const data = change.data as T;
          switch (change.operation) {
            case 'create':
              await dynamicFrom(tableName).insert(data);
              break;
            case 'update':
              await dynamicFrom(tableName).update(data).eq('id', data.id);
              break;
            case 'delete':
              await dynamicFrom(tableName).delete().eq('id', data.id);
              break;
          }
          await removePendingChange(change.id);
          successCount++;
        } catch (error) {
          devError('Failed to sync change:', error);
          failedCount++;
        }
      }

      // Then, fetch fresh data from server
      const { data: serverData, error } = await dynamicFrom(tableName)
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (serverData) {
        await putMany(storeName, serverData as T[]);
        await updateSyncMetadata(storeName, serverData.length);

        setState((prev) => ({
          ...prev,
          data: serverData as T[],
          lastSyncedAt: new Date().toISOString(),
          pendingChangesCount: failedCount,
        }));

        // Invalidate React Query cache
        queryClient.invalidateQueries({ queryKey });
      }

      // Notify about sync results
      if (pendingChanges.length > 0) {
        await notifySyncComplete(successCount, failedCount);
        if (successCount > 0) {
          toast.success(`Synced ${successCount} changes`);
        }
        if (failedCount > 0) {
          toast.error(`${failedCount} changes failed to sync`);
        }
      }
    } catch (error) {
      devError('Sync failed:', error);
      toast.error('Failed to sync with server');
    } finally {
      syncInProgress.current = false;
      setState((prev) => ({ ...prev, isSyncing: false }));
    }
  }, [storeName, tableName, queryKey, queryClient, notifySyncComplete]);

  // Create a record (offline-first)
  const create = useCallback(
    async (data: Omit<T, 'id'> & { id?: string }) => {
      const newRecord = {
        ...data,
        id: data.id || crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as unknown as T;

      if (dbSupported.current) {
        // Store locally first
        await put(storeName, newRecord);
        setState((prev) => ({
          ...prev,
          data: [newRecord, ...prev.data],
        }));

        if (navigator.onLine) {
          // Sync immediately if online
          try {
            const { error } = await dynamicFrom(tableName).insert(newRecord);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey });
          } catch (error) {
            devError('Failed to sync create:', error);
            await addPendingChange(storeName, 'create', newRecord);
            setState((prev) => ({
              ...prev,
              pendingChangesCount: prev.pendingChangesCount + 1,
            }));
          }
        } else {
          // Queue for later sync
          await addPendingChange(storeName, 'create', newRecord);
          setState((prev) => ({
            ...prev,
            pendingChangesCount: prev.pendingChangesCount + 1,
          }));
          toast.info('Saved offline. Will sync when online.');
        }
      } else {
        // Fallback to direct API call
        const { error } = await dynamicFrom(tableName).insert(newRecord);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey });
      }

      return newRecord;
    },
    [storeName, tableName, queryKey, queryClient]
  );

  // Update a record (offline-first)
  const update = useCallback(
    async (id: string, updates: Partial<T>) => {
      const existingRecord = await getById<T>(storeName, id);
      if (!existingRecord) throw new Error('Record not found');

      const updatedRecord = {
        ...existingRecord,
        ...updates,
        updated_at: new Date().toISOString(),
      } as T;

      if (dbSupported.current) {
        // Update locally first
        await put(storeName, updatedRecord);
        setState((prev) => ({
          ...prev,
          data: prev.data.map((item) => (item.id === id ? updatedRecord : item)),
        }));

        if (navigator.onLine) {
          try {
            const { error } = await dynamicFrom(tableName).update(updates).eq('id', id);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey });
          } catch (error) {
            devError('Failed to sync update:', error);
            await addPendingChange(storeName, 'update', updatedRecord);
            setState((prev) => ({
              ...prev,
              pendingChangesCount: prev.pendingChangesCount + 1,
            }));
          }
        } else {
          await addPendingChange(storeName, 'update', updatedRecord);
          setState((prev) => ({
            ...prev,
            pendingChangesCount: prev.pendingChangesCount + 1,
          }));
          toast.info('Saved offline. Will sync when online.');
        }
      } else {
        const { error } = await dynamicFrom(tableName).update(updates).eq('id', id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey });
      }

      return updatedRecord;
    },
    [storeName, tableName, queryKey, queryClient]
  );

  // Delete a record (offline-first)
  const deleteRecord = useCallback(
    async (id: string) => {
      const existingRecord = await getById<T>(storeName, id);

      if (dbSupported.current) {
        // Delete locally first
        await remove(storeName, id);
        setState((prev) => ({
          ...prev,
          data: prev.data.filter((item) => item.id !== id),
        }));

        if (navigator.onLine) {
          try {
            const { error } = await dynamicFrom(tableName).delete().eq('id', id);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey });
          } catch (error) {
            devError('Failed to sync delete:', error);
            await addPendingChange(storeName, 'delete', existingRecord);
            setState((prev) => ({
              ...prev,
              pendingChangesCount: prev.pendingChangesCount + 1,
            }));
          }
        } else {
          await addPendingChange(storeName, 'delete', existingRecord);
          setState((prev) => ({
            ...prev,
            pendingChangesCount: prev.pendingChangesCount + 1,
          }));
          toast.info('Deleted offline. Will sync when online.');
        }
      } else {
        const { error } = await dynamicFrom(tableName).delete().eq('id', id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey });
      }
    },
    [storeName, tableName, queryKey, queryClient]
  );

  // Manual refresh
  const refresh = useCallback(() => {
    if (navigator.onLine) {
      syncWithServer();
    }
  }, [syncWithServer]);

  return {
    ...state,
    create,
    update,
    delete: deleteRecord,
    refresh,
    syncWithServer,
  };
}
