// ---------- Formatting helpers ----------

function formatUSD(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function truncateAddr(addr, chars = 8, full = false) {
  if (!addr) return '';
  if (full || addr.length <= chars + 6) return addr;
  return `${addr.slice(0, chars)}…${addr.slice(-6)}`;
}

function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str.replace(' ', 'T') + 'Z');
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

// ---------- Small components ----------

function Alert(type, message) {
  if (!message) return '';
  return `<div class="alert alert-${type}">${escapeHtml(message)}</div>`;
}

function Badge(status) {
  const map = {
    pending: ['badge-pending', 'Pending review'],
    approved: ['badge-approved', 'Approved'],
    rejected: ['badge-rejected', 'Rejected'],
  };
  const [cls, label] = map[status] || ['badge-pending', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Icons (inline SVG, stroke style) ----------

const Icons = {
  overview: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>`,
  plans: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l3 6 6.5.9-4.7 4.6 1.1 6.5L12 17l-5.9 3 1.1-6.5L2.5 8.9 9 8z"/></svg>`,
  deposit: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v13m0 0l-4.5-4.5M12 16l4.5-4.5M4 20h16"/></svg>`,
  withdraw: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21V8m0 0l-4.5 4.5M12 8l4.5 4.5M4 4h16"/></svg>`,
  referral: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="3.2"/><circle cx="17" cy="16" r="3.2"/><path d="M10.5 9.7L14.5 14"/></svg>`,
  admin: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>`,
};

// ---------- Layout wrapper ----------

const NAV_ITEMS = [
  { route: 'dashboard', label: 'Overview', icon: 'overview' },
  { route: 'plans', label: 'Plans', icon: 'plans' },
  { route: 'deposit', label: 'Deposit', icon: 'deposit' },
  { route: 'withdraw', label: 'Withdraw', icon: 'withdraw' },
  { route: 'referral', label: 'Referrals', icon: 'referral' },
];

function Layout(activeRoute, innerHtml) {
  const user = State.user || {};
  const navItems = [...NAV_ITEMS];
  if (State.isAdmin()) navItems.push({ route: 'admin', label: 'Admin panel', icon: 'admin' });

  const navLinksHtml = navItems.map((item) => `
    <a class="nav-link ${activeRoute === item.route ? 'active' : ''}" href="#/${item.route}">
      <span class="icon">${Icons[item.icon]}</span>
      <span>${item.label}</span>
    </a>
  `).join('');

  const planConfig = {
    silver: { label: 'Silver', symbol: 'S', background: 'linear-gradient(135deg, #dfe7ef, #9ba8b8)', color: '#1b2430' },
    gold: { label: 'Gold', symbol: 'G', background: 'linear-gradient(135deg, #f7d77f, #c9931c)', color: '#2a1d00' },
    platinum: { label: 'Platinum', symbol: 'P', background: 'linear-gradient(135deg, #bfe7ff, #4aa6ff)', color: '#072c4a' },
  };
  const activePlan = planConfig[user.latest_plan_id] || { label: 'No plan', symbol: '★', background: 'linear-gradient(135deg, #2c3745, #141b25)', color: '#e7ecf2' };
  const planLabel = activePlan.label;

  return `
    <div class="app-shell">
      <div class="topbar-mobile">
        <div class="mobile-account">
          <div class="mobile-user-avatar">${initials(user.name)}</div>
          <div class="mobile-user-meta">
            <span class="mobile-user-name">${escapeHtml(user.name || 'Account')}</span>
            <span class="mobile-user-plan">${escapeHtml(planLabel)}</span>
          </div>
        </div>
        <button class="mobile-menu-button" id="mobile-menu-toggle" aria-label="Open navigation menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </div>

      <div class="mobile-menu-overlay" id="mobile-menu-overlay"></div>
      <div class="mobile-menu-panel" id="mobile-menu-panel">
        <div class="mobile-menu-header">
          <div class="mobile-menu-brand">
            <div class="brand-mark" style="background:${activePlan.background}; color:${activePlan.color};">${activePlan.symbol}</div>
            <div class="mobile-menu-user-info">
              <div class="mobile-menu-user-name">${escapeHtml(user.name || 'Account')}</div>
              <div class="mobile-menu-user-plan">${escapeHtml(planLabel)}</div>
            </div>
          </div>
          <button class="mobile-close-btn" id="mobile-menu-close" aria-label="Close navigation menu">✕</button>
        </div>
        <nav class="mobile-nav">
          ${navItems.map((item) => `
            <a class="nav-link ${activeRoute === item.route ? 'active' : ''}" href="#/${item.route}">
              <span class="icon">${Icons[item.icon]}</span>
              <span>${item.label}</span>
            </a>
          `).join('')}
        </nav>
        <div class="mobile-menu-footer">
          <button class="logout-btn" id="mobile-logout-btn">Log out</button>
        </div>
      </div>

      <aside class="sidebar">
        <div class="brand sidebar-user-block">
          <div class="brand-mark" style="background:${activePlan.background}; color:${activePlan.color};">${activePlan.symbol}</div>
          <div class="sidebar-user-meta">
            <div class="user-name">${escapeHtml(user.name || 'Account')}</div>
            <div class="user-email">${escapeHtml(user.email || '')}</div>
            <div class="user-plan-tag">${escapeHtml(planLabel)}</div>
          </div>
        </div>
        <nav class="nav">
          ${navLinksHtml}
        </nav>
        <div class="sidebar-footer">
          <button class="logout-btn" id="logout-btn">Log out</button>
        </div>
      </aside>
      <main class="main">
        ${innerHtml}
      </main>
    </div>
  `;
}

function wireLayoutEvents(root, navigate) {
  const logoutBtn = root.querySelector('#logout-btn');
  const mobileLogoutBtn = root.querySelector('#mobile-logout-btn');

  const doLogout = () => {
    Api.setToken(null);
    State.setUser(null);
    navigate('login');
  };

  if (logoutBtn) {
    logoutBtn.addEventListener('click', doLogout);
  }

  if (mobileLogoutBtn) {
    mobileLogoutBtn.addEventListener('click', doLogout);
  }

  const mobileMenuToggle = root.querySelector('#mobile-menu-toggle');
  const mobileMenuPanel = root.querySelector('#mobile-menu-panel');
  const mobileMenuOverlay = root.querySelector('#mobile-menu-overlay');
  const mobileMenuClose = root.querySelector('#mobile-menu-close');

  const closeMobileMenu = () => {
    if (!mobileMenuPanel || !mobileMenuToggle) return;
    mobileMenuPanel.classList.remove('open');
    mobileMenuOverlay.classList.remove('open');
    mobileMenuToggle.setAttribute('aria-expanded', 'false');
  };

  const openMobileMenu = () => {
    if (!mobileMenuPanel || !mobileMenuToggle) return;
    mobileMenuPanel.classList.add('open');
    mobileMenuOverlay.classList.add('open');
    mobileMenuToggle.setAttribute('aria-expanded', 'true');
  };

  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
      const isOpen = mobileMenuPanel.classList.contains('open');
      if (isOpen) closeMobileMenu(); else openMobileMenu();
    });
  }

  if (mobileMenuClose) {
    mobileMenuClose.addEventListener('click', closeMobileMenu);
  }

  if (mobileMenuOverlay) {
    mobileMenuOverlay.addEventListener('click', closeMobileMenu);
  }

  root.querySelectorAll('.mobile-nav .nav-link').forEach((link) => {
    link.addEventListener('click', closeMobileMenu);
  });
}

function wireCopyButtons(root) {
  root.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-copy');
      try {
        await navigator.clipboard.writeText(text);
        const original = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = original; }, 1400);
      } catch {
        // clipboard API unavailable, fail silently
      }
    });
  });
}
