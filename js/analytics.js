/* =============================================
   NISHAR TELECOM POS — Analytics Logic
   ============================================= */
APP.init({ page: 'analytics', title: 'Analytics', onReady: initAnalytics });

let revenueChartInst = null, paymentChartInst = null;

async function initAnalytics() {
  Chart.defaults.color    = '#8FA3BF';
  Chart.defaults.font.family = "'Sora', sans-serif";
  await loadAnalytics();
  document.getElementById('analytics-period').addEventListener('change', loadAnalytics);
}

async function loadAnalytics() {
  const days    = parseInt(document.getElementById('analytics-period').value) || 30;
  const cutoff  = new Date(); cutoff.setDate(cutoff.getDate() - days);

  try {
    const snap = await db.collection('sales').orderBy('createdAt','desc').get();
    const sales = snap.docs.map(d => d.data()).filter(s => {
      const t = s.createdAt?.toDate?.() ?? new Date(0);
      return t >= cutoff;
    });

    buildStats(sales);
    buildRevenueChart(sales, days);
    buildPaymentChart(sales);
    buildTopProducts(sales);
  } catch (e) { APP.toast('Failed to load analytics', 'error'); }
}

function buildStats(sales) {
  const total   = sales.reduce((s,x) => s + parseFloat(x.total||0), 0);
  const discount = sales.reduce((s,x) => s + parseFloat(x.discount||0), 0);
  const items   = sales.reduce((s,x) => s + (x.items||[]).reduce((a,i)=>a+i.quantity,0), 0);
  const avg     = sales.length ? total / sales.length : 0;

  document.getElementById('analytics-stats').innerHTML = `
    <div class="stat-card blue"><div class="stat-top"><div class="stat-icon blue"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div></div>
      <div class="stat-value">${sales.length}</div><div class="stat-label">Transactions</div></div>
    <div class="stat-card green"><div class="stat-top"><div class="stat-icon green"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div></div>
      <div class="stat-value">${APP.currency(total)}</div><div class="stat-label">Net Revenue</div></div>
    <div class="stat-card yellow"><div class="stat-top"><div class="stat-icon yellow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div></div>
      <div class="stat-value">${items}</div><div class="stat-label">Items Sold</div></div>
    <div class="stat-card red"><div class="stat-top"><div class="stat-icon red"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div></div>
      <div class="stat-value">${APP.currency(avg)}</div><div class="stat-label">Avg. Order Value</div></div>`;
}

function buildRevenueChart(sales, days) {
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
  const labels = Object.keys(buckets);
  const values = Object.values(buckets);

  if (revenueChartInst) revenueChartInst.destroy();
  revenueChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: '#4B8BF5',
        backgroundColor: 'rgba(75,139,245,0.08)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#4B8BF5',
      }]
    },
    options: {
      responsive: true, plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { maxTicksLimit: 7 } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { callback: v => '₹' + v.toLocaleString('en-IN') } }
      }
    }
  });
}

function buildPaymentChart(sales) {
  const ctx = document.getElementById('payment-chart').getContext('2d');
  const counts = { Cash: 0, UPI: 0, Card: 0, Credit: 0 };
  sales.forEach(s => { counts[s.paymentMethod] = (counts[s.paymentMethod] || 0) + 1; });
  const labels = Object.keys(counts).filter(k => counts[k] > 0);
  const values = labels.map(k => counts[k]);
  const colors = ['#4B8BF5','#00CFA8','#F5B942','#F5615A'];

  if (paymentChartInst) paymentChartInst.destroy();
  paymentChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#111829' }] },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { padding: 16, boxWidth: 12 } } },
      cutout: '65%'
    }
  });
}

function buildTopProducts(sales) {
  const tbody = document.getElementById('top-products-tbody');
  const empty = document.getElementById('top-empty');
  const productMap = {};
  sales.forEach(s => {
    (s.items || []).forEach(item => {
      const key = item.productId || item.name;
      if (!productMap[key]) productMap[key] = { name: item.name, units: 0, revenue: 0 };
      productMap[key].units   += item.quantity;
      productMap[key].revenue += item.total;
    });
  });
  const sorted = Object.values(productMap).sort((a,b) => b.revenue - a.revenue).slice(0,10);
  if (!sorted.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  tbody.innerHTML = sorted.map((p, i) => `<tr>
    <td style="color:var(--text-muted);">${i + 1}</td>
    <td style="font-weight:500;">${APP.sanitize(p.name)}</td>
    <td class="td-mono">${p.units}</td>
    <td class="td-mono text-success">${APP.currency(p.revenue)}</td>
  </tr>`).join('');
}
