/* =============================================
   NISHAR TELECOM POS — Analytics Logic
   Profit-aware, period-bounded queries.
   ============================================= */
APP.init({ page: 'analytics', title: 'Analytics', onReady: initAnalytics });

let revenueChartInst = null, paymentChartInst = null;
let perProductCache  = [];   // computed per-product P&L for the current period

const cssVar = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

async function initAnalytics() {
  Chart.defaults.color    = cssVar('--text-dim') || '#8FA3BF';
  Chart.defaults.font.family = "'Sora', sans-serif";
  await loadAnalytics();
  document.getElementById('analytics-period').addEventListener('change', loadAnalytics);
  document.getElementById('top-sort').addEventListener('change', () => renderTopProducts(perProductCache));
}

async function loadAnalytics() {
  const days   = parseInt(document.getElementById('analytics-period').value) || 30;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);

  // Skeleton states while loading
  document.getElementById('top-products-tbody').innerHTML = APP.skeletonRows(6, 5);
  document.getElementById('dead-stock-tbody').innerHTML   = APP.skeletonRows(5, 4);

  try {
    // All bounded by the selected window or naturally small (products).
    // Single-field range/orderBy → no composite index needed.
    const [salesSnap, productsSnap, expSnap, cashRevenue, cogs] = await Promise.all([
      db.collection('sales').where('createdAt', '>=', cutoff).orderBy('createdAt', 'desc').get(),
      db.collection('products').get(),
      db.collection('expenses').where('date', '>=', cutoff).get(),
      APP.cashCollected(cutoff),   // revenue = cash received in the window
      APP.cogsOfSold(cutoff),      // cost of goods sold in the window
    ]);

    const sales    = salesSnap.docs.map(d => d.data());
    const products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const operatingExpenses  = expSnap.docs.reduce((s, d) => s + parseFloat(d.data().amount || 0), 0);

    perProductCache = computePerProduct(sales, products);

    renderStats(sales, cashRevenue, cogs, operatingExpenses);
    renderRevenueChart(sales, days);
    renderPaymentChart(sales);
    renderTopProducts(perProductCache);
    renderDeadStock(products, sales);
  } catch (e) {
    console.error(e);
    APP.toast('Failed to load analytics', 'error');
    document.getElementById('top-products-tbody').innerHTML =
      APP.tableMessage(6, `Couldn't load analytics. <button class="btn btn-secondary" id="an-retry">Retry</button>`);
    document.getElementById('an-retry')?.addEventListener('click', loadAnalytics);
  }
}

/* ── Stat cards (now includes Net Profit) ───── */
function renderStats(sales, revenue, cogs, operatingExpenses) {
  // `revenue` is already cash actually received in the window. Units sold are
  // reported net of refunds. Net profit subtracts cost of goods sold + expenses.
  const items   = sales.reduce((s, x) => {
    const sold     = (x.items || []).reduce((a, i) => a + i.quantity, 0);
    const refunded = Object.values(x.refundedQtyByProduct || {}).reduce((a, q) => a + parseFloat(q || 0), 0);
    return s + Math.max(0, sold - refunded);
  }, 0);
  const net     = revenue - cogs - operatingExpenses;
  const ic = {
    tx:    '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    rupee: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    box:   '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',
  };
  const card = (color, icon, value, label) => `
    <div class="stat-card ${color}"><div class="stat-top"><div class="stat-icon ${color}">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icon}</svg>
    </div></div><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
  const netColor = net >= 0 ? 'green' : 'red';
  document.getElementById('analytics-stats').innerHTML =
    card('blue',   ic.tx,    sales.length,         'Transactions') +
    card('green',  ic.rupee, APP.currency(revenue),'Revenue') +
    card('yellow', ic.box,   items,                'Items Sold') +
    card(netColor, ic.rupee, APP.currency(net),    'Net Profit');
}

/* ── Per-product P&L (revenue, COGS, profit, margin) ── */
function computePerProduct(sales, products) {
  const pMap = {};
  products.forEach(p => { pMap[p.id] = p; });

  const acc = {};
  sales.forEach(s => {
    const refundedByProduct = s.refundedQtyByProduct || {};
    (s.items || []).forEach(item => {
      const key = item.productId || ('NAME:' + item.name);
      if (!acc[key]) acc[key] = { id: item.productId || null, name: item.name, units: 0, revenue: 0, cogs: 0 };
      // Net out any returned units so per-product revenue/COGS/profit reflect
      // only what the customer actually kept.
      const refundedQty = item.productId ? parseFloat(refundedByProduct[item.productId] || 0) : 0;
      const netQty      = Math.max(0, item.quantity - refundedQty);
      acc[key].units   += netQty;
      acc[key].revenue += parseFloat(item.price || 0) * netQty;
      // Prefer the buyPrice snapshotted on the sale line (exact for that point
      // in time). Fall back to the product's current buyPrice for older sales
      // that pre-date the snapshot field.
      const buy = (item.buyPrice !== undefined && item.buyPrice !== null && item.buyPrice !== '')
        ? parseFloat(item.buyPrice)
        : (item.productId && pMap[item.productId] ? parseFloat(pMap[item.productId].buyPrice || 0) : 0);
      acc[key].cogs += buy * netQty;
    });
  });

  return Object.values(acc).map(s => {
    const profit = s.revenue - s.cogs;
    const margin = s.revenue > 0 ? (profit / s.revenue) * 100 : 0;
    return { ...s, profit, margin };
  });
}

function renderTopProducts(rows) {
  const tbody = document.getElementById('top-products-tbody');
  const empty = document.getElementById('top-empty');
  if (!rows.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  const key = document.getElementById('top-sort').value || 'profit';
  const sorted = rows.slice().sort((a, b) => (b[key] || 0) - (a[key] || 0)).slice(0, 15);
  tbody.innerHTML = sorted.map((p, i) => {
    const marginColor = p.margin >= 30 ? 'text-success' : p.margin >= 10 ? '' : 'text-warning';
    const profitColor = p.profit >= 0 ? 'text-success' : 'text-warning';
    return `<tr>
      <td class="text-muted">${i + 1}</td>
      <td style="font-weight:500;">${APP.sanitize(p.name)}</td>
      <td class="td-mono">${p.units}</td>
      <td class="td-mono">${APP.currency(p.revenue)}</td>
      <td class="td-mono ${profitColor}">${APP.currency(p.profit)}</td>
      <td class="td-mono ${marginColor}">${p.margin.toFixed(1)}%</td>
    </tr>`;
  }).join('');
}

/* ── Dead stock: in stock + zero sales in window ── */
function renderDeadStock(products, sales) {
  const tbody = document.getElementById('dead-stock-tbody');
  const empty = document.getElementById('dead-stock-empty');
  const summary = document.getElementById('dead-stock-summary');

  const soldIds = new Set();
  sales.forEach(s => (s.items || []).forEach(i => i.productId && soldIds.add(i.productId)));

  const dead = products
    .filter(p => !p.isService && (p.stock || 0) > 0 && !soldIds.has(p.id))
    .map(p => ({ ...p, tied: (p.stock || 0) * parseFloat(p.buyPrice || 0) }))
    .sort((a, b) => b.tied - a.tied)
    .slice(0, 20);

  const totalTied = dead.reduce((s, p) => s + p.tied, 0);
  summary.textContent = dead.length
    ? `${dead.length} item${dead.length === 1 ? '' : 's'} · ${APP.currency(totalTied)} tied up`
    : '';

  if (!dead.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  tbody.innerHTML = dead.map((p, i) => `<tr>
    <td class="text-muted">${i + 1}</td>
    <td style="font-weight:500;">${APP.sanitize(p.name)}</td>
    <td class="text-muted">${APP.sanitize(p.category || '--')}</td>
    <td class="td-mono">${p.stock}</td>
    <td class="td-mono text-warning">${APP.currency(p.tied)}</td>
  </tr>`).join('');
}

/* ── Charts (revenue trend + payment methods) ── */
function renderRevenueChart(sales, days) {
  const ctx = document.getElementById('revenue-chart').getContext('2d');
  const buckets = {};
  for (let i = Math.min(days, 30) - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    buckets[d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' })] = 0;
  }
  sales.forEach(s => {
    const t  = s.createdAt?.toDate?.() ?? new Date();
    const key = t.toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
    if (buckets[key] !== undefined) buckets[key] += parseFloat(s.total || 0);
  });

  if (revenueChartInst) revenueChartInst.destroy();
  const accent = cssVar('--primary') || '#A66BFF';
  const gridColor = cssVar('--border') || 'rgba(255,255,255,0.06)';
  revenueChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Object.keys(buckets),
      datasets: [{
        data: Object.values(buckets),
        borderColor: accent,
        backgroundColor: cssVar('--primary-bg') || 'rgba(166,107,255,0.12)',
        borderWidth: 2, fill: true, tension: 0.4,
        pointRadius: 3, pointBackgroundColor: accent,
      }]
    },
    options: {
      responsive: true, plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor }, ticks: { maxTicksLimit: 7 } },
        y: { grid: { color: gridColor }, ticks: { callback: v => '₹' + v.toLocaleString('en-IN') } }
      }
    }
  });
}

function renderPaymentChart(sales) {
  const ctx = document.getElementById('payment-chart').getContext('2d');
  const counts = { Cash: 0, UPI: 0, Card: 0, Credit: 0 };
  sales.forEach(s => { counts[s.paymentMethod] = (counts[s.paymentMethod] || 0) + 1; });
  const labels = Object.keys(counts).filter(k => counts[k] > 0);
  const values = labels.map(k => counts[k]);
  const colors = [
    cssVar('--primary') || '#A66BFF',
    cssVar('--success') || '#2DD4BF',
    cssVar('--info')    || '#38BDF8',
    cssVar('--danger')  || '#FB5E7E'
  ];

  if (paymentChartInst) paymentChartInst.destroy();
  paymentChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: 'transparent' }] },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { padding: 16, boxWidth: 12 } } },
      cutout: '65%'
    }
  });
}
