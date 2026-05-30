/* =============================================
   NISHAR TELECOM POS — Billing Logic
   ============================================= */

APP.init({ page: 'billing', title: 'Billing Counter', onReady: initBilling });

let cart = [];
let products = [];
let customers = [];
let lastSaleData = null;

// Preload the shop logo so it's ready to embed in the PDF receipt.
// (jsPDF needs a raster image; the on-screen receipt uses the SVG directly.)
const BILL_LOGO = new Image();
BILL_LOGO.src = 'assets/bill-logo.png';

// Service categories: sold without stock/purchase tracking
const SERVICE_CATS = [];
function isService(p) {
  return p?.isService === true || SERVICE_CATS.includes(p?.category);
}

let shopCfg = {};

async function initBilling() {
  shopCfg = await APP.shopConfig();
  await Promise.all([loadProducts(), loadCustomers()]);
  refreshHeldCount();
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
    const svc    = isService(p);
    const oos    = !svc && (p.stock || 0) <= 0;
    const card   = document.createElement('div');
    card.className = `product-card${oos ? ' out-of-stock' : ''}${inCart ? ' selected' : ''}`;
    card.dataset.id = p.id;

    const cat = document.createElement('div'); cat.className = 'pc-cat'; cat.textContent = p.category || '';
    const nm  = document.createElement('div'); nm.className  = 'pc-name'; nm.textContent = p.name || 'Unnamed';
    const pr  = document.createElement('div'); pr.className  = 'pc-price'; pr.textContent = APP.currency(p.price);
    const st  = document.createElement('div');
    const unit = p.unit || 'Pcs';
    if (svc) {
      st.className = 'pc-stock';
      st.textContent = 'Service';
    } else {
      st.className = `pc-stock${APP.isLowStock(p) ? ' low-stock' : ''}${p.stock === 0 ? ' no-stock' : ''}`;
      st.textContent = p.stock === 0 ? 'Out of stock' : `${p.stock} ${unit} in stock`;
    }

    card.append(cat, nm, pr, st);
    if (!oos) card.addEventListener('click', () => addToCart(p));
    grid.appendChild(card);
  });
}

/* ── Cart Operations ───────────────────────── */
function addToCart(product) {
  const svc = isService(product);
  const existing = cart.find(i => i.id === product.id);
  if (existing) {
    if (!svc && existing.qty >= (product.stock || 0)) {
      APP.toast('Maximum available stock reached', 'warning'); return;
    }
    existing.qty++;
  } else {
    cart.push({
      id: product.id, name: product.name,
      price: parseFloat(product.price || 0),
      buyPrice: parseFloat(product.buyPrice || 0),
      qty: 1,
      stock: svc ? Infinity : (product.stock || 0),
      unit: product.unit || 'Pcs',
      isService: svc
    });
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
  if (!item.isService && item.qty > item.stock) { item.qty = item.stock; APP.toast('Max stock reached', 'warning'); }
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
        <div class="ci-price">${APP.currency(item.price)} / ${APP.sanitize(item.unit || 'Pcs')}</div>
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

// Single source of truth for cart totals — every caller goes through this
// so the math stays consistent across totals display, due display, checkout,
// and the "Pay full" button.
function computeCartTotals() {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = Math.max(0, parseFloat(document.getElementById('discount-input')?.value) || 0);
  const total    = Math.max(0, subtotal - discount);
  return { subtotal, discount, total };
}

function updateTotals() {
  const { subtotal, total } = computeCartTotals();
  const count = cart.reduce((s, i) => s + i.qty, 0);

  document.getElementById('subtotal').textContent    = APP.currency(subtotal);
  document.getElementById('grand-total').textContent = APP.currency(total);
  document.getElementById('item-count').textContent  = count;
  refreshDueDisplay(total);
}

// Recompute the Due row based on current Amount-Paid input vs total.
function refreshDueDisplay(total) {
  if (total == null) total = computeCartTotals().total;
  const paid = Math.max(0, parseFloat(document.getElementById('paid-now-input')?.value) || 0);
  const due  = Math.max(0, total - paid);
  const row  = document.getElementById('due-row');
  if (row) {
    row.style.display = due > 0 ? 'flex' : 'none';
    document.getElementById('due-amount').textContent = APP.currency(due);
  }
}

// React to payment-method selection: default the paid-now value sensibly.
function onPaymentMethodChange() {
  const method = document.getElementById('payment-method').value;
  const total  = computeCartTotals().total;
  document.getElementById('paid-now-input').value = (method === 'Credit' ? 0 : total).toFixed(2);
  refreshDueDisplay(total);
}

// When a customer is picked, surface their running due balance prominently.
function onCustomerChange() {
  const id = document.getElementById('customer-select').value;
  const c  = customers.find(x => x.id === id);
  const indicator = document.getElementById('customer-due-indicator');
  const balance = c ? parseFloat(c.dueBalance || 0) : 0;
  if (balance > 0) {
    indicator.style.display = 'block';
    indicator.innerHTML = `⚠ Existing due balance: <span class="td-mono">${APP.currency(balance)}</span>`;
  } else {
    indicator.style.display = 'none';
  }
}

/* ── Checkout ──────────────────────────────── */
async function checkout() {
  if (!cart.length) { APP.toast('Cart is empty', 'warning'); return; }

  const checkBtn  = document.getElementById('checkout-btn');
  const customerId = document.getElementById('customer-select').value;
  const payMethod  = document.getElementById('payment-method').value;
  const customer = customers.find(c => c.id === customerId);
  const { subtotal, discount, total } = computeCartTotals();

  // Credit / partial-payment handling.
  const paidNow    = Math.max(0, parseFloat(document.getElementById('paid-now-input').value) || 0);
  const amountPaid = Math.min(paidNow, total);
  const dueAmount  = total - amountPaid;
  const dueStatus  = dueAmount === 0 ? 'paid' : (amountPaid > 0 ? 'partial' : 'unpaid');

  if (dueAmount > 0 && !customer) {
    APP.toast('Pick a customer for credit / partial sales — walk-ins must pay full', 'warning');
    return;
  }

  checkBtn.disabled = true;
  checkBtn.innerHTML = '<span class="spinner"></span> Processing…';

  // Stable doc id across transaction retries. The invoice NUMBER is assigned
  // inside the transaction from a counter, so it stays gap-free and unique.
  const saleRef    = db.collection('sales').doc();
  const counterRef = db.collection('counters').doc('sales');
  const customerRef = customer ? db.collection('customers').doc(customer.id) : null;
  const stocked    = cart.filter(i => !i.isService);   // services carry no stock

  let saleData = null;

  try {
    // Atomic: stock is read, validated, deducted, the running invoice counter
    // is bumped, and the sale recorded in a single Firestore transaction. If
    // another terminal sells concurrently, Firestore replays this block on the
    // fresh values, so stock can't be oversold and invoice numbers never clash.
    await db.runTransaction(async (tx) => {
      // --- READ PHASE (all reads must precede any write) ---
      const snaps = await Promise.all(
        stocked.map(i => tx.get(db.collection('products').doc(i.id)))
      );
      const counterSnap = await tx.get(counterRef);
      // Read the customer doc whenever one is attached so we can maintain
      // denormalised lifetime stats (and the due balance). Walk-in sales skip this.
      const customerSnap = customerRef ? await tx.get(customerRef) : null;
      if (customerSnap && !customerSnap.exists) throw new Error('STOCK:Customer record not found');

      // --- VALIDATE ---
      snaps.forEach((snap, idx) => {
        const item = stocked[idx];
        if (!snap.exists) throw new Error(`STOCK:"${item.name}" no longer exists`);
        const current = snap.data().stock || 0;
        if (current < item.qty) {
          throw new Error(`STOCK:Insufficient stock for "${item.name}" (${current} left)`);
        }
      });

      // Sequential invoice number: NT-0001, NT-0002, … (NT-10000+ once past 9999)
      const nextSeq   = (counterSnap.exists ? (counterSnap.data().seq || 0) : 0) + 1;
      const invoiceNo = 'NT-' + String(nextSeq).padStart(4, '0');

      // --- WRITE PHASE ---
      snaps.forEach((snap, idx) => {
        tx.update(snap.ref, { stock: (snap.data().stock || 0) - stocked[idx].qty });
      });
      tx.set(counterRef, { seq: nextSeq }, { merge: true });

      // Maintain the customer's denormalised lifetime stats (+ due if any).
      if (customerSnap) {
        const cd = customerSnap.data();
        const updates = {
          totalPurchases: (parseInt(cd.totalPurchases || 0, 10)) + 1,
          totalSpent:     (parseFloat(cd.totalSpent || 0)) + total,
        };
        if (dueAmount > 0) updates.dueBalance = (parseFloat(cd.dueBalance || 0)) + dueAmount;
        tx.update(customerRef, updates);
      }

      saleData = {
        invoiceNo,
        customerId:   customerId || null,
        customerName: customer ? customer.name : 'Walk-in Customer',
        customerPhone: customer?.phone || '',
        items: cart.map(i => ({
          productId: i.id, name: i.name, price: i.price,
          quantity: i.qty, unit: i.unit || '', total: i.price * i.qty,
          buyPrice: parseFloat(i.buyPrice || 0)
        })),
        subtotal, discount, total,
        paymentMethod: payMethod,
        amountPaid, dueAmount, dueStatus,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.currentUser?.uid || 'unknown'
      };
      tx.set(saleRef, saleData);
    });

    // Update in-memory customer balance so subsequent UI reflects it without a refetch.
    if (customer && dueAmount > 0) {
      customer.dueBalance = (parseFloat(customer.dueBalance) || 0) + dueAmount;
    }

    lastSaleData = saleData;
    showInvoice(saleData);
    APP.audit('sale.create', {
      invoiceNo: saleData.invoiceNo, total: saleData.total,
      paid: amountPaid, due: dueAmount, items: saleData.items.length,
    });
    APP.toast(dueAmount > 0 ? `Sale completed (${APP.currency(dueAmount)} on credit)` : 'Sale completed!', 'success');
  } catch (err) {
    console.error('Checkout error:', err);
    // Surface the specific stock message; keep generic copy for everything else.
    const msg = err?.message?.startsWith('STOCK:')
      ? err.message.slice(6)
      : 'Checkout failed. Please try again.';
    APP.toast(msg, 'error');
  } finally {
    checkBtn.disabled = false;
    checkBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Checkout';
  }
}

/* ── Invoice ───────────────────────────────── */
function showInvoice(data) {
  const body = document.getElementById('invoice-body');
  const cfg  = shopCfg || {};
  body.innerHTML = `
    <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;border:1px dashed var(--border-mid);border-radius:var(--r-md);padding:var(--sp-5);">
      <div style="text-align:center;margin-bottom:var(--sp-4);">
        <img src="assets/logo-hexagon-dark.svg" alt="${APP.sanitize(cfg.name || 'Nishar Telecom')}" style="width:54px;height:54px;margin:0 auto var(--sp-2);display:block;"/>
        <div style="font-size:15px;font-weight:700;font-family:'Sora',sans-serif;">${APP.sanitize(cfg.name || 'Nishar Telecom')}</div>
        ${cfg.address ? `<div style="font-size:10px;color:var(--text-muted);">${APP.sanitize(cfg.address)}</div>` : ''}
        ${cfg.phone   ? `<div style="font-size:10px;color:var(--text-muted);">Ph: ${APP.sanitize(cfg.phone)}</div>` : ''}
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
            <td style="text-align:center;">${i.quantity}${i.unit ? ' ' + APP.sanitize(i.unit) : ''}</td>
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
      ${data.dueAmount > 0 ? `
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:6px;"><span>Paid Now</span><span>${APP.currency(data.amountPaid)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:var(--danger);"><span>Balance Due</span><span>${APP.currency(data.dueAmount)}</span></div>` : ''}
      <div style="text-align:center;margin-top:var(--sp-4);font-size:10px;color:var(--text-muted);">Thank you for your business!</div>
    </div>`;
  APP.openModal('invoice-modal');
}

/* ── Thermal receipt printing (58mm / 80mm) ── */
// Opens a dedicated popup window containing only the receipt content so the
// browser prints exactly what it sees — no app shell, no CSS variables,
// pure black text on white. Far more reliable than window.print() on the main page.
function printThermal(data) {
  if (!data) return;
  const cfg   = shopCfg || {};
  const width = parseInt((shopCfg && shopCfg.thermalWidth) || '80', 10) || 80;
  const contentW = Math.max(40, width - 6);

  const row = (l, r, bold = false) =>
    `<div style="display:flex;justify-content:space-between;gap:6px;${bold ? 'font-size:14px;font-weight:700;' : ''}">
       <span style="word-break:break-word;">${l}</span><span style="white-space:nowrap;">${r}</span>
     </div>`;

  const items = data.items.map(i =>
    `<div style="margin-bottom:3px;">
       <div>${APP.sanitize(i.name)}</div>
       ${row(`&nbsp;&nbsp;${i.quantity}${i.unit ? ' ' + APP.sanitize(i.unit) : ''} × ${APP.currency(i.price)}`, APP.currency(i.total))}
     </div>`).join('');

  const body = `
    <div style="text-align:center;margin-bottom:8px;">
      <div style="font-size:15px;font-weight:700;">${APP.sanitize(cfg.name || 'Nishar Telecom')}</div>
      ${cfg.address ? `<div style="font-size:10px;">${APP.sanitize(cfg.address)}</div>` : ''}
      ${cfg.phone   ? `<div style="font-size:10px;">Ph: ${APP.sanitize(cfg.phone)}</div>` : ''}
    </div>
    <hr style="border:none;border-top:1px dashed #000;margin:5px 0;"/>
    <div style="font-size:11px;">Invoice: ${APP.sanitize(data.invoiceNo)}</div>
    <div style="font-size:11px;">${new Date().toLocaleString('en-IN')}</div>
    <div style="font-size:11px;">Customer: ${APP.sanitize(data.customerName || 'Walk-in')}</div>
    <div style="font-size:11px;">Payment: ${APP.sanitize(data.paymentMethod || '')}</div>
    <hr style="border:none;border-top:1px dashed #000;margin:5px 0;"/>
    ${items}
    <hr style="border:none;border-top:1px dashed #000;margin:5px 0;"/>
    ${data.discount > 0 ? row('Subtotal', APP.currency(data.subtotal)) + row('Discount', '-' + APP.currency(data.discount)) : ''}
    ${row('TOTAL', APP.currency(data.total), true)}
    ${data.dueAmount > 0 ? row('Paid', APP.currency(data.amountPaid)) + row('Balance Due', APP.currency(data.dueAmount)) : ''}
    <hr style="border:none;border-top:1px dashed #000;margin:5px 0;"/>
    <div style="text-align:center;font-size:10px;">Thank you for your business!</div>`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      @page { size: ${width}mm auto; margin: 2mm 1mm; }
      body  { margin:0; font-family:'Courier New',monospace; font-size:12px;
              width:${contentW}mm; color:#000; background:#fff; }
    </style>
  </head><body>${body}</body></html>`;

  const win = window.open('', '_blank', `width=${width * 5},height=700,menubar=no,toolbar=no`);
  if (!win) { APP.toast('Allow pop-ups to print receipts', 'warning'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  // Give the popup a moment to render, then print and auto-close.
  setTimeout(() => { win.print(); win.addEventListener('afterprint', () => win.close()); }, 300);
}

function downloadPDF(data) {
  if (!window.jspdf) { APP.toast('PDF library not loaded', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
  const cfg = shopCfg || {};

  let y = 10;
  // Shop logo, centered at the top (skip gracefully if it hasn't loaded yet).
  if (BILL_LOGO.complete && BILL_LOGO.naturalWidth) {
    try { doc.addImage(BILL_LOGO, 'PNG', 32, y, 16, 16); y += 18; }
    catch (e) { console.warn('Logo embed skipped:', e); }
  }
  doc.setFontSize(14); doc.setFont('helvetica','bold');
  doc.text(cfg.name || 'Nishar Telecom', 40, y, { align: 'center' }); y += 6;
  doc.setFontSize(8); doc.setFont('helvetica','normal');
  if (cfg.address) { doc.text(cfg.address.substring(0, 50), 40, y, { align: 'center' }); y += 4; }
  if (cfg.phone)   { doc.text(`Ph: ${cfg.phone}`, 40, y, { align: 'center' }); y += 4; }
  doc.setFontSize(9);
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
    doc.text(`${item.quantity}${item.unit ? ' ' + item.unit : ''}`, 50, y);
    doc.text(`Rs.${item.total.toFixed(2)}`, 75, y, { align: 'right' });
    y += 4;
  });

  y += 2; doc.setLineDashPattern([1,1]); doc.line(5, y, 75, y); y += 5;
  doc.setFontSize(11); doc.setFont('helvetica','bold');
  doc.text(`TOTAL: Rs.${data.total.toFixed(2)}`, 75, y, { align: 'right' });
  if (data.dueAmount > 0) {
    y += 5; doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text(`Paid: Rs.${(data.amountPaid || 0).toFixed(2)}`, 75, y, { align: 'right' });
    y += 4; doc.setFontSize(10); doc.setFont('helvetica','bold');
    doc.text(`DUE: Rs.${data.dueAmount.toFixed(2)}`, 75, y, { align: 'right' });
  }
  y += 8; doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.text('Thank you for your business!', 40, y, { align: 'center' });

  doc.save(`Invoice_${data.invoiceNo}.pdf`);
  APP.toast('PDF downloaded');
}

/* ── Hold / Restore ────────────────────────── */
/* ── Held bills (parked to Firestore, resumable anywhere) ── */
async function holdCart() {
  if (!cart.length) { APP.toast('Cart is empty', 'warning'); return; }
  const customerId = document.getElementById('customer-select').value;
  const customer   = customers.find(c => c.id === customerId);
  const { total }  = computeCartTotals();
  const itemCount  = cart.reduce((s, i) => s + i.qty, 0);
  try {
    await db.collection('heldCarts').add({
      cart,
      customerId:   customerId || null,
      customerName: customer ? customer.name : 'Walk-in Customer',
      discount:     parseFloat(document.getElementById('discount-input').value) || 0,
      itemCount, total,
      heldBy:    auth.currentUser?.uid || 'unknown',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    APP.audit('cart.hold', { itemCount, total, customerName: customer ? customer.name : 'Walk-in' });
    // Clear the current cart so the counter is free for the next customer
    cart = [];
    document.getElementById('discount-input').value = 0;
    document.getElementById('customer-select').value = '';
    document.getElementById('paid-now-input').value = 0;
    onCustomerChange();
    updateCart(); renderProducts();
    APP.toast('Bill held — resume it from any terminal', 'success');
    refreshHeldCount();
  } catch (e) {
    console.error(e);
    APP.toast('Could not hold bill', 'error');
  }
}

// Update the Resume button's visibility + count badge.
async function refreshHeldCount() {
  try {
    const count = await APP.countOf(db.collection('heldCarts'));
    const btn   = document.getElementById('resume-held-btn');
    const badge = document.getElementById('held-count');
    if (count && count > 0) {
      btn.style.display = 'flex';
      badge.textContent = count;
    } else {
      btn.style.display = 'none';
    }
  } catch (e) { /* count is best-effort */ }
}

async function openHeldModal() {
  const list = document.getElementById('held-list');
  list.innerHTML = APP.skeletonRows ? '<div class="text-muted" style="padding:12px;text-align:center;">Loading…</div>' : '';
  APP.openModal('held-modal');
  try {
    const snap = await db.collection('heldCarts').orderBy('createdAt', 'desc').limit(50).get();
    if (snap.empty) {
      list.innerHTML = '<div class="text-muted" style="padding:20px;text-align:center;">No held bills right now.</div>';
      return;
    }
    list.innerHTML = snap.docs.map(d => {
      const h = d.data();
      const when = h.createdAt?.toDate?.() ? h.createdAt.toDate().toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '';
      return `<div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border-soft);border-radius:var(--r-sm);margin-bottom:8px;">
        <div style="flex:1;">
          <div style="font-weight:600;">${APP.sanitize(h.customerName || 'Walk-in Customer')}</div>
          <div class="text-muted" style="font-size:12px;">${h.itemCount} item${h.itemCount !== 1 ? 's' : ''} · ${APP.currency(h.total)}${when ? ' · ' + when : ''}</div>
        </div>
        <button class="btn btn-primary btn-icon" data-resume="${d.id}" title="Resume this bill">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button class="btn btn-danger btn-icon" data-discard="${d.id}" title="Discard">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
    }).join('');
  } catch (e) {
    console.error(e);
    list.innerHTML = '<div class="text-muted" style="padding:20px;text-align:center;">Failed to load held bills.</div>';
  }
}

async function resumeHeldCart(id) {
  if (cart.length && !await confirmReplaceCart()) return;
  try {
    const ref  = db.collection('heldCarts').doc(id);
    const snap = await ref.get();
    if (!snap.exists) { APP.toast('That held bill is no longer available', 'warning'); openHeldModal(); return; }
    const h = snap.data();
    cart = (h.cart || []).map(i => ({ ...i }));
    document.getElementById('discount-input').value  = h.discount || 0;
    document.getElementById('customer-select').value = h.customerId || '';
    onCustomerChange();
    await ref.delete();            // consumed — remove from the parking list
    updateCart(); renderProducts();
    APP.closeModal('held-modal');
    APP.toast('Held bill resumed', 'success');
    refreshHeldCount();
  } catch (e) {
    console.error(e);
    APP.toast('Could not resume bill', 'error');
  }
}

async function discardHeldCart(id) {
  try {
    await db.collection('heldCarts').doc(id).delete();
    APP.toast('Held bill discarded');
    openHeldModal();
    refreshHeldCount();
  } catch (e) { APP.toast('Could not discard', 'error'); }
}

// Small helper: confirm before overwriting a non-empty cart.
function confirmReplaceCart() {
  return new Promise(resolve => {
    APP.showConfirm({
      title: 'Replace current cart?',
      message: 'Your current cart has items. Resuming a held bill will replace it. Continue?',
      type: 'warning', confirmText: 'Replace',
      onConfirm: () => resolve(true),
      onCancel:  () => resolve(false),
    });
  });
}

/* ── Filter ────────────────────────────────── */
function filterProducts() {
  const term = document.getElementById('product-search').value.toLowerCase();
  const cat  = document.getElementById('category-filter').value;
  const filtered = products.filter(p =>
    (p.name?.toLowerCase().includes(term) || p.brand?.toLowerCase().includes(term) || p.barcode?.toLowerCase().includes(term)) &&
    (!cat || p.category === cat)
  );
  renderProducts(filtered);
}

// Enter on the search box → treat the value as a scanned barcode.
// USB scanners are keyboard wedges: they type the code very fast and end
// with Enter. We clear the box first so the debounced text filter shows the
// full grid back while the barcode lookup runs.
async function handleProductSearchEnter(e) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const value = e.target.value.trim();
  if (!value) return;
  e.target.value = '';
  filterProducts();

  // Fast path: exact barcode match against products already loaded in memory.
  const local = products.find(p => p.barcode && p.barcode === value);
  if (local) {
    addToCart(local);
    APP.toast(`+ ${local.name}`, 'success');
    return;
  }

  // Fallback: query Firestore in case the local list is stale or filtered.
  try {
    const snap = await db.collection('products').where('barcode', '==', value).limit(1).get();
    if (snap.empty) {
      APP.toast(`No product for barcode "${value}"`, 'warning');
      return;
    }
    const doc = snap.docs[0];
    const p = { id: doc.id, ...doc.data() };
    if (!products.find(x => x.id === p.id)) products.push(p);
    addToCart(p);
    APP.toast(`+ ${p.name}`, 'success');
  } catch (err) {
    console.error('Barcode lookup failed', err);
    APP.toast('Barcode lookup failed', 'error');
  }
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
function buildInvoiceMessage(data) {
  const lines = [
    `Hello ${data.customerName || 'there'},`,
    ``,
    `Thank you for shopping at Nishar Telecom! 🙏`,
    ``,
    `*Invoice:* ${data.invoiceNo}`,
    `*Items:* ${(data.items || []).reduce((s, i) => s + i.quantity, 0)} item(s)`,
    `*Total:* ${APP.currency(data.total)}`,
  ];
  if (data.dueAmount > 0) {
    lines.push(`*Paid:* ${APP.currency(data.amountPaid || 0)}`);
    lines.push(`*Balance Due:* ${APP.currency(data.dueAmount)}`);
  }
  lines.push(``);
  lines.push(`We appreciate your business.`);
  return lines.join('\n');
}

function sendInvoiceWhatsApp(data) {
  const phone = data.customerPhone || '';
  if (!phone) {
    APP.toast('No phone number on this sale (walk-in customer)', 'warning');
    return;
  }
  const opened = APP.whatsApp(phone, buildInvoiceMessage(data));
  if (opened) APP.audit('whatsapp.invoice', { invoiceNo: data.invoiceNo, customerName: data.customerName });
}


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

  // Held bills
  document.getElementById('resume-held-btn').addEventListener('click', openHeldModal);
  document.getElementById('close-held-modal').addEventListener('click', () => APP.closeModal('held-modal'));
  document.getElementById('held-list').addEventListener('click', e => {
    const r = e.target.closest('[data-resume]');
    const d = e.target.closest('[data-discard]');
    if (r) resumeHeldCart(r.dataset.resume);
    if (d) discardHeldCart(d.dataset.discard);
  });
  document.getElementById('print-btn').addEventListener('click', () => {
    if (lastSaleData) showInvoice(lastSaleData);
    else APP.toast('No recent bill to print', 'warning');
  });

  // Credit / due controls
  document.getElementById('payment-method').addEventListener('change', onPaymentMethodChange);
  document.getElementById('customer-select').addEventListener('change', onCustomerChange);
  document.getElementById('paid-now-input').addEventListener('input', () => refreshDueDisplay());
  document.getElementById('pay-full-btn').addEventListener('click', () => {
    document.getElementById('paid-now-input').value = computeCartTotals().total.toFixed(2);
    refreshDueDisplay();
  });

  // Product search
  const searchFn = APP.debounce(filterProducts, 250);
  const searchEl = document.getElementById('product-search');
  searchEl.addEventListener('input', searchFn);
  searchEl.addEventListener('keydown', handleProductSearchEnter);
  searchEl.focus();    // ready for the next scan immediately
  document.getElementById('category-filter').addEventListener('change', filterProducts);

  // Customer modal
  document.getElementById('add-customer-btn').addEventListener('click', () => APP.openModal('add-customer-modal'));
  document.getElementById('close-add-customer').addEventListener('click', () => APP.closeModal('add-customer-modal'));
  document.getElementById('cancel-add-customer').addEventListener('click', () => APP.closeModal('add-customer-modal'));
  document.getElementById('save-add-customer').addEventListener('click', saveQuickCustomer);

  // Invoice modal
  document.getElementById('close-invoice-modal').addEventListener('click', () => APP.closeModal('invoice-modal'));
  document.getElementById('download-pdf-btn').addEventListener('click', () => { if (lastSaleData) downloadPDF(lastSaleData); });
  document.getElementById('print-thermal-btn').addEventListener('click', () => { if (lastSaleData) printThermal(lastSaleData); });
  document.getElementById('whatsapp-invoice-btn').addEventListener('click', () => { if (lastSaleData) sendInvoiceWhatsApp(lastSaleData); });
  document.getElementById('new-bill-btn').addEventListener('click', () => {
    cart = [];
    document.getElementById('discount-input').value = 0;
    updateCart(); renderProducts();
    APP.closeModal('invoice-modal');
    loadProducts(); // Refresh stock
  });
}

/* =============================================
   Touch Mode — fullscreen tablet billing
   ============================================= */
const TOUCH_MODE_KEY = 'pos-touch-mode';

function enterTouchMode() {
  document.body.classList.add('touch-mode');
  try { localStorage.setItem(TOUCH_MODE_KEY, '1'); } catch (e) {}
  // Best-effort fullscreen (some browsers/devices reject if not user-gestured)
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (req) { try { req.call(el); } catch (e) { /* not fatal */ } }
}

function exitTouchMode() {
  document.body.classList.remove('touch-mode');
  try { localStorage.removeItem(TOUCH_MODE_KEY); } catch (e) {}
  const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
  if (exit && document.fullscreenElement) { try { exit.call(document); } catch (e) {} }
}

// Restore preference + wire toggle/exit/Escape. Runs once the DOM is parsed,
// independent of the auth flow so the buttons are always responsive.
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('touch-mode-btn')?.addEventListener('click', enterTouchMode);
  document.getElementById('exit-touch-btn')?.addEventListener('click', exitTouchMode);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.classList.contains('touch-mode')) exitTouchMode();
  });
  try {
    if (localStorage.getItem(TOUCH_MODE_KEY) === '1') {
      document.body.classList.add('touch-mode');     // restore visual state immediately
      // Do NOT auto-request fullscreen — browsers require a user gesture, and
      // forcing it on load is jarring. The cashier can tap any button to enter.
    }
  } catch (e) {}
});
