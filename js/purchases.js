/* =============================================
   NISHAR TELECOM POS — Purchases Logic
   Supplier-aware: tracks how much you've paid on
   each purchase and credits any unpaid remainder
   to the supplier's running due balance atomically.
   ============================================= */
APP.init({ page: 'purchases', title: 'Purchases', onReady: initPurchases });

let allPurchases = [], products = [], suppliers = [];
let purCursor = null, purHasMore = true, purLoading = false, purFullyLoaded = false;
const PUR_PAGE = 30, PUR_COLS = 8;

async function initPurchases() {
  await Promise.all([loadFirstPurchasePage(), loadProducts(), loadSuppliers()]);
  bindPurchaseEvents();
}

// Refresh the list (used after record/delete).
async function loadPurchases() { await loadFirstPurchasePage(); }

async function loadFirstPurchasePage() {
  allPurchases = []; purCursor = null; purHasMore = true; purFullyLoaded = false;
  document.getElementById('pur-tbody').innerHTML = APP.skeletonRows(PUR_COLS);
  document.getElementById('pur-empty').style.display = 'none';
  document.getElementById('pur-loadmore').innerHTML = '';
  await loadMorePurchases(true);
}

async function loadMorePurchases(first = false) {
  if (purLoading || (!first && !purHasMore)) return;
  purLoading = true; renderPurLoadMore();
  try {
    let q = db.collection('purchases').orderBy('createdAt', 'desc').limit(PUR_PAGE);
    if (purCursor) q = q.startAfter(purCursor);
    const snap = await q.get();
    if (snap.docs.length < PUR_PAGE) purHasMore = false;
    if (snap.docs.length) purCursor = snap.docs[snap.docs.length - 1];
    allPurchases.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
    applyPurchaseFilter();
  } catch (e) {
    console.error(e);
    if (first) {
      document.getElementById('pur-tbody').innerHTML =
        APP.tableMessage(PUR_COLS, `Couldn't load purchases. <button class="btn btn-secondary" id="pur-retry">Retry</button>`);
      document.getElementById('pur-retry')?.addEventListener('click', loadFirstPurchasePage);
    } else {
      APP.toast('Failed to load more purchases', 'error');
    }
  } finally {
    purLoading = false; renderPurLoadMore();
  }
}

// Search needs the whole set; pull it once, then cache.
async function ensureAllPurchasesLoaded() {
  if (purFullyLoaded) return;
  try {
    const snap = await db.collection('purchases').orderBy('createdAt', 'desc').get();
    allPurchases = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    purFullyLoaded = true; purHasMore = false;
    purCursor = snap.docs[snap.docs.length - 1] || null;
  } catch (e) {
    console.error(e);
    APP.toast('Search failed to load purchases', 'error');
  }
}

function isFilteringPurchases() {
  return !!(document.getElementById('pur-search').value || '').trim();
}

async function applyPurchaseFilter() {
  if (isFilteringPurchases()) await ensureAllPurchasesLoaded();
  const term = (document.getElementById('pur-search').value || '').toLowerCase();
  const list = !term ? allPurchases : allPurchases.filter(p =>
    p.supplierName?.toLowerCase().includes(term) ||
    p.productName?.toLowerCase().includes(term) ||
    p.refNo?.toLowerCase().includes(term)
  );
  renderPurchases(list);
  renderPurLoadMore();
}

function renderPurLoadMore() {
  const bar = document.getElementById('pur-loadmore');
  if (!bar) return;
  if (isFilteringPurchases()) { bar.innerHTML = ''; return; }
  if (purHasMore) {
    bar.innerHTML = `<button class="btn btn-secondary" id="pur-more-btn" ${purLoading ? 'disabled' : ''}>${
      purLoading ? '<span class="spinner"></span> Loading…' : 'Load more'}</button>`;
    document.getElementById('pur-more-btn')?.addEventListener('click', () => loadMorePurchases());
  } else {
    bar.innerHTML = allPurchases.length ? `<span class="hint">All purchases loaded.</span>` : '';
  }
}

async function loadProducts() {
  try {
    const snap = await db.collection('products').orderBy('name').get();
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const sel = document.getElementById('pur-product');
    sel.innerHTML = '<option value="">Select a product…</option><option value="__new__">➕ New product (not in list yet)</option>';
    products.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = `${p.name} (Stock: ${p.stock ?? 0})`;
      sel.appendChild(opt);
    });
  } catch (e) { console.error('Products:', e); }
}

async function loadSuppliers() {
  try {
    const snap = await db.collection('suppliers').orderBy('name').get();
    suppliers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const sel = document.getElementById('pur-supplier');
    sel.innerHTML = '<option value="">Walk-in vendor (no tracking)</option>';
    suppliers.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id; opt.textContent = s.name;
      sel.appendChild(opt);
    });
  } catch (e) { console.error('Suppliers:', e); }
}

function renderPurchases(list) {
  const tbody  = document.getElementById('pur-tbody');
  const empty  = document.getElementById('pur-empty');
  const countEl = document.getElementById('pur-count');
  countEl.textContent = `${list.length} record${list.length !== 1 ? 's' : ''}`;
  if (!list.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  tbody.innerHTML = list.map(p => {
    const due = parseFloat(p.dueAmount || 0);
    return `<tr>
      <td class="td-mono text-primary">${APP.sanitize(p.refNo||'--')}</td>
      <td>${APP.sanitize(p.supplierName||'Walk-in')}</td>
      <td style="font-weight:500;">${APP.sanitize(p.productName||'--')}</td>
      <td class="td-mono">${p.quantity}</td>
      <td class="td-mono">${APP.currency(p.unitCost)}</td>
      <td class="td-mono text-warning">${APP.currency(p.totalCost)}${due > 0 ? `<div><span class="badge badge-red" style="font-size:10px;margin-top:2px;">DUE ${APP.currency(due)}</span></div>` : ''}</td>
      <td class="text-muted">${APP.fmtDate(p.createdAt)}</td>
      <td class="td-actions">
        <button class="btn btn-danger btn-icon" data-action="delete" data-id="${p.id}" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');
}

async function savePurchase() {
  const productSel = document.getElementById('pur-product').value;
  const isNew      = productSel === '__new__';
  const qty        = parseInt(document.getElementById('pur-qty').value) || 0;
  const unitCost   = parseFloat(document.getElementById('pur-cost').value) || 0;
  const supplierId = document.getElementById('pur-supplier').value;
  const refNo      = document.getElementById('pur-ref').value.trim() || APP.genId('PUR');
  const notes      = document.getElementById('pur-notes').value.trim();
  const payMethod  = document.getElementById('pur-pay-method').value;

  if (!productSel) { APP.toast('Please select a product (or add a new one)', 'warning'); return; }
  if (qty <= 0)    { APP.toast('Quantity must be at least 1', 'warning'); return; }

  // Gather new-product details if we're creating one inline.
  let newProduct = null;
  if (isNew) {
    const npName     = document.getElementById('np-name').value.trim();
    const npCategory = document.getElementById('np-category').value;
    const npPrice    = parseFloat(document.getElementById('np-price').value) || 0;
    const npUnit     = document.getElementById('np-unit').value || 'Pcs';
    if (!npName)        { APP.toast('Enter the new product name', 'warning'); return; }
    if (!npCategory)    { APP.toast('Pick a category for the new product', 'warning'); return; }
    if (!(npPrice > 0)) { APP.toast('Enter the selling price for the new product', 'warning'); return; }
    newProduct = { name: npName, category: npCategory, price: npPrice, unit: npUnit, buyPrice: unitCost };
  }

  const existingProduct = !isNew ? products.find(p => p.id === productSel) : null;
  if (!isNew && !existingProduct) { APP.toast('Selected product not found — reload and try again', 'warning'); return; }

  const supplier   = suppliers.find(s => s.id === supplierId);
  const totalCost  = qty * unitCost;
  const paidNowRaw = parseFloat(document.getElementById('pur-paid').value) || 0;
  const amountPaid = Math.min(Math.max(0, paidNowRaw), totalCost);
  const dueAmount  = totalCost - amountPaid;

  if (dueAmount > 0 && !supplier) {
    APP.toast('Select a supplier to track an unpaid balance (or pay in full for walk-in purchases)', 'warning');
    return;
  }

  const btn = document.getElementById('save-purchase-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…';

  try {
    const purRef      = db.collection('purchases').doc();
    const productRef  = isNew ? db.collection('products').doc() : db.collection('products').doc(productSel);
    const supplierRef = supplier ? db.collection('suppliers').doc(supplier.id) : null;
    const productName = isNew ? newProduct.name : (existingProduct.name || '');

    await db.runTransaction(async (tx) => {
      // READS first
      const productSnap  = isNew ? null : await tx.get(productRef);
      const supplierSnap = supplierRef ? await tx.get(supplierRef) : null;
      if (!isNew && !productSnap.exists) throw new Error('Product no longer exists');
      if (supplierSnap && !supplierSnap.exists) throw new Error('Supplier no longer exists');

      // WRITES
      if (isNew) {
        // Create the product with opening stock = the quantity being purchased.
        tx.set(productRef, {
          name: newProduct.name, category: newProduct.category,
          price: newProduct.price, buyPrice: newProduct.buyPrice,
          unit: newProduct.unit, stock: qty,
          brand: '', description: '', barcode: '', isService: false,
          packUnit: '', packSize: '',
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        // Existing product: just add the purchased quantity to stock.
        tx.update(productRef, { stock: (productSnap.data().stock || 0) + qty });
      }

      tx.set(purRef, {
        productId: productRef.id, productName,
        supplierId:   supplier ? supplier.id : null,
        supplierName: supplier ? supplier.name : '',
        refNo, quantity: qty, unitCost, totalCost,
        amountPaid, dueAmount,
        dueStatus: dueAmount === 0 ? 'paid' : (amountPaid > 0 ? 'partial' : 'unpaid'),
        paymentMethod: payMethod, notes,
        newProduct: isNew,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.currentUser?.uid || 'unknown',
      });
      if (supplierSnap && dueAmount > 0) {
        const prev = parseFloat(supplierSnap.data().dueBalance || 0);
        tx.update(supplierRef, { dueBalance: prev + dueAmount });
      }
    });

    if (supplier && dueAmount > 0) {
      supplier.dueBalance = (parseFloat(supplier.dueBalance) || 0) + dueAmount;
    }

    APP.audit('purchase.create', {
      productId: productRef.id, productName,
      newProduct: isNew,
      supplierId: supplier?.id || null, supplierName: supplier?.name || '',
      quantity: qty, totalCost, amountPaid, dueAmount
    });
    APP.toast(
      isNew
        ? `Created "${productName}" and stocked ${qty} units`
        : (dueAmount > 0
            ? `${qty} units stocked — ${APP.currency(dueAmount)} owed to ${supplier.name}`
            : `${qty} units of "${productName}" added to stock`),
      'success'
    );
    APP.closeModal('purchase-modal');
    await loadPurchases();
    await loadProducts();
    clearPurchaseForm();
  } catch (e) {
    console.error(e);
    APP.toast(e.message || 'Failed to record purchase', 'error');
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
  document.getElementById('pur-paid').value = '0';
  document.getElementById('pur-pay-method').value = 'Cash';
  document.getElementById('pur-notes').value = '';
  document.getElementById('pur-total-row').style.display = 'none';
  document.getElementById('pur-due-row').style.display = 'none';
  // New-product inline fields
  ['np-name','np-price'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const npCat = document.getElementById('np-category'); if (npCat) npCat.value = '';
  const npUnit = document.getElementById('np-unit');     if (npUnit) npUnit.value = 'Pcs';
  toggleNewProductFields();
}

// Show the inline new-product fields only when "New product" is selected.
function toggleNewProductFields() {
  const isNew = document.getElementById('pur-product').value === '__new__';
  document.getElementById('pur-newproduct').style.display = isNew ? 'block' : 'none';
}

function deletePurchase(id) {
  const p = allPurchases.find(x => x.id === id); if (!p) return;
  const due = parseFloat(p.dueAmount || 0);
  const qty = parseInt(p.quantity || 0, 10);
  const supplierNote = (due > 0 && p.supplierId)
    ? ` Supplier balance will drop by ${APP.currency(due)}.` : '';
  APP.showConfirm({
    title: 'Delete Purchase',
    message: `Delete this purchase? This reverses the stock-in (−${qty} units) and undoes the cost.${supplierNote} Cannot be undone.`,
    type: 'danger', confirmText: 'Delete & Reverse',
    onConfirm: async () => {
      try {
        const purRef      = db.collection('purchases').doc(id);
        const productRef  = p.productId  ? db.collection('products').doc(p.productId)   : null;
        const supplierRef = (due > 0 && p.supplierId) ? db.collection('suppliers').doc(p.supplierId) : null;

        await db.runTransaction(async (tx) => {
          // READS first
          const purSnap = await tx.get(purRef);
          if (!purSnap.exists) throw new Error('Purchase already removed');
          const prodSnap = productRef  ? await tx.get(productRef)  : null;
          const supSnap  = supplierRef ? await tx.get(supplierRef) : null;

          // WRITES — floor at 0 so intervening sales/payments can't push negative
          if (prodSnap && prodSnap.exists) {
            const newStock = Math.max(0, (prodSnap.data().stock || 0) - qty);
            tx.update(productRef, { stock: newStock });
          }
          if (supSnap && supSnap.exists) {
            const newDue = Math.max(0, parseFloat(supSnap.data().dueBalance || 0) - due);
            tx.update(supplierRef, { dueBalance: newDue });
          }
          tx.delete(purRef);
        });

        APP.audit('purchase.delete', {
          refNo: p.refNo, productName: p.productName, quantity: qty,
          reversedDue: due, supplierName: p.supplierName || '',
        });
        APP.toast('Purchase deleted and reversed', 'success');
        await loadPurchases();
        await loadProducts();
      } catch (e) {
        console.error(e);
        APP.toast(e.message || 'Delete failed', 'error');
      }
    }
  });
}

function updatePurchaseTotals() {
  const qty   = parseFloat(document.getElementById('pur-qty').value)  || 0;
  const cost  = parseFloat(document.getElementById('pur-cost').value) || 0;
  const total = qty * cost;
  const paid  = parseFloat(document.getElementById('pur-paid').value) || 0;
  const due   = Math.max(0, total - paid);

  const totalRow = document.getElementById('pur-total-row');
  if (total > 0) {
    totalRow.style.display = 'block';
    document.getElementById('pur-total-val').textContent = APP.currency(total);
  } else { totalRow.style.display = 'none'; }

  const dueRow = document.getElementById('pur-due-row');
  if (due > 0 && total > 0) {
    dueRow.style.display = 'block';
    document.getElementById('pur-due-val').textContent = APP.currency(due);
  } else { dueRow.style.display = 'none'; }
}

function bindPurchaseEvents() {
  document.getElementById('add-purchase-btn').addEventListener('click', () => {
    clearPurchaseForm();
    APP.openModal('purchase-modal');
  });
  document.getElementById('close-purchase-modal').addEventListener('click', () => APP.closeModal('purchase-modal'));
  document.getElementById('cancel-purchase-modal').addEventListener('click', () => APP.closeModal('purchase-modal'));
  document.getElementById('save-purchase-btn').addEventListener('click', savePurchase);

  ['pur-qty','pur-cost','pur-paid'].forEach(id =>
    document.getElementById(id).addEventListener('input', updatePurchaseTotals)
  );
  document.getElementById('pur-product').addEventListener('change', toggleNewProductFields);

  document.getElementById('pur-pay-full').addEventListener('click', () => {
    const qty  = parseFloat(document.getElementById('pur-qty').value)  || 0;
    const cost = parseFloat(document.getElementById('pur-cost').value) || 0;
    document.getElementById('pur-paid').value = (qty * cost).toFixed(2);
    updatePurchaseTotals();
  });

  document.getElementById('pur-tbody').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]'); if (!btn) return;
    if (btn.dataset.action === 'delete') deletePurchase(btn.dataset.id);
  });

  const search = APP.debounce(applyPurchaseFilter, 250);
  document.getElementById('pur-search').addEventListener('input', search);
}
