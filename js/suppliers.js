/* =============================================
   NISHAR TELECOM POS — Suppliers
   Mirror of the customer-due system, but for what
   the SHOP owes vendors. Back-office only.
   ============================================= */
APP.init({ page: 'suppliers', title: 'Suppliers', onReady: initSuppliers });

const SUP_COLS = 7;
let allSuppliers = [];

async function initSuppliers() {
  bindSupplierEvents();
  await loadSuppliers();
}

async function loadSuppliers() {
  document.getElementById('sup-tbody').innerHTML = APP.skeletonRows(SUP_COLS, 4);
  document.getElementById('sup-empty').style.display = 'none';
  try {
    const snap = await db.collection('suppliers').orderBy('name').get();
    allSuppliers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSupStats();
    applySupFilters();
  } catch (e) {
    console.error(e);
    document.getElementById('sup-tbody').innerHTML =
      APP.tableMessage(SUP_COLS, `Couldn't load suppliers. <button class="btn btn-secondary" id="sup-retry">Retry</button>`);
    document.getElementById('sup-retry')?.addEventListener('click', loadSuppliers);
  }
}

function applySupFilters() {
  const term = (document.getElementById('sup-search').value || '').toLowerCase().trim();
  const flt  = document.getElementById('sup-due-filter')?.value || '';
  const list = allSuppliers.filter(s => {
    const matchTerm = !term
      || s.name?.toLowerCase().includes(term)
      || s.phone?.includes(term)
      || s.gstin?.toLowerCase().includes(term);
    const due = parseFloat(s.dueBalance || 0);
    const matchDue = !flt || (flt === 'dues' && due > 0) || (flt === 'paid' && due <= 0);
    return matchTerm && matchDue;
  });
  renderSuppliers(list);
}

function renderSupStats() {
  const total      = allSuppliers.length;
  const withDues   = allSuppliers.filter(s => parseFloat(s.dueBalance || 0) > 0).length;
  const owed       = allSuppliers.reduce((s, c) => s + parseFloat(c.dueBalance || 0), 0);
  const card = (color, icon, value, label) => `
    <div class="stat-card ${color}"><div class="stat-top"><div class="stat-icon ${color}">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icon}</svg>
    </div></div><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
  document.getElementById('sup-stats').innerHTML =
    card('blue',   '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>', total, 'Total Suppliers') +
    card('yellow', '<path d="M12 5v14"/><polyline points="19 12 12 5 5 12"/>', withDues, 'You Owe Money To') +
    card(owed > 0 ? 'red' : 'green',
         '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
         APP.currency(owed), 'Total Outstanding');
}

function renderSuppliers(list) {
  const tbody = document.getElementById('sup-tbody');
  const empty = document.getElementById('sup-empty');
  document.getElementById('sup-count').textContent = `${list.length} supplier${list.length !== 1 ? 's' : ''}`;
  if (!list.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  const canManage = APP.can('suppliers.manage');
  const canDelete = APP.can('suppliers.delete') || APP.role() === 'owner';
  tbody.innerHTML = list.map(s => {
    const due = parseFloat(s.dueBalance || 0);
    const dueCell = due > 0
      ? `<span class="badge badge-red td-mono">${APP.currency(due)}</span>`
      : `<span class="text-muted td-mono">${APP.currency(0)}</span>`;
    return `<tr>
      <td style="font-weight:500;">${APP.sanitize(s.name)}</td>
      <td class="text-muted">${APP.sanitize(s.contactPerson || '--')}</td>
      <td class="td-mono">${APP.sanitize(s.phone || '--')}</td>
      <td class="td-mono text-muted" style="font-size:11px;">${APP.sanitize(s.gstin || '--')}</td>
      <td>${dueCell}</td>
      <td class="text-muted">${APP.fmtDate(s.createdAt)}</td>
      <td class="td-actions">
        ${due > 0 && canManage ? `<button class="btn btn-primary btn-icon" data-action="pay" data-id="${s.id}" title="Record payment">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><polyline points="19 12 12 5 5 12"/></svg>
        </button>` : ''}
        ${canManage ? `<button class="btn btn-secondary btn-icon" data-action="edit" data-id="${s.id}" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>` : ''}
        ${canDelete ? `<button class="btn btn-danger btn-icon" data-action="delete" data-id="${s.id}" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

/* ── Add / Edit ─────────────────────────────── */
function openAddSupplier() {
  document.getElementById('supplier-modal-title').textContent = 'Add Supplier';
  ['sup-id','s-name','s-contact','s-phone','s-email','s-gstin','s-address','s-notes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  APP.openModal('supplier-modal');
}

function openEditSupplier(id) {
  const s = allSuppliers.find(x => x.id === id); if (!s) return;
  document.getElementById('supplier-modal-title').textContent = 'Edit Supplier';
  document.getElementById('sup-id').value      = id;
  document.getElementById('s-name').value      = s.name || '';
  document.getElementById('s-contact').value   = s.contactPerson || '';
  document.getElementById('s-phone').value     = s.phone || '';
  document.getElementById('s-email').value     = s.email || '';
  document.getElementById('s-gstin').value     = s.gstin || '';
  document.getElementById('s-address').value   = s.address || '';
  document.getElementById('s-notes').value     = s.notes || '';
  APP.openModal('supplier-modal');
}

async function saveSupplier() {
  const id      = document.getElementById('sup-id').value;
  const name    = document.getElementById('s-name').value.trim();
  if (!name) { APP.toast('Name is required', 'warning'); return; }
  const data = {
    name,
    contactPerson: document.getElementById('s-contact').value.trim(),
    phone:         document.getElementById('s-phone').value.trim(),
    email:         document.getElementById('s-email').value.trim(),
    gstin:         document.getElementById('s-gstin').value.trim(),
    address:       document.getElementById('s-address').value.trim(),
    notes:         document.getElementById('s-notes').value.trim(),
    updatedAt:     firebase.firestore.FieldValue.serverTimestamp(),
  };
  const btn = document.getElementById('save-supplier-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…';
  try {
    if (id) {
      await db.collection('suppliers').doc(id).update(data);
      APP.audit('supplier.update', { id, name });
      APP.toast('Supplier updated', 'success');
    } else {
      data.createdAt   = firebase.firestore.FieldValue.serverTimestamp();
      data.dueBalance  = 0;
      const ref = await db.collection('suppliers').add(data);
      APP.audit('supplier.create', { id: ref.id, name });
      APP.toast('Supplier added', 'success');
    }
    APP.closeModal('supplier-modal');
    await loadSuppliers();
  } catch (e) {
    console.error(e);
    APP.toast('Save failed', 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'Save';
  }
}

function deleteSupplier(id) {
  const s = allSuppliers.find(x => x.id === id); if (!s) return;
  const due = parseFloat(s.dueBalance || 0);
  APP.showConfirm({
    title: 'Delete Supplier',
    message: `Delete "${APP.sanitize(s.name)}"?${due > 0 ? ` Outstanding balance of ${APP.currency(due)} will be lost.` : ''} This cannot be undone.`,
    type: 'danger', confirmText: 'Delete',
    onConfirm: async () => {
      try {
        await db.collection('suppliers').doc(id).delete();
        APP.audit('supplier.delete', { id, name: s.name });
        APP.toast('Supplier deleted');
        await loadSuppliers();
      } catch (e) { APP.toast('Delete failed', 'error'); }
    }
  });
}

/* ── Pay supplier ──────────────────────────── */
function openPaySupplier(id) {
  const s = allSuppliers.find(x => x.id === id); if (!s) return;
  const balance = parseFloat(s.dueBalance || 0);
  document.getElementById('sp-sup-id').value = id;
  document.getElementById('sp-sup-info').innerHTML = `
    <div style="font-weight:600;">${APP.sanitize(s.name)}</div>
    <div style="color:var(--text-muted);font-size:12px;">${APP.sanitize(s.contactPerson || '')}${s.phone ? ' · ' + APP.sanitize(s.phone) : ''}</div>
    <div style="margin-top:6px;font-size:13px;">Outstanding: <span class="td-mono" style="color:var(--danger);font-weight:700;">${APP.currency(balance)}</span></div>`;
  document.getElementById('sp-amount').value = balance.toFixed(2);
  document.getElementById('sp-amount').max = balance;
  document.getElementById('sp-method').value = 'Cash';
  document.getElementById('sp-note').value = '';
  APP.openModal('sup-pay-modal');
}

async function saveSupplierPayment() {
  const id     = document.getElementById('sp-sup-id').value;
  const amount = Math.max(0, parseFloat(document.getElementById('sp-amount').value) || 0);
  const method = document.getElementById('sp-method').value;
  const note   = document.getElementById('sp-note').value.trim();
  const s      = allSuppliers.find(x => x.id === id);
  if (!s)              { APP.toast('Supplier not found', 'error'); return; }
  if (amount <= 0)     { APP.toast('Amount must be greater than 0', 'warning'); return; }
  const balance = parseFloat(s.dueBalance || 0);
  if (amount > balance + 0.005) { APP.toast(`Amount can't exceed outstanding (${APP.currency(balance)})`, 'warning'); return; }

  const btn = document.getElementById('save-suppay-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…';
  try {
    const supRef = db.collection('suppliers').doc(id);
    const payRef = db.collection('supplierPayments').doc();
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(supRef);
      if (!snap.exists) throw new Error('Supplier not found');
      const current = parseFloat(snap.data().dueBalance || 0);
      if (amount > current + 0.005) throw new Error(`Outstanding is only ${APP.currency(current)}`);
      tx.update(supRef, { dueBalance: current - amount });
      tx.set(payRef, {
        supplierId:   id,
        supplierName: snap.data().name || '',
        amount, paymentMethod: method, note,
        balanceBefore: current,
        balanceAfter:  current - amount,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        paidBy:    auth.currentUser?.uid || 'unknown',
      });
    });
    APP.audit('supplier.payment', { supplierId: id, supplierName: s.name, amount, method });
    APP.toast(`Paid ${APP.currency(amount)} to ${s.name}`, 'success');
    APP.closeModal('sup-pay-modal');
    await loadSuppliers();
  } catch (e) {
    console.error(e);
    APP.toast(e.message || 'Payment failed', 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'Record Payment';
  }
}

/* ── Events ────────────────────────────────── */
function bindSupplierEvents() {
  document.getElementById('add-supplier-btn')?.addEventListener('click', openAddSupplier);
  document.getElementById('close-supplier-modal').addEventListener('click', () => APP.closeModal('supplier-modal'));
  document.getElementById('cancel-supplier-modal').addEventListener('click', () => APP.closeModal('supplier-modal'));
  document.getElementById('save-supplier-btn').addEventListener('click', saveSupplier);

  document.getElementById('close-suppay-modal').addEventListener('click', () => APP.closeModal('sup-pay-modal'));
  document.getElementById('cancel-suppay-modal').addEventListener('click', () => APP.closeModal('sup-pay-modal'));
  document.getElementById('save-suppay-btn').addEventListener('click', saveSupplierPayment);
  document.getElementById('sp-pay-full').addEventListener('click', () => {
    const id = document.getElementById('sp-sup-id').value;
    const s  = allSuppliers.find(x => x.id === id);
    document.getElementById('sp-amount').value = parseFloat(s?.dueBalance || 0).toFixed(2);
  });

  document.getElementById('sup-tbody').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]'); if (!btn) return;
    if (btn.dataset.action === 'edit')    openEditSupplier(btn.dataset.id);
    if (btn.dataset.action === 'delete')  deleteSupplier(btn.dataset.id);
    if (btn.dataset.action === 'pay')     openPaySupplier(btn.dataset.id);
  });

  const search = APP.debounce(applySupFilters, 250);
  document.getElementById('sup-search').addEventListener('input', search);
  document.getElementById('sup-due-filter').addEventListener('change', applySupFilters);
}
