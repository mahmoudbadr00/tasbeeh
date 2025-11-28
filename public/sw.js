// Service Worker for Voice Subha PWA
const CACHE_NAME = 'voice-subha-v1';
const OFFLINE_URL = '/offline.html';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Install event - precache assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      console.log('[ServiceWorker] Caching app shell');
      
      // Cache precache assets, but don't fail if some are missing
      for (const asset of PRECACHE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (error) {
          console.warn(`[ServiceWorker] Failed to cache ${asset}:`, error);
        }
      }
      
      // Skip waiting to activate immediately
      await self.skipWaiting();
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  
  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[ServiceWorker] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
      
      // Take control of all clients immediately
      await self.clients.claim();
    })()
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip chrome-extension and other non-http(s) requests
  if (!event.request.url.startsWith('http')) return;
  
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      
      // Try to get from cache first
      const cachedResponse = await cache.match(event.request);
      
      if (cachedResponse) {
        // Return cached response and update cache in background
        event.waitUntil(
          (async () => {
            try {
              const networkResponse = await fetch(event.request);
              if (networkResponse.ok) {
                await cache.put(event.request, networkResponse.clone());
              }
            } catch (error) {
              // Network failed, that's okay - we have cache
            }
          })()
        );
        
        return cachedResponse;
      }
      
      // Not in cache, try network
      try {
        const networkResponse = await fetch(event.request);
        
        // Cache successful responses
        if (networkResponse.ok) {
          // Don't cache API calls or external resources
          const url = new URL(event.request.url);
          if (url.origin === self.location.origin) {
            await cache.put(event.request, networkResponse.clone());
          }
        }
        
        return networkResponse;
      } catch (error) {
        // Network failed and not in cache
        // Return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          const offlineResponse = await cache.match(OFFLINE_URL);
          if (offlineResponse) {
            return offlineResponse;
          }
        }
        
        // Return a simple error response
        return new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable',
        });
      }
    })()
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push received');
  
  let data = {
    title: '📿 السبحة الصوتية',
    body: 'حان وقت ذكر الله',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'dhikr-reminder',
    renotify: true,
    requireInteraction: false,
    dir: 'rtl',
    lang: 'ar',
    actions: [
      {
        action: 'open',
        title: 'فتح التطبيق',
      },
      {
        action: 'dismiss',
        title: 'تجاهل',
      },
    ],
  };
  
  // Try to parse push data
  if (event.data) {
    try {
      const pushData = event.data.json();
      data = { ...data, ...pushData };
    } catch (error) {
      data.body = event.data.text();
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, data)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification click:', event.action);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  // Open or focus the app
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      
      // Try to focus existing window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })()
  );
});

// Periodic background sync for reminders
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'dhikr-reminder-sync') {
    event.waitUntil(checkAndSendReminder());
  }
});

async function checkAndSendReminder() {
  // Get stored reminder settings
  const cache = await caches.open(CACHE_NAME);
  
  // Show reminder notification
  await self.registration.showNotification('📿 وقت الأذكار', {
    body: 'حان وقت ذكر الله. اللهم اجعلنا من الذاكرين.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'dhikr-reminder',
    renotify: true,
    dir: 'rtl',
    lang: 'ar',
  });
}

// Message handler for communication with main app
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'SCHEDULE_REMINDER') {
    // Schedule a reminder (would need periodic background sync or push subscription)
    console.log('[ServiceWorker] Reminder scheduled for:', event.data.time);
  }
});
