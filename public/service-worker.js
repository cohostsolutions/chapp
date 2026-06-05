// Service Worker for PWA support with enhanced pre-caching
const CACHE_NAME = 'alcor-nexus-v5'; // Incremented to force update
const STATIC_CACHE = 'alcor-static-v2';
const DYNAMIC_CACHE = 'alcor-dynamic-v2';
const API_CACHE = 'alcor-api-v2';
const SYNC_QUEUE = 'alcor-sync-queue';
const OFFLINE_PAGE = '/offline.html';

// Cache TTL configuration (in milliseconds)
const CACHE_TTL = {
  api: 5 * 60 * 1000,        // 5 minutes for API responses
  dynamic: 24 * 60 * 60 * 1000, // 24 hours for dynamic assets
  static: 7 * 24 * 60 * 60 * 1000, // 7 days for static assets
};

// Critical assets to pre-cache immediately
const CRITICAL_ASSETS = [
  '/offline.html',
  '/alcor-nexus-logo.svg',
  '/alcor-logo.svg',
  '/favicon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/notification.mp3',
];

// Static assets to cache on first visit
const STATIC_ASSETS = [
  '/manifest.json',
  '/robots.txt',
];

// Font URLs to pre-cache for faster text rendering
const FONT_URLS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
];

// ============= Cache Expiration Helpers =============

// Add timestamp metadata to cached response
function addTimestampToResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('sw-cache-timestamp', Date.now().toString());
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Check if cached response is expired
function isCacheExpired(response, ttl) {
  const timestamp = response.headers.get('sw-cache-timestamp');
  if (!timestamp) return true;
  return Date.now() - parseInt(timestamp, 10) > ttl;
}

// Clean up expired cache entries
async function cleanupExpiredCache(cacheName, ttl) {
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  
  for (const request of requests) {
    const response = await cache.match(request);
    if (response && isCacheExpired(response, ttl)) {
      await cache.delete(request);
    }
  }
}

// ============= Background Sync Queue =============

// Queue a failed request for later retry
async function queueFailedRequest(request) {
  try {
    const cache = await caches.open(SYNC_QUEUE);
    const queueData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: request.method !== 'GET' ? await request.clone().text() : null,
      timestamp: Date.now(),
      retryCount: 0,
    };
    
    // Store with unique key
    const key = `${request.method}-${request.url}-${Date.now()}`;
    await cache.put(
      new Request(`/sync-queue/${key}`),
      new Response(JSON.stringify(queueData), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
    
    // Register for background sync if available
    if ('sync' in self.registration) {
      await self.registration.sync.register('sync-failed-requests');
    }
    
    return true;
  } catch (error) {
    console.error('Failed to queue request:', error);
    return false;
  }
}

// Notify clients of backend errors (when online but fetch failed)
async function notifyClientsOfBackendError(url, errorMessage) {
  try {
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => {
      client.postMessage({
        type: 'BACKEND_ERROR',
        url,
        error: errorMessage,
        timestamp: Date.now(),
      });
    });
  } catch (e) {
    console.error('Failed to notify clients of backend error:', e);
  }
}

// Process queued requests
async function processQueuedRequests() {
  const cache = await caches.open(SYNC_QUEUE);
  const requests = await cache.keys();
  const results = { success: 0, failed: 0 };
  
  for (const cacheRequest of requests) {
    try {
      const response = await cache.match(cacheRequest);
      if (!response) continue;
      
      const queueData = await response.json();
      
      // Skip if too old (older than 24 hours)
      if (Date.now() - queueData.timestamp > 24 * 60 * 60 * 1000) {
        await cache.delete(cacheRequest);
        continue;
      }
      
      // Skip if too many retries
      if (queueData.retryCount >= 3) {
        await cache.delete(cacheRequest);
        continue;
      }
      
      // Rebuild the request
      const requestInit = {
        method: queueData.method,
        headers: queueData.headers,
      };
      
      if (queueData.body && queueData.method !== 'GET') {
        requestInit.body = queueData.body;
      }
      
      const retryRequest = new Request(queueData.url, requestInit);
      const networkResponse = await fetch(retryRequest);
      
      if (networkResponse.ok) {
        await cache.delete(cacheRequest);
        results.success++;
        
        // Notify clients of successful sync
        const clients = await self.clients.matchAll();
        clients.forEach((client) => {
          client.postMessage({
            type: 'SYNC_SUCCESS',
            url: queueData.url,
            method: queueData.method,
          });
        });
      } else {
        // Update retry count
        queueData.retryCount++;
        await cache.put(
          cacheRequest,
          new Response(JSON.stringify(queueData), {
            headers: { 'Content-Type': 'application/json' },
          })
        );
        results.failed++;
      }
    } catch (error) {
      results.failed++;
      console.error('Failed to process queued request:', error);
    }
  }
  
  return results;
}

// Get sync queue status
async function getSyncQueueStatus() {
  const cache = await caches.open(SYNC_QUEUE);
  const requests = await cache.keys();
  return {
    pendingCount: requests.length,
    requests: requests.map((r) => r.url),
  };
}

// ============= Install Event =============

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // Cache critical assets
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.addAll([...CRITICAL_ASSETS, ...STATIC_ASSETS]);
      }),
      // Pre-cache Google Fonts CSS
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return Promise.all(
          FONT_URLS.map((url) =>
            fetch(url, { mode: 'cors' })
              .then((response) => {
                if (response.ok) {
                  cache.put(url, addTimestampToResponse(response));
                }
              })
              .catch(() => {
                // Font caching failed, continue without blocking
              })
          )
        );
      }),
    ])
  );
  self.skipWaiting();
});

// ============= Activate Event =============

self.addEventListener('activate', (event) => {
  const validCaches = [CACHE_NAME, STATIC_CACHE, DYNAMIC_CACHE, API_CACHE, SYNC_QUEUE];
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!validCaches.includes(cacheName)) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Clean up expired entries
      cleanupExpiredCache(API_CACHE, CACHE_TTL.api),
      cleanupExpiredCache(DYNAMIC_CACHE, CACHE_TTL.dynamic),
    ])
  );
  self.clients.claim();
});

// ============= Fetch Event =============

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, addTimestampToResponse(responseClone));
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }

            return caches.match(OFFLINE_PAGE);
          });
        })
    );
    return;
  }

  // Handle Google Fonts - cache first, network fallback
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse && !isCacheExpired(cachedResponse, CACHE_TTL.dynamic)) {
          // Return cached font and update in background
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse.ok) {
                caches.open(DYNAMIC_CACHE).then((cache) => {
                  cache.put(request, addTimestampToResponse(networkResponse));
                });
              }
            })
            .catch(() => {});
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, addTimestampToResponse(responseClone));
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Handle static assets - cache first
  if (CRITICAL_ASSETS.includes(url.pathname) || STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        return cachedResponse || fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, addTimestampToResponse(responseClone));
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Handle JS/CSS bundles - stale-while-revalidate with TTL
  if (url.pathname.match(/\.(js|css)$/)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, addTimestampToResponse(responseClone));
            });
          }
          return networkResponse;
        });
        
        // Return cached if valid, otherwise wait for network
        if (cachedResponse && !isCacheExpired(cachedResponse, CACHE_TTL.dynamic)) {
          return cachedResponse;
        }
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Handle images - cache first with network fallback
  if (url.pathname.match(/\.(png|jpg|jpeg|webp|svg|gif|ico)$/)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse && !isCacheExpired(cachedResponse, CACHE_TTL.static)) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, addTimestampToResponse(responseClone));
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);
      })
    );
    return;
  }

  // Handle API requests - NetworkFirst with cache fallback and sync queue
  if (url.pathname.startsWith('/api') || url.hostname.includes('supabase')) {
    // For non-GET requests, only queue if truly offline
    if (request.method !== 'GET') {
      event.respondWith(
        fetch(request.clone())
          .then((response) => response)
          .catch(async (error) => {
            // Only fake offline response if browser is actually offline
            if (!navigator.onLine) {
              const queued = await queueFailedRequest(request);
              return new Response(
                JSON.stringify({
                  error: 'Offline',
                  queued,
                  message: queued
                    ? 'Request queued for retry when online.'
                    : 'Failed to queue request.',
                }),
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'application/json' },
                }
              );
            }
            // If online but fetch failed (CORS, server error, etc.), notify clients
            // But skip notifications for expected failures (functions that don't exist, etc.)
            const shouldNotify = !(
              request.url.includes('/functions/v1/') && (
                error.message.includes('Failed to fetch') ||
                error.message.includes('404') ||
                error.message.includes('FunctionsHttpError')
              )
            );
            if (shouldNotify) {
              notifyClientsOfBackendError(request.url, error.message || 'Network error');
            }
            throw error;
          })
      );
      return;
    }

    // GET requests - network first with cache fallback
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, addTimestampToResponse(responseClone));
            });
          }
          return networkResponse;
        })
        .catch(async (error) => {
          // Only use cache fallback if truly offline
          if (!navigator.onLine) {
            const cachedResponse = await caches.match(request);
            if (cachedResponse) {
              const isStale = isCacheExpired(cachedResponse, CACHE_TTL.api);
              const headers = new Headers(cachedResponse.headers);
              headers.set('sw-cache-stale', isStale.toString());
              return new Response(cachedResponse.body, {
                status: cachedResponse.status,
                statusText: cachedResponse.statusText,
                headers,
              });
            }
            return new Response(
              JSON.stringify({
                error: 'Offline',
                message: 'You are currently offline. Please check your connection.',
              }),
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }
          // If online but fetch failed, notify clients
          notifyClientsOfBackendError(request.url, error.message || 'Network error');
          throw error;
        })
    );
    return;
  }

  // Default: network first with cache fallback for non-navigation requests
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // For other requests, try index.html
          return caches.match('/index.html');
        });
      })
  );
});

// ============= Background Sync Event =============

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-failed-requests') {
    event.waitUntil(processQueuedRequests());
  }
  if (event.tag === 'sync-leads') {
    event.waitUntil(syncLeads());
  }
});

async function syncLeads() {
  // Sync offline changes when connection is restored
  try {
    const cache = await caches.open('pending-requests');
    const requests = await cache.keys();

    for (const request of requests) {
      await fetch(request);
      await cache.delete(request);
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

// ============= Periodic Cache Cleanup =============

// Run cache cleanup periodically
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cache-cleanup') {
    event.waitUntil(
      Promise.all([
        cleanupExpiredCache(API_CACHE, CACHE_TTL.api),
        cleanupExpiredCache(DYNAMIC_CACHE, CACHE_TTL.dynamic),
      ])
    );
  }
});

// ============= Message Handler =============

self.addEventListener('message', (event) => {
  // Handle skip waiting for PWA updates - CRITICAL for update button to work
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  
  if (event.data.type === 'GET_SYNC_STATUS') {
    getSyncQueueStatus().then((status) => {
      event.ports[0].postMessage(status);
    });
  }
  
  if (event.data.type === 'RETRY_SYNC') {
    processQueuedRequests().then((results) => {
      event.ports[0].postMessage(results);
    });
  }
  
  if (event.data.type === 'CLEANUP_CACHE') {
    Promise.all([
      cleanupExpiredCache(API_CACHE, CACHE_TTL.api),
      cleanupExpiredCache(DYNAMIC_CACHE, CACHE_TTL.dynamic),
    ]).then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});

// ============= Push Notifications =============

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: data.id,
    },
    actions: [
      { action: 'view', title: 'View' },
      { action: 'close', title: 'Close' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'AlCor Nexus', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/')
    );
  }
});

// ============= Share Target =============

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (url.pathname === '/share-target' && event.request.method === 'POST') {
    event.respondWith(handleShareTarget(event.request));
  }
});

async function handleShareTarget(request) {
  const formData = await request.formData();
  const title = formData.get('title');
  const text = formData.get('text');
  const url = formData.get('url');

  const cache = await caches.open('shared-data');
  await cache.put(
    '/shared-data',
    new Response(JSON.stringify({ title, text, url }))
  );

  return Response.redirect('/dashboard', 303);
}
