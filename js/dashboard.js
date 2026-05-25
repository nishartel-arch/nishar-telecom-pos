/* =============================================
   NISHAR TELECOM POS — Dashboard Page Logic
   ============================================= */

APP.init({ page: 'dashboard', title: 'Dashboard', onReady: loadDashboard });

async function loadDashboard() {
  await Promise.all([loadStats(), loadRecentSales(), loadLowStock()]);
}

async function loadStats() {
  try {
    const [salesSnap, inventorySnap, customersSnap] = await Promise.all([
      db.collection('sales').get(),
      db.collection('products').get(),
      db.collection('customers').get(),
    ]);

    const today = new Date(); today.setHours(0,0,0,0);
    let todayRevenue = 0, monthRevenue = 0, totalRevenue = 0;
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    salesSnap.forEach(doc => {
      const d = doc.data();
      const t = d.createdAt?.toDate?.() || new Date(0);
      const amt = parseFloat(d.total || 0);
      totalRevenue += amt;
      if (t >= today)      todayRevenue += amt;
      if (t >= monthStart) monthRevenue += amt;
    });

    const products  = inventorySnap.size;
    const customers = customersSnap.size;

    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-card blue">
        <div class="stat-top">
          <div class="stat-icon blue"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
          <span class="stat-change up">Today</span>
        </div>
        <div class="stat-value">${APP.currency(todayRevenue)}</div>
        <div class="stat-label">Today's Revenue</div>
      </div>
      <div class="stat-card green">
        <div class="stat-top">
          <div class="stat-icon green"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
          <span class="stat-change up">This month</span>
        </div>
        <div class="stat-value">${APP.currency(monthRevenue)}</div>
        <div class="stat-label">Monthly Revenue</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-top">
          <div class="stat-icon yellow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>
        </div>
        <div class="stat-value">${products}</div>
        <div class="stat-label">Total Products</div>
      </div>
      <div class="stat-card red">
        <div class="stat-top">
          <div class="stat-icon red"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
        </div>
        <div class="stat-value">${customers}</div>
        <div class="stat-label">Total Customers</div>
      </div>`;
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
    const snap = await db.collection('products').where('stock', '<=', 5).get();
    const el = document.getElementById('low-stock-list');
    if (snap.empty) {
      el.innerHTML = `<div class="empty-state" style="padding:var(--sp-6) var(--sp-2)"><p>All products well-stocked ✓</p></div>`;
      return;
    }
    el.innerHTML = snap.docs.map(doc => {
      const d = doc.data();
      const stock = Number(d.stock) || 0;
      const cls = stock === 0 ? 'badge-red' : 'badge-yellow';
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:var(--sp-3) 0;border-bottom:1px solid var(--border);">
        <span style="font-size:var(--fs-sm);">${sanitizeText(d.name)}</span>
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
