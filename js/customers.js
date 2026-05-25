/* =============================================
   NISHAR TELECOM POS — Customers Logic
   ============================================= */
APP.init({ page: 'customers', title: 'Customers', onReady: initCustomers });

let allCustomers = [], customerStats = {};

async function initCustomers() {
  await Promise.all([loadCustomers(), loadCustomerStats()]);
  bindCustomerEvents();
}

async function loadCustomers() {
  try {
    const snap = await db.collection('customers').orderBy('name').get();
    allCustomers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCustomers(allCustomers);
  } catch (e) { APP.toast('Failed to load customers', 'error'); }
}

async function loadCustomerStats() {
  try {
    const snap = await db.collection('sales').get();
    snap.forEach(doc => {
      const d = doc.data();
      if (!d.customerId) return;
      if (!customerStats[d.customerId]) customerStats[d.customerId] = { count: 0, spent: 0 };
      customerStats[d.customerId].count++;
      customerStats[d.customerId].spent += parseFloat(d.total || 0);
    });
    renderCustomers(allCustomers);
  } catch (e) { console.error('Stats:', e); }
}

function renderCustomers(list) {
  const tbody  = document.getElementById('cust-tbody');
  const empty  = document.getElementById('cust-empty');
  const countEl = document.getElementById('cust-count');
  countEl.textContent = `${list.length} customer${list.length !== 1 ? 's' : ''}`;

  if (!list.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  tbody.innerHTML = list.map(c => {
    const stats = customerStats[c.id] || { count: 0, spent: 0 };
    return `<tr>
      <td style="font-weight:500;">${APP.sanitize(c.name)}</td>
      <td class="td-mono">${APP.sanitize(c.phone || '--')}</td>
      <td class="text-muted">${APP.sanitize(c.email || '--')}</td>
      <td class="td-mono">${stats.count}</td>
      <td class="td-mono text-success">${APP.currency(stats.spent)}</td>
      <td class="text-muted">${APP.fmtDate(c.createdAt)}</td>
      <td class="td-actions">
        <button class="btn btn-secondary btn-icon" data-action="history" data-id="${c.id}" title="View history">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </button>
        <button class="btn btn-secondary btn-icon" data-action="edit" data-id="${c.id}" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn btn-danger btn-icon" data-action="delete" data-id="${c.id}" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');
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
      try { await db.collection('customers').doc(id).delete(); APP.toast('Customer deleted'); await loadCustomers(); }
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

function bindCustomerEvents() {
  document.getElementById('add-cust-btn').addEventListener('click', openAddModal);
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
  });

  const search = APP.debounce(() => {
    const term = document.getElementById('cust-search').value.toLowerCase();
    renderCustomers(allCustomers.filter(c => c.name?.toLowerCase().includes(term) || c.phone?.includes(term)));
  }, 250);
  document.getElementById('cust-search').addEventListener('input', search);
}
