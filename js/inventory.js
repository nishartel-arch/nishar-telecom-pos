/* =============================================
   NISHAR TELECOM POS — Inventory Logic
   ============================================= */
APP.init({ page: 'inventory', title: 'Inventory', onReady: initInventory });

let allProducts = [];           // accumulator of loaded products
let invCursor    = null;        // pagination cursor (last doc)
let invHasMore   = true;
let invFullyLoaded = false;     // true once the whole collection is in memory
let invLoading   = false;
const INV_PAGE   = 60;
const INV_COLS   = 8;

// Service categories need only a sale price — no stock or purchase price.
const SERVICE_CATS = [];
const isServiceCat = c => SERVICE_CATS.includes(c);

// Suggested pieces-per-pack defaults for common pack units.
const PACK_DEFAULTS = { Dozen: 12, Pair: 2 };

// Pieces per pack currently entered (1 if no pack unit selected).
function currentPackSize() {
  const packUnit = document.getElementById('p-pack-unit').value;
  if (!packUnit) return 1;
  return Math.max(1, parseInt(document.getElementById('p-pack-size').value) || 0);
}

// Build a readable "1 Dozen 3 Pcs" style label from a piece count.
function packLabel(stock, packSize, packUnit, unit) {
  if (!packUnit || packSize <= 1) return `${stock} ${unit}`;
  const packs = Math.floor(stock / packSize);
  const rem   = stock % packSize;
  let s = packs > 0 ? `${packs} ${packUnit}` : '';
  if (rem > 0) s += (s ? ' ' : '') + `${rem} ${unit}`;
  return s || `0 ${packUnit}`;
}

// Rebuild the "enter stock as" dropdown + live conversion hint.
function refreshUnitUI() {
  const unit     = document.getElementById('p-unit').value || 'Pcs';
  const packUnit = document.getElementById('p-pack-unit').value;

  // Pieces-per-pack field only matters when a pack unit is chosen.
  document.getElementById('grp-pack-size').style.display = packUnit ? '' : 'none';

  // Stock entry-unit options: always the piece (selling) unit; add pack if set.
  const sel = document.getElementById('p-stock-unit');
  const prev = sel.value;
  sel.innerHTML =
    `<option value="piece">${unit}</option>` +
    (packUnit ? `<option value="pack">${packUnit}</option>` : '');
  sel.value = (prev === 'pack' && packUnit) ? 'pack' : 'piece';

  updateStockHint();
}

function updateStockHint() {
  const unit     = document.getElementById('p-unit').value || 'Pcs';
  const packUnit = document.getElementById('p-pack-unit').value;
  const packSize = currentPackSize();
  const entry    = document.getElementById('p-stock-unit').value;
  const qty      = parseFloat(document.getElementById('p-stock').value) || 0;
  const hint     = document.getElementById('stock-hint');
  if (!packUnit || qty <= 0) { hint.textContent = ''; return; }
  const pieces = entry === 'pack' ? Math.round(qty * packSize) : Math.round(qty);
  hint.textContent = `= ${pieces} ${unit}  (1 ${packUnit} = ${packSize} ${unit})`;
}

// Show/hide stock, pack and buy-price fields based on category (services hide them).
function toggleServiceFields() {
  const cat = document.getElementById('p-category').value;
  const svc = isServiceCat(cat);
  document.getElementById('grp-stock-buy').style.display = svc ? 'none' : '';
  document.getElementById('grp-pack').style.display      = svc ? 'none' : '';
  if (svc) {
    document.getElementById('p-stock').value = '';
    document.getElementById('p-buy-price').value = '';
    document.getElementById('p-pack-unit').value = '';
    document.getElementById('p-pack-size').value = '';
    document.getElementById('p-unit').value = 'Service';
  }
  refreshUnitUI();
}

async function initInventory() {
  await loadProducts();
  bindInventoryEvents();
}

async function loadProducts() {
  // Used by other actions (save/delete/purchase) to refresh. Reset & reload page 1.
  allProducts = []; invCursor = null; invHasMore = true; invFullyLoaded = false;
  document.getElementById('inventory-tbody').innerHTML = APP.skeletonRows(INV_COLS);
  document.getElementById('inventory-empty').style.display = 'none';
  document.getElementById('inv-loadmore').innerHTML = '';
  await loadMoreProducts(true);
}

async function loadMoreProducts(first = false) {
  if (invLoading || (!first && !invHasMore)) return;
  invLoading = true;
  renderInvLoadMore();
  try {
    let q = db.collection('products').orderBy('name').limit(INV_PAGE);
    if (invCursor) q = q.startAfter(invCursor);
    const snap = await q.get();
    if (snap.docs.length < INV_PAGE) { invHasMore = false; invFullyLoaded = true; }
    if (snap.docs.length) invCursor = snap.docs[snap.docs.length - 1];
    allProducts.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
    applyInventoryView();
  } catch (e) {
    console.error(e);
    if (first) {
      document.getElementById('inventory-tbody').innerHTML =
        APP.tableMessage(INV_COLS, `Couldn't load inventory. <button class="btn btn-secondary" id="inv-retry">Retry</button>`);
      document.getElementById('inv-retry')?.addEventListener('click', loadProducts);
    } else {
      APP.toast('Failed to load more products', 'error');
    }
  } finally {
    invLoading = false;
    renderInvLoadMore();
  }
}

// Search/filter needs the full set; pull it once, then cache.
async function ensureAllProductsLoaded() {
  if (invFullyLoaded) return;
  document.getElementById('inventory-tbody').innerHTML = APP.skeletonRows(INV_COLS, 4);
  try {
    const snap = await db.collection('products').orderBy('name').get();
    allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    invFullyLoaded = true; invHasMore = false;
    invCursor = snap.docs[snap.docs.length - 1] || null;
  } catch (e) {
    console.error(e);
    APP.toast('Search failed to load products', 'error');
  }
}

function renderInvLoadMore() {
  const bar = document.getElementById('inv-loadmore');
  if (!bar) return;
  // When filtering, the full set is loaded — no paging control needed.
  if (isFilteringInventory()) { bar.innerHTML = ''; return; }
  if (invHasMore) {
    bar.innerHTML = `<button class="btn btn-secondary" id="inv-more-btn" ${invLoading ? 'disabled' : ''}>${
      invLoading ? '<span class="spinner"></span> Loading…' : 'Load more'}</button>`;
    document.getElementById('inv-more-btn')?.addEventListener('click', () => loadMoreProducts());
  } else {
    bar.innerHTML = allProducts.length ? `<span class="hint">All products loaded.</span>` : '';
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
    const svc = p.isService === true || SERVICE_CATS.includes(p.category);
    let statusBadge;
    if (svc)                       statusBadge = '<span class="badge badge-blue">Service</span>';
    else if (p.stock === 0)        statusBadge = '<span class="badge badge-red">Out of Stock</span>';
    else if (APP.isLowStock(p))    statusBadge = `<span class="badge badge-yellow">Low Stock</span>`;
    else                           statusBadge = '<span class="badge badge-green">In Stock</span>';

    const buyCell = svc ? '<span class="text-muted">—</span>' : APP.currency(p.buyPrice);
    const unit = p.unit || 'Pcs';
    const stockCell = svc
      ? '<span class="text-muted">—</span>'
      : `${p.stock ?? 0} <span class="text-muted" style="font-size:11px;">${APP.sanitize(unit)}</span>` +
        (p.packUnit && p.packSize > 1
          ? `<div class="text-muted" style="font-size:10px;">${APP.sanitize(packLabel(p.stock ?? 0, p.packSize, p.packUnit, unit))}</div>`
          : '');

    return `<tr>
      <td><span style="font-weight:500;">${APP.sanitize(p.name)}</span>${p.barcode ? ` <span title="Barcode: ${APP.sanitize(p.barcode)}" style="color:var(--text-dim);vertical-align:middle;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;"><path d="M3 5v14"/><path d="M8 5v14"/><path d="M12 5v14"/><path d="M17 5v14"/><path d="M21 5v14"/></svg></span>` : ''}</td>
      <td><span class="badge badge-blue">${APP.sanitize(p.category || 'General')}</span></td>
      <td class="text-muted">${APP.sanitize(p.brand || '--')}</td>
      <td class="td-mono">${buyCell}</td>
      <td class="td-mono text-primary">${APP.currency(p.price)}</td>
      <td class="td-mono ${!svc && p.stock === 0 ? 'no-stock' : APP.isLowStock(p) ? 'low-stock' : ''}">${stockCell}</td>
      <td>${statusBadge}</td>
      <td class="td-actions">
        ${APP.can('inventory.edit') ? `<button class="btn btn-secondary btn-icon" data-action="edit" data-id="${p.id}" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>` : ''}
        ${APP.can('inventory.delete') ? `<button class="btn btn-danger btn-icon" data-action="delete" data-id="${p.id}" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>` : ''}
        ${!APP.can('inventory.edit') && !APP.can('inventory.delete') ? '<span class="text-muted" style="font-size:11px;">View only</span>' : ''}
      </td>
    </tr>`;
  }).join('');
}

function openAddModal() {
  document.getElementById('product-id').value = '';
  document.getElementById('product-modal-title').textContent = 'Add Product';
  ['p-name','p-brand','p-description','p-barcode'].forEach(id => document.getElementById(id).value = '');
  ['p-category'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('p-unit').value = 'Pcs';
  document.getElementById('p-pack-unit').value = '';
  document.getElementById('p-pack-size').value = '';
  ['p-stock','p-buy-price','p-sell-price','p-reorder'].forEach(id => document.getElementById(id).value = '');
  toggleServiceFields();
  APP.openModal('product-modal');
}

function openEditModal(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  document.getElementById('product-id').value         = id;
  document.getElementById('product-modal-title').textContent = 'Edit Product';
  document.getElementById('p-name').value             = p.name || '';
  document.getElementById('p-brand').value            = p.brand || '';
  document.getElementById('p-barcode').value          = p.barcode || '';
  document.getElementById('p-category').value         = p.category || '';
  document.getElementById('p-unit').value             = p.unit || 'Pcs';
  document.getElementById('p-pack-unit').value        = p.packUnit || '';
  document.getElementById('p-pack-size').value        = p.packSize && p.packSize > 1 ? p.packSize : '';
  document.getElementById('p-buy-price').value        = p.buyPrice ?? '';
  document.getElementById('p-sell-price').value       = p.price ?? '';
  document.getElementById('p-reorder').value          = (p.reorderLevel ?? '') === null ? '' : (p.reorderLevel ?? '');
  document.getElementById('p-description').value      = p.description || '';
  toggleServiceFields();
  // Stock is stored in pieces — always show/edit it in the piece unit.
  document.getElementById('p-stock-unit').value       = 'piece';
  document.getElementById('p-stock').value            = p.stock ?? 0;
  updateStockHint();
  APP.openModal('product-modal');
}

async function saveProduct() {
  const id       = document.getElementById('product-id').value;
  const name     = document.getElementById('p-name').value.trim();
  const brand    = document.getElementById('p-brand').value.trim();
  const category = document.getElementById('p-category').value;
  const unit     = document.getElementById('p-unit').value;
  const description = document.getElementById('p-description').value.trim();
  const price    = parseFloat(document.getElementById('p-sell-price').value) || 0;

  const svc      = isServiceCat(category);

  // Pack definition (e.g. 1 Dozen = 12 Pcs). Stock is always stored in pieces.
  const packUnit = svc ? '' : document.getElementById('p-pack-unit').value;
  const packSize = packUnit ? Math.max(1, parseInt(document.getElementById('p-pack-size').value) || 0) : 1;

  const stockQty   = parseFloat(document.getElementById('p-stock').value) || 0;
  const entryUnit  = document.getElementById('p-stock-unit').value;
  const stock      = svc ? 0 : Math.round(entryUnit === 'pack' ? stockQty * packSize : stockQty);
  const buyPrice   = svc ? 0 : (parseFloat(document.getElementById('p-buy-price').value) || 0);

  if (!name)     { APP.toast('Product name is required', 'warning'); return; }
  if (!category) { APP.toast('Category is required', 'warning'); return; }
  if (!unit)     { APP.toast('Selling unit is required', 'warning'); return; }
  if (!svc && packUnit && packSize < 1) { APP.toast('Enter how many pieces are in one ' + packUnit, 'warning'); return; }
  if (price <= 0){ APP.toast('Sell price must be greater than 0', 'warning'); return; }

  const saveBtn = document.getElementById('save-product-btn');
  saveBtn.disabled = true; saveBtn.innerHTML = '<span class="spinner"></span> Saving…';

  try {
    const barcode = document.getElementById('p-barcode').value.trim();
    const reorderRaw = document.getElementById('p-reorder').value.trim();
    const reorderLevel = reorderRaw === '' ? null : Math.max(0, parseInt(reorderRaw, 10) || 0);
    const data = { name, brand, category, unit, isService: svc, packUnit, packSize, stock, buyPrice, price, description, barcode, reorderLevel, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    if (id) {
      await db.collection('products').doc(id).update(data);
      APP.audit('product.update', { id, name, price, stock });
      APP.toast('Product updated', 'success');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      const ref = await db.collection('products').add(data);
      APP.audit('product.create', { id: ref.id, name, price, stock });
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
        APP.audit('product.delete', { id, name: p?.name || '' });
        APP.toast('Product deleted');
        await loadProducts();
      } catch (e) { APP.toast('Delete failed', 'error'); }
    }
  });
}

function isFilteringInventory() {
  return !!(document.getElementById('inv-search').value.trim()
    || (document.getElementById('inv-category')?.value || '')
    || (document.getElementById('inv-stock-filter')?.value || ''));
}

// Decide what to render: paginated browse list, or filtered full set.
async function applyInventoryView() {
  if (isFilteringInventory()) await ensureAllProductsLoaded();

  const term  = document.getElementById('inv-search').value.toLowerCase();
  const cat   = document.getElementById('inv-category')?.value || '';
  const stock = document.getElementById('inv-stock-filter')?.value || '';

  let list = allProducts;
  if (isFilteringInventory()) {
    list = allProducts.filter(p => {
      const svc = p.isService === true || isServiceCat(p.category);
      const matchTerm  = !term  || p.name?.toLowerCase().includes(term) || p.brand?.toLowerCase().includes(term) || p.barcode?.toLowerCase().includes(term);
      const matchCat   = !cat   || p.category === cat;
      const matchStock = !stock ||
        (stock === 'low' && p.stock > 0 && APP.isLowStock(p)) ||
        (stock === 'out' && !svc && p.stock === 0);
      return matchTerm && matchCat && matchStock;
    });
  }
  renderTable(list);
  renderInvLoadMore();
}

// Kept as the debounced handler entry-point.
function filterInventory() { applyInventoryView(); }

function bindInventoryEvents() {
  document.getElementById('add-product-btn')?.addEventListener('click', openAddModal);
  document.getElementById('close-product-modal').addEventListener('click', () => APP.closeModal('product-modal'));
  document.getElementById('cancel-product-modal').addEventListener('click', () => APP.closeModal('product-modal'));
  document.getElementById('save-product-btn').addEventListener('click', saveProduct);
  document.getElementById('p-category').addEventListener('change', toggleServiceFields);
  document.getElementById('p-unit').addEventListener('change', refreshUnitUI);
  document.getElementById('p-pack-unit').addEventListener('change', () => {
    const pu = document.getElementById('p-pack-unit').value;
    const ps = document.getElementById('p-pack-size');
    if (pu && !ps.value && PACK_DEFAULTS[pu]) ps.value = PACK_DEFAULTS[pu];
    refreshUnitUI();
  });
  document.getElementById('p-pack-size').addEventListener('input', updateStockHint);
  document.getElementById('p-stock').addEventListener('input', updateStockHint);
  document.getElementById('p-stock-unit').addEventListener('change', updateStockHint);

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

/* =============================================
   Bulk Import / Export (SheetJS)
   ============================================= */
const IMPORT_HEADERS = ['name','brand','category','unit','price','buyPrice','stock','barcode','description','packUnit','packSize'];
let importStaged = [];

function productToRow(p) {
  return {
    name: p.name || '', brand: p.brand || '', category: p.category || '',
    unit: p.unit || 'Pcs',
    price:    parseFloat(p.price    || 0),
    buyPrice: parseFloat(p.buyPrice || 0),
    stock:    parseInt(p.stock      || 0, 10),
    barcode: p.barcode || '', description: p.description || '',
    packUnit: p.packUnit || '', packSize: p.packSize || '',
  };
}

async function exportProducts() {
  if (typeof XLSX === 'undefined') { APP.toast('Spreadsheet library still loading — try again in a moment', 'warning'); return; }
  await ensureAllProductsLoaded();
  if (!allProducts.length) { APP.toast('No products to export', 'warning'); return; }
  const rows = allProducts.slice()
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .map(productToRow);
  const ws = XLSX.utils.json_to_sheet(rows, { header: IMPORT_HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  XLSX.writeFile(wb, `nishar-products-${new Date().toISOString().slice(0,10)}.xlsx`);
  APP.audit('product.export', { count: rows.length });
  APP.toast(`Exported ${rows.length} products`, 'success');
}

function downloadImportTemplate() {
  if (typeof XLSX === 'undefined') { APP.toast('Spreadsheet library still loading', 'warning'); return; }
  const example = {
    name: 'Example Charger', brand: 'Samsung', category: 'Mobiles & Accessories',
    unit: 'Pcs', price: 299, buyPrice: 200, stock: 10,
    barcode: '8901234567890', description: 'Sample row — delete me',
    packUnit: '', packSize: ''
  };
  const ws = XLSX.utils.json_to_sheet([example], { header: IMPORT_HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  XLSX.writeFile(wb, 'nishar-products-template.xlsx');
}

function openImportDialog() { document.getElementById('import-file-input').click(); }

async function handleImportFile(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (typeof XLSX === 'undefined') { APP.toast('Spreadsheet library failed to load', 'error'); return; }
  try {
    const buf  = await file.arrayBuffer();
    const wb   = XLSX.read(buf, { type: 'array' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!rows.length) { APP.toast('File appears to be empty', 'warning'); return; }
    importStaged = rows.map((r, i) => validateImportRow(r, i + 2));   // sheet rows are 1-based (row 1 is header)
    renderImportPreview();
    APP.openModal('import-modal');
  } catch (err) {
    console.error(err);
    APP.toast('Could not read file. Make sure it is .xlsx or .csv', 'error');
  }
}

function validateImportRow(r, rowNum) {
  const errors = [];
  const name     = String(r.name || '').trim();
  const category = String(r.category || '').trim();
  const price    = parseFloat(r.price);
  const buyPrice = parseFloat(r.buyPrice);
  const stock    = parseInt(r.stock, 10);

  if (!name)        errors.push('name required');
  if (!category)    errors.push('category required');
  if (!(price > 0)) errors.push('price must be > 0');

  return {
    row: rowNum, status: errors.length ? 'error' : 'ok', errors,
    data: errors.length ? null : {
      name,
      brand:       String(r.brand || '').trim(),
      category,
      unit:        String(r.unit || 'Pcs').trim() || 'Pcs',
      price,
      buyPrice:    isNaN(buyPrice) ? 0 : buyPrice,
      stock:       isNaN(stock) ? 0 : stock,
      barcode:     String(r.barcode || '').trim(),
      description: String(r.description || '').trim(),
      packUnit:    String(r.packUnit || '').trim(),
      packSize:    String(r.packSize || '').trim(),
      isService:   false,
    },
  };
}

function renderImportPreview() {
  const tbody   = document.getElementById('import-preview-tbody');
  const summary = document.getElementById('import-summary');
  const btn     = document.getElementById('confirm-import-btn');

  const ok   = importStaged.filter(r => r.status === 'ok').length;
  const errs = importStaged.length - ok;
  summary.innerHTML = `
    <div style="display:flex;gap:var(--sp-3);align-items:center;flex-wrap:wrap;">
      <div class="badge badge-green">${ok} ready</div>
      ${errs ? `<div class="badge badge-red">${errs} with errors</div>` : ''}
      <span class="text-muted" style="font-size:12px;">Only "ready" rows will be imported.</span>
    </div>`;

  const visible = importStaged.slice(0, 200);
  tbody.innerHTML = visible.map(r => {
    const cls = r.status === 'ok' ? 'badge-green' : 'badge-red';
    return `<tr>
      <td class="text-muted">${r.row}</td>
      <td><span class="badge ${cls}">${r.status === 'ok' ? 'Ready' : 'Error'}</span></td>
      <td>${APP.sanitize(r.data?.name || '')}</td>
      <td>${APP.sanitize(r.data?.category || '')}</td>
      <td class="td-mono">${r.data ? APP.currency(r.data.price) : '--'}</td>
      <td class="td-mono">${r.data?.stock ?? '--'}</td>
      <td class="text-warning" style="font-size:11px;">${r.errors.join('; ')}</td>
    </tr>`;
  }).join('');
  if (importStaged.length > 200) {
    tbody.innerHTML += `<tr><td colspan="7" class="text-muted" style="text-align:center;font-size:11px;padding:8px;">…and ${importStaged.length - 200} more rows (not previewed)</td></tr>`;
  }

  btn.disabled = ok === 0;
  btn.textContent = `Import ${ok} product${ok !== 1 ? 's' : ''}`;
}

async function confirmImport() {
  const ready = importStaged.filter(r => r.status === 'ok');
  if (!ready.length) return;
  const btn = document.getElementById('confirm-import-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Importing…';
  try {
    const CHUNK = 450;   // Firestore allows 500 ops/batch; keep slack
    for (let i = 0; i < ready.length; i += CHUNK) {
      const batch = db.batch();
      ready.slice(i, i + CHUNK).forEach(r => {
        const ref = db.collection('products').doc();
        batch.set(ref, { ...r.data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      });
      await batch.commit();
    }
    APP.audit('product.import', { count: ready.length });
    APP.toast(`Imported ${ready.length} products`, 'success');
    APP.closeModal('import-modal');
    await loadProducts();
  } catch (e) {
    console.error(e);
    APP.toast('Import failed', 'error');
  } finally {
    btn.disabled = false;
    renderImportPreview();
  }
}

// Wire the import/export buttons (gated; bindings live separately so they don't
// accidentally break if applyPermissions removed the import button for read-only roles).
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('export-products-btn')?.addEventListener('click', exportProducts);
  document.getElementById('import-products-btn')?.addEventListener('click', openImportDialog);
  document.getElementById('import-file-input')?.addEventListener('change', handleImportFile);
  document.getElementById('close-import-modal')?.addEventListener('click', () => APP.closeModal('import-modal'));
  document.getElementById('cancel-import-modal')?.addEventListener('click', () => APP.closeModal('import-modal'));
  document.getElementById('confirm-import-btn')?.addEventListener('click', confirmImport);
  document.getElementById('download-template-btn')?.addEventListener('click', downloadImportTemplate);
});
