/* =============================================
   NISHAR TELECOM POS — CSC Module
   Logs Common Service Centre work (Aadhaar, PAN,
   certificates, banking) with per-service commission
   and a status workflow, since these jobs often span
   days unlike instant recharges.
   ============================================= */
APP.init({ page: 'csc', title: 'CSC Services', onReady: initCsc });

const CSC_COLS = 8;
let monthServices = [];   // this month's services (stats + breakdown)
let editingCscId  = null; // set when editing an existing service

function cscMonthStart() {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
}

async function initCsc() {
  bindCscEvents();
  await loadServices();
}

async function loadServices() {
  document.getElementById('csc-tbody').innerHTML = APP.skeletonRows(CSC_COLS, 5);
  document.getElementById('csc-empty').style.display = 'none';
  try {
    // This month only — single-field range, auto-indexed.
    const snap = await db.collection('cscServices')
      .where('createdAt', '>=', cscMonthStart())
      .orderBy('createdAt', 'desc')
      .get();
    monthServices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCscStats();
    renderServiceTable();
    applyCscFilters();
  } catch (e) {
    console.error(e);
    document.getElementById('csc-tbody').innerHTML =
      APP.tableMessage(CSC_COLS, `Couldn't load services. <button class="btn btn-secondary" id="csc-retry">Retry</button>`);
    document.getElementById('csc-retry')?.addEventListener('click', loadServices);
  }
}

function renderCscStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let todayCount = 0, todayComm = 0, monthComm = 0, pending = 0;
  monthServices.forEach(s => {
    const t = s.createdAt?.toDate?.() || new Date(0);
    const comm = parseFloat(s.commission || 0);
    monthComm += comm;
    if (s.status === 'Pending' || s.status === 'In Progress') pending++;
    if (t >= todayStart) { todayCount++; todayComm += comm; }
  });

  const card = (color, icon, value, label) => `
    <div class="stat-card ${color}"><div class="stat-top"><div class="stat-icon ${color}">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icon}</svg>
    </div></div><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
  const rupee = '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>';
  const card2 = '<rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M5 16a3 3 0 0 1 6 0"/>';
  const clock = '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>';
  document.getElementById('csc-stats').innerHTML =
    card('blue',   card2, todayCount,               "Today's Services") +
    card('green',  rupee, APP.currency(todayComm),  "Today's Commission") +
    card('yellow', rupee, APP.currency(monthComm),  'Commission (Month)') +
    card('red',    clock, pending,                  'Pending / In Progress');
}

function renderServiceTable() {
  const byService = {};
  monthServices.forEach(s => {
    const k = s.service || 'Other';
    if (!byService[k]) byService[k] = { count: 0, charged: 0, comm: 0 };
    byService[k].count++;
    byService[k].charged += parseFloat(s.charge || 0);
    byService[k].comm    += parseFloat(s.commission || 0);
  });
  const rows = Object.entries(byService).sort((a, b) => b[1].comm - a[1].comm);
  const tbody = document.getElementById('csc-service-tbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-muted" style="text-align:center;padding:18px;">No services yet this month</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(([k, d]) => `<tr>
    <td style="font-weight:500;">${APP.sanitize(k)}</td>
    <td class="td-mono">${d.count}</td>
    <td class="td-mono">${APP.currency(d.charged)}</td>
    <td class="td-mono text-success">${APP.currency(d.comm)}</td>
  </tr>`).join('');
}

function applyCscFilters() {
  const term   = (document.getElementById('csc-search').value || '').toLowerCase().trim();
  const svc    = document.getElementById('csc-service-filter').value;
  const status = document.getElementById('csc-status-filter').value;
  const list = monthServices.filter(s => {
    const hay = `${s.customerName || ''} ${s.customerPhone || ''} ${s.refNo || ''}`.toLowerCase();
    const matchTerm   = !term || hay.includes(term);
    const matchSvc    = !svc || s.service === svc;
    const matchStatus = !status || s.status === status;
    return matchTerm && matchSvc && matchStatus;
  });
  renderServices(list);
}

function statusBadge(status) {
  const map = {
    'Pending':     'background:var(--warning-bg, rgba(234,179,8,0.15));color:var(--warning, #EAB308);',
    'In Progress': 'background:var(--info-bg, rgba(56,189,248,0.15));color:var(--info, #38BDF8);',
    'Completed':   'background:var(--success-bg, rgba(34,197,94,0.15));color:var(--success, #22C55E);',
    'Rejected':    'background:var(--danger-bg, rgba(239,68,68,0.15));color:var(--danger, #EF4444);',
  };
  const css = map[status] || map['Pending'];
  return `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:600;${css}">${APP.sanitize(status || 'Pending')}</span>`;
}

function renderServices(list) {
  const tbody = document.getElementById('csc-tbody');
  const empty = document.getElementById('csc-empty');
  document.getElementById('csc-count').textContent = `${list.length} service${list.length === 1 ? '' : 's'}`;
  if (!list.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  const canEdit   = APP.can('csc');
  const canDelete = APP.role() === 'owner' || APP.role() === 'manager';
  tbody.innerHTML = list.map(s => {
    const when = s.createdAt?.toDate?.() ? s.createdAt.toDate().toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '';
    return `<tr>
      <td style="font-weight:500;">${APP.sanitize(s.service || 'Other')}</td>
      <td>${APP.sanitize(s.customerName || '--')}${s.customerPhone ? `<div class="text-muted" style="font-size:11px;">${APP.sanitize(s.customerPhone)}</div>` : ''}</td>
      <td class="td-mono">${APP.sanitize(s.refNo || '--')}</td>
      <td class="td-mono">${APP.currency(s.charge)}</td>
      <td class="td-mono text-success">${APP.currency(s.commission)}</td>
      <td>${statusBadge(s.status)}</td>
      <td class="text-muted">${when}</td>
      <td class="td-actions">
        ${canEdit ? `<button class="btn btn-secondary btn-icon" data-edit="${s.id}" title="Edit / update status">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>` : ''}
        ${canDelete ? `<button class="btn btn-danger btn-icon" data-del="${s.id}" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

/* ── Add / edit service ────────────────────── */
function openCscModal(existing) {
  editingCscId = existing ? existing.id : null;
  document.getElementById('csc-modal-title').textContent = existing ? 'Update CSC Service' : 'New CSC Service';
  document.getElementById('save-csc-btn').textContent    = existing ? 'Save Changes' : 'Save Service';
  document.getElementById('cs-service').value    = existing?.service    || 'Aadhaar Update';
  document.getElementById('cs-status').value     = existing?.status     || 'Pending';
  document.getElementById('cs-name').value       = existing?.customerName  || '';
  document.getElementById('cs-phone').value      = existing?.customerPhone || '';
  document.getElementById('cs-ref').value        = existing?.refNo       || '';
  document.getElementById('cs-charge').value     = existing?.charge      ?? '';
  document.getElementById('cs-govtfee').value    = existing?.govtFee     ?? '';
  document.getElementById('cs-commission').value = existing?.commission  ?? '';
  document.getElementById('cs-payment').value    = existing?.paymentMethod || 'Cash';
  document.getElementById('cs-note').value       = existing?.note        || '';
  APP.openModal('csc-modal');
}

// Auto-fill commission as (charge − govt fee) unless the user has typed one.
function recalcCscCommission() {
  const charge  = parseFloat(document.getElementById('cs-charge').value) || 0;
  const govtFee = parseFloat(document.getElementById('cs-govtfee').value) || 0;
  const margin  = Math.max(0, charge - govtFee);
  document.getElementById('cs-commission').value = margin.toFixed(2);
}

async function saveCscService() {
  const service    = document.getElementById('cs-service').value;
  const status     = document.getElementById('cs-status').value;
  const name       = document.getElementById('cs-name').value.trim();
  const phone      = document.getElementById('cs-phone').value.trim();
  const refNo      = document.getElementById('cs-ref').value.trim();
  const charge     = parseFloat(document.getElementById('cs-charge').value) || 0;
  const govtFee    = parseFloat(document.getElementById('cs-govtfee').value) || 0;
  const commission = parseFloat(document.getElementById('cs-commission').value) || 0;
  const payment    = document.getElementById('cs-payment').value;
  const note       = document.getElementById('cs-note').value.trim();

  if (charge <= 0) { APP.toast('Enter the amount charged to the customer', 'warning'); return; }

  const btn = document.getElementById('save-csc-btn');
  const original = btn.textContent;
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…';
  try {
    if (editingCscId) {
      await db.collection('cscServices').doc(editingCscId).update({
        service, status, customerName: name, customerPhone: phone, refNo,
        charge, govtFee, commission, paymentMethod: payment, note,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      APP.audit('csc.update', { id: editingCscId, service, status, commission });
      APP.toast('Service updated', 'success');
    } else {
      await db.collection('cscServices').add({
        service, status, customerName: name, customerPhone: phone, refNo,
        charge, govtFee, commission, paymentMethod: payment, note,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.currentUser?.uid || 'unknown',
      });
      APP.audit('csc.create', { service, status, charge, commission });
      APP.toast(`${service} logged — ${APP.currency(commission)} commission`, 'success');
    }
    APP.closeModal('csc-modal');
    editingCscId = null;
    await loadServices();
  } catch (e) {
    console.error(e);
    APP.toast('Could not save service', 'error');
  } finally {
    btn.disabled = false; btn.textContent = original;
  }
}

function deleteCscService(id) {
  const s = monthServices.find(x => x.id === id); if (!s) return;
  APP.showConfirm({
    title: 'Delete service',
    message: `Delete this ${APP.sanitize(s.service || 'service')} record? This also removes its commission from your totals.`,
    type: 'danger', confirmText: 'Delete',
    onConfirm: async () => {
      try {
        await db.collection('cscServices').doc(id).delete();
        APP.audit('csc.delete', { service: s.service, commission: s.commission });
        APP.toast('Service deleted');
        await loadServices();
      } catch (err) { APP.toast('Delete failed', 'error'); }
    }
  });
}

/* ── Events ────────────────────────────────── */
function bindCscEvents() {
  document.getElementById('add-csc-btn')?.addEventListener('click', () => openCscModal(null));
  document.getElementById('close-csc-modal').addEventListener('click', () => APP.closeModal('csc-modal'));
  document.getElementById('cancel-csc-modal').addEventListener('click', () => APP.closeModal('csc-modal'));
  document.getElementById('save-csc-btn').addEventListener('click', saveCscService);

  // Live commission calc from charge − govt fee
  document.getElementById('cs-charge').addEventListener('input', recalcCscCommission);
  document.getElementById('cs-govtfee').addEventListener('input', recalcCscCommission);

  document.getElementById('csc-tbody').addEventListener('click', e => {
    const edit = e.target.closest('[data-edit]');
    const del  = e.target.closest('[data-del]');
    if (edit) openCscModal(monthServices.find(x => x.id === edit.dataset.edit));
    if (del)  deleteCscService(del.dataset.del);
  });

  const search = APP.debounce(applyCscFilters, 250);
  document.getElementById('csc-search').addEventListener('input', search);
  document.getElementById('csc-service-filter').addEventListener('change', applyCscFilters);
  document.getElementById('csc-status-filter').addEventListener('change', applyCscFilters);
}
