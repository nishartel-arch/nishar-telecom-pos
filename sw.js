const CACHE_NAME = 'nishar-pos-v3';

const urlsToCache = [

'/',
'/index.html',

'/css/style.css',
'/css/dashboard.css',
'/css/billing.css',

'/js/app.js',
'/js/auth.js',
'/js/firebase.js',
'/js/inventory.js',
'/js/billing.js',
'/js/reports.js',
'/js/analytics.js',
'/js/pdf.js',
'/js/whatsapp.js',

'/pages/dashboard.html',
'/pages/inventory.html',
'/pages/billing.html',
'/pages/sales.html',
'/pages/analytics.html',

'/assets/icon-192.png',
'/assets/icon-512.png'

];


// INSTALL

self.addEventListener('install',event=>{

console.log('Service Worker Installing...');

event.waitUntil(

caches.open(CACHE_NAME)
.then(cache=>{

console.log('Caching App Files');

return cache.addAll(urlsToCache);

})

);

self.skipWaiting();

});


// ACTIVATE

self.addEventListener('activate',event=>{

console.log('Service Worker Activated');

event.waitUntil(

caches.keys().then(cacheNames=>{

return Promise.all(

cacheNames.map(cache=>{

if(cache !== CACHE_NAME){

console.log('Deleting Old Cache:',cache);

return caches.delete(cache);

}

})

);

})

);

self.clients.claim();

});


// FETCH

self.addEventListener('fetch',event=>{

event.respondWith(

caches.match(event.request)
.then(response=>{

// RETURN CACHE FIRST

if(response){

return response;

}


// OTHERWISE FETCH FROM NETWORK

return fetch(event.request)
.then(networkResponse=>{

return networkResponse;

});

})

);

});