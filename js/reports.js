import {
db
}
from './firebase.js';

import {

collection,
getDocs

}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// LOAD SALES

export async function loadSales(){

const snapshot =
await getDocs(
collection(db,'sales')
);

const salesList =
document.getElementById('sales-list');


// CLEAR SALES TABLE

if(salesList){
salesList.innerHTML='';
}


let totalSales=0;

let totalOrders=0;


// LOOP SALES

snapshot.forEach(docSnap=>{

const sale =
docSnap.data();

totalSales += sale.total;

totalOrders++;


// SALES PAGE TABLE

if(salesList){

const date =
new Date(
sale.createdAt
).toLocaleString();


const itemCount =
sale.items.length;


salesList.innerHTML += `

<tr>

<td>${date}</td>

<td>${itemCount} items</td>

<td>₹${sale.total}</td>

</tr>

`;

}

});


// SALES PAGE

const salesEl =
document.getElementById('total-sales');

if(salesEl){

salesEl.innerText=`₹${totalSales}`;

}


const ordersEl =
document.getElementById('total-orders');

if(ordersEl){

ordersEl.innerText=totalOrders;

}


// DASHBOARD PAGE

const dashboardRevenue =
document.getElementById('dashboard-revenue');

if(dashboardRevenue){

dashboardRevenue.innerText=`₹${totalSales}`;

}


const dashboardOrders =
document.getElementById('dashboard-orders');

if(dashboardOrders){

dashboardOrders.innerText=totalOrders;

}

}