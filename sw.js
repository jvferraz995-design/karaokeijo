// Karaokeijo: o app sempre busca a versão nova primeiro e só usa a cópia guardada sem internet.
const CACHE_VERSION = 'karaokeijo-v2';
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/applause.mp3', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png'];
const LYRICS_CACHE = 'karaokeijo-lrclib-v1';
const LYRICS_MAX = 300;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(APP_SHELL)).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION && k !== LYRICS_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimLyrics(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - LYRICS_MAX; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Letras do LRCLIB: cache primeiro (abrem na hora se já foram buscadas), com limite de tamanho
  if (url.hostname === 'lrclib.net' && url.pathname.startsWith('/api/')) {
    event.respondWith(caches.open(LYRICS_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response && response.ok) { cache.put(request, response.clone()); trimLyrics(cache); }
      return response;
    }));
    return;
  }

  // Arquivos do próprio site: rede primeiro (sempre a versão mais nova), cópia guardada só sem internet
  if (url.origin === self.location.origin) {
    event.respondWith(caches.open(CACHE_VERSION).then(async (cache) => {
      try {
        const response = await fetch(request, { cache: 'no-cache' });
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || (await cache.match('/index.html')) || Response.error();
      }
    }));
  }
});
