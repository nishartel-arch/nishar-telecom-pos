var firebaseConfig = {
  apiKey: "AIzaSyBVC2KvWFX3E3w_a4iV9aDMJErVquK4IPA",
  authDomain: "nishar-telecom-pos.firebaseapp.com",
  projectId: "nishar-telecom-pos",
  storageBucket: "nishar-telecom-pos.firebasestorage.app",
  messagingSenderId: "640145265950",
  appId: "1:640145265950:web:04d4c1dc2eb63c363ca50f"
};

if (window.firebase && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

var auth = firebase.auth();
var db = firebase.firestore();

window.auth = auth;
window.db = db;
