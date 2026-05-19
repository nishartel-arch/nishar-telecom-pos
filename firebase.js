import { initializeApp }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
getAuth
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
getFirestore
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// FIREBASE CONFIG

const firebaseConfig = {

apiKey: "AIzaSyBVC2KvWFX3E3w_a4iV9aDMJErVquK4IPA",

authDomain: "nishar-telecom-pos.firebaseapp.com",

projectId: "nishar-telecom-pos",

storageBucket: "nishar-telecom-pos.firebasestorage.app",

messagingSenderId: "640145265950",

appId: "1:640145265950:web:04d4c1dc2eb63c363ca50f"

};


// INIT

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


// EXPORT

export {
auth,
db
};