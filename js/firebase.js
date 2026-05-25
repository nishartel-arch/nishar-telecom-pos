/* =============================================
   NISHAR TELECOM POS — Firebase Configuration
   =============================================
   SETUP INSTRUCTIONS:
   1. Go to https://console.firebase.google.com
   2. Create / open your project
   3. Project Settings → Your Apps → Web App
   4. Copy the firebaseConfig values below
   5. In Firestore → Rules, paste the security rules from README.md
*/

const firebaseConfig = {
  apiKey: "AIzaSyBVC2KvWFX3E3w_a4iV9aDMJErVquK4IPA",
  authDomain: "nishar-telecom-pos.firebaseapp.com",
  projectId: "nishar-telecom-pos",
  storageBucket: "nishar-telecom-pos.firebasestorage.app",
  messagingSenderId: "640145265950",
  appId: "1:640145265950:web:04d4c1dc2eb63c363ca50f"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();

// Enable offline data persistence
db.enablePersistence({ synchronizeTabs: true })
  .catch(err => {
    if (err.code === 'failed-precondition') console.warn('Multiple tabs open; persistence disabled.');
    else if (err.code === 'unimplemented') console.warn('Browser does not support persistence.');
  });
