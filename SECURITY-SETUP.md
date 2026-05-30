# Security & Roles — Setup Guide

Phase 1 of the roadmap (role-based access + audit logs + backup) is now built in.
This is a one-time setup.

## 1. Deploy the security rules

The rules in `firestore.rules` are the **real** security boundary — without them
deployed, any logged-in account can still read/write everything.

```bash
firebase deploy --only firestore:rules
```

(Or paste the contents of `firestore.rules` into Firebase Console → Firestore
Database → Rules → Publish.)

Then deploy the app as usual:

```bash
firebase deploy --only hosting
```

## 2. Claim the Owner account

The **first person to sign in** after the rules are live automatically becomes the
**Owner** (the app stamps a one-time `meta/app` marker so this can't happen twice).

So: **log in yourself first, before adding any staff.** You'll see an `OWNER`
badge next to your name in the top bar.

## 3. Add staff and set their roles

1. In **Firebase Console → Authentication**, add a login for each employee
   (Add user → email + password). The app never creates accounts itself, by design.
2. The employee signs in once — they're auto-provisioned as **Staff** (the lowest role).
3. Open the **Users** screen inside the app (Owner-only). The new employee
   appears in the list. Click Edit to promote them to Manager / Cashier and
   set their Active status. *(This used to require a manual edit in the
   Firestore console — the in-app screen now does it.)*

To disable someone, set their **Status** to Disabled from the Users screen —
they're locked out instantly on next page load. For full removal, also delete
their auth account in Firebase Console; the in-app Remove button only deletes
the role profile, not the underlying Firebase login.

## 4. What each role can do

| Capability                     | Owner | Manager | Cashier | Staff |
|--------------------------------|:-----:|:-------:|:-------:|:-----:|
| Billing / checkout             |  ✅   |   ✅    |   ✅    |  ✅   |
| View inventory                 |  ✅   |   ✅    |   ✅    |  ✅   |
| Add / edit / delete products   |  ✅   |   ✅    |   ❌    |  ❌   |
| View & edit customers          |  ✅   |   ✅    |   ✅    |  view |
| Delete customers               |  ✅   |   ✅    |   ❌    |  ❌   |
| Sales history                  |  ✅   |   ✅    |   ✅    |  ❌   |
| Purchases (stock-in)           |  ✅   |   ✅    |   ❌    |  ❌   |
| Expenses & Net-Profit reports  |  ✅   |   ✅    |   ❌    |  ❌   |
| Analytics                      |  ✅   |   ✅    |   ❌    |  ❌   |
| Export / backup data           |  ✅   |   ✅    |   ❌    |  ❌   |
| Manage users / roles           |  ✅   |   ❌    |   ❌    |  ❌   |

Pages a role can't use are hidden from the sidebar **and** blocked if someone types
the URL directly. The Firestore rules enforce the same limits on the server, so the
restrictions hold even outside the app.

## 5. Audit log

Sensitive actions are now recorded in the `auditLogs` collection: sales, product
create/update/delete, customer delete, stock purchases, and backup exports. Each
entry stores who (uid + email + role), what, and when. Only Owner/Manager can read
the log; nobody can edit it; only the Owner can prune it.

## 6. Backup

Owner/Manager see a **download icon** in the sidebar footer. It exports products,
customers, sales, purchases, and the invoice counter to a timestamped JSON file.
Run it regularly (or before any big change). Restore tooling is a later roadmap item;
for now the JSON is your safety net and can be re-imported via a script if needed.
