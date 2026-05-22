import {
db
}
from './firebase.js';

import {

collection,
addDoc,
getDocs,
updateDoc,
doc,
getDoc

}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


let products=[];


// OPEN MODAL

window.openPurchaseModal = function(){

document.getElementById('purchase-modal')
.style.display='flex';

loadPurchaseProducts();

}


// CLOSE MODAL

window.closePurchaseModal = function(){

document.getElementById('purchase-modal')
.style.display='none';

}


// LOAD PRODUCTS

async function loadPurchaseProducts(){

const snapshot =
await getDocs(
collection(db,'products')
);

const select =
document.getElementById('purchase-product');

if(!select) return;

select.innerHTML=`
<option value="">
Select Product
</option>
`;

products=[];

snapshot.forEach(docSnap=>{

const product={
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


// SAVE PURCHASE

window.savePurchase = async function(){

const productId =
document.getElementById('purchase-product').value;

const qty =
Number(
document.getElementById('purchase-qty').value
);

const price =
Number(
document.getElementById('purchase-price').value
);

const supplier =
document.getElementById('purchase-supplier').value;

if(!productId){

alert('Select product');

return;

}

const product =
products.find(p=>p.id===productId);

const total =
qty * price;


try{

// SAVE PURCHASE

await addDoc(
collection(db,'purchases'),
{
productId,
productName:product.name,
qty,
price,
supplier,
total,
createdAt:Date.now()
}
);


// UPDATE STOCK

const productRef =
doc(db,'products',productId);

const productSnap =
await getDoc(productRef);

const productData =
productSnap.data();

await updateDoc(productRef,{
stock:
productData.stock + qty
});


alert('Purchase Saved');

closePurchaseModal();

loadPurchases();

}catch(err){

console.error(err);

alert(err.message);

}

}


// LOAD PURCHASES

export async function loadPurchases(){

const snapshot =
await getDocs(
collection(db,'purchases')
);

const purchaseList =
document.getElementById('purchase-list');

if(!purchaseList) return;

purchaseList.innerHTML='';

let totalPurchases=0;


snapshot.forEach(docSnap=>{

const purchase =
docSnap.data();

totalPurchases += purchase.total;

purchaseList.innerHTML += `

<tr>

<td>${purchase.productName}</td>

<td>${purchase.qty}</td>

<td>₹${purchase.price}</td>

<td>${purchase.supplier}</td>

<td>₹${purchase.total}</td>

</tr>

`;

});


const totalEl =
document.getElementById('total-purchases');

if(totalEl){

totalEl.innerText=`₹${totalPurchases}`;

}

}