import {
loadPurchases
}
from './purchases.js';

import {
loadCustomers
}
from './customers.js';

import {
loadAnalytics
}
from './analytics.js';

import './inventory.js';

import {
loadBillingProducts
}
from './billing.js';

import {
loadSales
}
from './reports.js';


// LOAD PAGE

async function loadPage(page){

const response =
await fetch(`pages/${page}.html`);

const html =
await response.text();


// LOAD HTML

document.querySelector('.main-content')
.innerHTML = html;


// SMALL RENDER DELAY

await new Promise(resolve =>
setTimeout(resolve,50)
);


// PAGE INIT

if(page==='billing'){

await loadBillingProducts();

}


if(page==='dashboard'){

const inventoryModule =
await import('./inventory.js');

await inventoryModule.loadProducts();


const reportsModule =
await import('./reports.js');

await reportsModule.loadSales();

}


if(page==='inventory'){

const inventoryModule =
await import('./inventory.js');

await inventoryModule.loadProducts();

}


if(page==='sales'){

await loadSales();

}


if(page==='analytics'){

await loadAnalytics();

}


if(page==='customers'){

await loadCustomers();

}


if(page==='purchases'){

await loadPurchases();

}

}


// NAVIGATION

const navItems =
document.querySelectorAll('.nav-item');


navItems.forEach(item=>{

item.addEventListener('click',()=>{


// REMOVE ACTIVE

navItems.forEach(nav=>{
nav.classList.remove('active');
});


// ACTIVE MENU

item.classList.add('active');


// PAGE NAME

const page =
item.innerText
.trim()
.toLowerCase();


// IGNORE LOGOUT

if(page==='logout') return;


// LOAD PAGE

loadPage(page);

});

});


// DEFAULT PAGE

loadPage('dashboard');