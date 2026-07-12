const CACHE_NAME = 'cute-sticky-shell-v1'
const CORE_FILES = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/offline.html',
]

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME)
  await Promise.allSettled(CORE_FILES.slice(1).map(path => cache.add(path)))

  const response = await fetch('/')
  if (!response.ok) throw new Error(`App shell returned ${response.status}`)
  await cache.put('/', response.clone())

  const html = await response.text()
  const assetPaths = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
    .map(match => new URL(match[1], self.location.origin))
    .filter(url => url.origin === self.location.origin)
    .map(url => `${url.pathname}${url.search}`)
  await Promise.allSettled([...new Set(assetPaths)].map(path => cache.add(path)))
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) (await caches.open(CACHE_NAME)).put('/', response.clone())
          return response
        })
        .catch(async () => (await caches.match('/')) ?? (await caches.match('/offline.html'))),
    )
    return
  }

  const cacheableAsset = url.origin === self.location.origin
    && ['script', 'style', 'image', 'font', 'manifest'].includes(request.destination)
  if (!cacheableAsset) return

  event.respondWith(
    caches.match(request).then(cached => cached ?? fetch(request).then(async (response) => {
      if (response.ok) (await caches.open(CACHE_NAME)).put(request, response.clone())
      return response
    })),
  )
})
