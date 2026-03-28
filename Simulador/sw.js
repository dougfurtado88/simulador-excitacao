// ═══════════════════════════════════════════════════════════
// SERVICE WORKER — SimExcitação PWA
// Cache offline: landing page + simulador + Chart.js
// ═══════════════════════════════════════════════════════════
const CACHE_NAME = 'simexcitacao-v14';

const ASSETS_STATIC = [
  './',
  './index.html',
  './Simulador_Excitacao.html',
  './manifest.json',
  './icon.svg',
];

const ASSETS_CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
];

// ── Instalar: pré-cachear todos os assets ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Assets locais (devem sempre estar disponíveis)
      cache.addAll(ASSETS_STATIC).catch(err =>
        console.warn('[SW] Falha ao cachear assets locais:', err)
      );
      // CDN: tenta cachear, mas não bloqueia a instalação
      ASSETS_CDN.forEach(url => {
        fetch(url, { mode: 'cors' })
          .then(res => {
            if (res.ok) cache.put(url, res);
          })
          .catch(() => {});
      });
    })
  );
  self.skipWaiting();
});

// ── Ativar: limpar caches antigos ─────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first para CDN, network-first para locais ─
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Ignora requisições não-GET e extensões do navegador
  if (event.request.method !== 'GET') return;
  if (url.startsWith('chrome-extension://')) return;

  // CDN → cache-first (evita falha offline)
  if (ASSETS_CDN.some(cdn => url.includes('cdnjs.cloudflare.com'))) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request, { mode: 'cors' }).then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Google Fonts → cache-first (estética offline)
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return res;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // Assets locais → network-first com fallback cache
  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request).then(cached =>
          cached || caches.match('./index.html')
        )
      )
  );
});
