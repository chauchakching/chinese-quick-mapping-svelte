'use strict';

// Update cache names any time any of the cached files change.
const CACHE_NAME = 'static-cache-v2';
const IMAGE_CACHE_NAME = 'image-cache-v1';

// Add list of files to cache here.
const FILES_TO_CACHE = ['/'];

// Maximum number of images to keep in cache (to prevent unlimited storage growth)
const MAX_IMAGE_CACHE_SIZE = 1000;

self.addEventListener('install', (evt) => {
  console.log('[ServiceWorker] Install');

  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching offline page');
      return cache.addAll(FILES_TO_CACHE);
    })
  );

  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  console.log('[ServiceWorker] Activate');
  // Remove previous cached data from disk.
  evt.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME && key !== IMAGE_CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );

  self.clients.claim();
});

// Helper function to manage cache size
async function manageCacheSize(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length > maxSize) {
    // Remove oldest entries (FIFO approach)
    const keysToDelete = keys.slice(0, keys.length - maxSize);
    await Promise.all(keysToDelete.map((key) => cache.delete(key)));
    console.log(`[ServiceWorker] Removed ${keysToDelete.length} old cache entries`);
  }
}

// Helper function to handle image caching
async function handleImageRequest(request) {
  try {
    // Try cache first
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      console.log('[ServiceWorker] Image served from cache:', request.url);
      return cachedResponse;
    }

    // If not in cache, fetch from network
    console.log('[ServiceWorker] Fetching image from network:', request.url);
    const response = await fetch(request);

    // Cache the response if it's successful
    if (response.ok) {
      // Clone the response before caching (response can only be consumed once)
      await cache.put(request, response.clone());
      console.log('[ServiceWorker] Image cached:', request.url);

      // Manage cache size to prevent unlimited growth
      await manageCacheSize(IMAGE_CACHE_NAME, MAX_IMAGE_CACHE_SIZE);
    }

    return response;
  } catch (error) {
    console.error('[ServiceWorker] Error handling image request:', error);
    // Return a network fetch as fallback
    return fetch(request);
  }
}

self.addEventListener('fetch', (evt) => {
  const url = new URL(evt.request.url);

  // Handle character images (SVG files in chars/ directory)
  if (url.pathname.startsWith('/chars/') && url.pathname.endsWith('.svg')) {
    console.log('[ServiceWorker] Handling image request:', evt.request.url);
    evt.respondWith(handleImageRequest(evt.request));
    return;
  }

  // Handle navigation requests (original logic)
  if (evt.request.mode !== 'navigate') {
    // Not a page navigation and not an image, let browser handle it
    return;
  }

  evt.respondWith(
    fetch(evt.request).catch(() => {
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.match('offline.html');
      });
    })
  );
});
