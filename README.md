# Nishar Telecom POS

A complete, production-ready Point of Sale system built with vanilla HTML/CSS/JavaScript and Firebase.

---

## Features

- **Billing** — Product grid + cart, customer selection, discount, receipt/PDF
- **Inventory** — Full CRUD, category filters, low-stock alerts
- **Customers** — Records with purchase history per customer
- **Purchases** — Record supplier purchases with auto stock update
- **Sales History** — Full transaction log, filters, invoice reprint
- **Analytics** — Revenue charts, payment breakdown, top products (Chart.js)
- **Themes** — 5 themes (Blue, Purple, Dark, Ocean, Light), persisted to localStorage
- **Quick search** — Press <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd> (or the topbar Search button) for a command-palette to jump between pages
- **PWA / Offline** — Service worker for offline capability, with a dedicated `offline.html` fallback page

---

## File Structure

```
nishar-telecom-pos/
├── css/
│   ├── variables.css       ← Design tokens (colors, spacing, radius…)
│   └── style.css           ← All global styles
├── js/
│   ├── firebase.js         ← Firebase init & config
│   ├── app.js              ← Shared core (sidebar, auth, toast, modal, utils)
│   ├── dashboard.js
│   ├── billing.js
│   ├── inventory.js
│   ├── customers.js
│   ├── purchases.js
│   ├── analytics.js
│   └── sales.js
├── index.html              ← Dashboard
├── login.html
├── billing.html
├── inventory.html
├── customers.html
├── purchases.html
├── analytics.html
├── sales.html
├── sw.js                   ← Service Worker (PWA)
├── manifest.json
└── firebase.json           ← Firebase Hosting config
```

---

## Setup Instructions

### 1. Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**, follow the wizard
3. Enable **Authentication** → Sign-in method → **Email/Password**
4. Enable **Firestore Database** → Start in production mode
5. Go to **Project Settings** → **Your Apps** → Add a **Web App**
6. Copy the `firebaseConfig` object

### 2. Configure the App

Open `js/firebase.js` and replace the placeholder values:

```javascript
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
```

### 3. Set Firestore Security Rules

In the Firebase Console → Firestore → **Rules** tab, paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only authenticated users can read/write
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Click **Publish**.

### 4. Create Your First Admin User

In Firebase Console → **Authentication** → **Users** → **Add user**. Enter your email and password. Use these to log in to the POS.

### 5. Run Locally

No build step needed. Just serve the folder with any static server:

```bash
# Option A: Python
python -m http.server 8080

# Option B: VS Code → Live Server extension

# Option C: Firebase Hosting
npm install -g firebase-tools
firebase login
firebase init hosting
firebase serve
```

Open [http://localhost:8080/login.html](http://localhost:8080/login.html)

### 6. Deploy to Firebase Hosting (optional)

```bash
firebase deploy --only hosting
```

---

## Firestore Collections

| Collection   | Fields |
|-------------|--------|
| `products`   | name, brand, category, price, buyPrice, stock, description, createdAt |
| `customers`  | name, phone, email, address, createdAt |
| `sales`      | invoiceNo, customerId, customerName, items[], subtotal, discount, total, paymentMethod, createdAt |
| `purchases`  | productId, productName, supplierName, refNo, quantity, unitCost, totalCost, notes, createdAt |

> **Full schema:** see [`DATABASE.md`](DATABASE.md) for every collection, field types, relationships, the per-role access matrix, and the cash-basis accounting model.

---

## Security Notes

- Role-based access control (Owner / Manager / Cashier / Staff) enforced both in the UI and in `firestore.rules` (the real boundary). See `SECURITY-SETUP.md`.
- All app pages are protected by an auth + role guard in `js/app.js`; unauthorised pages are hidden and blocked.
- Sensitive actions are recorded to an append-only `auditLogs` collection.
- Owner/Manager can export a full JSON backup from the sidebar.
- User input is sanitized using `APP.sanitize()` (textContent assignment) to prevent XSS
- No inline `onclick` handlers; event delegation is used throughout
- Firestore batch writes are used for atomic checkout (stock deduction + sale record)
- Checkout runs inside a Firestore transaction: stock is read, validated, and deducted atomically with the sale record, so concurrent sales on multiple terminals can never oversell

---

## Fonts Used

- **Sora** — UI text (Google Fonts)
- **IBM Plex Mono** — Numbers, IDs, prices (Google Fonts)

---

Built with ❤ for Nishar Telecom
