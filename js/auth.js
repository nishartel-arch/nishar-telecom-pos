// WAIT UNTIL PAGE LOADS

window.addEventListener('DOMContentLoaded',()=>{


// ======================
// AUTH CHECK
// ======================

auth.onAuthStateChanged((user)=>{

const currentPage =
window.location.pathname
.split("/")
.pop();


// LOGIN PAGE

if(currentPage === 'login.html'){

if(user){

window.location.href='index.html';

}

return;

}


// ALL OTHER PAGES

if(!user){

window.location.href='login.html';

}

});


// ======================
// LOGIN FORM
// ======================

const loginForm =
document.getElementById('loginForm');


if(loginForm){

loginForm.addEventListener('submit', async(e)=>{

e.preventDefault();

const email =
document.getElementById('email').value;

const password =
document.getElementById('password').value;

try{

await auth.signInWithEmailAndPassword(
email,
password
);

window.location.href='index.html';

}catch(err){

const errorBox =
document.getElementById('loginError');

if(errorBox){

errorBox.style.display='block';

errorBox.innerText=err.message;

}else{

alert(err.message);

}

}

});

}


// ======================
// LOGOUT
// ======================

const logoutBtn =
document.getElementById('logoutBtn');


if(logoutBtn){

logoutBtn.addEventListener('click', async()=>{

try{

await auth.signOut();

window.location.href='login.html';

}catch(err){

alert(err.message);

}

});

}


});