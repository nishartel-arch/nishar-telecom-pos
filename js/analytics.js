import {
db
}
from './firebase.js';

import {

collection,
getDocs

}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// LOAD ANALYTICS

export async function loadAnalytics(){

// SALES

const salesSnapshot =
await getDocs(
collection(db,'sales')
);

let revenue=0;

let totalOrders=0;

let estimatedProfit=0;


salesSnapshot.forEach(docSnap=>{

const sale =
docSnap.data();

revenue += sale.total;

totalOrders++;


// ESTIMATED PROFIT

estimatedProfit += sale.total * 0.25;

});


// PRODUCTS

const productSnapshot =
await getDocs(
collection(db,'products')
);

let lowStock=0;

productSnapshot.forEach(docSnap=>{

const product =
docSnap.data();

if(product.stock <= 5){

lowStock++;

}

});


// UPDATE UI

document.getElementById('analytics-revenue')
.innerText=`₹${revenue}`;

document.getElementById('analytics-profit')
.innerText=`₹${Math.round(estimatedProfit)}`;

document.getElementById('analytics-orders')
.innerText=totalOrders;

document.getElementById('analytics-lowstock')
.innerText=lowStock;

}