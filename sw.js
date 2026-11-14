// Ricettario — service worker
// index.html: network-first (sempre l'ultima versione quando c'è rete, cache se offline)
// file statici, font e SDK Firebase: stale-while-revalidate
// API (Firebase DB, Gemini, proxy, foto): mai in cache
const VERSION = 'ric-v4';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './logo.svg', './favicon-32.png'];
const NO_CACHE = /firebasedatabase\.app|firebaseio\.com|googleapis\.com\/(identitytoolkit|securetoken)|identitytoolkit|securetoken|generativelanguage|r\.jina\.ai|allorigins|codetabs|api\.unsplash|api\.pexels/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || NO_CACHE.test(req.url)) return;
  const url = new URL(req.url);
  const isPage = req.mode === 'navigate' || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname));

  if (isPage) {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); }
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  const cacheable = url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com|www\.gstatic\.com\/firebasejs|images\.unsplash\.com|images\.pexels\.com/.test(url.host + url.pathname);
  if (!cacheable) return;
  e.respondWith(
    caches.open(VERSION).then(cache =>
      cache.match(req).then(hit => {
        const net = fetch(req).then(res => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    )
  );
});
