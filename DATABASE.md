# Database Structure — Nishar Telecom POS

Cloud Firestore (NoSQL, document/collection model). Every collection is access-controlled
by [`firestore.rules`](firestore.rules) — that file is the **real** security boundary; the
client-side role gating in [`js/app.js`](js/app.js) is only for UX.

**Role tiers:** `owner` > `manager` > `cashier` > `staff`
- **Manager-up** = owner or manager (back office)
- **Staff-up** = any active profile (shop floor)

Timestamps are Firestore server timestamps (`createdAt`, `at`) unless noted.

---

## Collection summary

| Collection | Purpose | Read | Create | Update | Delete |
|---|---|---|---|---|---|
| `users` | Role directory (1 doc per Auth user) | self / owner | first-run claim · self-provision · owner | owner · self (not role/active) | owner |
| `meta/app` | One-time bootstrap marker (owner claim) | signed-in | first user only | owner | owner |
| `counters` | Invoice / refund sequence numbers | staff-up | staff-up | staff-up | — |
| `products` | Inventory items & services | staff-up | manager-up | staff-up¹ | manager-up |
| `customers` | Customer records + due balances | staff-up | staff-up | staff-up | manager-up |
| `sales` | Completed bills (line items, totals, payment) | staff-up | staff-up | manager-up² | owner |
| `duePayments` | Receipts against credit balances | staff-up | staff-up | manager-up | owner |
| `refunds` | Returns against past sales | staff-up | manager-up | never | owner |
| `purchases` | Stock-in from suppliers | manager-up | manager-up | owner | owner |
| `suppliers` | Vendor directory + payable balances | manager-up | manager-up | manager-up | owner |
| `supplierPayments` | What we paid a supplier (append-only) | manager-up | manager-up | never | owner |
| `expenses` | Shop operating expenses | manager-up | manager-up | manager-up | manager-up |
| `cscServices` | Aadhaar/PAN/certificate service log | staff-up | staff-up | staff-up | manager-up |
| `heldCarts` | Parked bills, resumable from any terminal | staff-up | staff-up | never (immutable) | staff-up |
| `auditLogs` | Append-only record of sensitive actions | manager-up | staff-up | never | owner |
| `config/shop` | Business info shown on receipts | signed-in | — | owner | owner |

¹ Cashiers update `products` only to decrement stock at checkout.
² Manager-up updates `sales` for corrections/refund bookkeeping (`refundedTotal`, `refundedQtyByProduct`).

---

## Document shapes

### `users/{uid}`  — uid is the Firebase Auth UID
```
name      string
email     string
role      'owner' | 'manager' | 'cashier' | 'staff'
active    boolean          // false → locked out (see APP.renderLockout)
createdAt timestamp
```
The **first** user to sign in claims `owner` and stamps `meta/app` (atomic batch); everyone
after self-provisions as `staff` and waits for an owner to promote them. A user can edit their
own profile but rules forbid changing their own `role` or `active`.

### `products/{id}`
```
name         string
brand        string
category     string         // Cosmetics | Electronics | Mobile Accessories | Stationary | General …
price        number         // sell price
buyPrice     number         // cost — drives COGS / gross profit
stock        number
reorderLevel number?         // low-stock threshold (default 3 via APP.reorderLevelOf)
isService    boolean?        // services carry no stock (excluded from low-stock)
description  string?
createdAt    timestamp
```

### `customers/{id}`
```
name        string
phone       string
email       string?
address     string?
totalSpent  number          // lifetime spend, net of refunds
dueBalance  number          // outstanding credit owed to the shop
createdAt   timestamp
```

### `sales/{id}`  — written inside a Firestore transaction at checkout
```
invoiceNo     string         // 'NT-0001' (zero-padded from counters)
customerId    string|null
customerName  string
customerPhone string
items         [ { productId, name, price, quantity, unit, total, buyPrice } ]
subtotal      number
discount      number
total         number
paymentMethod 'Cash' | 'UPI' | 'Card' | 'Credit'
amountPaid    number         // cash actually taken at the counter
dueAmount     number         // total − amountPaid (added to customer.dueBalance)
dueStatus     'paid' | 'partial' | 'unpaid'
createdAt     timestamp
createdBy     uid
// added later by refunds:
refundedTotal        number?
refundedQtyByProduct { [productId]: qty }?
```
Checkout is a **transaction**: stock is read, validated and decremented atomically with the
sale write, so concurrent sales on multiple terminals can never oversell.

### `duePayments/{id}`
```
customerId  string
amount      number          // cash received against an earlier credit balance
method      string
createdAt   timestamp
createdBy   uid
```

### `refunds/{id}`  — transactional (restocks items, advances refund counter)
```
refundNo      string
saleId        string         // → sales/{id}
saleInvoiceNo string
customerId    string|null
customerName  string
customerPhone string
items         [ { productId, name, quantity, … } ]
totalRefund   number
method        'Cash' | 'UPI' | 'Card' | 'Adjust Due'   // "Adjust Due" moves no cash
reason        string
createdAt     timestamp
createdBy     uid
```

### `purchases/{id}`
```
productId    string
productName  string
supplierName string
refNo        string
quantity     number
unitCost     number
totalCost    number
notes        string?
createdAt    timestamp
```

### `cscServices/{id}`
```
customerName  string
customerPhone string
service       string         // Aadhaar / PAN / certificate type
refNo         string
charge        number         // collected from customer
govtFee       number
commission    number         // shop's earning
status        string         // pending / in-progress / completed …
createdAt     timestamp
```

### `heldCarts/{id}`  — immutable once created (resume = delete)
```
cart         [ line items ]
customerId   string|null
customerName string
discount     number
itemCount    number
total        number
heldBy       uid
createdAt    timestamp
```

### `counters/{name}`  — e.g. `counters/invoices`, `counters/refunds`
```
seq  number    // last issued number; advanced inside checkout/refund transactions
```

### `config/shop`
```
name string · state string · address string · phone string · email string · thermalWidth string
```

### `auditLogs/{id}`  (append-only)
```
action  string · details map · uid string · email string · role string · at timestamp
```

---

## Relationships

```
users (Auth uid) ──< sales.createdBy
                 └─< refunds.createdBy / duePayments.createdBy / heldCarts.heldBy

customers ──< sales.customerId
          ├─< duePayments.customerId
          └─< refunds.customerId

products  ──< sales.items[].productId
          ├─< purchases.productId
          └─< refunds.items[].productId

sales     ──< refunds.saleId
```

Firestore has no joins or foreign-key enforcement — references are plain string ids resolved
in app code. Denormalised fields (`customerName`, `productName`, `buyPrice` on each sale line)
are snapshots taken at sale time so historical documents stay correct even if the source record
later changes.

## Accounting model (cash basis)

- **Revenue** = cash *actually received* (`sales.amountPaid` + `duePayments.amount` − cash refunds), not amounts merely billed.
- **COGS** = `Σ buyPrice × net-quantity-kept` per sold line (net of refunded units).
- **Net profit** = Revenue − COGS − expenses, all net of refunds.

See [`APP.cashCollected()`](js/app.js) and [`APP.cogsOfSold()`](js/app.js) for the canonical implementations.

## Backup

Owner/Manager can export a JSON backup of all business collections (see `BACKUP_COLLECTIONS`
in [`js/app.js`](js/app.js)). `users`, `meta` and `auditLogs` are intentionally excluded —
they're tied to Firebase Auth and the owner-claim logic, so restoring them could break sign-in.
