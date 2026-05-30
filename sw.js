/* =============================================
   NISHAR TELECOM POS — Service Worker
   Enables offline capability
   ============================================= */
const CACHE  = 'nishar-pos-v42';
const ASSETS = [
  '/', '/index.html', '/login.html', '/offline.html',
  '/billing.html', '/csc.html', '/inventory.html', '/customers.html',
  '/purchases.html', '/analytics.html', '/sales.html', '/expenses.html', '/users.html', '/suppliers.html', '/settings.html',
  '/css/variables.css', '/css/style.css',
  '/js/firebase.js', '/js/app.js', '/js/dashboard.js',
  '/js/billing.js', '/js/csc.js', '/js/inventory.js', '/js/customers.js',
  '/js/purchases.js', '/js/analytics.js', '/js/sales.js', '/js/expenses.js', '/js/users.js', '/js/suppliers.js', '/js/settings.js',
  '/manifest.json',
  '/assets/icon-192.png', '/assets/icon-512.png', '/assets/bill-logo.png',
  '/assets/logo-hexagon-dark.svg', '/assets/logo-hexagon-light.svg',
  '/assets/fav-dashboard.svg', '/assets/fav-billing.svg',
  '/assets/fav-inventory.svg', '/assets/fav-sales.svg',
  '/assets/fav-customers.svg', '/assets/fav-purchases.svg',
  '/assets/fav-analytics.svg', '/assets/fav-expenses.svg', '/assets/fav-users.svg', '/assets/fav-suppliers.svg', '/assets/fav-settings.svg', '/assets/fav-csc.svg',
  '/assets/fav-dashboard-32.png', '/assets/fav-dashboard-180.png',
  '/assets/fav-billing-32.png',   '/assets/fav-billing-180.png',
  '/assets/fav-inventory-32.png', '/assets/fav-inventory-180.png',
  '/assets/fav-sales-32.png',     '/assets/fav-sales-180.png',
  '/assets/fav-customers-32.png', '/assets/fav-customers-180.png',
  '/assets/fav-purchases-32.png', '/assets/fav-purchases-180.png',
  '/assets/fav-analytics-32.png', '/assets/fav-analytics-180.png',
  '/assets/fav-expenses-32.png',  '/assets/fav-expenses-180.png',
  '/assets/fav-users-32.png',     '/assets/fav-users-180.png',
  '/assets/fav-suppliers-32.png', '/assets/fav-suppliers-180.png',
  '/assets/fav-settings-32.png',  '/assets/fav-settings-180.png',
  '/assets/fav-login-32.png',     '/assets/fav-login-180.png'
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
  const req = e.request;

  // Only handle GET; let everything else hit the network untouched.
  if (req.method !== 'GET') return;

  // Skip Firebase / Google APIs entirely (live data).
  if (req.url.includes('firestore.googleapis.com') ||
      req.url.includes('googleapis.com')) return;

  // Never cache the login page — avoids stale auth-redirect issues.
  if (req.url.includes('login.html')) return;

  const isPageNav =
    req.mode === 'navigate' || req.destination === 'document';

  if (isPageNav) {
    // NETWORK-FIRST for pages: always show the latest HTML when online,
    // fall back to the cached copy (or dashboard) only when offline.
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(req, clone));
          }
          return res;
        })
        // Offline: serve the cached copy of this exact page if we have it,
        // otherwise the dedicated offline fallback (never the dashboard,
        // which would be misleading on an unrelated URL).
        .catch(() => caches.match(req).then(c => c || caches.match('/offline.html')))
    );
    return;
  }

  // CACHE-FIRST for static assets (css, js, images, fonts).
  e.respondWith(
    caches.match(req).then(cached => cached ||
      fetch(req).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      })
    )
  );
});
