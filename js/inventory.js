import {
db
}
from './firebase.js';

import {

collection,
addDoc,
getDocs,
deleteDoc,
doc

}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// OPEN MODAL

window.openAddProductModal = function(){

document.getElementById('product-modal')
.style.display='flex';

}


// CLOSE MODAL

window.closeModal = function(){

document.getElementById('product-modal')
.style.display='none';

}


// SAVE PRODUCT

window.saveProduct = async function(){

const name =
document.getElementById('product-name').value;

const category =
document.getElementById('product-category').value;

const stock =
Number(
document.getElementById('product-stock').value
);

const price =
Number(
document.getElementById('product-price').value
);

if(!name){

alert('Enter product name');

return;

}

try{

await addDoc(
collection(db,'products'),
{
name,
category,
stock,
price,
createdAt:Date.now()
}
);

alert('Product Saved');

closeModal();

loadProducts();

}catch(err){

console.error(err);

alert(err.message);

}

}


// LOAD PRODUCTS

export async function loadProducts(){

const snapshot =
await getDocs(
collection(db,'products')
);

const productList =
document.getElementById('product-list');


if(productList){
productList.innerHTML='';
}

let totalProducts=0;
let lowStock=0;

snapshot.forEach(docSnap=>{

const p = docSnap.data();

totalProducts++;

if(p.stock <= 5){
lowStock++;
}

if(productList){

productList.innerHTML += `

<tr>

<td>${p.name}</td>

<td>${p.category}</td>

<td>${p.stock}</td>

<td>₹${p.price}</td>

<td>

<button onclick="deleteProduct('${docSnap.id}')">

Delete

</button>

</td>

</tr>

`;
}

});


// UPDATE DASHBOARD

const totalEl =
document.getElementById('total-products');

const lowEl =
document.getElementById('low-stock');

if(totalEl){
totalEl.innerText=totalProducts;
}

if(lowEl){
lowEl.innerText=lowStock;
}

}


// DELETE PRODUCT

window.deleteProduct = async function(id){

await deleteDoc(
doc(db,'products',id)
);

loadProducts();

}


// AUTO LOAD

setTimeout(()=>{
loadProducts();
},500);