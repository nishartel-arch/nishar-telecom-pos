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
    sun:       `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    moon:      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    logout:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
    menu:      `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
    close:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    check:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    x:         `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warn:      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  /* ── Nav Pages ─────────────────────────────── */
  const PAGES = [
    { id: 'dashboard', href: 'index.html',     icon: IC.grid,      label: 'Dashboard'  },
    { id: 'billing',   href: 'billing.html',   icon: IC.billing,   label: 'Billing'    },
    { id: 'inventory', href: 'inventory.html', icon: IC.inventory, label: 'Inventory'  },
    { id: 'sales',     href: 'sales.html',     icon: IC.sales,     label: 'Sales'      },
    { id: 'customers', href: 'customers.html', icon: IC.customers, label: 'Customers'  },
    { id: 'purchases', href: 'purchases.html', icon: IC.purchases, label: 'Purchases'  },
    { id: 'analytics', href: 'analytics.html', icon: IC.analytics, label: 'Analytics'  },
  ];

  /* ── Theme ─────────────────────────────────── */
  function initTheme() {
    const t = localStorage.getItem('pos-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  }

  function toggleTheme() {
    const cur = localStorage.getItem('pos-theme') || 'dark';
    const nxt = cur === 'dark' ? 'light' : 'dark';
    localStorage.setItem('pos-theme', nxt);
    document.documentElement.setAttribute('data-theme', nxt);
    const btn = document.getElementById('theme-btn');
    if (btn) btn.innerHTML = nxt === 'dark' ? IC.sun : IC.moon;
  }

  /* ── Sidebar ───────────────────────────────── */
  function buildSidebar(activePage) {
    const items = PAGES.map(p => `
      <a href="${p.href}" class="nav-item ${activePage === p.id ? 'active' : ''}">
        ${p.icon}<span>${p.label}</span>
      </a>`).join('');

    const theme = localStorage.getItem('pos-theme') || 'dark';
    const logoSrc = theme === 'dark' ? 'assets/logo-hexagon-dark.svg' : 'assets/logo-hexagon-light.svg';

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
      </nav>
      <div class="sidebar-footer">
        <button class="btn-icon-ghost" id="theme-btn" title="Toggle theme">
          ${theme === 'dark' ? IC.sun : IC.moon}
        </button>
        <button class="btn-icon-ghost" id="logout-btn" title="Sign out" style="margin-left:auto;">
          ${IC.logout}
        </button>
      </div>`;
  }

  function mountSidebar(activePage) {
    const el = document.getElementById('sidebar');
    if (!el) return;
    el.innerHTML = buildSidebar(activePage);

    document.getElementById('theme-btn')?.addEventListener('click', toggleTheme);
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      showConfirm({
        title: 'Sign Out',
        message: 'Are you sure you want to sign out?',
        type: 'warning', confirmText: 'Sign Out',
        onConfirm: () => auth.signOut().then(() => location.href = 'login.html')
      });
    });
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
        <span class="topbar-clock" id="clock"></span>
        <div class="topbar-user">
          <div class="user-avatar">${initials}</div>
          <span class="user-name">${name}</span>
        </div>
      </div>`;

    document.getElementById('menu-btn')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('open');
      document.getElementById('sidebar-overlay')?.classList.toggle('open');
    });

    document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebar-overlay')?.classList.remove('open');
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
    requireAuth(user => {
      mountSidebar(page);
      mountTopbar(title, user);
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

  function debounce(fn, delay = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  }

  function sanitize(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  /* ── Public API ────────────────────────────── */
  return { init, toast, openModal, closeModal, showConfirm, currency, fmtDate, fmtDateTime, genId, debounce, sanitize, requireAuth };

})();
