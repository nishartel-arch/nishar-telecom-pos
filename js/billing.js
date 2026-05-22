import './pdf.js';
import './whatsapp.js';
import {
db
}
from './firebase.js';

import {
loadProducts
}
from './inventory.js';

import {

collection,
getDocs,
addDoc,
doc,
updateDoc,
getDoc

}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


let products = [];

let billItems = [];


// LOAD PRODUCTS

export async function loadBillingProducts(){

const snapshot =
await getDocs(
collection(db,'products')
);

const select =
document.getElementById('product-select');

if(!select) return;

select.innerHTML = `
<option value="">
Select Product
</option>
`;

products=[];

snapshot.forEach(docSnap=>{

const product = {
id:docSnap.id,
...docSnap.data()
};

products.push(product);

select.innerHTML += `
<option value="${product.id}">
${product.name}
</option>
`;

});

}


// ADD TO BILL

window.addToBill = function(){

const productId =
document.getElementById('product-select').value;

const qty =
Number(
document.getElementById('bill-qty').value
);

if(!productId) return;

const product =
products.find(p=>p.id===productId);

if(!product) return;

billItems.push({
...product,
qty
});

renderBill();

}


// RENDER BILL

function renderBill(){

const tbody =
document.getElementById('bill-items');

const totalEl =
document.getElementById('grand-total');

tbody.innerHTML='';

let grandTotal=0;

billItems.forEach((item,index)=>{

const total =
item.price * item.qty;

grandTotal += total;

tbody.innerHTML += `

<tr>

<td>${item.name}</td>

<td>${item.qty}</td>

<td>₹${item.price}</td>

<td>₹${total}</td>

<td>

<button onclick="removeBillItem(${index})">

Remove

</button>

</td>

</tr>

`;

});

totalEl.innerText=grandTotal;

}


// REMOVE ITEM

window.removeBillItem = function(index){

billItems.splice(index,1);

renderBill();

}


// SAVE BILL

window.saveBill = async function(){

if(billItems.length===0){

alert('No items added');

return;

}

const total =
billItems.reduce(
(sum,item)=>sum+(item.price*item.qty),
0
);

try{

// SAVE SALE

await addDoc(
collection(db,'sales'),
{
items:billItems,
total,
createdAt:Date.now()
}
);


// UPDATE STOCK

for(const item of billItems){

const productRef =
doc(db,'products',item.id);

const productSnap =
await getDoc(productRef);

const productData =
productSnap.data();

await updateDoc(productRef,{
stock:
productData.stock - item.qty
});

}


generatePDF(
billItems,
total
);

shareWhatsApp(
billItems,
total
);

billItems=[];

renderBill();

loadProducts();

alert('Bill Saved Successfully');

}catch(err){

console.error(err);

alert(err.message);

}

}