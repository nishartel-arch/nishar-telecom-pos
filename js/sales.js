/* =============================================
   NISHAR TELECOM POS — Sales History Logic
   Cursor-paginated so it stays fast at scale.
   ============================================= */
APP.init({ page: 'sales', title: 'Sales History', onReady: initSales });

const SALES_PAGE = 30;          // rows fetched per page
let allSales      = [];         // accumulator of loaded sales
let viewedSale    = null;       // currently open in the view-invoice modal
let salesCursor   = null;       // last doc snapshot (pagination cursor)
let salesHasMore  = true;
let salesLoading  = false;

const SALES_COLS = 9;

async function initSales() {
  bindSalesEvents();
  await Promise.all([loadSalesStats(), loadFirstSalesPage()]);
}

/* ── Stats (accurate, independent of the table) ── */
async function loadSalesStats() {
  const coll = db.collection('sales');
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  try {
    const [total, monthSnap, todayCash, monthCash] = await Promise.all([
      APP.countOf(coll),
      coll.where('createdAt', '>=', monthStart).get(),
      APP.cashCollected(todayStart),   // money received today
      APP.cashCollected(monthStart),   // money received this month
    ]);
    const monthCount = monthSnap.size;
    // Average order value is a billing metric (typical bill size), so it stays on
    // the billed amount net of refunds — independent of how much was collected.
    const billedNet = monthSnap.docs.reduce((s, d) =>
      s + parseFloat(d.data().total || 0) - parseFloat(d.data().refundedTotal || 0), 0);
    renderSalesStats({
      total: total != null ? total : monthCount,
      todayRev: todayCash,
      monthRev: monthCash,
      avg: monthCount ? billedNet / monthCount : 0,
    });
  } catch (e) {
    console.error(e);
    document.getElementById('sales-stats').innerHTML =
      `<div class="card" style="grid-column:1/-1;text-align:center;color:var(--text-muted);">Could not load summary. <button class="btn btn-secondary" id="stats-retry">Retry</button></div>`;
    document.getElementById('stats-retry')?.addEventListener('click', loadSalesStats);
  }
}

function renderSalesStats({ total, todayRev, monthRev, avg }) {
  const ic = {
    tx:   '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    rupee:'<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    clock:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  };
  const card = (color, icon, value, label) => `
    <div class="stat-card ${color}"><div class="stat-top"><div class="stat-icon ${color}">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icon}</svg>
    </div></div><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
  document.getElementById('sales-stats').innerHTML =
    card('blue',   ic.tx,    total,                 'Total Transactions') +
    card('green',  ic.rupee, APP.currency(monthRev),'This Month') +
    card('yellow', ic.clock, APP.currency(todayRev),"Today's Revenue") +
    card('red',    ic.rupee, APP.currency(avg),     'Avg Order (Month)');
}

/* ── Table pagination ─────────────────────── */
async function loadFirstSalesPage() {
  allSales = []; salesCursor = null; salesHasMore = true;
  document.getElementById('sales-tbody').innerHTML = APP.skeletonRows(SALES_COLS);
  document.getElementById('sales-empty').style.display = 'none';
  document.getElementById('sales-loadmore').innerHTML = '';
  await loadMoreSales(true);
}

async function loadMoreSales(first = false) {
  if (salesLoading || (!first && !salesHasMore)) return;
  salesLoading = true;
  renderSalesLoadMore();
  try {
    let q = db.collection('sales').orderBy('createdAt', 'desc').limit(SALES_PAGE);
    if (salesCursor) q = q.startAfter(salesCursor);
    const snap = await q.get();
    if (snap.docs.length < SALES_PAGE) salesHasMore = false;
    if (snap.docs.length) salesCursor = snap.docs[snap.docs.length - 1];
    allSales.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
    filterSales();
  } catch (e) {
    console.error(e);
    if (first) {
      document.getElementById('sales-tbody').innerHTML =
        APP.tableMessage(SALES_COLS, `Couldn't load sales. <button class="btn btn-secondary" id="sales-retry">Retry</button>`);
      document.getElementById('sales-retry')?.addEventListener('click', loadFirstSalesPage);
    } else {
      APP.toast('Failed to load more sales', 'error');
    }
  } finally {
    salesLoading = false;
    renderSalesLoadMore();
  }
}

function renderSalesLoadMore() {
  const bar = document.getElementById('sales-loadmore');
  if (!bar) return;
  if (salesHasMore) {
    bar.innerHTML =
      `<button class="btn btn-secondary" id="sales-more-btn" ${salesLoading ? 'disabled' : ''}>${
        salesLoading ? '<span class="spinner"></span> Loading…' : 'Load more'}</button>` +
      (isFilteringSales() ? `<span class="hint">Filters apply to loaded sales — load more to reach older records.</span>` : '');
    document.getElementById('sales-more-btn')?.addEventListener('click', () => loadMoreSales());
  } else {
    bar.innerHTML = allSales.length ? `<span class="hint">All sales loaded.</span>` : '';
  }
}

/* ── Rendering ─────────────────────────────── */
function renderSales(list) {
  const tbody = document.getElementById('sales-tbody');
  const empty = document.getElementById('sales-empty');
  document.getElementById('sales-count').textContent = `${list.length} sale${list.length !== 1 ? 's' : ''}`;
  if (!list.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  const mc = { Cash: 'blue', UPI: 'green', Card: 'yellow', Credit: 'red' };
  tbody.innerHTML = list.map(s => `<tr>
    <td class="td-mono text-primary">${APP.sanitize(s.invoiceNo || '--')}</td>
    <td>${APP.sanitize(s.customerName || 'Walk-in')}</td>
    <td><span class="badge badge-gray">${(s.items || []).reduce((a, i) => a + i.quantity, 0)} items</span></td>
    <td class="td-mono">${APP.currency(s.subtotal)}</td>
    <td class="td-mono ${s.discount > 0 ? 'text-warning' : ''}">${s.discount > 0 ? '-' + APP.currency(s.discount) : '--'}</td>
    <td class="td-mono text-primary" style="font-weight:600;">${APP.currency(s.total)}${s.dueAmount > 0 ? `<div><span class="badge badge-red" style="font-size:10px;margin-top:2px;">DUE ${APP.currency(s.dueAmount)}</span></div>` : ''}${s.refundedTotal > 0 ? `<div><span class="badge badge-yellow" style="font-size:10px;margin-top:2px;">REFUNDED ${APP.currency(s.refundedTotal)}</span></div>` : ''}</td>
    <td><span class="badge badge-${mc[s.paymentMethod] || 'gray'}">${APP.sanitize(s.paymentMethod || 'Cash')}</span></td>
    <td class="text-muted">${APP.fmtDateTime(s.createdAt)}</td>
    <td><button class="btn btn-secondary btn-icon" data-action="view" data-id="${s.id}" title="View invoice"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>${APP.can('sales.refund') && (parseFloat(s.refundedTotal||0) < parseFloat(s.total||0) - 0.001) ? ` <button class="btn btn-danger btn-icon" data-action="refund" data-id="${s.id}" title="Refund"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg></button>` : ''}</td>
  </tr>`).join('');
}

function viewInvoice(id) {
  const s = allSales.find(x => x.id === id); if (!s) return;
  viewedSale = s;
  document.getElementById('view-invoice-body').innerHTML = `
    <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;border:1px dashed var(--border-mid);border-radius:var(--r-md);padding:var(--sp-5);">
      <div style="text-align:center;margin-bottom:var(--sp-4);">
        <img src="assets/logo-hexagon-dark.svg" alt="Nishar Telecom" style="width:48px;height:48px;margin:0 auto var(--sp-2);display:block;"/>
        <div style="font-size:15px;font-weight:700;font-family:'Sora',sans-serif;">Nishar Telecom</div>
        <div style="font-size:11px;color:var(--text-muted);">Invoice: ${APP.sanitize(s.invoiceNo || '--')}</div>
        <div style="font-size:11px;color:var(--text-dim);">${APP.fmtDateTime(s.createdAt)}</div>
      </div>
      <hr style="border:none;border-top:1px dashed var(--border-mid);margin:var(--sp-3) 0;"/>
      <div style="font-size:11px;margin-bottom:var(--sp-3);">
        <div>Customer: ${APP.sanitize(s.customerName || 'Walk-in')}</div>
        <div>Payment : ${APP.sanitize(s.paymentMethod || 'Cash')}</div>
      </div>
      <hr style="border:none;border-top:1px dashed var(--border-mid);margin:var(--sp-3) 0;"/>
      <table style="width:100%;font-size:11px;">
        ${(s.items || []).map(i => `<tr><td>${APP.sanitize(i.name)}</td><td style="text-align:center;">${i.quantity}x</td><td style="text-align:right;">${APP.currency(i.total)}</td></tr>`).join('')}
      </table>
      <hr style="border:none;border-top:1px dashed var(--border-mid);margin:var(--sp-3) 0;"/>
      ${s.discount > 0 ? `<div style="display:flex;justify-content:space-between;font-size:11px;"><span>Discount</span><span>-${APP.currency(s.discount)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;padding-top:var(--sp-2);">
        <span>TOTAL</span><span style="color:var(--primary);">${APP.currency(s.total)}</span>
      </div>
      ${s.dueAmount > 0 ? `
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:6px;"><span>Paid Now</span><span>${APP.currency(s.amountPaid || 0)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:var(--danger);"><span>Balance Due</span><span>${APP.currency(s.dueAmount)}</span></div>` : ''}
    </div>`;
  APP.openModal('view-invoice-modal');
}

/* ── Filtering (over loaded rows) ──────────── */
function isFilteringSales() {
  return !!(document.getElementById('sales-search').value.trim()
    || document.getElementById('sales-method').value
    || document.getElementById('sales-period').value);
}

function filterSales() {
  const term   = document.getElementById('sales-search').value.toLowerCase();
  const method = document.getElementById('sales-method').value;
  const period = document.getElementById('sales-period').value;
  const now    = new Date(); now.setHours(0, 0, 0, 0);
  const week   = new Date(now); week.setDate(week.getDate() - week.getDay());
  const month  = new Date(now.getFullYear(), now.getMonth(), 1);

  renderSales(allSales.filter(s => {
    const matchTerm   = !term   || s.invoiceNo?.toLowerCase().includes(term) || s.customerName?.toLowerCase().includes(term);
    const matchMethod = !method || s.paymentMethod === method;
    const date        = s.createdAt?.toDate?.() ?? new Date(0);
    const matchPeriod = !period ||
      (period === 'today' && date >= now) ||
      (period === 'week'  && date >= week) ||
      (period === 'month' && date >= month);
    return matchTerm && matchMethod && matchPeriod;
  }));
  renderSalesLoadMore();
}

/* ── Refund flow ───────────────────────────── */
let refundSale = null;

function openRefundModal(id) {
  const s = allSales.find(x => x.id === id); if (!s) return;
  refundSale = s;
  document.getElementById('refund-sale-id').value = id;
  document.getElementById('refund-invoice-no').textContent = s.invoiceNo || '--';
  const custLine = s.customerName
    ? `${APP.sanitize(s.customerName)}${s.customerPhone ? ' · ' + APP.sanitize(s.customerPhone) : ''}`
    : 'Walk-in Customer';
  document.getElementById('refund-cust-info').innerHTML = `
    <div style="font-weight:600;">${custLine}</div>
    <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">
      Sold: <span class="td-mono">${APP.currency(s.total)}</span>
      ${s.refundedTotal > 0 ? ' · Already refunded: <span class="td-mono">' + APP.currency(s.refundedTotal) + '</span>' : ''}
    </div>`;

  const already = s.refundedQtyByProduct || {};
  const rows = (s.items || []).map((it, idx) => {
    const refunded  = parseFloat(already[it.productId] || 0);
    const available = Math.max(0, it.quantity - refunded);
    return `<tr data-row="${idx}">
      <td>${APP.sanitize(it.name)}</td>
      <td style="text-align:center;">${it.quantity}</td>
      <td style="text-align:center;">${refunded || '--'}</td>
      <td style="text-align:center;">
        <input type="number" class="form-input refund-qty" data-idx="${idx}" data-price="${it.price}" data-max="${available}" value="0" min="0" max="${available}" step="1" style="width:70px;text-align:center;" ${available === 0 ? 'disabled' : ''}/>
      </td>
      <td style="text-align:right;" class="td-mono refund-sub" data-idx="${idx}">${APP.currency(0)}</td>
      <td style="text-align:center;">
        <input type="checkbox" class="refund-restore" data-idx="${idx}" checked ${!it.productId ? 'disabled' : ''}/>
      </td>
    </tr>`;
  }).join('');
  document.getElementById('refund-items-tbody').innerHTML = rows || `<tr><td colspan="6" class="text-muted" style="text-align:center;padding:20px;">No items on this sale.</td></tr>`;

  document.getElementById('refund-method').value = 'Cash';
  document.getElementById('refund-reason').value = '';
  document.getElementById('refund-total-display').textContent = APP.currency(0);

  document.getElementById('refund-items-tbody').oninput = e => {
    if (!e.target.classList.contains('refund-qty')) return;
    const tr   = e.target.closest('tr');
    const max  = parseFloat(e.target.dataset.max);
    let   qty  = Math.max(0, parseFloat(e.target.value) || 0);
    if (qty > max) { qty = max; e.target.value = max; }
    const price = parseFloat(e.target.dataset.price);
    tr.querySelector('.refund-sub').textContent = APP.currency(qty * price);
    recalcRefundTotal();
  };
  recalcRefundTotal();
  APP.openModal('refund-modal');
}

function recalcRefundTotal() {
  let total = 0;
  document.querySelectorAll('#refund-items-tbody .refund-qty').forEach(inp => {
    total += (parseFloat(inp.value) || 0) * parseFloat(inp.dataset.price);
  });
  document.getElementById('refund-total-display').textContent = APP.currency(total);
  return total;
}

async function saveRefund() {
  const saleId = document.getElementById('refund-sale-id').value;
  const sale   = allSales.find(x => x.id === saleId);
  if (!sale)   { APP.toast('Sale not found', 'error'); return; }

  const lines = [];
  document.querySelectorAll('#refund-items-tbody .refund-qty').forEach(inp => {
    const qty = parseFloat(inp.value) || 0;
    if (qty <= 0) return;
    const idx     = parseInt(inp.dataset.idx, 10);
    const restore = document.querySelector('#refund-items-tbody .refund-restore[data-idx="' + idx + '"]')?.checked === true;
    const item    = sale.items[idx];
    lines.push({
      productId: item.productId || null, name: item.name, price: item.price,
      quantity: qty, total: qty * item.price, restoreStock: restore && !!item.productId,
    });
  });
  if (!lines.length) { APP.toast('Enter a return quantity for at least one item', 'warning'); return; }

  const method = document.getElementById('refund-method').value;
  const reason = document.getElementById('refund-reason').value.trim();
  const total  = lines.reduce((s, l) => s + l.total, 0);
  if (total <= 0)    { APP.toast('Refund total must be greater than 0', 'warning'); return; }

  const btn = document.getElementById('save-refund-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Processing…';
  try {
    const refundRef  = db.collection('refunds').doc();
    const counterRef = db.collection('counters').doc('refunds');
    const saleRef    = db.collection('sales').doc(saleId);
    const adjustDue  = method === 'Adjust Due';
    if (adjustDue && !sale.customerId) throw new Error('Adjust Due needs a customer on the original sale');
    // Read the customer whenever the sale had one, so their lifetime spend can be
    // netted by the refund — not only when settling against their due balance.
    const custRef    = sale.customerId ? db.collection('customers').doc(sale.customerId) : null;

    let refundNo = '';
    await db.runTransaction(async (tx) => {
      const restoreLines = lines.filter(l => l.restoreStock && l.productId);
      const productSnaps = await Promise.all(restoreLines.map(l => tx.get(db.collection('products').doc(l.productId))));
      const counterSnap  = await tx.get(counterRef);
      const saleSnap     = await tx.get(saleRef);
      const custSnap     = custRef ? await tx.get(custRef) : null;

      if (!saleSnap.exists) throw new Error('Original sale no longer exists');
      const curRefunded = parseFloat(saleSnap.data().refundedTotal || 0);
      const saleTotal   = parseFloat(saleSnap.data().total || 0);
      if (curRefunded + total > saleTotal + 0.005) {
        throw new Error('Cannot refund more than the sale (' + APP.currency(saleTotal - curRefunded) + ' remaining)');
      }
      if (adjustDue) {
        if (!custSnap || !custSnap.exists) throw new Error('Customer no longer exists; refund via Cash/UPI/Card instead');
        const due = parseFloat(custSnap.data().dueBalance || 0);
        if (total > due + 0.005) throw new Error("Customer's outstanding due is only " + APP.currency(due) + '; refund via Cash/UPI/Card instead');
      }

      const nextSeq = (counterSnap.exists ? (counterSnap.data().seq || 0) : 0) + 1;
      refundNo = 'RF-' + String(nextSeq).padStart(4, '0');

      restoreLines.forEach((l, i) => {
        const snap = productSnaps[i];
        if (!snap || !snap.exists) return;
        tx.update(snap.ref, { stock: (snap.data().stock || 0) + l.quantity });
      });
      tx.set(counterRef, { seq: nextSeq }, { merge: true });
      tx.set(refundRef, {
        refundNo, saleId,
        saleInvoiceNo: sale.invoiceNo || '',
        customerId:    sale.customerId || null,
        customerName:  sale.customerName || '',
        customerPhone: sale.customerPhone || '',
        items: lines, totalRefund: total, method, reason,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.currentUser?.uid || 'unknown',
      });
      const merged = Object.assign({}, saleSnap.data().refundedQtyByProduct || {});
      lines.forEach(l => { if (l.productId) merged[l.productId] = (merged[l.productId] || 0) + l.quantity; });
      tx.update(saleRef, { refundedTotal: curRefunded + total, refundedQtyByProduct: merged });
      // Net the returned value off the customer's lifetime spend, and — only when
      // settling against their account — reduce their outstanding due as well.
      if (custRef && custSnap && custSnap.exists) {
        const cd  = custSnap.data();
        const upd = { totalSpent: Math.max(0, parseFloat(cd.totalSpent || 0) - total) };
        if (adjustDue) upd.dueBalance = parseFloat(cd.dueBalance || 0) - total;
        tx.update(custRef, upd);
      }
    });

    APP.audit('refund.create', {
      refundNo, saleInvoiceNo: sale.invoiceNo, total, method,
      items: lines.length, customerName: sale.customerName,
    });
    APP.toast('Refund ' + refundNo + ' processed (' + APP.currency(total) + ')', 'success');
    APP.closeModal('refund-modal');
    await loadFirstSalesPage();
    await loadSalesStats();
  } catch (e) {
    console.error(e);
    APP.toast(e.message || 'Refund failed', 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'Process Refund';
  }
}

function bindSalesEvents() {
  document.getElementById('close-refund-modal').addEventListener('click', () => APP.closeModal('refund-modal'));
  document.getElementById('cancel-refund-modal').addEventListener('click', () => APP.closeModal('refund-modal'));
  document.getElementById('save-refund-btn').addEventListener('click', saveRefund);
  document.getElementById('close-view-invoice').addEventListener('click', () => APP.closeModal('view-invoice-modal'));
  document.getElementById('close-view-invoice-btn').addEventListener('click', () => APP.closeModal('view-invoice-modal'));
  document.getElementById('whatsapp-sale-btn').addEventListener('click', () => {
    if (!viewedSale) return;
    if (!viewedSale.customerPhone) { APP.toast('No phone number on this sale (walk-in customer)', 'warning'); return; }
    const items = (viewedSale.items || []).reduce((s, i) => s + i.quantity, 0);
    const lines = [
      `Hello ${viewedSale.customerName || 'there'},`, ``,
      `Here is your invoice from Nishar Telecom 🙏`, ``,
      `*Invoice:* ${viewedSale.invoiceNo}`,
      `*Items:* ${items} item(s)`,
      `*Total:* ${APP.currency(viewedSale.total)}`,
    ];
    if (viewedSale.dueAmount > 0) {
      lines.push(`*Paid:* ${APP.currency(viewedSale.amountPaid || 0)}`);
      lines.push(`*Balance Due:* ${APP.currency(viewedSale.dueAmount)}`);
    }
    lines.push(``, `Thank you for your business.`);
    if (APP.whatsApp(viewedSale.customerPhone, lines.join('\n'))) {
      APP.audit('whatsapp.invoice', { invoiceNo: viewedSale.invoiceNo, source: 'sales-history' });
    }
  });
  document.getElementById('sales-tbody').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]'); if (!btn) return;
    if (btn.dataset.action === 'view')   viewInvoice(btn.dataset.id);
    if (btn.dataset.action === 'refund') openRefundModal(btn.dataset.id);
  });
  ['sales-search', 'sales-method', 'sales-period'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', APP.debounce(filterSales, 250));
  });
}

/* =============================================
   Export to Excel (SheetJS)
   ============================================= */
function exportSalesToExcel() {
  if (typeof XLSX === 'undefined') { APP.toast('Spreadsheet library still loading — try again in a moment', 'warning'); return; }
  if (!allSales.length) { APP.toast('No sales loaded yet — click Load More to pull more history first.', 'warning'); return; }

  const fmt = ts => (ts?.toDate?.() || new Date()).toLocaleString('en-IN');

  const salesRows = allSales.map(s => ({
    Invoice:   s.invoiceNo || '',
    Date:      fmt(s.createdAt),
    Customer:  s.customerName || 'Walk-in',
    Phone:     s.customerPhone || '',
    Items:     (s.items || []).reduce((a, i) => a + i.quantity, 0),
    Subtotal:  parseFloat(s.subtotal || 0),
    Discount:  parseFloat(s.discount || 0),
    Total:     parseFloat(s.total || 0),
    Paid:      parseFloat(s.amountPaid != null ? s.amountPaid : s.total),
    Due:       parseFloat(s.dueAmount || 0),
    Status:    s.dueStatus || 'paid',
    Method:    s.paymentMethod || '',
    Refunded:  parseFloat(s.refundedTotal || 0),
  }));

  const itemRows = [];
  allSales.forEach(s => {
    (s.items || []).forEach(it => {
      itemRows.push({
        Invoice:      s.invoiceNo || '',
        Date:         fmt(s.createdAt),
        Customer:     s.customerName || 'Walk-in',
        Product:      it.name,
        Quantity:     it.quantity,
        'Unit Price': parseFloat(it.price || 0),
        'Line Total': parseFloat(it.total || 0),
      });
    });
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesRows), 'Sales');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemRows),  'Items');
  XLSX.writeFile(wb, `nishar-sales-${new Date().toISOString().slice(0,10)}.xlsx`);
  APP.audit('sales.export', { sales: allSales.length, items: itemRows.length });
  APP.toast(`Exported ${allSales.length} sales (${itemRows.length} line items)`, 'success');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('export-sales-btn')?.addEventListener('click', exportSalesToExcel);
});
