// IndexedDB wrapper for offline-first data storage

const DB_NAME = 'alcor-nexus-offline';
const DB_VERSION = 1;

interface StoreConfig {
  name: string;
  keyPath: string;
  indexes?: { name: string; keyPath: string; unique?: boolean }[];
}

const STORES: StoreConfig[] = [
  {
    name: 'leads',
    keyPath: 'id',
    indexes: [
      { name: 'organization_id', keyPath: 'organization_id' },
      { name: 'status', keyPath: 'status' },
      { name: 'updated_at', keyPath: 'updated_at' },
    ],
  },
  {
    name: 'communications',
    keyPath: 'id',
    indexes: [
      { name: 'lead_id', keyPath: 'lead_id' },
      { name: 'channel', keyPath: 'channel' },
      { name: 'created_at', keyPath: 'created_at' },
    ],
  },
  {
    name: 'bookings',
    keyPath: 'id',
    indexes: [
      { name: 'organization_id', keyPath: 'organization_id' },
      { name: 'status', keyPath: 'status' },
    ],
  },
  {
    name: 'orders',
    keyPath: 'id',
    indexes: [
      { name: 'organization_id', keyPath: 'organization_id' },
      { name: 'status', keyPath: 'status' },
    ],
  },
  {
    name: 'sync_metadata',
    keyPath: 'store_name',
  },
  {
    name: 'pending_changes',
    keyPath: 'id',
    indexes: [
      { name: 'store_name', keyPath: 'store_name' },
      { name: 'timestamp', keyPath: 'timestamp' },
    ],
  },
];

let dbInstance: IDBDatabase | null = null;

// Open or create the database
export async function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      STORES.forEach((storeConfig) => {
        if (!db.objectStoreNames.contains(storeConfig.name)) {
          const store = db.createObjectStore(storeConfig.name, {
            keyPath: storeConfig.keyPath,
          });

          storeConfig.indexes?.forEach((index) => {
            store.createIndex(index.name, index.keyPath, {
              unique: index.unique ?? false,
            });
          });
        }
      });
    };
  });
}

// Generic CRUD operations
export async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`Failed to get all from ${storeName}`));
  });
}

export async function getById<T>(storeName: string, id: string): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`Failed to get ${id} from ${storeName}`));
  });
}

export async function getByIndex<T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`Failed to get by index from ${storeName}`));
  });
}

export async function put<T extends { id: string }>(
  storeName: string,
  data: T
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to put in ${storeName}`));
  });
}

export async function putMany<T extends { id: string }>(
  storeName: string,
  items: T[]
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    items.forEach((item) => {
      store.put(item);
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error(`Failed to put many in ${storeName}`));
  });
}

export async function remove(storeName: string, id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to delete from ${storeName}`));
  });
}

export async function clear(storeName: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to clear ${storeName}`));
  });
}

// Sync metadata management
interface SyncMetadata {
  store_name: string;
  last_synced_at: string;
  record_count: number;
}

export async function getSyncMetadata(storeName: string): Promise<SyncMetadata | undefined> {
  return getById<SyncMetadata>('sync_metadata', storeName);
}

export async function updateSyncMetadata(
  storeName: string,
  recordCount: number
): Promise<void> {
  await put('sync_metadata', {
    store_name: storeName,
    last_synced_at: new Date().toISOString(),
    record_count: recordCount,
  } as SyncMetadata & { id: string });
}

// Pending changes for offline mutations
interface PendingChange {
  id: string;
  store_name: string;
  operation: 'create' | 'update' | 'delete';
  data: unknown;
  timestamp: string;
}

export async function addPendingChange(
  storeName: string,
  operation: 'create' | 'update' | 'delete',
  data: unknown
): Promise<void> {
  const change: PendingChange = {
    id: `${storeName}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    store_name: storeName,
    operation,
    data,
    timestamp: new Date().toISOString(),
  };
  await put('pending_changes', change);
}

export async function getPendingChanges(storeName?: string): Promise<PendingChange[]> {
  if (storeName) {
    return getByIndex('pending_changes', 'store_name', storeName);
  }
  return getAll('pending_changes');
}

export async function removePendingChange(id: string): Promise<void> {
  await remove('pending_changes', id);
}

export async function clearPendingChanges(storeName?: string): Promise<void> {
  if (storeName) {
    const changes = await getByIndex<PendingChange>('pending_changes', 'store_name', storeName);
    await Promise.all(changes.map((c) => remove('pending_changes', c.id)));
  } else {
    await clear('pending_changes');
  }
}

// Check if IndexedDB is supported
export function isIndexedDBSupported(): boolean {
  return 'indexedDB' in window;
}

// Get database size estimate
export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage ?? 0,
      quota: estimate.quota ?? 0,
    };
  }
  return null;
}
