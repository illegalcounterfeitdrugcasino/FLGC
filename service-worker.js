const CACHE_NAME = 'flgc-cache-v5525';
const urlsToCache = [
  '/',
  '/index.html',
  '/apple-touch-icon.png',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@700&display=swap',
  'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/11.6.0/firebase-analytics.js',
  'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js'
];

// Install the service worker and cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate the service worker and clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Handle fetch requests
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached response if available
        if (response) {
          return response;
        }
        // Fetch from network if not cached
        return fetch(event.request).then(networkResponse => {
          // Cache the new response for future use
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
            });
          }
          return networkResponse;
        });
      }).catch(() => {
        // Fallback for offline HTML requests
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
  );
});

// Listen for messages from the client to clear cache
self.addEventListener('message', event => {
  if (event.data.action === 'clearCache') {
    caches.delete(CACHE_NAME).then(() => {
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ action: 'cacheCleared' });
        });
      });
    });
  }
});
