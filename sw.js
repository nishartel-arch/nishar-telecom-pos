/* =============================================
   NISHAR TELECOM POS — Service Worker
   Enables offline capability
   ============================================= */
const CACHE  = 'nishar-pos-v2';
const ASSETS = [
  '/', '/index.html', '/login.html',
  '/billing.html', '/inventory.html', '/customers.html',
  '/purchases.html', '/analytics.html', '/sales.html',
  '/css/variables.css', '/css/style.css',
  '/js/firebase.js', '/js/app.js', '/js/dashboard.js',
  '/js/billing.js', '/js/inventory.js', '/js/customers.js',
  '/js/purchases.js', '/js/analytics.js', '/js/sales.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== CACHE).map(k => caches.delete(k))
  )));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('firestore.googleapis.com') ||
      e.request.url.includes('googleapis.com')) return; // skip Firebase

  e.respondWith(
    caches.match(e.request).then(cached => cached ||
      fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
    )
  );
});
