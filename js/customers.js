/* =============================================
   NISHAR TELECOM POS — Customers Logic
   ============================================= */
APP.init({ page: 'customers', title: 'Customers', onReady: initCustomers });

let allCustomers   = [];     // accumulator (paged), or full set once filtering forces a full load
let custCursor     = null;   // pagination cursor (last doc snapshot)
let custHasMore    = true;
let custLoading    = false;
let custFullyLoaded = false;
const CUST_PAGE = 30;
const CUST_COLS = 8;

async function initCustomers() {
  bindCustomerEvents();
  await Promise.all([loadCustStats(), loadFirstCustPage()]);
}

// Refresh everything (used after add/edit/delete/recalc).
async function loadCustomers() {
  await Promise.all([loadCustStats(), loadFirstCustPage()]);
}

/* ── Stats banner — accurate regardless of pagination ── */
// Total via count() aggregation; dues via a bounded dueBalance>0 query
// (only customers who owe — typically a small set), summed client-side.
async function loadCustStats() {
  try {
    const [total, duesSnap] = await Promise.all([
      APP.countOf(db.collection('customers')),
      db.collection('customers').where('dueBalance', '>', 0).get(),
    ]);
    const withDues    = duesSnap.size;
    const outstanding = duesSnap.docs.reduce((s, d) => s + parseFloat(d.data().dueBalance || 0), 0);
    renderCustStats({ total: total != null ? total : withDues, withDues, outstanding });
  } catch (e) {
    console.error(e);
    document.getElementById('cust-stats').innerHTML =
      `<div class="card" style="grid-column:1/-1;text-align:center;color:var(--text-muted);">Could not load summary. <button class="btn btn-secondary" id="cust-stats-retry">Retry</button></div>`;
    document.getElementById('cust-stats-retry')?.addEventListener('click', loadCustStats);
  }
}

/* ── Table pagination (hybrid: load-all when filtering) ── */
async function loadFirstCustPage() {
  allCustomers = []; custCursor = null; custHasMore = true; custFullyLoaded = false;
  document.getElementById('cust-tbody').innerHTML = APP.skeletonRows(CUST_COLS);
  document.getElementById('cust-empty').style.display = 'none';
  document.getElementById('cust-loadmore').innerHTML = '';
  await loadMoreCust(true);
}

async function loadMoreCust(first = false) {
  if (custLoading || (!first && !custHasMore)) return;
  custLoading = true; renderCustLoadMore();
  try {
    let q = db.collection('customers').orderBy('name').limit(CUST_PAGE);
    if (custCursor) q = q.startAfter(custCursor);
    const snap = await q.get();
    if (snap.docs.length < CUST_PAGE) custHasMore = false;
    if (snap.docs.length) custCursor = snap.docs[snap.docs.length - 1];
    allCustomers.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
    applyCustFilters();
  } catch (e) {
    console.error(e);
    if (first) {
      document.getElementById('cust-tbody').innerHTML =
        APP.tableMessage(CUST_COLS, `Couldn't load customers. <button class="btn btn-secondary" id="cust-retry">Retry</button>`);
      document.getElementById('cust-retry')?.addEventListener('click', loadFirstCustPage);
    } else {
      APP.toast('Failed to load more customers', 'error');
    }
  } finally {
    custLoading = false; renderCustLoadMore();
  }
}

// Search / filter needs the whole set; pull it once, then cache.
async function ensureAllCustomersLoaded() {
  if (custFullyLoaded) return;
  try {
    const snap = await db.collection('customers').orderBy('name').get();
    allCustomers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    custFullyLoaded = true; custHasMore = false;
    custCursor = snap.docs[snap.docs.length - 1] || null;
  } catch (e) {
    console.error(e);
    APP.toast('Search failed to load customers', 'error');
  }
}

function isFilteringCust() {
  return !!((document.getElementById('cust-search').value || '').trim()
         || (document.getElementById('cust-due-filter')?.value || ''));
}

// Apply current search + dues filter and render.
async function applyCustFilters() {
  if (isFilteringCust()) await ensureAllCustomersLoaded();
  const term = (document.getElementById('cust-search').value || '').toLowerCase();
  const flt  = document.getElementById('cust-due-filter')?.value || '';
  const list = allCustomers.filter(c => {
    const matchTerm = !term || c.name?.toLowerCase().includes(term) || c.phone?.includes(term);
    const due = parseFloat(c.dueBalance || 0);
    const matchDue = !flt || (flt === 'dues' && due > 0) || (flt === 'paid' && due <= 0);
    return matchTerm && matchDue;
  });
  renderCustomers(list);
  renderCustLoadMore();
}

function renderCustLoadMore() {
  const bar = document.getElementById('cust-loadmore');
  if (!bar) return;
  // When filtering, the full set is loaded — no paging control needed.
  if (isFilteringCust()) { bar.innerHTML = ''; return; }
  if (custHasMore) {
    bar.innerHTML = `<button class="btn btn-secondary" id="cust-more-btn" ${custLoading ? 'disabled' : ''}>${
      custLoading ? '<span class="spinner"></span> Loading…' : 'Load more'}</button>`;
    document.getElementById('cust-more-btn')?.addEventListener('click', () => loadMoreCust());
  } else {
    bar.innerHTML = allCustomers.length ? `<span class="hint">All customers loaded.</span>` : '';
  }
}

// Lifetime per-customer stats (totalPurchases / totalSpent) are denormalised
// onto each customer doc and maintained at checkout — so the table reads them
// straight from the already-loaded customer docs, no full sales scan needed.
// For data created before denormalisation, the owner can run a one-time
// recalculation (the only time we read the full sales collection).
async function recalcCustomerStats() {
  const ok = await new Promise(res => APP.showConfirm({
    title: 'Recalculate customer stats',
    message: 'This reads all past sales once and writes each customer\'s lifetime purchase count and total spent back onto their record. Useful after upgrading. Continue?',
    type: 'warning', confirmText: 'Recalculate',
    onConfirm: () => res(true), onCancel: () => res(false),
  }));
  if (!ok) return;

  APP.toast('Recalculating… this reads all sales once', 'info');
  try {
    const agg = {};   // customerId -> { count, spent }
    // Gross invoice count & spend from sales, then net out refunds so "total spent"
    // reflects only what the customer actually kept.
    const [salesSnap, refundsSnap] = await Promise.all([
      db.collection('sales').get(),
      db.collection('refunds').get(),
    ]);
    salesSnap.forEach(doc => {
      const d = doc.data();
      if (!d.customerId) return;
      if (!agg[d.customerId]) agg[d.customerId] = { count: 0, spent: 0 };
      agg[d.customerId].count++;
      agg[d.customerId].spent += parseFloat(d.total || 0);
    });
    refundsSnap.forEach(doc => {
      const r = doc.data();
      if (!r.customerId) return;
      if (!agg[r.customerId]) agg[r.customerId] = { count: 0, spent: 0 };
      agg[r.customerId].spent -= parseFloat(r.totalRefund || 0);
    });

    // Write back in batches of 450 (Firestore allows 500 ops/batch)
    const ids = allCustomers.map(c => c.id);
    const CHUNK = 450;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const batch = db.batch();
      ids.slice(i, i + CHUNK).forEach(id => {
        const a = agg[id] || { count: 0, spent: 0 };
        batch.update(db.collection('customers').doc(id), {
          totalPurchases: a.count, totalSpent: Math.max(0, a.spent),
        });
      });
      await batch.commit();
    }
    APP.audit('customers.recalcStats', { customers: ids.length });
    APP.toast('Customer stats recalculated', 'success');
    await loadCustomers();
  } catch (e) {
    console.error(e);
    APP.toast('Recalculation failed', 'error');
  }
}

function renderCustomers(list) {
  const tbody  = document.getElementById('cust-tbody');
  const empty  = document.getElementById('cust-empty');
  const countEl = document.getElementById('cust-count');
  countEl.textContent = `${list.length} customer${list.length !== 1 ? 's' : ''}`;

  if (!list.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  const canEdit = APP.can('customers.edit');
  tbody.innerHTML = list.map(c => {
    const purchases = parseInt(c.totalPurchases || 0, 10);
    const spent     = parseFloat(c.totalSpent || 0);
    const due   = parseFloat(c.dueBalance || 0);
    const dueCell = due > 0
      ? `<span class="badge badge-red td-mono">${APP.currency(due)}</span>`
      : `<span class="text-muted td-mono">${APP.currency(0)}</span>`;
    return `<tr>
      <td style="font-weight:500;">${APP.sanitize(c.name)}</td>
      <td class="td-mono">${APP.sanitize(c.phone || '--')}</td>
      <td class="text-muted">${APP.sanitize(c.email || '--')}</td>
      <td class="td-mono">${purchases}</td>
      <td class="td-mono text-success">${APP.currency(spent)}</td>
      <td>${dueCell}</td>
      <td class="text-muted">${APP.fmtDate(c.createdAt)}</td>
      <td class="td-actions">
        ${due > 0 && canEdit ? `<button class="btn btn-primary btn-icon" data-action="receive" data-id="${c.id}" title="Receive payment">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><polyline points="19 12 12 5 5 12"/></svg>
        </button>
        ${c.phone ? `<button class="btn btn-icon" data-action="remind" data-id="${c.id}" title="Send WhatsApp reminder" style="background:#25D366;color:#fff;border-color:#25D366;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        </button>` : ''}` : ''}
        <button class="btn btn-secondary btn-icon" data-action="history" data-id="${c.id}" title="View history">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </button>
        ${canEdit ? `<button class="btn btn-secondary btn-icon" data-action="edit" data-id="${c.id}" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>` : ''}
        ${APP.can('customers.delete') ? `<button class="btn btn-danger btn-icon" data-action="delete" data-id="${c.id}" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

function renderCustStats({ total, withDues, outstanding }) {
  const card = (color, icon, value, label) => `
    <div class="stat-card ${color}"><div class="stat-top"><div class="stat-icon ${color}">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icon}</svg>
    </div></div><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
  document.getElementById('cust-stats').innerHTML =
    card('blue',  '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>', total, 'Total Customers') +
    card('yellow','<path d="M12 5v14"/><polyline points="19 12 12 5 5 12"/>', withDues, 'Customers with Dues') +
    card(outstanding > 0 ? 'red' : 'green', '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', APP.currency(outstanding), 'Total Outstanding');
}

function openAddModal() {
  document.getElementById('cust-id').value = '';
  document.getElementById('cust-modal-title').textContent = 'Add Customer';
  ['c-name','c-phone','c-email','c-address'].forEach(id => document.getElementById(id).value = '');
  APP.openModal('cust-modal');
}

function openEditModal(id) {
  const c = allCustomers.find(x => x.id === id); if (!c) return;
  document.getElementById('cust-id').value = id;
  document.getElementById('cust-modal-title').textContent = 'Edit Customer';
  document.getElementById('c-name').value    = c.name || '';
  document.getElementById('c-phone').value   = c.phone || '';
  document.getElementById('c-email').value   = c.email || '';
  document.getElementById('c-address').value = c.address || '';
  APP.openModal('cust-modal');
}

async function saveCustomer() {
  const id   = document.getElementById('cust-id').value;
  const name = document.getElementById('c-name').value.trim();
  const phone = document.getElementById('c-phone').value.trim();
  if (!name || !phone) { APP.toast('Name and phone are required', 'warning'); return; }

  const btn = document.getElementById('save-cust-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…';
  try {
    const data = {
      name, phone,
      email:   document.getElementById('c-email').value.trim(),
      address: document.getElementById('c-address').value.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (id) {
      await db.collection('customers').doc(id).update(data);
      APP.toast('Customer updated', 'success');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('customers').add(data);
      APP.toast('Customer added', 'success');
    }
    APP.closeModal('cust-modal');
    await loadCustomers();
  } catch (e) { APP.toast('Save failed', 'error'); }
  finally { btn.disabled = false; btn.innerHTML = 'Save Customer'; }
}

async function deleteCustomer(id) {
  const c = allCustomers.find(x => x.id === id);
  APP.showConfirm({
    title: 'Delete Customer', message: `Delete "${c?.name}"? This cannot be undone.`,
    type: 'danger', confirmText: 'Delete',
    onConfirm: async () => {
      try { await db.collection('customers').doc(id).delete(); APP.audit('customer.delete', { id }); APP.toast('Customer deleted'); await loadCustomers(); }
      catch (e) { APP.toast('Delete failed', 'error'); }
    }
  });
}

async function viewHistory(id) {
  const c = allCustomers.find(x => x.id === id); if (!c) return;
  document.getElementById('history-name').textContent = `${c.name} — Purchase History`;
  const tbody = document.getElementById('history-tbody');
  const empty  = document.getElementById('history-empty');
  tbody.innerHTML = '<tr><td colspan="5"><div class="skeleton" style="height:14px;width:100%;"></div></td></tr>';
  APP.openModal('history-modal');
  try {
    // Query without orderBy (avoids needing a Firestore composite index),
    // then sort by date in JavaScript instead.
    const snap = await db.collection('sales').where('customerId','==',id).get();
    if (snap.empty) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    const docs = snap.docs.slice().sort((a, b) => {
      const ta = a.data().createdAt?.toDate?.() ?? new Date(0);
      const tb = b.data().createdAt?.toDate?.() ?? new Date(0);
      return tb - ta; // newest first
    });
    tbody.innerHTML = docs.map(doc => {
      const d = doc.data();
      return `<tr>
        <td class="td-mono text-primary">${APP.sanitize(d.invoiceNo||'--')}</td>
        <td>${(d.items||[]).reduce((s,i)=>s+i.quantity,0)} items</td>
        <td class="td-mono">${APP.currency(d.total)}</td>
        <td><span class="badge badge-blue">${APP.sanitize(d.paymentMethod||'Cash')}</span></td>
        <td class="text-muted">${APP.fmtDateTime(d.createdAt)}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    console.error('Customer history load failed:', e);
    tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Error loading history</td></tr>';
  }
}

/* ── Receive Payment ───────────────────────── */
function openReceivePayment(id) {
  const c = allCustomers.find(x => x.id === id); if (!c) return;
  const balance = parseFloat(c.dueBalance || 0);
  document.getElementById('pay-cust-id').value = id;
  document.getElementById('pay-cust-info').innerHTML = `
    <div style="font-weight:600;font-size:14px;">${APP.sanitize(c.name)}</div>
    <div style="color:var(--text-muted);font-size:12px;">${APP.sanitize(c.phone || '')}</div>
    <div style="margin-top:6px;font-size:13px;">Outstanding due: <span class="td-mono" style="color:var(--danger);font-weight:700;">${APP.currency(balance)}</span></div>`;
  document.getElementById('pay-amount').value = balance.toFixed(2);
  document.getElementById('pay-amount').max = balance;
  document.getElementById('pay-method').value = 'Cash';
  document.getElementById('pay-note').value = '';
  APP.openModal('payment-modal');
}

async function savePayment() {
  const id     = document.getElementById('pay-cust-id').value;
  const amount = Math.max(0, parseFloat(document.getElementById('pay-amount').value) || 0);
  const method = document.getElementById('pay-method').value;
  const note   = document.getElementById('pay-note').value.trim();
  const c      = allCustomers.find(x => x.id === id);
  if (!c)              { APP.toast('Customer not found', 'error'); return; }
  if (amount <= 0)     { APP.toast('Amount must be greater than 0', 'warning'); return; }
  const balance = parseFloat(c.dueBalance || 0);
  if (amount > balance + 0.005) { APP.toast(`Amount can't exceed outstanding due (${APP.currency(balance)})`, 'warning'); return; }

  const btn = document.getElementById('save-payment-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…';
  try {
    const custRef = db.collection('customers').doc(id);
    const payRef  = db.collection('duePayments').doc();
    // Atomic: read current balance, decrement, record receipt — same instant.
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(custRef);
      if (!snap.exists) throw new Error('Customer not found');
      const current = parseFloat(snap.data().dueBalance || 0);
      if (amount > current + 0.005) throw new Error(`Outstanding is only ${APP.currency(current)}`);
      tx.update(custRef, { dueBalance: current - amount });
      tx.set(payRef, {
        customerId:   id,
        customerName: snap.data().name || '',
        amount, paymentMethod: method, note,
        balanceBefore: current,
        balanceAfter:  current - amount,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        receivedBy: auth.currentUser?.uid || 'unknown',
      });
    });

    APP.audit('payment.receive', { customerId: id, customerName: c.name, amount, method });
    APP.toast(`Received ${APP.currency(amount)} from ${c.name}`, 'success');
    APP.closeModal('payment-modal');
    await loadCustomers();
  } catch (e) {
    console.error(e);
    APP.toast(e.message || 'Payment failed', 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'Record Payment';
  }
}

function sendDueReminder(id) {
  const c = allCustomers.find(x => x.id === id); if (!c) return;
  const balance = parseFloat(c.dueBalance || 0);
  if (balance <= 0)   { APP.toast('No outstanding due for this customer', 'info'); return; }
  if (!c.phone)       { APP.toast('No phone number on this customer', 'warning'); return; }
  const message = [
    `Hello ${c.name},`, ``,
    `This is a friendly reminder from Nishar Telecom 🙏`,
    ``,
    `You have a pending balance of *${APP.currency(balance)}*.`,
    ``,
    `Please drop by at your convenience to settle the amount. Thank you!`,
  ].join('\n');
  if (APP.whatsApp(c.phone, message)) {
    APP.audit('whatsapp.reminder', { customerId: id, customerName: c.name, balance });
    APP.toast(`WhatsApp opened for ${c.name}`, 'success');
  }
}

function bindCustomerEvents() {
  document.getElementById('recalc-stats-btn')?.addEventListener('click', recalcCustomerStats);
  document.getElementById('add-cust-btn')?.addEventListener('click', openAddModal);
  document.getElementById('close-cust-modal').addEventListener('click', () => APP.closeModal('cust-modal'));
  document.getElementById('cancel-cust-modal').addEventListener('click', () => APP.closeModal('cust-modal'));
  document.getElementById('save-cust-btn').addEventListener('click', saveCustomer);
  document.getElementById('close-history-modal').addEventListener('click', () => APP.closeModal('history-modal'));
  document.getElementById('close-history-btn').addEventListener('click', () => APP.closeModal('history-modal'));

  document.getElementById('cust-tbody').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]'); if (!btn) return;
    if (btn.dataset.action === 'edit')    openEditModal(btn.dataset.id);
    if (btn.dataset.action === 'delete')  deleteCustomer(btn.dataset.id);
    if (btn.dataset.action === 'history') viewHistory(btn.dataset.id);
    if (btn.dataset.action === 'receive') openReceivePayment(btn.dataset.id);
    if (btn.dataset.action === 'remind')  sendDueReminder(btn.dataset.id);
  });

  // Payment modal
  document.getElementById('close-payment-modal').addEventListener('click', () => APP.closeModal('payment-modal'));
  document.getElementById('cancel-payment-modal').addEventListener('click', () => APP.closeModal('payment-modal'));
  document.getElementById('save-payment-btn').addEventListener('click', savePayment);
  document.getElementById('pay-full-due').addEventListener('click', () => {
    const id = document.getElementById('pay-cust-id').value;
    const c  = allCustomers.find(x => x.id === id);
    document.getElementById('pay-amount').value = parseFloat(c?.dueBalance || 0).toFixed(2);
  });

  const search = APP.debounce(applyCustFilters, 250);
  document.getElementById('cust-search').addEventListener('input', search);
  document.getElementById('cust-due-filter').addEventListener('change', applyCustFilters);
}
