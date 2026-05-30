/* =============================================
   NISHAR TELECOM POS — Settings
   Owner-only. Edits the single /config/shop doc
   that drives business info on receipts.
   ============================================= */
APP.init({ page: 'settings', title: 'Settings', onReady: initSettings });

async function initSettings() {
  bindSettingsEvents();
  renderThemePicker();
  await loadConfig();
  renderBackupStatus();
}

function renderThemePicker() {
  const container = document.getElementById('settings-theme-picker');
  if (!container) return;
  const labels = { blue: 'Blue', purple: 'Purple', dark: 'Dark', ocean: 'Ocean', light: 'Light' };
  const current = APP.getTheme();
  container.innerHTML = APP.THEMES.map(t => `
    <button class="settings-theme-btn ${t === current ? 'active' : ''}" data-theme="${t}" title="${labels[t]}">
      <span class="settings-theme-dot ${t}"></span>
      <span>${labels[t]}</span>
    </button>`).join('');
  container.addEventListener('click', e => {
    const btn = e.target.closest('[data-theme]');
    if (!btn) return;
    APP.setTheme(btn.dataset.theme);
    container.querySelectorAll('.settings-theme-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.theme === btn.dataset.theme));
  });
}

/* ── Backup status nudge ───────────────────── */
// Client-only PWAs can't run true unattended scheduled exports (that needs a
// Cloud Function). Instead we track the last manual backup and nudge when stale.
function renderBackupStatus() {
  const el = document.getElementById('backup-status');
  if (!el) return;
  const last = localStorage.getItem('pos-last-backup');
  if (!last) {
    el.style.background = 'var(--danger-bg)'; el.style.color = 'var(--text)';
    el.innerHTML = '⚠️ No backup has been downloaded on this device yet. Download one now and keep it somewhere safe.';
    return;
  }
  const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
  const when = new Date(last).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  if (days >= 7) {
    el.style.background = 'var(--warning-bg, rgba(234,179,8,0.12))'; el.style.color = 'var(--text)';
    el.innerHTML = `⏰ Last backup was <strong>${days} day${days === 1 ? '' : 's'} ago</strong> (${when}). Consider downloading a fresh one.`;
  } else {
    el.style.background = 'var(--success-bg, rgba(34,197,94,0.12))'; el.style.color = 'var(--text)';
    el.innerHTML = `✓ Last backup: ${when} (${days === 0 ? 'today' : days + ' day' + (days === 1 ? '' : 's') + ' ago'}).`;
  }
}

let pendingRestore = null;   // parsed backup awaiting confirmation

// Recursively rebuild Firestore Timestamps that JSON turned into {seconds,nanoseconds}.
function reviveValue(v) {
  if (v && typeof v === 'object') {
    if (typeof v.seconds === 'number' && typeof v.nanoseconds === 'number')
      return new firebase.firestore.Timestamp(v.seconds, v.nanoseconds);
    if (typeof v._seconds === 'number' && typeof v._nanoseconds === 'number')
      return new firebase.firestore.Timestamp(v._seconds, v._nanoseconds);
    if (Array.isArray(v)) return v.map(reviveValue);
    const o = {}; for (const k in v) o[k] = reviveValue(v[k]); return o;
  }
  return v;
}

function previewRestore() {
  const fileInput = document.getElementById('restore-file');
  const file = fileInput.files && fileInput.files[0];
  if (!file) { APP.toast('Choose a backup file first', 'warning'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); }
    catch (e) { APP.toast('That file is not valid JSON', 'error'); return; }
    if (!data || typeof data.collections !== 'object') {
      APP.toast('This does not look like a Nishar POS backup', 'error'); return;
    }
    pendingRestore = data;
    const rows = Object.entries(data.collections)
      .map(([c, arr]) => `<tr><td style="padding:3px 16px 3px 0;">${APP.sanitize(c)}</td><td class="td-mono">${Array.isArray(arr) ? arr.length : 0} records</td></tr>`)
      .join('');
    const exportedAt = data.exportedAt ? new Date(data.exportedAt).toLocaleString('en-IN') : 'unknown date';
    document.getElementById('restore-summary').innerHTML =
      `<div style="margin-bottom:8px;">Backup from <strong>${APP.sanitize(exportedAt)}</strong> contains:</div>
       <table style="font-size:13px;">${rows}</table>`;
    document.getElementById('restore-confirm-text').value = '';
    document.getElementById('run-restore-btn').disabled = true;
    document.getElementById('restore-preview').style.display = 'block';
  };
  reader.onerror = () => APP.toast('Could not read that file', 'error');
  reader.readAsText(file);
}

async function runRestore() {
  if (!pendingRestore) return;
  if (document.getElementById('restore-confirm-text').value.trim() !== 'RESTORE') {
    APP.toast('Type RESTORE to confirm', 'warning'); return;
  }
  const btn = document.getElementById('run-restore-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Restoring…';

  let written = 0;
  const okCols = [], failedCols = [];
  try {
    for (const [col, arr] of Object.entries(pendingRestore.collections)) {
      if (!Array.isArray(arr) || !arr.length) continue;
      try {
        let batch = db.batch(), ops = 0;
        for (const raw of arr) {
          const { id, ...rest } = raw;
          if (!id) continue;
          const data = reviveValue(rest);
          batch.set(db.collection(col).doc(String(id)), data);   // full overwrite of this doc
          ops++;
          if (ops >= 450) { await batch.commit(); batch = db.batch(); ops = 0; }
        }
        if (ops > 0) await batch.commit();
        written += arr.length; okCols.push(col);
      } catch (colErr) {
        // Append-only collections (refunds, duePayments, supplierPayments) reject
        // overwriting an existing doc by security-rule design — that collection is
        // skipped, the rest continue. Expected when restoring over live data.
        console.warn(`Restore skipped "${col}":`, colErr);
        failedCols.push(col);
      }
    }
    APP.clearShopConfigCache();
    APP.audit('backup.restore', { records: written, restored: okCols, skipped: failedCols });
    if (failedCols.length) {
      APP.toast(`Restored ${written} records. Skipped: ${failedCols.join(', ')} (already-present append-only records).`, 'warning');
    } else {
      APP.toast(`Restore complete — ${written} records written`, 'success');
    }
    document.getElementById('restore-preview').style.display = 'none';
    document.getElementById('restore-file').value = '';
    pendingRestore = null;
  } catch (e) {
    console.error(e);
    APP.toast('Restore failed', 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'Restore Data';
  }
}

async function loadConfig() {
  APP.clearShopConfigCache();
  const c = await APP.shopConfig();
  document.getElementById('cfg-name').value    = c.name || '';
  document.getElementById('cfg-phone').value   = c.phone || '';
  document.getElementById('cfg-email').value   = c.email || '';
  document.getElementById('cfg-state').value   = c.state || '';
  document.getElementById('cfg-address').value = c.address || '';
  document.getElementById('cfg-thermal-width').value = c.thermalWidth || '80';
}

async function saveSettings() {
  const name = document.getElementById('cfg-name').value.trim();
  if (!name) { APP.toast('Shop name is required', 'warning'); return; }

  const data = {
    name,
    phone:     document.getElementById('cfg-phone').value.trim(),
    email:     document.getElementById('cfg-email').value.trim(),
    state:     document.getElementById('cfg-state').value.trim(),
    address:   document.getElementById('cfg-address').value.trim(),
    thermalWidth: document.getElementById('cfg-thermal-width').value || '80',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: auth.currentUser?.uid || 'unknown',
  };

  const btn = document.getElementById('save-settings-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…';
  try {
    await db.collection('config').doc('shop').set(data, { merge: true });
    APP.clearShopConfigCache();
    APP.audit('settings.update', { fields: Object.keys(data) });
    APP.toast('Settings saved', 'success');
  } catch (e) {
    console.error(e);
    APP.toast('Save failed', 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'Save Settings';
  }
}

function bindSettingsEvents() {
  document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
  document.getElementById('reset-settings-btn').addEventListener('click', loadConfig);

  // Backup & restore
  document.getElementById('download-backup-btn').addEventListener('click', async () => {
    const ok = await APP.backup();
    if (ok) renderBackupStatus();
  });
  document.getElementById('preview-restore-btn').addEventListener('click', previewRestore);
  document.getElementById('restore-confirm-text').addEventListener('input', e => {
    document.getElementById('run-restore-btn').disabled = e.target.value.trim() !== 'RESTORE';
  });
  document.getElementById('run-restore-btn').addEventListener('click', runRestore);
}
