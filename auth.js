import {
auth
}
from './firebase.js';

import {

signInWithEmailAndPassword,

createUserWithEmailAndPassword,

onAuthStateChanged,

signOut

}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


// LOGIN

window.login = async function(){

const email =
document.getElementById('email').value;

const password =
document.getElementById('password').value;

try{

await signInWithEmailAndPassword(
auth,
email,
password
);

alert('Login successful');

}catch(err){

alert(err.message);

}

}


// REGISTER

window.register = async function(){

const email =
document.getElementById('email').value;

const password =
document.getElementById('password').value;

try{

await createUserWithEmailAndPassword(
auth,
email,
password
);

alert('Account created');

}catch(err){

alert(err.message);

}

}


// LOGOUT

window.logout = async function(){

await signOut(auth);

}


// SESSION

onAuthStateChanged(auth,user=>{

if(user){

document.getElementById('login-page')
.style.display='none';

document.getElementById('app')
.style.display='flex';

}else{

document.getElementById('login-page')
.style.display='flex';

document.getElementById('app')
.style.display='none';

}

});