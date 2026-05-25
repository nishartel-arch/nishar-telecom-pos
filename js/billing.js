/* =============================================
   NISHAR TELECOM POS — Billing Logic
   ============================================= */

APP.init({ page: 'billing', title: 'Billing Counter', onReady: initBilling });

let cart = [];
let products = [];
let customers = [];
let lastSaleData = null;

async function initBilling() {
  await Promise.all([loadProducts(), loadCustomers()]);
  restoreHeldCart();
  bindEvents();
}

/* ── Load Data ─────────────────────────────── */
async function loadProducts() {
  try {
    const snap = await db.collection('products').orderBy('name').get();
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProducts();
  } catch (e) {
    APP.toast('Failed to load products', 'error');
  }
}

async function loadCustomers() {
  try {
    const snap = await db.collection('customers').orderBy('name').get();
    customers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const sel = document.getElementById('customer-select');
    sel.innerHTML = '<option value="">Walk-in Customer</option>';
    customers.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} — ${c.phone || 'N/A'}`;
      sel.appendChild(opt);
    });
  } catch (e) { console.error('Customers load:', e); }
}

/* ── Render Products ───────────────────────── */
function renderProducts(list = null) {
  const grid  = document.getElementById('product-grid');
  const empty = document.getElementById('product-empty');
  const data  = list ?? products;

  grid.innerHTML = '';

  if (!data.length) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  grid.style.display = 'grid';
  empty.style.display = 'none';

  data.forEach(p => {
    const inCart = cart.some(i => i.id === p.id);
    const oos    = (p.stock || 0) <= 0;
    const card   = document.createElement('div');
    card.className = `product-card${oos ? ' out-of-stock' : ''}${inCart ? ' selected' : ''}`;
    card.dataset.id = p.id;

    const cat = document.createElement('div'); cat.className = 'pc-cat'; cat.textContent = p.category || '';
    const nm  = document.createElement('div'); nm.className  = 'pc-name'; nm.textContent = p.name || 'Unnamed';
    const pr  = document.createElement('div'); pr.className  = 'pc-price'; pr.textContent = APP.currency(p.price);
    const st  = document.createElement('div'); st.className  = `pc-stock${p.stock <= 3 ? ' low-stock' : ''}${p.stock === 0 ? ' no-stock' : ''}`;
    st.textContent = p.stock === 0 ? 'Out of stock' : `${p.stock} in stock`;

    card.append(cat, nm, pr, st);
    if (!oos) card.addEventListener('click', () => addToCart(p));
    grid.appendChild(card);
  });
}

/* ── Cart Operations ───────────────────────── */
function addToCart(product) {
  const existing = cart.find(i => i.id === product.id);
  if (existing) {
    if (existing.qty >= (product.stock || 0)) {
      APP.toast('Maximum available stock reached', 'warning'); return;
    }
    existing.qty++;
  } else {
    cart.push({ id: product.id, name: product.name, price: parseFloat(product.price || 0), qty: 1, stock: product.stock || 0 });
  }
  updateCart();
  renderProducts();
  APP.toast(`${product.name} added`, 'success', 1500);
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  updateCart(); renderProducts();
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty = Math.max(0, item.qty + delta);
  if (item.qty === 0) { removeFromCart(id); return; }
  if (item.qty > item.stock) { item.qty = item.stock; APP.toast('Max stock reached', 'warning'); }
  updateCart(); renderProducts();
}

function clearCart() {
  if (!cart.length) return;
  APP.showConfirm({
    title: 'Clear Cart', message: 'Remove all items from the current bill?',
    type: 'danger', confirmText: 'Clear',
    onConfirm: () => { cart = []; document.getElementById('discount-input').value = 0; updateCart(); renderProducts(); APP.toast('Cart cleared'); }
  });
}

function updateCart() {
  const cartEl   = document.getElementById('cart-items');
  const checkBtn = document.getElementById('checkout-btn');
  const printBtn = document.getElementById('print-btn');

  if (!cart.length) {
    cartEl.innerHTML = `
      <div class="cart-empty">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        <p style="font-weight:500;margin-top:var(--sp-2);">Cart is empty</p>
        <p style="font-size:var(--fs-xs);">Click products to add them</p>
      </div>`;
    checkBtn.disabled = true;
    printBtn.disabled = !lastSaleData;
    updateTotals();
    return;
  }

  cartEl.innerHTML = cart.map(item => `
    <div class="cart-item" data-id="${item.id}">
      <div class="ci-info">
        <div class="ci-name">${APP.sanitize(item.name)}</div>
        <div class="ci-price">${APP.currency(item.price)} each</div>
      </div>
      <div class="ci-qty">
        <button class="qty-btn" data-action="dec" data-id="${item.id}">−</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" data-action="inc" data-id="${item.id}">+</button>
      </div>
      <div class="ci-total">${APP.currency(item.price * item.qty)}</div>
      <button class="ci-del" data-action="del" data-id="${item.id}" title="Remove">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`).join('');

  checkBtn.disabled = false;
  printBtn.disabled = !lastSaleData;
  updateTotals();
}

function updateTotals() {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = Math.max(0, parseFloat(document.getElementById('discount-input')?.value) || 0);
  const total    = Math.max(0, subtotal - discount);
  const count    = cart.reduce((s, i) => s + i.qty, 0);

  document.getElementById('subtotal').textContent   = APP.currency(subtotal);
  document.getElementById('grand-total').textContent = APP.currency(total);
  document.getElementById('item-count').textContent  = count;
}

/* ── Checkout ──────────────────────────────── */
async function checkout() {
  if (!cart.length) { APP.toast('Cart is empty', 'warning'); return; }

  const checkBtn  = document.getElementById('checkout-btn');
  const customerId = document.getElementById('customer-select').value;
  const payMethod  = document.getElementById('payment-method').value;
  const discount   = Math.max(0, parseFloat(document.getElementById('discount-input').value) || 0);
  const subtotal   = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const total      = Math.max(0, subtotal - discount);
  const customer   = customers.find(c => c.id === customerId);

  checkBtn.disabled = true;
  checkBtn.innerHTML = '<span class="spinner"></span> Processing…';

  try {
    // Re-validate stock before committing
    for (const item of cart) {
      const doc = await db.collection('products').doc(item.id).get();
      const currentStock = doc.data()?.stock || 0;
      if (currentStock < item.qty) {
        APP.toast(`Insufficient stock for "${item.name}"`, 'error');
        return;
      }
    }

    const batch = db.batch();

    // Deduct stock
    cart.forEach(item => {
      const ref = db.collection('products').doc(item.id);
      batch.update(ref, { stock: firebase.firestore.FieldValue.increment(-item.qty) });
    });

    // Write sale record
    const saleRef  = db.collection('sales').doc();
    const saleData = {
      invoiceNo:    APP.genId('INV'),
      customerId:   customerId || null,
      customerName: customer ? customer.name : 'Walk-in Customer',
      customerPhone: customer?.phone || '',
      items: cart.map(i => ({ productId: i.id, name: i.name, price: i.price, quantity: i.qty, total: i.price * i.qty })),
      subtotal, discount, total,
      paymentMethod: payMethod,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: auth.currentUser?.uid || 'unknown'
    };
    batch.set(saleRef, saleData);
    await batch.commit();

    lastSaleData = saleData;
    showInvoice(saleData);
    APP.toast('Sale completed!', 'success');
  } catch (err) {
    console.error('Checkout error:', err);
    APP.toast('Checkout failed. Please try again.', 'error');
  } finally {
    checkBtn.disabled = false;
    checkBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Checkout';
  }
}

/* ── Invoice ───────────────────────────────── */
function showInvoice(data) {
  const body = document.getElementById('invoice-body');
  body.innerHTML = `
    <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;border:1px dashed var(--border-mid);border-radius:var(--r-md);padding:var(--sp-5);">
      <div style="text-align:center;margin-bottom:var(--sp-4);">
        <div style="font-size:15px;font-weight:700;font-family:'Sora',sans-serif;">Nishar Telecom</div>
        <div style="font-size:11px;color:var(--text-muted);">Point of Sale System</div>
        <div style="margin-top:var(--sp-2);font-size:11px;color:var(--text-dim);">Invoice: ${APP.sanitize(data.invoiceNo)}</div>
        <div style="font-size:11px;color:var(--text-muted);">${new Date().toLocaleString('en-IN')}</div>
      </div>
      <hr style="border:none;border-top:1px dashed var(--border-mid);margin:var(--sp-3) 0;"/>
      <div style="font-size:11px;margin-bottom:var(--sp-3);">
        <div>Customer: ${APP.sanitize(data.customerName)}</div>
        <div>Payment : ${APP.sanitize(data.paymentMethod)}</div>
      </div>
      <hr style="border:none;border-top:1px dashed var(--border-mid);margin:var(--sp-3) 0;"/>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead><tr style="border-bottom:1px dashed var(--border-mid);">
          <th style="text-align:left;padding:3px 0;">Item</th>
          <th style="text-align:center;">Qty</th>
          <th style="text-align:right;">Amount</th>
        </tr></thead>
        <tbody>
          ${data.items.map(i => `<tr>
            <td style="padding:3px 0;">${APP.sanitize(i.name)}</td>
            <td style="text-align:center;">${i.quantity}</td>
            <td style="text-align:right;">${APP.currency(i.total)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <hr style="border:none;border-top:1px dashed var(--border-mid);margin:var(--sp-3) 0;"/>
      ${data.discount > 0 ? `<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span>Subtotal</span><span>${APP.currency(data.subtotal)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span>Discount</span><span>-${APP.currency(data.discount)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;padding-top:var(--sp-2);border-top:2px solid var(--border-mid);margin-top:var(--sp-2);">
        <span>TOTAL</span><span style="color:var(--primary);">${APP.currency(data.total)}</span>
      </div>
      <div style="text-align:center;margin-top:var(--sp-4);font-size:10px;color:var(--text-muted);">Thank you for your business!</div>
    </div>`;
  APP.openModal('invoice-modal');
}

function downloadPDF(data) {
  if (!window.jspdf) { APP.toast('PDF library not loaded', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: [80, 200] });

  let y = 10;
  doc.setFontSize(14); doc.setFont('helvetica','bold');
  doc.text('Nishar Telecom', 40, y, { align: 'center' }); y += 6;
  doc.setFontSize(9); doc.setFont('helvetica','normal');
  doc.text('Point of Sale System', 40, y, { align: 'center' }); y += 5;
  doc.text(`Invoice: ${data.invoiceNo}`, 40, y, { align: 'center' }); y += 4;
  doc.text(new Date().toLocaleString('en-IN'), 40, y, { align: 'center' }); y += 7;

  doc.setLineDashPattern([1,1]); doc.line(5, y, 75, y); y += 4;
  doc.setFont('helvetica','normal');
  doc.text(`Customer: ${data.customerName}`, 5, y); y += 4;
  doc.text(`Payment : ${data.paymentMethod}`,   5, y); y += 5;
  doc.line(5, y, 75, y); y += 4;

  doc.setFontSize(8);
  data.items.forEach(item => {
    doc.text(item.name.substring(0,22), 5, y);
    doc.text(`${item.quantity}x`, 55, y);
    doc.text(`Rs.${item.total.toFixed(2)}`, 75, y, { align: 'right' });
    y += 4;
  });

  y += 2; doc.setLineDashPattern([1,1]); doc.line(5, y, 75, y); y += 5;
  doc.setFontSize(11); doc.setFont('helvetica','bold');
  doc.text(`TOTAL: Rs.${data.total.toFixed(2)}`, 75, y, { align: 'right' });
  y += 8; doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.text('Thank you for your business!', 40, y, { align: 'center' });

  doc.save(`Invoice_${data.invoiceNo}.pdf`);
  APP.toast('PDF downloaded');
}

/* ── Hold / Restore ────────────────────────── */
function holdCart() {
  if (!cart.length) { APP.toast('Cart is empty', 'warning'); return; }
  localStorage.setItem('pos-held-cart',     JSON.stringify(cart));
  localStorage.setItem('pos-held-customer', document.getElementById('customer-select').value);
  localStorage.setItem('pos-held-discount', document.getElementById('discount-input').value);
  APP.toast('Bill held. You can restore it on next visit.', 'info');
}

function restoreHeldCart() {
  try {
    const held = localStorage.getItem('pos-held-cart');
    if (!held) return;
    cart = JSON.parse(held);
    document.getElementById('customer-select').value = localStorage.getItem('pos-held-customer') || '';
    document.getElementById('discount-input').value  = localStorage.getItem('pos-held-discount')  || '0';
    localStorage.removeItem('pos-held-cart');
    localStorage.removeItem('pos-held-customer');
    localStorage.removeItem('pos-held-discount');
    updateCart(); renderProducts();
    APP.toast('Held bill restored', 'info');
  } catch (e) { console.error('Restore cart:', e); }
}

/* ── Filter ────────────────────────────────── */
function filterProducts() {
  const term = document.getElementById('product-search').value.toLowerCase();
  const cat  = document.getElementById('category-filter').value;
  const filtered = products.filter(p =>
    (p.name?.toLowerCase().includes(term) || p.brand?.toLowerCase().includes(term)) &&
    (!cat || p.category === cat)
  );
  renderProducts(filtered);
}

/* ── Add Quick Customer ────────────────────── */
async function saveQuickCustomer() {
  const name  = document.getElementById('qc-name').value.trim();
  const phone = document.getElementById('qc-phone').value.trim();
  const email = document.getElementById('qc-email').value.trim();

  if (!name || !phone) { APP.toast('Name and phone are required', 'warning'); return; }

  const btn = document.getElementById('save-add-customer');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…';

  try {
    const ref  = db.collection('customers').doc();
    const data = { name, phone, email: email || '', createdAt: firebase.firestore.FieldValue.serverTimestamp() };
    await ref.set(data);

    const newC = { id: ref.id, ...data };
    customers.push(newC);

    const opt = document.createElement('option');
    opt.value = ref.id;
    opt.textContent = `${name} — ${phone}`;
    document.getElementById('customer-select').appendChild(opt);
    document.getElementById('customer-select').value = ref.id;

    APP.closeModal('add-customer-modal');
    APP.toast(`Customer "${name}" added`, 'success');
    document.getElementById('qc-name').value = '';
    document.getElementById('qc-phone').value = '';
    document.getElementById('qc-email').value = '';
  } catch (e) {
    APP.toast('Failed to add customer', 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'Save & Select';
  }
}

/* ── Event Bindings ────────────────────────── */
function bindEvents() {
  // Cart item actions (event delegation)
  document.getElementById('cart-items').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'inc') changeQty(id,  1);
    if (btn.dataset.action === 'dec') changeQty(id, -1);
    if (btn.dataset.action === 'del') removeFromCart(id);
  });

  document.getElementById('discount-input').addEventListener('input', updateTotals);
  document.getElementById('clear-cart-btn').addEventListener('click', clearCart);
  document.getElementById('checkout-btn').addEventListener('click', checkout);
  document.getElementById('hold-btn').addEventListener('click', holdCart);
  document.getElementById('print-btn').addEventListener('click', () => {
    if (lastSaleData) showInvoice(lastSaleData);
    else APP.toast('No recent bill to print', 'warning');
  });

  // Product search
  const searchFn = APP.debounce(filterProducts, 250);
  document.getElementById('product-search').addEventListener('input', searchFn);
  document.getElementById('category-filter').addEventListener('change', filterProducts);

  // Customer modal
  document.getElementById('add-customer-btn').addEventListener('click', () => APP.openModal('add-customer-modal'));
  document.getElementById('close-add-customer').addEventListener('click', () => APP.closeModal('add-customer-modal'));
  document.getElementById('cancel-add-customer').addEventListener('click', () => APP.closeModal('add-customer-modal'));
  document.getElementById('save-add-customer').addEventListener('click', saveQuickCustomer);

  // Invoice modal
  document.getElementById('close-invoice-modal').addEventListener('click', () => APP.closeModal('invoice-modal'));
  document.getElementById('download-pdf-btn').addEventListener('click', () => { if (lastSaleData) downloadPDF(lastSaleData); });
  document.getElementById('new-bill-btn').addEventListener('click', () => {
    cart = [];
    document.getElementById('discount-input').value = 0;
    updateCart(); renderProducts();
    APP.closeModal('invoice-modal');
    loadProducts(); // Refresh stock
  });
}
