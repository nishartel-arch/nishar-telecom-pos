/* =============================================
   NISHAR TELECOM POS — Shared Application Core
   All pages import this. It handles:
   - Auth guard
   - Sidebar with Logo (light/dark swap)
   - Topbar + clock
   - Toast notifications
   - Custom modal + confirm dialog
   - Dark/light theme
   - Utility helpers
   ============================================= */

const APP = (() => {

  /* ── SVG Icons ─────────────────────────────── */
  const IC = {
    grid:      `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    billing:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
    inventory: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`,
    sales:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    customers: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    purchases: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
    analytics: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    expenses:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>`,
    chat:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
    users:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg>`,
    suppliers: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
    settings:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    csc:       `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M5 16a3 3 0 0 1 6 0"/><line x1="14" y1="9" x2="19" y2="9"/><line x1="14" y1="13" x2="19" y2="13"/></svg>`,
    sun:       `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    moon:      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    logout:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
    menu:      `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
    close:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    check:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    x:         `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warn:      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    download:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    search:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    arrow:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  };

  /* ── Nav Pages ─────────────────────────────── */
  const PAGES = [
    { id: 'dashboard', href: 'index.html',     icon: IC.grid,      label: 'Dashboard'  },
    { id: 'billing',   href: 'billing.html',   icon: IC.billing,   label: 'Billing'    },
    { id: 'csc',       href: 'csc.html',       icon: IC.csc,       label: 'CSC Services'},
    { id: 'inventory', href: 'inventory.html', icon: IC.inventory, label: 'Inventory'  },
    { id: 'sales',     href: 'sales.html',     icon: IC.sales,     label: 'Sales'      },
    { id: 'customers', href: 'customers.html', icon: IC.customers, label: 'Customers'  },
    { id: 'purchases', href: 'purchases.html', icon: IC.purchases, label: 'Purchases'  },
    { id: 'suppliers', href: 'suppliers.html', icon: IC.suppliers, label: 'Suppliers'  },
    { id: 'expenses',  href: 'expenses.html',  icon: IC.expenses,  label: 'Expenses'   },
    { id: 'analytics', href: 'analytics.html', icon: IC.analytics, label: 'Analytics'  },
    { id: 'users',     href: 'users.html',     icon: IC.users,     label: 'Users'      },
    { id: 'settings',  href: 'settings.html',  icon: IC.settings,  label: 'Settings'   },
  ];

  /* ── Roles & Permissions ──────────────────── */
  const ROLES = ['owner', 'manager', 'cashier', 'staff'];

  // What each role is allowed to do. 'owner' has the wildcard.
  const PERMISSIONS = {
    owner:   ['*'],
    manager: ['bill', 'inventory.view', 'inventory.edit', 'inventory.delete', 'price.edit',
              'purchases', 'customers.view', 'customers.edit', 'customers.delete',
              'sales.view', 'sales.refund', 'analytics.view', 'backup',
              'expenses.view', 'expenses.manage',
              'suppliers.view', 'suppliers.manage', 'csc'],
    cashier: ['bill', 'inventory.view', 'customers.view', 'customers.edit', 'sales.view', 'csc'],
    staff:   ['bill', 'inventory.view', 'customers.view', 'csc'],
  };

  // Permission required to open each page (null = any provisioned user).
  const PAGE_PERM = {
    dashboard: null, billing: 'bill', csc: 'csc', inventory: 'inventory.view', sales: 'sales.view',
    customers: 'customers.view', purchases: 'purchases', analytics: 'analytics.view',
    expenses: 'expenses.view',
    users: 'users.manage',
    suppliers: 'suppliers.view',
    settings: 'users.manage',
  };

  let _profile = null;   // { name, email, role, active }

  function role() { return _profile?.role || null; }

  function can(perm) {
    if (!_profile || _profile.active === false) return false;
    const list = PERMISSIONS[_profile.role] || [];
    return list.includes('*') || list.includes(perm);
  }

  // Load (or first-run bootstrap) the signed-in user's role profile.
  async function loadProfile(user) {
    const ref  = db.collection('users').doc(user.uid);
    const snap = await ref.get();
    if (snap.exists) return snap.data();

    // No profile yet. Bootstrap: the very first user to sign in claims Owner
    // (and stamps meta/app so the claim can only happen once); everyone after
    // self-provisions as the lowest role and waits for an Owner to promote them.
    const metaRef = db.collection('meta').doc('app');
    const firstRun = !(await metaRef.get()).exists;
    const ts = firebase.firestore.FieldValue.serverTimestamp();
    const base = {
      name:  user.displayName || user.email?.split('@')[0] || 'User',
      email: user.email || '',
      active: true,
      createdAt: ts,
    };
    try {
      if (firstRun) {
        const batch = db.batch();
        batch.set(ref, { ...base, role: 'owner' });
        batch.set(metaRef, { ownerUid: user.uid, initialized: true, createdAt: ts });
        await batch.commit();
      } else {
        await ref.set({ ...base, role: 'staff' });
      }
      return (await ref.get()).data();
    } catch (e) {
      console.error('Profile provisioning failed:', e);
      return null;
    }
  }

  // Hide/disable any element tagged with data-perm="x" the user can't do.
  function applyPermissions(root = document) {
    root.querySelectorAll('[data-perm]').forEach(el => {
      if (!can(el.getAttribute('data-perm'))) el.remove();
    });
  }

  // Full-screen "not authorised yet" state for unprovisioned/disabled users.
  function renderLockout(profile) {
    const inactive = profile && profile.active === false;
    document.body.innerHTML = `
      <div style="min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center;">
        <div style="max-width:420px;">
          <img src="${logoFor(getTheme())}" alt="Logo" style="width:64px;height:64px;margin-bottom:16px;"/>
          <h2 style="font-family:'Sora',sans-serif;margin:0 0 8px;">${inactive ? 'Account disabled' : 'Awaiting access'}</h2>
          <p style="color:var(--text-muted);line-height:1.6;">
            ${inactive
              ? 'Your account has been disabled. Please contact the shop owner.'
              : 'Your account is signed in but has not been granted a role yet. Ask the shop owner to approve your access from the Users settings.'}
          </p>
          <button id="lockout-signout" class="btn btn-secondary" style="margin-top:18px;">Sign out</button>
        </div>
      </div>`;
    document.getElementById('lockout-signout')?.addEventListener('click',
      () => auth.signOut().then(() => location.href = 'login.html'));
  }

  /* ── Audit Log ─────────────────────────────── */
  // Fire-and-forget append-only record of who did what.
  async function audit(action, details = {}) {
    try {
      await db.collection('auditLogs').add({
        action,
        details,
        uid:   auth.currentUser?.uid || null,
        email: _profile?.email || auth.currentUser?.email || '',
        role:  _profile?.role || null,
        at:    firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) { console.warn('Audit write skipped:', e); }
  }

  /* ── Backup / Export ───────────────────────── */
  // Collections worth backing up. Excludes auditLogs (large history),
  // and users/meta (tied to Firebase Auth + owner-claim logic — restoring
  // them could break sign-in, so they're managed separately).
  const BACKUP_COLLECTIONS = [
    'products', 'customers', 'sales', 'purchases', 'counters',
    'suppliers', 'expenses', 'duePayments', 'refunds', 'supplierPayments',
    'cscServices', 'config',
  ];

  async function backup() {
    if (!can('backup')) { toast('You do not have permission to export data', 'error'); return; }
    toast('Preparing backup…', 'info');
    try {
      const dump = { exportedAt: new Date().toISOString(), shop: 'Nishar Telecom', version: 2, collections: {} };
      for (const c of BACKUP_COLLECTIONS) {
        const snap = await db.collection(c).get();
        dump.collections[c] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nishar-pos-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      try { localStorage.setItem('pos-last-backup', new Date().toISOString()); } catch (e) {}
      audit('backup.export', { collections: BACKUP_COLLECTIONS });
      toast('Backup downloaded', 'success');
      return true;
    } catch (e) {
      console.error(e);
      toast('Backup failed', 'error');
      return false;
    }
  }

  /* ── Theme ─────────────────────────────────── */
  const THEMES = ['blue', 'purple', 'dark', 'ocean', 'light'];

  // The hexagon logo comes in two inks: the light-ink variant reads on the
  // bright "light" theme, the default variant reads on every dark theme.
  function logoFor(theme) {
    return theme === 'light'
      ? 'assets/logo-hexagon-light.svg'
      : 'assets/logo-hexagon-dark.svg';
  }

  function getTheme() {
    const saved = localStorage.getItem('pos-theme') || 'blue';
    return THEMES.includes(saved) ? saved : 'blue';
  }

  function initTheme() {
    const t = getTheme();
    localStorage.setItem('pos-theme', t);
    document.documentElement.setAttribute('data-theme', t);
  }

  function setTheme(nxt) {
    if (!THEMES.includes(nxt)) return;
    localStorage.setItem('pos-theme', nxt);
    document.documentElement.setAttribute('data-theme', nxt);
    const btn = document.getElementById('theme-btn');
    if (btn) btn.innerHTML = IC.sun;
    document.querySelectorAll('.theme-dot').forEach(dot => {
      dot.classList.toggle('active', dot.dataset.theme === nxt);
    });
    const logo = document.querySelector('.brand-logo');
    if (logo) logo.src = logoFor(nxt);
  }

  function toggleTheme() {
    const cur = getTheme();
    const nxt = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
    setTheme(nxt);
  }

  /* ── Sidebar ───────────────────────────────── */
  function buildSidebar(activePage) {
    const items = PAGES
      .filter(p => { const need = PAGE_PERM[p.id]; return !need || can(need); })
      .map(p => `
      <a href="${p.href}" class="nav-item ${activePage === p.id ? 'active' : ''}">
        ${p.icon}<span>${p.label}</span>
      </a>`).join('');

    const logoSrc = logoFor(getTheme());

    return `
      <div class="sidebar-brand">
        <img src="${logoSrc}" alt="Nishar Telecom Logo" class="brand-logo" style="width:48px;height:48px;flex-shrink:0;border-radius:var(--r-md);">
        <div>
          <div class="brand-name">Nishar Telecom</div>
          <div class="brand-sub">POS System</div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-label">Navigation</div>
        ${items}
      </nav>`;
  }

  function mountSidebar(activePage) {
    const el = document.getElementById('sidebar');
    if (!el) return;
    el.innerHTML = buildSidebar(activePage);

  }

  /* ── Topbar ────────────────────────────────── */
  function mountTopbar(title, user) {
    const el = document.getElementById('topbar');
    if (!el) return;
    const initials = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
    const name = user.displayName || user.email?.split('@')[0] || 'User';
    el.innerHTML = `
      <button class="menu-btn" id="menu-btn">${IC.menu}</button>
      <span class="topbar-title">${title}</span>
      <div class="topbar-spacer"></div>
      <div class="topbar-right">
        <button class="qs-trigger" id="qs-trigger" title="Quick search (Ctrl/⌘ + K)">
          ${IC.search}
          <span class="qs-trigger-label">Search</span>
          <span class="qs-kbd">Ctrl K</span>
        </button>
        <span class="topbar-clock" id="clock"></span>
        <div class="topbar-user">
          <div class="user-avatar">${initials}</div>
          <span class="user-name">${name}</span>
          ${_profile?.role ? `<span class="role-badge role-${_profile.role}">${_profile.role}</span>` : ''}
        </div>
        <button class="btn-icon-ghost" id="topbar-logout-btn" title="Sign out" style="margin-left:var(--sp-2);">${IC.logout}</button>
      </div>`;

    document.getElementById('menu-btn')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('open');
      document.getElementById('sidebar-overlay')?.classList.toggle('open');
    });

    document.getElementById('qs-trigger')?.addEventListener('click', openQuickSearch);

    document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebar-overlay')?.classList.remove('open');
    });

    document.getElementById('topbar-logout-btn')?.addEventListener('click', () => {
      showConfirm({
        title: 'Sign Out',
        message: 'Are you sure you want to sign out?',
        type: 'warning', confirmText: 'Sign Out',
        onConfirm: () => auth.signOut().then(() => location.href = 'login.html')
      });
    });

    const clockEl = document.getElementById('clock');
    const tick = () => clockEl && (clockEl.textContent = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }));
    tick(); setInterval(tick, 1000);
  }

  /* ── Auth Guard ────────────────────────────── */
  function requireAuth(cb) {
    auth.onAuthStateChanged(user => {
      if (!user) { location.href = 'login.html'; return; }
      cb(user);
    });
  }

  /* ── Init ──────────────────────────────────── */
  function init({ page, title, onReady }) {
    initTheme();
    requireAuth(async (user) => {
      _profile = await loadProfile(user).catch(() => null);

      // Not provisioned or disabled → lock the app, offer sign-out.
      if (!_profile || _profile.active === false) { renderLockout(_profile); return; }

      // Page-level guard: bounce users who lack permission for this screen.
      const need = PAGE_PERM[page];
      if (need && !can(need)) { toast('You do not have access to that page', 'error'); location.replace('index.html'); return; }

      mountSidebar(page);
      mountTopbar(title, user);
      mountQuickSearch();
      applyPermissions();
      onReady?.(user);
    });
  }

  /* ── Toast ─────────────────────────────────── */
  function toast(msg, type = 'success', ms = 3500) {
    const stack = document.getElementById('toast-stack');
    if (!stack) return;
    const icons = { success: IC.check, error: IC.x, warning: IC.warn, info: IC.info };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${msg}</span>`;
    stack.appendChild(t);
    setTimeout(() => {
      t.classList.add('exiting');
      setTimeout(() => t.remove(), 280);
    }, ms);
  }

  /* ── Modal ─────────────────────────────────── */
  function openModal(id)  { document.getElementById(id)?.classList.add('open');    }
  function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

  function showConfirm({ title, message, type = 'danger', confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel }) {
    const backdrop = document.getElementById('confirm-modal');
    if (!backdrop) return;

    const iconMap = {
      danger:  `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
      warning: IC.warn,
    };

    backdrop.querySelector('#confirm-icon').innerHTML = iconMap[type] || IC.warn;
    backdrop.querySelector('#confirm-icon').className = `confirm-icon ${type}`;
    backdrop.querySelector('#confirm-title').textContent   = title;
    backdrop.querySelector('#confirm-message').textContent = message;

    const ok  = backdrop.querySelector('#confirm-ok');
    const can = backdrop.querySelector('#confirm-cancel');
    ok.textContent  = confirmText;
    ok.className    = `btn btn-${type}`;
    can.textContent = cancelText;

    const okNew  = ok.cloneNode(true);
    const canNew = can.cloneNode(true);
    ok.replaceWith(okNew);
    can.replaceWith(canNew);

    okNew.addEventListener('click',  () => { closeModal('confirm-modal'); onConfirm?.(); });
    canNew.addEventListener('click', () => { closeModal('confirm-modal'); onCancel?.();  });

    openModal('confirm-modal');
  }

  /* ── Utilities ─────────────────────────────── */
  function currency(n) {
    return '₹' + parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtDate(ts) {
    if (!ts) return '--';
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function fmtDateTime(ts) {
    if (!ts) return '--';
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function genId(prefix = 'ID') {
    return prefix + '-' + Date.now().toString(36).toUpperCase();
  }

  // Coalesce rapid calls — fires once after `delay` ms of quiet. Ideal for
  // search-as-you-type boxes so we don't query Firestore on every keystroke.
  function debounce(fn, delay = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  }

  // Rate-limit a hot handler to at most once per `limit` ms (leading edge),
  // for scroll / resize / pointermove style streams.
  function throttle(fn, limit = 200) {
    let last = 0, pending = null;
    return (...args) => {
      const now = Date.now();
      const run = () => { last = now; fn(...args); };
      if (now - last >= limit) { run(); }
      else { clearTimeout(pending); pending = setTimeout(run, limit - (now - last)); }
    };
  }

  // JSON-safe localStorage wrapper that never throws (private mode / quota).
  const store = {
    get(key, fallback = null) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
    },
    remove(key) { try { localStorage.removeItem(key); } catch (e) {} },
  };

  // Copy text to the clipboard with a graceful fallback for old/non-secure
  // contexts; returns a promise<boolean>.
  async function copy(text) {
    const s = String(text == null ? '' : text);
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(s); return true; }
      const ta = document.createElement('textarea');
      ta.value = s; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove();
      return ok;
    } catch (e) { return false; }
  }

  // Plain grouped number (no currency symbol) — for counts, quantities, etc.
  function formatNum(n, dp = 0) {
    return parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }

  function sanitize(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  /* ── CSV helpers (no library — Excel reads it natively) ── */
  function csvEscape(v) {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function csvBuild(headers, rows) {
    // rows is an array of objects keyed by header.
    const head = headers.map(csvEscape).join(',');
    const body = rows.map(r => headers.map(h => csvEscape(r[h])).join(',')).join('\n');
    return head + '\n' + body + (body ? '\n' : '');
  }
  // Parse CSV into objects keyed by the header row. Handles quoted fields,
  // escaped quotes ("") and embedded newlines.
  function csvParse(text) {
    const rows = [];
    let cur = [], cell = '', i = 0, q = false;
    text = text.replace(/^\uFEFF/, '');                 // strip BOM if Excel saved it
    while (i < text.length) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        if (c === '"') { q = false; i++; continue; }
        cell += c; i++; continue;
      }
      if (c === '"') { q = true; i++; continue; }
      if (c === ',') { cur.push(cell); cell = ''; i++; continue; }
      if (c === '\n' || c === '\r') {
        if (cell !== '' || cur.length) { cur.push(cell); rows.push(cur); cur = []; cell = ''; }
        if (c === '\r' && text[i + 1] === '\n') i++;     // skip CRLF pair
        i++; continue;
      }
      cell += c; i++;
    }
    if (cell !== '' || cur.length) { cur.push(cell); rows.push(cur); }
    if (!rows.length) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).filter(r => r.some(x => x !== '')).map(r => {
      const obj = {};
      headers.forEach((h, idx) => obj[h] = r[idx] != null ? r[idx] : '');
      return obj;
    });
  }
  function csvDownload(filename, headers, rows) {
    const blob = new Blob(['\uFEFF' + csvBuild(headers, rows)], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  /* ── Stock / reorder helpers ─────────────── */
  // One consistent definition of "low stock" for billing, inventory & dashboard.
  // Each product may set its own reorderLevel; absent that, a sensible default.
  const DEFAULT_REORDER_LEVEL = 3;
  const SERVICE_CATEGORIES = [];
  function isServiceProduct(p) {
    return p?.isService === true || SERVICE_CATEGORIES.includes(p?.category);
  }
  function reorderLevelOf(p) {
    const v = parseInt(p?.reorderLevel, 10);
    return Number.isFinite(v) && v >= 0 ? v : DEFAULT_REORDER_LEVEL;
  }
  function isLowStock(p) {
    if (isServiceProduct(p)) return false;        // services carry no stock
    return (Number(p?.stock) || 0) <= reorderLevelOf(p);
  }

  /* ── Shop config (business info for receipts) ── */
  // Cached after first read so subsequent pages don't refetch. Always returns
  // an object — defaults are baked in so callers can read fields safely.
  let _shopConfigCache = null;
  async function shopConfig() {
    if (_shopConfigCache) return _shopConfigCache;
    try {
      const snap = await db.collection('config').doc('shop').get();
      const data = snap.exists ? snap.data() : {};
      _shopConfigCache = Object.assign({
        name: 'Nishar Telecom',
        state: '',
        address: '',
        phone: '',
        email: '',
        thermalWidth: '80',
      }, data);
    } catch (e) {
      _shopConfigCache = { name: 'Nishar Telecom', state: '', address: '', phone: '', email: '', thermalWidth: '80' };
    }
    return _shopConfigCache;
  }
  function clearShopConfigCache() { _shopConfigCache = null; }

  /* ── WhatsApp send (universal wa.me link) ─── */
  // Default country code for bare 10-digit numbers (India). Override by
  // setting localStorage 'pos-country-code' to e.g. '971' for UAE.
  const DEFAULT_CC = '91';
  function whatsApp(phone, text) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) { toast('No phone number on file for this contact', 'warning'); return false; }
    const cc = (typeof localStorage !== 'undefined' && localStorage.getItem('pos-country-code')) || DEFAULT_CC;
    // 10-digit → prefix CC; longer → assume it already includes a country code.
    const intl = digits.length === 10 ? cc + digits : digits;
    const url  = `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener');
    return true;
  }

  /* ── Loading / error UI helpers ────────────── */
  // Shimmer placeholder rows for a table body while data loads.
  function skeletonRows(cols, rows = 6) {
    const cells = `<td><span class="skeleton-bar"></span></td>`.repeat(cols);
    return Array.from({ length: rows }, () => `<tr class="skeleton-row">${cells}</tr>`).join('');
  }
  // A single full-width message row (empty / error states inside a table).
  function tableMessage(cols, html) {
    return `<tr><td colspan="${cols}" class="table-msg">${html}</td></tr>`;
  }
  // Accurate count for a query/collection. Prefers the cheap server-side count()
  // aggregation; if that isn't available in this SDK build (or it's offline /
  // throws), falls back to reading the docs and using their size so callers still
  // get a real number instead of a blank. Returns null only if both paths fail.
  async function countOf(query) {
    try { return (await query.count().get()).data().count; }
    catch (e) {
      try { return (await query.get()).size; }
      catch (e2) { return null; }
    }
  }

  /* ── Cash-basis money helpers ──────────────── */
  // Revenue is reported as cash ACTUALLY RECEIVED, not amounts merely billed —
  // so an unpaid (credit) sale doesn't become revenue until the customer pays.
  // Helper to range-query a collection on a timestamp field over [start, end).
  function _rangeGet(coll, field, start, end) {
    let q = db.collection(coll).where(field, '>=', start);
    if (end) q = q.where(field, '<', end);
    return q.get();
  }

  // Money IN over [start, end):
  //   + amount paid at the counter on sales created in the window
  //   + payments received against earlier credit (duePayments)
  //   − cash handed back on refunds (Cash/UPI/Card; "Adjust Due" moves no cash)
  async function cashCollected(start, end) {
    const [sales, dues, refunds] = await Promise.all([
      _rangeGet('sales', 'createdAt', start, end),
      _rangeGet('duePayments', 'createdAt', start, end),
      _rangeGet('refunds', 'createdAt', start, end),
    ]);
    const salePay = sales.docs.reduce((s, d) => {
      const x = d.data();
      // Older sales pre-date the amountPaid field — they were paid in full.
      return s + parseFloat(x.amountPaid != null ? x.amountPaid : (x.total || 0));
    }, 0);
    const duePay  = dues.docs.reduce((s, d) => s + parseFloat(d.data().amount || 0), 0);
    const cashBack = refunds.docs.reduce((s, d) => {
      const r = d.data();
      return ['Cash', 'UPI', 'Card'].includes(r.method) ? s + parseFloat(r.totalRefund || 0) : s;
    }, 0);
    return salePay + duePay - cashBack;
  }

  // Cost of goods that stayed sold over [start, end) — each sold line's buy price
  // × the quantity the customer kept (net of refunded units). This is the real
  // cost behind the sales, independent of how the stock was entered (Purchases
  // module, Inventory form, or bulk import), so gross profit is always meaningful.
  async function cogsOfSold(start, end) {
    const snap = await _rangeGet('sales', 'createdAt', start, end);
    let cogs = 0;
    snap.docs.forEach(d => {
      const s = d.data();
      const refundedBy = s.refundedQtyByProduct || {};
      (s.items || []).forEach(it => {
        const refunded = it.productId ? parseFloat(refundedBy[it.productId] || 0) : 0;
        const netQty   = Math.max(0, it.quantity - refunded);
        cogs += parseFloat(it.buyPrice || 0) * netQty;
      });
    });
    return cogs;
  }

  /* ── Quick-Search Command Palette (Ctrl / ⌘ + K) ──
     One global overlay, injected once and reused on every page. It indexes
     the nav pages the signed-in user is actually allowed to open, so it
     doubles as a fast keyboard-driven navigator. */
  let _qsMounted = false;
  let _qsItems = [];
  let _qsFiltered = [];
  let _qsActive = 0;

  function qsIndex() {
    return PAGES
      .filter(p => { const need = PAGE_PERM[p.id]; return !need || can(need); })
      .map(p => ({ label: p.label, href: p.href, icon: p.icon, kw: p.label.toLowerCase() }));
  }

  function qsRender(query = '') {
    const box = document.getElementById('qs-results');
    if (!box) return;
    const q = query.trim().toLowerCase();
    _qsFiltered = q ? _qsItems.filter(it => it.kw.includes(q)) : _qsItems.slice();
    _qsActive = 0;
    if (!_qsFiltered.length) {
      box.innerHTML = `<div class="qs-empty">No pages match “${sanitize(query)}”</div>`;
      return;
    }
    box.innerHTML =
      `<div class="qs-group-label">Go to</div>` +
      _qsFiltered.map((it, i) => `
        <div class="qs-item ${i === 0 ? 'active' : ''}" data-idx="${i}" role="option">
          ${it.icon}<span>${it.label}</span>
          <span class="qs-item-sub">${IC.arrow}</span>
        </div>`).join('');
  }

  function qsSetActive(idx) {
    const items = [...document.querySelectorAll('#qs-results .qs-item')];
    if (!items.length) return;
    _qsActive = (idx + items.length) % items.length;
    items.forEach((el, i) => el.classList.toggle('active', i === _qsActive));
    items[_qsActive]?.scrollIntoView({ block: 'nearest' });
  }

  function qsGo(idx = _qsActive) {
    const it = _qsFiltered[idx];
    if (it) location.href = it.href;
  }

  function openQuickSearch() {
    const bd = document.getElementById('qs-backdrop');
    if (!bd) return;
    _qsItems = qsIndex();
    qsRender('');
    const input = document.getElementById('qs-input');
    if (input) input.value = '';
    bd.classList.add('open');
    setTimeout(() => input?.focus(), 30);
  }

  function closeQuickSearch() {
    document.getElementById('qs-backdrop')?.classList.remove('open');
  }

  function mountQuickSearch() {
    if (_qsMounted) return;
    _qsMounted = true;

    const bd = document.createElement('div');
    bd.className = 'qs-backdrop';
    bd.id = 'qs-backdrop';
    bd.innerHTML = `
      <div class="qs-panel" role="dialog" aria-modal="true" aria-label="Quick search">
        <div class="qs-search">
          ${IC.search}
          <input class="qs-input" id="qs-input" type="text" placeholder="Search pages…"
                 autocomplete="off" autocorrect="off" spellcheck="false"/>
          <span class="qs-esc">Esc</span>
        </div>
        <div class="qs-results" id="qs-results" role="listbox"></div>
      </div>`;
    document.body.appendChild(bd);

    // Click backdrop (but not the panel) to dismiss.
    bd.addEventListener('click', e => { if (e.target === bd) closeQuickSearch(); });

    const results = bd.querySelector('#qs-results');
    results.addEventListener('mousemove', e => {
      const item = e.target.closest('.qs-item');
      if (item) qsSetActive(parseInt(item.dataset.idx, 10));
    });
    results.addEventListener('click', e => {
      const item = e.target.closest('.qs-item');
      if (item) qsGo(parseInt(item.dataset.idx, 10));
    });

    const input = bd.querySelector('#qs-input');
    input.addEventListener('input', debounce(e => qsRender(e.target.value), 80));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); qsSetActive(_qsActive + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); qsSetActive(_qsActive - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); qsGo(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeQuickSearch(); }
    });

    // Global shortcut: Ctrl/⌘+K toggles the palette from anywhere.
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        const open = document.getElementById('qs-backdrop')?.classList.contains('open');
        open ? closeQuickSearch() : openQuickSearch();
      }
    });
  }

  /* ── Public API ────────────────────────────── */
  return { init, toast, openModal, closeModal, showConfirm, currency, fmtDate, fmtDateTime, genId,
           debounce, throttle, store, copy, formatNum, sanitize, requireAuth,
           openQuickSearch, closeQuickSearch,
           can, role, audit, backup, applyPermissions, ROLES, skeletonRows, tableMessage, countOf, whatsApp,
           cashCollected, cogsOfSold,
           shopConfig, clearShopConfigCache,
           isLowStock, reorderLevelOf, isServiceProduct, DEFAULT_REORDER_LEVEL,
           setTheme, getTheme, THEMES };

})();
