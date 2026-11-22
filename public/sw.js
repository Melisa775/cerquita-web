/*
 * Cerquita's service worker: what makes the site installable as an app.
 *
 * - Pages (navigations) always come from the network, so a new deploy shows
 *   up right away; without internet a friendly "you're offline" page appears
 *   instead of a browser error (the games are live, so there's nothing to
 *   play offline anyway).
 * - Built files in /assets have a hash in their name and never change, so
 *   they're served from the cache after the first visit (faster startup).
 * - The game server (/api, /ws) is never cached: games are live.
 */
const VERSION = 'cerquita-v1'
const SHELL = ['/offline.html', '/favicon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // fonts and the game server go straight to the network
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) return

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/offline.html')))
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(VERSION).then((cache) => cache.put(req, copy))
            }
            return res
          }),
      ),
    )
  }
})
