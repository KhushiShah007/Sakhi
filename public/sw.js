/* Sakhi service worker.
 * - App shell and built assets are cached so the app opens, and Right Now / 3 AM work, with no network.
 * - NOTHING under /api, /f, /b, /l or /webhooks is ever cached: health data and links never sit in a cache.
 * - Bump VERSION to drop old caches. */
const VERSION = 'sakhi-v1'
const NEVER = /\/(api|f|b|l|webhooks|healthz)(\/|$)/

self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(['./', './favicon.svg', './manifest.webmanifest']).catch(() => {})).then(() => self.skipWaiting())) })
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())) })

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin || NEVER.test(url.pathname)) return
  if (req.mode === 'navigate') {
    // network first so updates arrive, cached shell when offline
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put('./', copy)); return r }).catch(() => caches.match('./')))
    return
  }
  // built assets, fonts and icons are content-hashed or static: cache first
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)) } return r })))
})
