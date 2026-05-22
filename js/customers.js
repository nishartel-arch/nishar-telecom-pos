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

window.openCustomerModal = function(){

document.getElementById('customer-modal')
.style.display='flex';

}


// CLOSE MODAL

window.closeCustomerModal = function(){

document.getElementById('customer-modal')
.style.display='none';

}


// SAVE CUSTOMER

window.saveCustomer = async function(){

const name =
document.getElementById('customer-name').value;

const phone =
document.getElementById('customer-phone-input').value;

const address =
document.getElementById('customer-address').value;

const due =
Number(
document.getElementById('customer-due').value || 0
);

if(!name){

alert('Enter customer name');

return;

}

try{

await addDoc(
collection(db,'customers'),
{
name,
phone,
address,
due,
createdAt:Date.now()
}
);

alert('Customer Saved');

closeCustomerModal();

loadCustomers();

}catch(err){

console.error(err);

alert(err.message);

}

}


// LOAD CUSTOMERS

export async function loadCustomers(){

const snapshot =
await getDocs(
collection(db,'customers')
);

const customerList =
document.getElementById('customer-list');

if(!customerList) return;

customerList.innerHTML='';

let totalCustomers=0;


snapshot.forEach(docSnap=>{

const customer =
docSnap.data();

totalCustomers++;

customerList.innerHTML += `

<tr>

<td>${customer.name}</td>

<td>${customer.phone}</td>

<td>${customer.address}</td>

<td>₹${customer.due}</td>

<td>

<button onclick="deleteCustomer('${docSnap.id}')">

Delete

</button>

</td>

</tr>

`;

});


// UPDATE CARD

const totalEl =
document.getElementById('total-customers');

if(totalEl){

totalEl.innerText=totalCustomers;

}

}


// DELETE CUSTOMER

window.deleteCustomer = async function(id){

await deleteDoc(
doc(db,'customers',id)
);

loadCustomers();

}