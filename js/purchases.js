/* =============================================
   NISHAR TELECOM POS — Purchases Logic
   ============================================= */
APP.init({ page: 'purchases', title: 'Purchases', onReady: initPurchases });

let allPurchases = [], products = [];

async function initPurchases() {
  await Promise.all([loadPurchases(), loadProducts()]);
  bindPurchaseEvents();
}

async function loadPurchases() {
  try {
    const snap = await db.collection('purchases').orderBy('createdAt','desc').get();
    allPurchases = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPurchases(allPurchases);
  } catch (e) { APP.toast('Failed to load purchases', 'error'); }
}

async function loadProducts() {
  try {
    const snap = await db.collection('products').orderBy('name').get();
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const sel = document.getElementById('pur-product');
    sel.innerHTML = '<option value="">Select a product…</option>';
    products.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = `${p.name} (Stock: ${p.stock ?? 0})`;
      sel.appendChild(opt);
    });
  } catch (e) { console.error('Products:', e); }
}

function renderPurchases(list) {
  const tbody  = document.getElementById('pur-tbody');
  const empty  = document.getElementById('pur-empty');
  const countEl = document.getElementById('pur-count');
  countEl.textContent = `${list.length} record${list.length !== 1 ? 's' : ''}`;
  if (!list.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  tbody.innerHTML = list.map(p => `<tr>
    <td class="td-mono text-primary">${APP.sanitize(p.refNo||'--')}</td>
    <td>${APP.sanitize(p.supplierName||'Unknown')}</td>
    <td style="font-weight:500;">${APP.sanitize(p.productName||'--')}</td>
    <td class="td-mono">${p.quantity}</td>
    <td class="td-mono">${APP.currency(p.unitCost)}</td>
    <td class="td-mono text-warning">${APP.currency(p.totalCost)}</td>
    <td class="text-muted">${APP.fmtDate(p.createdAt)}</td>
    <td class="td-actions">
      <button class="btn btn-danger btn-icon" data-action="delete" data-id="${p.id}" title="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </td>
  </tr>`).join('');
}

async function savePurchase() {
  const productId   = document.getElementById('pur-product').value;
  const qty         = parseInt(document.getElementById('pur-qty').value) || 0;
  const unitCost    = parseFloat(document.getElementById('pur-cost').value) || 0;
  const supplier    = document.getElementById('pur-supplier').value.trim();
  const refNo       = document.getElementById('pur-ref').value.trim() || APP.genId('PUR');
  const notes       = document.getElementById('pur-notes').value.trim();

  if (!productId) { APP.toast('Please select a product', 'warning'); return; }
  if (qty <= 0)   { APP.toast('Quantity must be at least 1', 'warning'); return; }

  const product = products.find(p => p.id === productId);
  const btn = document.getElementById('save-purchase-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…';

  try {
    const batch = db.batch();
    const purRef = db.collection('purchases').doc();
    batch.set(purRef, {
      productId, productName: product?.name || '',
      supplierName: supplier, refNo, quantity: qty, unitCost,
      totalCost: qty * unitCost, notes,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: auth.currentUser?.uid
    });
    // Auto-update stock
    batch.update(db.collection('products').doc(productId), {
      stock: firebase.firestore.FieldValue.increment(qty)
    });
    await batch.commit();
    APP.toast(`${qty} units of "${product?.name}" added to stock`, 'success');
    APP.closeModal('purchase-modal');
    await loadPurchases();
    await loadProducts();
    clearPurchaseForm();
  } catch (e) {
    APP.toast('Failed to record purchase', 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'Record Purchase';
  }
}

function clearPurchaseForm() {
  document.getElementById('pur-product').value = '';
  document.getElementById('pur-supplier').value = '';
  document.getElementById('pur-ref').value = '';
  document.getElementById('pur-qty').value = '';
  document.getElementById('pur-cost').value = '';
  document.getElementById('pur-notes').value = '';
  document.getElementById('pur-total-row').style.display = 'none';
}

function deletePurchase(id) {
  APP.showConfirm({
    title: 'Delete Purchase', message: 'Delete this purchase record? Stock will NOT be reversed automatically.',
    type: 'danger', confirmText: 'Delete',
    onConfirm: async () => {
      try { await db.collection('purchases').doc(id).delete(); APP.toast('Purchase deleted'); await loadPurchases(); }
      catch (e) { APP.toast('Delete failed', 'error'); }
    }
  });
}

function bindPurchaseEvents() {
  document.getElementById('add-purchase-btn').addEventListener('click', () => APP.openModal('purchase-modal'));
  document.getElementById('close-purchase-modal').addEventListener('click', () => APP.closeModal('purchase-modal'));
  document.getElementById('cancel-purchase-modal').addEventListener('click', () => APP.closeModal('purchase-modal'));
  document.getElementById('save-purchase-btn').addEventListener('click', savePurchase);

  ['pur-qty','pur-cost'].forEach(id => document.getElementById(id).addEventListener('input', () => {
    const qty  = parseFloat(document.getElementById('pur-qty').value)  || 0;
    const cost = parseFloat(document.getElementById('pur-cost').value) || 0;
    const row  = document.getElementById('pur-total-row');
    if (qty > 0 && cost > 0) {
      row.style.display = 'block';
      document.getElementById('pur-total-val').textContent = APP.currency(qty * cost);
    } else { row.style.display = 'none'; }
  }));

  document.getElementById('pur-tbody').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]'); if (!btn) return;
    if (btn.dataset.action === 'delete') deletePurchase(btn.dataset.id);
  });

  const search = APP.debounce(() => {
    const term = document.getElementById('pur-search').value.toLowerCase();
    renderPurchases(allPurchases.filter(p => p.supplierName?.toLowerCase().includes(term) || p.productName?.toLowerCase().includes(term)));
  }, 250);
  document.getElementById('pur-search').addEventListener('input', search);
}
