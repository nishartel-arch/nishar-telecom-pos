/* =============================================
   NISHAR TELECOM POS — Inventory Logic
   ============================================= */
APP.init({ page: 'inventory', title: 'Inventory', onReady: initInventory });

let allProducts = [];

async function initInventory() {
  await loadProducts();
  bindInventoryEvents();
}

async function loadProducts() {
  try {
    const snap = await db.collection('products').orderBy('name').get();
    allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTable(allProducts);
  } catch (e) {
    APP.toast('Failed to load inventory', 'error');
  }
}

function renderTable(list) {
  const tbody  = document.getElementById('inventory-tbody');
  const empty  = document.getElementById('inventory-empty');
  const countEl = document.getElementById('inv-count');
  countEl.textContent = `${list.length} product${list.length !== 1 ? 's' : ''}`;

  if (!list.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = list.map(p => {
    const margin = p.price && p.buyPrice ? (((p.price - p.buyPrice) / p.buyPrice) * 100).toFixed(1) : '--';
    let statusBadge;
    if (p.stock === 0)      statusBadge = '<span class="badge badge-red">Out of Stock</span>';
    else if (p.stock <= 5)  statusBadge = '<span class="badge badge-yellow">Low Stock</span>';
    else                    statusBadge = '<span class="badge badge-green">In Stock</span>';

    return `<tr>
      <td><span style="font-weight:500;">${APP.sanitize(p.name)}</span></td>
      <td><span class="badge badge-blue">${APP.sanitize(p.category || 'Other')}</span></td>
      <td class="text-muted">${APP.sanitize(p.brand || '--')}</td>
      <td class="td-mono">${APP.currency(p.buyPrice)}</td>
      <td class="td-mono text-primary">${APP.currency(p.price)}</td>
      <td class="td-mono ${p.stock === 0 ? 'no-stock' : p.stock <= 5 ? 'low-stock' : ''}">${p.stock ?? 0}</td>
      <td>${statusBadge}</td>
      <td class="td-actions">
        <button class="btn btn-secondary btn-icon" data-action="edit" data-id="${p.id}" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn btn-danger btn-icon" data-action="delete" data-id="${p.id}" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');
}

function openAddModal() {
  document.getElementById('product-id').value = '';
  document.getElementById('product-modal-title').textContent = 'Add Product';
  ['p-name','p-brand','p-description'].forEach(id => document.getElementById(id).value = '');
  ['p-category'].forEach(id => document.getElementById(id).value = '');
  ['p-stock','p-buy-price','p-sell-price'].forEach(id => document.getElementById(id).value = '');
  APP.openModal('product-modal');
}

function openEditModal(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  document.getElementById('product-id').value         = id;
  document.getElementById('product-modal-title').textContent = 'Edit Product';
  document.getElementById('p-name').value             = p.name || '';
  document.getElementById('p-brand').value            = p.brand || '';
  document.getElementById('p-category').value         = p.category || '';
  document.getElementById('p-stock').value            = p.stock ?? 0;
  document.getElementById('p-buy-price').value        = p.buyPrice ?? '';
  document.getElementById('p-sell-price').value       = p.price ?? '';
  document.getElementById('p-description').value      = p.description || '';
  APP.openModal('product-modal');
}

async function saveProduct() {
  const id       = document.getElementById('product-id').value;
  const name     = document.getElementById('p-name').value.trim();
  const brand    = document.getElementById('p-brand').value.trim();
  const category = document.getElementById('p-category').value;
  const stock    = parseInt(document.getElementById('p-stock').value) || 0;
  const buyPrice = parseFloat(document.getElementById('p-buy-price').value) || 0;
  const price    = parseFloat(document.getElementById('p-sell-price').value) || 0;
  const description = document.getElementById('p-description').value.trim();

  if (!name)     { APP.toast('Product name is required', 'warning'); return; }
  if (!category) { APP.toast('Category is required', 'warning'); return; }
  if (price <= 0){ APP.toast('Sell price must be greater than 0', 'warning'); return; }

  const saveBtn = document.getElementById('save-product-btn');
  saveBtn.disabled = true; saveBtn.innerHTML = '<span class="spinner"></span> Saving…';

  try {
    const data = { name, brand, category, stock, buyPrice, price, description, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    if (id) {
      await db.collection('products').doc(id).update(data);
      APP.toast('Product updated', 'success');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('products').add(data);
      APP.toast('Product added', 'success');
    }
    APP.closeModal('product-modal');
    await loadProducts();
  } catch (e) {
    APP.toast('Failed to save product', 'error');
  } finally {
    saveBtn.disabled = false; saveBtn.innerHTML = 'Save Product';
  }
}

async function deleteProduct(id) {
  const p = allProducts.find(x => x.id === id);
  APP.showConfirm({
    title: 'Delete Product',
    message: `Delete "${p?.name || 'this product'}"? This cannot be undone.`,
    type: 'danger', confirmText: 'Delete',
    onConfirm: async () => {
      try {
        await db.collection('products').doc(id).delete();
        APP.toast('Product deleted');
        await loadProducts();
      } catch (e) { APP.toast('Delete failed', 'error'); }
    }
  });
}

function filterInventory() {
  const term  = document.getElementById('inv-search').value.toLowerCase();
  const cat   = document.getElementById('inv-category').value;
  const stock = document.getElementById('inv-stock-filter').value;
  let list = allProducts.filter(p => {
    const matchTerm  = !term  || p.name?.toLowerCase().includes(term) || p.brand?.toLowerCase().includes(term);
    const matchCat   = !cat   || p.category === cat;
    const matchStock = !stock ||
      (stock === 'low' && p.stock > 0 && p.stock <= 5) ||
      (stock === 'out' && p.stock === 0);
    return matchTerm && matchCat && matchStock;
  });
  renderTable(list);
}

function bindInventoryEvents() {
  document.getElementById('add-product-btn').addEventListener('click', openAddModal);
  document.getElementById('close-product-modal').addEventListener('click', () => APP.closeModal('product-modal'));
  document.getElementById('cancel-product-modal').addEventListener('click', () => APP.closeModal('product-modal'));
  document.getElementById('save-product-btn').addEventListener('click', saveProduct);

  document.getElementById('inventory-tbody').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'edit')   openEditModal(btn.dataset.id);
    if (btn.dataset.action === 'delete') deleteProduct(btn.dataset.id);
  });

  const search = APP.debounce(filterInventory, 250);
  document.getElementById('inv-search').addEventListener('input', search);
  document.getElementById('inv-category').addEventListener('change', filterInventory);
  document.getElementById('inv-stock-filter').addEventListener('change', filterInventory);
}
