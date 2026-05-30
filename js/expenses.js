/* =============================================
   NISHAR TELECOM POS — Expenses & Profit Logic

   Net Profit (month) = Sales revenue
                        − Stock purchases (from Purchases module)
                        − Operating expenses (logged here)
   ============================================= */
APP.init({ page: 'expenses', title: 'Expenses & Profit', onReady: initExpenses });

const EXPENSE_CATS = ['Rent', 'Electricity', 'Salary', 'Internet', 'Maintenance', 'Transport', 'Marketing', 'Supplies', 'Misc'];
const EXP_COLS = 6;

let monthExpenses = [];     // expenses for the selected month
let lastPnl = null;

/* ── date helpers (local-safe) ─────────────── */
const z = n => String(n).padStart(2, '0');
const toInputDate = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const fromInputDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

function selectedMonthRange() {
  const v = document.getElementById('expense-month').value; // YYYY-MM
  const [y, m] = v.split('-').map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1), label: new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) };
}

async function initExpenses() {
  // Populate category dropdowns
  const opts = EXPENSE_CATS.map(c => `<option value="${c}">${c}</option>`).join('');
  document.getElementById('e-category').innerHTML = opts;
  document.getElementById('expense-cat-filter').innerHTML = '<option value="">All categories</option>' + opts;

  // Default month = current, default expense date = today
  const now = new Date();
  document.getElementById('expense-month').value = `${now.getFullYear()}-${z(now.getMonth() + 1)}`;
  document.getElementById('e-date').value = toInputDate(now);

  bindExpenseEvents();
  await loadMonth();
}

/* ── Load month data + compute P&L ─────────── */
async function loadMonth() {
  const { start, end, label } = selectedMonthRange();
  document.getElementById('expense-tbody').innerHTML = APP.skeletonRows(EXP_COLS, 5);
  document.getElementById('expense-empty').style.display = 'none';
  document.getElementById('pnl-title').textContent = `Profit & Loss — ${label}`;
  document.getElementById('pnl-body').innerHTML = '';

  try {
    const [expSnap, revenue, cogs] = await Promise.all([
      db.collection('expenses').where('date', '>=', start).where('date', '<', end).orderBy('date', 'desc').get(),
      APP.cashCollected(start, end),   // revenue = cash received in the month
      APP.cogsOfSold(start, end),      // cost of the goods actually sold this month
    ]);

    monthExpenses = expSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const opEx = monthExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const net  = revenue - cogs - opEx;

    lastPnl = { revenue, cogs, opEx, net, label };
    renderExpenseStats(lastPnl);
    renderPnl(lastPnl);
    renderExpenses(monthExpenses);
  } catch (e) {
    console.error(e);
    document.getElementById('expense-tbody').innerHTML =
      APP.tableMessage(EXP_COLS, `Couldn't load expenses. <button class="btn btn-secondary" id="exp-retry">Retry</button>`);
    document.getElementById('exp-retry')?.addEventListener('click', loadMonth);
  }
}

/* ── Stat cards ────────────────────────────── */
function renderExpenseStats({ revenue, cogs, opEx, net }) {
  const ic = {
    rupee: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    cart:  '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
    wallet:'<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
    trend: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  };
  const card = (color, icon, value, label) => `
    <div class="stat-card ${color}"><div class="stat-top"><div class="stat-icon ${color}">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icon}</svg>
    </div></div><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
  const netColor = net >= 0 ? 'green' : 'red';
  document.getElementById('expense-stats').innerHTML =
    card('blue',   ic.rupee, APP.currency(revenue), 'Revenue') +
    card('yellow', ic.cart,  APP.currency(cogs),    'Cost of Goods Sold') +
    card('red',    ic.wallet,APP.currency(opEx),    'Operating Expenses') +
    card(netColor, ic.trend, APP.currency(net),     'Net Profit');
}

/* ── P&L breakdown ─────────────────────────── */
function renderPnl({ revenue, cogs, opEx, net }) {
  const margin = revenue > 0 ? (net / revenue) * 100 : 0;
  const line = (label, value, sign, strong) => `
    <div style="display:flex;justify-content:space-between;padding:10px 0;${strong ? 'border-top:2px solid var(--border-mid);margin-top:6px;font-weight:700;font-size:var(--fs-md);' : 'border-bottom:1px solid var(--border-soft);'}">
      <span>${label}</span>
      <span class="td-mono" style="color:${sign === '-' ? 'var(--danger)' : sign === '+' ? 'var(--text)' : (net >= 0 ? 'var(--success)' : 'var(--danger)')};">${sign === '-' ? '−' : ''}${APP.currency(value)}</span>
    </div>`;
  document.getElementById('pnl-body').innerHTML =
    line('Sales revenue', revenue, '+') +
    line('Less: Cost of goods sold', cogs, '-') +
    line('Less: Operating expenses', opEx, '-') +
    line('Net profit', net, '') +
    `<div style="text-align:right;color:var(--text-muted);font-size:12px;margin-top:6px;">Profit margin: ${margin.toFixed(1)}%</div>`;
}

/* ── Table ─────────────────────────────────── */
function renderExpenses(list) {
  const tbody = document.getElementById('expense-tbody');
  const empty = document.getElementById('expense-empty');
  document.getElementById('expense-count').textContent = `${list.length} expense${list.length !== 1 ? 's' : ''}`;
  if (!list.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  const pc = { Cash: 'blue', UPI: 'green', Card: 'yellow', Bank: 'gray' };
  const canManage = APP.can('expenses.manage');
  tbody.innerHTML = list.map(e => `<tr>
    <td class="text-muted">${APP.fmtDate(e.date)}</td>
    <td><span class="badge badge-blue">${APP.sanitize(e.category || 'Misc')}</span></td>
    <td>${APP.sanitize(e.description || '--')}</td>
    <td><span class="badge badge-${pc[e.paymentMethod] || 'gray'}">${APP.sanitize(e.paymentMethod || 'Cash')}</span></td>
    <td class="td-mono" style="font-weight:600;">${APP.currency(e.amount)}</td>
    <td class="td-actions">
      ${canManage ? `<button class="btn btn-secondary btn-icon" data-action="edit" data-id="${e.id}" title="Edit">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="btn btn-danger btn-icon" data-action="delete" data-id="${e.id}" title="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>` : '<span class="text-muted" style="font-size:11px;">—</span>'}
    </td>
  </tr>`).join('');
}

function filterExpenses() {
  const cat = document.getElementById('expense-cat-filter').value;
  renderExpenses(cat ? monthExpenses.filter(e => e.category === cat) : monthExpenses);
}

/* ── Add / Edit / Delete ───────────────────── */
function openAddExpense() {
  document.getElementById('expense-modal-title').textContent = 'Add Expense';
  document.getElementById('expense-id').value = '';
  document.getElementById('e-category').value = EXPENSE_CATS[0];
  document.getElementById('e-amount').value = '';
  document.getElementById('e-date').value = toInputDate(new Date());
  document.getElementById('e-payment').value = 'Cash';
  document.getElementById('e-description').value = '';
  APP.openModal('expense-modal');
}

function openEditExpense(id) {
  const e = monthExpenses.find(x => x.id === id); if (!e) return;
  document.getElementById('expense-modal-title').textContent = 'Edit Expense';
  document.getElementById('expense-id').value = id;
  document.getElementById('e-category').value = e.category || EXPENSE_CATS[0];
  document.getElementById('e-amount').value = e.amount || '';
  document.getElementById('e-date').value = e.date?.toDate ? toInputDate(e.date.toDate()) : toInputDate(new Date());
  document.getElementById('e-payment').value = e.paymentMethod || 'Cash';
  document.getElementById('e-description').value = e.description || '';
  APP.openModal('expense-modal');
}

async function saveExpense() {
  const id       = document.getElementById('expense-id').value;
  const category = document.getElementById('e-category').value;
  const amount   = parseFloat(document.getElementById('e-amount').value) || 0;
  const dateStr  = document.getElementById('e-date').value;
  const payment  = document.getElementById('e-payment').value;
  const desc     = document.getElementById('e-description').value.trim();

  if (!category)      { APP.toast('Category is required', 'warning'); return; }
  if (amount <= 0)    { APP.toast('Amount must be greater than 0', 'warning'); return; }
  if (!dateStr)       { APP.toast('Date is required', 'warning'); return; }

  const btn = document.getElementById('save-expense-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…';
  try {
    const data = {
      category, amount,
      date: firebase.firestore.Timestamp.fromDate(fromInputDate(dateStr)),
      paymentMethod: payment, description: desc,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (id) {
      await db.collection('expenses').doc(id).update(data);
      APP.audit('expense.update', { id, category, amount });
      APP.toast('Expense updated', 'success');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      data.createdBy = auth.currentUser?.uid || 'unknown';
      const ref = await db.collection('expenses').add(data);
      APP.audit('expense.create', { id: ref.id, category, amount });
      APP.toast('Expense added', 'success');
    }
    APP.closeModal('expense-modal');
    await loadMonth();
  } catch (e) {
    console.error(e);
    APP.toast('Failed to save expense', 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'Save Expense';
  }
}

function deleteExpense(id) {
  const e = monthExpenses.find(x => x.id === id);
  APP.showConfirm({
    title: 'Delete Expense',
    message: `Delete this ${e?.category || ''} expense of ${APP.currency(e?.amount || 0)}? This cannot be undone.`,
    type: 'danger', confirmText: 'Delete',
    onConfirm: async () => {
      try {
        await db.collection('expenses').doc(id).delete();
        APP.audit('expense.delete', { id, category: e?.category, amount: e?.amount });
        APP.toast('Expense deleted');
        await loadMonth();
      } catch (err) { APP.toast('Delete failed', 'error'); }
    }
  });
}

/* ── Events ────────────────────────────────── */
function bindExpenseEvents() {
  document.getElementById('add-expense-btn')?.addEventListener('click', openAddExpense);
  document.getElementById('close-expense-modal').addEventListener('click', () => APP.closeModal('expense-modal'));
  document.getElementById('cancel-expense-modal').addEventListener('click', () => APP.closeModal('expense-modal'));
  document.getElementById('save-expense-btn').addEventListener('click', saveExpense);
  document.getElementById('expense-month').addEventListener('change', loadMonth);
  document.getElementById('expense-cat-filter').addEventListener('change', filterExpenses);
  document.getElementById('expense-tbody').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]'); if (!btn) return;
    if (btn.dataset.action === 'edit')   openEditExpense(btn.dataset.id);
    if (btn.dataset.action === 'delete') deleteExpense(btn.dataset.id);
  });
}

/* =============================================
   Export to Excel (SheetJS)
   ============================================= */
function exportExpensesToExcel() {
  if (typeof XLSX === 'undefined') { APP.toast('Spreadsheet library still loading — try again in a moment', 'warning'); return; }
  if (!monthExpenses.length)        { APP.toast('No expenses to export for this month', 'warning'); return; }
  const { label } = selectedMonthRange();

  const rows = monthExpenses
    .slice()
    .sort((a, b) => (a.date?.toDate?.() || 0) - (b.date?.toDate?.() || 0))
    .map(e => ({
      Date:        e.date?.toDate?.()?.toLocaleDateString('en-IN') || '',
      Category:    e.category || 'Misc',
      Description: e.description || '',
      Payment:     e.paymentMethod || '',
      Amount:      parseFloat(e.amount || 0),
    }));

  // P&L summary sheet (uses the figures already computed for the page)
  const pnl = lastPnl || { revenue: 0, cogs: 0, opEx: 0, net: 0 };
  const summary = [
    [`Profit & Loss — ${label}`],
    [],
    ['Sales revenue',            pnl.revenue],
    ['Less: Cost of goods sold', -pnl.cogs],
    ['Less: Operating expenses', -pnl.opEx],
    ['Net profit',               pnl.net],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary),    'P&L Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows),      'Expenses');
  XLSX.writeFile(wb, `nishar-expenses-${label.replace(/ /g,'-').toLowerCase()}.xlsx`);
  APP.audit('expense.export', { month: label, count: rows.length });
  APP.toast(`Exported ${rows.length} expenses`, 'success');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('export-expenses-btn')?.addEventListener('click', exportExpensesToExcel);
});
