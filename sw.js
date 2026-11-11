/* GaronchiHisaab offline support. Bump VERSION whenever any file changes so phones pick up the update. */
const VERSION = 'gh-v32';
const FILES = ['./', 'index.html', 'css/styles.css', 'js/firebase-config.js', 'js/icons.js', 'js/store.js', 'js/cloud.js', 'js/charts.js', 'js/leaves.js', 'js/app.js', 'manifest.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
/* network first so updates arrive when online; the saved copy is used when offline */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  /* the sign-in library and the typeface come from Google: keep a saved copy so the app opens offline */
  const library = url.origin === 'https://www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
  const font = url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com';
  if (library || font) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return res;
    })));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(
    /* no-cache: always check with the server, so an edited file is never served stale */
    fetch(e.request, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
