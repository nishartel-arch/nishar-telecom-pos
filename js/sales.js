/* =============================================
   NISHAR TELECOM POS — Sales History Logic
   ============================================= */
APP.init({ page: 'sales', title: 'Sales History', onReady: initSales });

let allSales = [];

async function initSales() {
  await loadSales();
  bindSalesEvents();
}

async function loadSales() {
  try {
    const snap = await db.collection('sales').orderBy('createdAt','desc').limit(200).get();
    allSales = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSalesStats();
    renderSales(allSales);
  } catch (e) { APP.toast('Failed to load sales', 'error'); }
}

function renderSalesStats() {
  const total   = allSales.reduce((s,x) => s + parseFloat(x.total||0), 0);
  const today   = new Date(); today.setHours(0,0,0,0);
  const todayRev = allSales.filter(x => (x.createdAt?.toDate?.()??new Date(0)) >= today)
                           .reduce((s,x) => s + parseFloat(x.total||0), 0);
  document.getElementById('sales-stats').innerHTML = `
    <div class="stat-card blue"><div class="stat-top"><div class="stat-icon blue"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div></div>
      <div class="stat-value">${allSales.length}</div><div class="stat-label">Total Transactions</div></div>
    <div class="stat-card green"><div class="stat-top"><div class="stat-icon green"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div></div>
      <div class="stat-value">${APP.currency(total)}</div><div class="stat-label">Total Revenue</div></div>
    <div class="stat-card yellow"><div class="stat-top"><div class="stat-icon yellow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div></div>
      <div class="stat-value">${APP.currency(todayRev)}</div><div class="stat-label">Today's Revenue</div></div>
    <div class="stat-card red"><div class="stat-top"><div class="stat-icon red"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div></div>
      <div class="stat-value">${APP.currency(allSales.length ? total/allSales.length : 0)}</div><div class="stat-label">Avg. Order Value</div></div>`;
}

function renderSales(list) {
  const tbody  = document.getElementById('sales-tbody');
  const empty  = document.getElementById('sales-empty');
  const countEl = document.getElementById('sales-count');
  countEl.textContent = `${list.length} sale${list.length !== 1 ? 's' : ''}`;
  if (!list.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  const mc = { Cash:'blue', UPI:'green', Card:'yellow', Credit:'red' };
  tbody.innerHTML = list.map(s => `<tr>
    <td class="td-mono text-primary">${APP.sanitize(s.invoiceNo||'--')}</td>
    <td>${APP.sanitize(s.customerName||'Walk-in')}</td>
    <td><span class="badge badge-gray">${(s.items||[]).reduce((a,i)=>a+i.quantity,0)} items</span></td>
    <td class="td-mono">${APP.currency(s.subtotal)}</td>
    <td class="td-mono ${s.discount>0?'text-warning':''}">${s.discount > 0 ? '-'+APP.currency(s.discount) : '--'}</td>
    <td class="td-mono text-primary" style="font-weight:600;">${APP.currency(s.total)}</td>
    <td><span class="badge badge-${mc[s.paymentMethod]||'gray'}">${APP.sanitize(s.paymentMethod||'Cash')}</span></td>
    <td class="text-muted">${APP.fmtDateTime(s.createdAt)}</td>
    <td><button class="btn btn-secondary btn-icon" data-action="view" data-id="${s.id}" title="View invoice"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></td>
  </tr>`).join('');
}

function viewInvoice(id) {
  const s = allSales.find(x => x.id === id); if (!s) return;
  document.getElementById('view-invoice-body').innerHTML = `
    <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;border:1px dashed var(--border-mid);border-radius:var(--r-md);padding:var(--sp-5);">
      <div style="text-align:center;margin-bottom:var(--sp-4);">
        <div style="font-size:15px;font-weight:700;font-family:'Sora',sans-serif;">Nishar Telecom</div>
        <div style="font-size:11px;color:var(--text-muted);">Invoice: ${APP.sanitize(s.invoiceNo||'--')}</div>
        <div style="font-size:11px;color:var(--text-dim);">${APP.fmtDateTime(s.createdAt)}</div>
      </div>
      <hr style="border:none;border-top:1px dashed var(--border-mid);margin:var(--sp-3) 0;"/>
      <div style="font-size:11px;margin-bottom:var(--sp-3);">
        <div>Customer: ${APP.sanitize(s.customerName||'Walk-in')}</div>
        <div>Payment : ${APP.sanitize(s.paymentMethod||'Cash')}</div>
      </div>
      <hr style="border:none;border-top:1px dashed var(--border-mid);margin:var(--sp-3) 0;"/>
      <table style="width:100%;font-size:11px;">
        ${(s.items||[]).map(i=>`<tr><td>${APP.sanitize(i.name)}</td><td style="text-align:center;">${i.quantity}x</td><td style="text-align:right;">${APP.currency(i.total)}</td></tr>`).join('')}
      </table>
      <hr style="border:none;border-top:1px dashed var(--border-mid);margin:var(--sp-3) 0;"/>
      ${s.discount>0?`<div style="display:flex;justify-content:space-between;font-size:11px;"><span>Discount</span><span>-${APP.currency(s.discount)}</span></div>`:''}
      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;padding-top:var(--sp-2);">
        <span>TOTAL</span><span style="color:var(--primary);">${APP.currency(s.total)}</span>
      </div>
    </div>`;
  APP.openModal('view-invoice-modal');
}

function filterSales() {
  const term   = document.getElementById('sales-search').value.toLowerCase();
  const method = document.getElementById('sales-method').value;
  const period = document.getElementById('sales-period').value;
  const now    = new Date(); now.setHours(0,0,0,0);
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
}

function bindSalesEvents() {
  document.getElementById('close-view-invoice').addEventListener('click', () => APP.closeModal('view-invoice-modal'));
  document.getElementById('close-view-invoice-btn').addEventListener('click', () => APP.closeModal('view-invoice-modal'));
  document.getElementById('sales-tbody').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]'); if (!btn) return;
    if (btn.dataset.action === 'view') viewInvoice(btn.dataset.id);
  });
  ['sales-search','sales-method','sales-period'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', APP.debounce(filterSales, 250));
  });
}
