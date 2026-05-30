/* =============================================
   NISHAR TELECOM POS — Users & Roles
   Owner-only. Promotes, disables, or removes the
   role profiles in /users/{uid}.

   Note: this never touches the Firebase Auth user.
   Deleting here only removes the role doc (which
   locks them out of the app on next reload).
   ============================================= */
APP.init({ page: 'users', title: 'Users & Roles', onReady: initUsers });

const USER_COLS = 6;
let allUsers = [];

async function initUsers() {
  bindUserEvents();
  await loadUsers();
}

async function loadUsers() {
  document.getElementById('user-tbody').innerHTML = APP.skeletonRows(USER_COLS, 4);
  document.getElementById('user-empty').style.display = 'none';
  try {
    const snap = await db.collection('users').get();
    allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
                        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    renderUserStats();
    renderUsers(allUsers);
  } catch (e) {
    console.error(e);
    document.getElementById('user-tbody').innerHTML =
      APP.tableMessage(USER_COLS, `Couldn't load users. <button class="btn btn-secondary" id="users-retry">Retry</button>`);
    document.getElementById('users-retry')?.addEventListener('click', loadUsers);
  }
}

function renderUserStats() {
  const total    = allUsers.length;
  const active   = allUsers.filter(u => u.active !== false).length;
  const disabled = total - active;
  const byRole   = allUsers.reduce((m, u) => { m[u.role] = (m[u.role] || 0) + 1; return m; }, {});
  const ownerCnt = byRole.owner || 0;

  const card = (color, value, label) => `
    <div class="stat-card ${color}"><div class="stat-top"><div class="stat-icon ${color}">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
    </div></div><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;

  document.getElementById('user-stats').innerHTML =
    card('blue',   total,   'Total Accounts') +
    card('green',  active,  'Active') +
    card(disabled > 0 ? 'red' : 'gray', disabled, 'Disabled') +
    card('yellow', ownerCnt, ownerCnt === 1 ? 'Owner' : 'Owners');
}

function renderUsers(list) {
  const tbody = document.getElementById('user-tbody');
  const empty = document.getElementById('user-empty');
  if (!list.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  const myUid = auth.currentUser?.uid;
  tbody.innerHTML = list.map(u => {
    const isMe       = u.uid === myUid;
    const isActive   = u.active !== false;
    const statusCell = isActive
      ? `<span class="badge badge-green">Active</span>`
      : `<span class="badge badge-red">Disabled</span>`;
    return `<tr>
      <td style="font-weight:500;">${APP.sanitize(u.name || '--')}${isMe ? ' <span class="text-muted" style="font-size:11px;">(you)</span>' : ''}</td>
      <td class="text-muted">${APP.sanitize(u.email || '--')}</td>
      <td><span class="role-badge role-${APP.sanitize(u.role || '')}">${APP.sanitize(u.role || '—')}</span></td>
      <td>${statusCell}</td>
      <td class="text-muted">${APP.fmtDate(u.createdAt)}</td>
      <td class="td-actions">
        <button class="btn btn-secondary btn-icon" data-action="edit" data-uid="${u.uid}" title="Edit role / status">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        ${isMe ? '' : `<button class="btn btn-danger btn-icon" data-action="delete" data-uid="${u.uid}" title="Remove role profile">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>`}
      </td>
    </tr>`;
  }).join('');
}

/* ── Edit user ─────────────────────────────── */
function openEditUser(uid) {
  const u = allUsers.find(x => x.uid === uid); if (!u) return;
  const isMe = u.uid === auth.currentUser?.uid;

  document.getElementById('u-uid').value   = uid;
  document.getElementById('u-name').value  = u.name  || '';
  document.getElementById('u-email').value = u.email || '';
  document.getElementById('u-role').value  = u.role  || 'staff';
  document.getElementById('u-active').value = (u.active !== false) ? 'true' : 'false';

  // Self-protection: don't let an owner accidentally lock themselves out
  document.getElementById('u-role').disabled   = isMe;
  document.getElementById('u-active').disabled = isMe;
  document.getElementById('u-self-warning').style.display = isMe ? 'block' : 'none';

  APP.openModal('user-modal');
}

async function saveUser() {
  const uid    = document.getElementById('u-uid').value;
  const role   = document.getElementById('u-role').value;
  const active = document.getElementById('u-active').value === 'true';
  const u      = allUsers.find(x => x.uid === uid);
  if (!u) { APP.toast('User not found', 'error'); return; }

  const isMe = uid === auth.currentUser?.uid;
  if (isMe && (role !== u.role || active !== (u.active !== false))) {
    APP.toast("You can't change your own role or status", 'warning');
    return;
  }

  const btn = document.getElementById('save-user-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…';
  try {
    const updates = {};
    if (role !== u.role) updates.role = role;
    if (active !== (u.active !== false)) updates.active = active;
    if (Object.keys(updates).length === 0) {
      APP.closeModal('user-modal');
      return;
    }
    updates.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('users').doc(uid).update(updates);
    APP.audit('user.update', { uid, name: u.name, email: u.email, changes: updates });
    APP.toast(`Updated ${u.name || u.email}`, 'success');
    APP.closeModal('user-modal');
    await loadUsers();
  } catch (e) {
    console.error(e);
    APP.toast(e.message || 'Update failed', 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'Save';
  }
}

function deleteUser(uid) {
  const u = allUsers.find(x => x.uid === uid); if (!u) return;
  if (uid === auth.currentUser?.uid) { APP.toast("You can't delete yourself", 'warning'); return; }
  APP.showConfirm({
    title: 'Remove role profile',
    message: `This removes ${APP.sanitize(u.name || u.email || 'this user')}'s access to the POS. Their Firebase login still exists — disable it in Firebase Console for full removal. Continue?`,
    type: 'danger', confirmText: 'Remove',
    onConfirm: async () => {
      try {
        await db.collection('users').doc(uid).delete();
        APP.audit('user.delete', { uid, name: u.name, email: u.email, role: u.role });
        APP.toast('Profile removed', 'success');
        await loadUsers();
      } catch (e) {
        APP.toast(e.message || 'Delete failed', 'error');
      }
    }
  });
}

/* ── Events ────────────────────────────────── */
function bindUserEvents() {
  document.getElementById('close-user-modal').addEventListener('click', () => APP.closeModal('user-modal'));
  document.getElementById('cancel-user-modal').addEventListener('click', () => APP.closeModal('user-modal'));
  document.getElementById('save-user-btn').addEventListener('click', saveUser);
  document.getElementById('user-tbody').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]'); if (!btn) return;
    if (btn.dataset.action === 'edit')   openEditUser(btn.dataset.uid);
    if (btn.dataset.action === 'delete') deleteUser(btn.dataset.uid);
  });
}
