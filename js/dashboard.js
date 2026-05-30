/* =============================================
   NISHAR TELECOM POS — Dashboard Page Logic
   ============================================= */

APP.init({ page: 'dashboard', title: 'Dashboard', onReady: loadDashboard });

async function loadDashboard() {
  await Promise.all([loadStats(), loadRecentSales(), loadLowStock()]);
}

async function loadStats() {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Product/customer totals come from a count (with a doc-read fallback).
    // Cost of goods sold + operating expenses are fetched only for users who
    // can see profit numbers (back-office) — rules block them otherwise.
    const canSeeProfit = APP.can('expenses.view');
    // Revenue = cash actually received (paid sales + due collections − cash refunds),
    // not the full billed amount. Unpaid credit only counts once it's collected.
    const fetches = [
      APP.cashCollected(monthStart),       // money received this month
      APP.cashCollected(today),            // money received today
      APP.countOf(db.collection('products')),
      APP.countOf(db.collection('customers')),
    ];
    if (canSeeProfit) {
      fetches.push(APP.cogsOfSold(monthStart));                                        // cost of goods sold this month
      fetches.push(db.collection('expenses').where('date', '>=', monthStart).get());   // operating expenses
    }
    const results = await Promise.all(fetches);
    const monthRevenue = results[0], todayRevenue = results[1];
    const productCount = results[2], customerCount = results[3];
    const monthCOGS = canSeeProfit ? results[4] : 0;
    const expSnap   = canSeeProfit ? results[5] : null;

    const monthExpenses = expSnap ? expSnap.docs.reduce((s, d) => s + parseFloat(d.data().amount || 0), 0) : 0;
    const netProfit     = monthRevenue - monthCOGS - monthExpenses;

    const products  = productCount  != null ? productCount  : '—';
    const customers = customerCount != null ? customerCount : '—';

    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-card blue">
        <div class="stat-top">
          <div class="stat-icon blue"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="icon-pop" d="M5 7.5h13.2l-1.4 8.2H7.4z"/><path class="icon-line" d="M3 4.5h2.2l2.2 11.2h9.4l1.6-8.2H6.3"/><circle class="icon-fill" cx="9" cy="20" r="1.7"/><circle class="icon-fill" cx="16.8" cy="20" r="1.7"/></svg></div>
          <span class="stat-change up">Today</span>
        </div>
        <div class="stat-value">${APP.currency(todayRevenue)}</div>
        <div class="stat-label">Today's Revenue</div>
      </div>
      <div class="stat-card green">
        <div class="stat-top">
          <div class="stat-icon green"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="icon-pop" d="M4 17h16v3H4z"/><path class="icon-line" d="M4 16.5 9 11l3.4 3.2L19.8 6.5"/><path class="icon-fill" d="M17.2 6.2h3.1v3.1z"/></svg></div>
          <span class="stat-change up">This month</span>
        </div>
        <div class="stat-value">${APP.currency(monthRevenue)}</div>
        <div class="stat-label">Monthly Revenue</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-top">
          <div class="stat-icon yellow"><svg viewBox="0 0 24 24" aria-hidden="true"><rect class="icon-fill" x="7" y="3" width="10" height="18" rx="2.2"/><rect x="8.7" y="5.7" width="6.6" height="12.2" rx="1.2" fill="rgba(0,0,0,0.22)"/><circle cx="12" cy="18.9" r="0.9" fill="rgba(0,0,0,0.32)"/></svg></div>
        </div>
        <div class="stat-value">${products}</div>
        <div class="stat-label">Total Products</div>
      </div>
      <div class="stat-card red">
        <div class="stat-top">
          <div class="stat-icon red"><svg viewBox="0 0 24 24" aria-hidden="true"><circle class="icon-fill" cx="9" cy="8" r="4"/><path class="icon-fill" d="M2.8 20.5c.8-4.1 3-6.1 6.2-6.1s5.4 2 6.2 6.1z"/><circle class="icon-pop" cx="17" cy="9" r="3"/><path class="icon-pop" d="M14.4 20.5c.5-2.9 2-4.3 4.3-4.3 1.2 0 2.1.3 2.8 1v3.3z"/></svg></div>
        </div>
        <div class="stat-value">${customers}</div>
        <div class="stat-label">Total Customers</div>
      </div>` + (canSeeProfit ? `
      <div class="stat-card ${netProfit >= 0 ? 'green' : 'red'}">
        <div class="stat-top">
          <div class="stat-icon ${netProfit >= 0 ? 'green' : 'red'}"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
          <span class="stat-change ${netProfit >= 0 ? 'up' : 'down'}">Profit</span>
        </div>
        <div class="stat-value">${APP.currency(netProfit)}</div>
        <div class="stat-label">Net Profit (Month)</div>
      </div>` : '');
  } catch (e) {
    console.error('Stats error:', e);
  }
}

async function loadRecentSales() {
  try {
    const snap = await db.collection('sales').orderBy('createdAt','desc').limit(8).get();
    const tbody = document.getElementById('recent-sales-tbody');
    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state" style="padding:var(--sp-8) var(--sp-4)"><p>No sales yet. <a href="billing.html" class="text-primary">Start billing →</a></p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = snap.docs.map(doc => {
      const d = doc.data();
      const methodColor = { Cash:'blue', UPI:'green', Card:'yellow', 'Credit':'red' }[d.paymentMethod] || 'gray';
      return `<tr>
        <td><span class="td-mono text-primary">${sanitizeText(d.invoiceNo || '--')}</span></td>
        <td>${sanitizeText(d.customerName || 'Walk-in')}</td>
        <td><span class="badge badge-gray">${(d.items||[]).reduce((s,i)=>s+i.quantity,0)} items</span></td>
        <td class="text-mono">${APP.currency(d.total)}</td>
        <td><span class="badge badge-${methodColor}">${sanitizeText(d.paymentMethod||'Cash')}</span></td>
        <td class="text-muted">${APP.fmtDate(d.createdAt)}</td>
        <td><span class="badge badge-green">Completed</span></td>
      </tr>`;
    }).join('');
  } catch (e) { console.error('Recent sales:', e); }
}

async function loadLowStock() {
  try {
    // Can't compare two fields server-side, so pull anything at/under a generous
    // ceiling, then keep only those at/under their own reorder level.
    const snap = await db.collection('products').where('stock', '<=', 50).get();
    const el = document.getElementById('low-stock-list');
    const docs = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => APP.isLowStock(p))
      .sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0));
    if (!docs.length) {
      el.innerHTML = `<div class="empty-state" style="padding:var(--sp-6) var(--sp-2)"><p>All products well-stocked ✓</p></div>`;
      return;
    }
    el.innerHTML = docs.map(d => {
      const stock = Number(d.stock) || 0;
      const level = APP.reorderLevelOf(d);
      const cls = stock === 0 ? 'badge-red' : 'badge-yellow';
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:var(--sp-3) 0;border-bottom:1px solid var(--border);">
        <span style="font-size:var(--fs-sm);">${sanitizeText(d.name)}<span class="text-muted" style="font-size:11px;"> · reorder at ${level}</span></span>
        <span class="badge ${cls}">${stock === 0 ? 'Out of stock' : `${stock} left`}</span>
      </div>`;
    }).join('');
  } catch (e) { console.error('Low stock:', e); }
}

function sanitizeText(str) {
  const d = document.createElement('span');
  d.textContent = str || '';
  return d.innerHTML;
}
