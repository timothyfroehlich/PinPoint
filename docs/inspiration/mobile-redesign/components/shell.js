// PinPoint Mobile Mockup — Shared Shell (header, tabs, panels)
// Usage: include this script, then call initShell({ activePage: 'machines' })
// Options: { activePage: string, auth: boolean (default true) }

function initShell(options = {}) {
  const activePage = options.activePage || "home";
  const isAuth = options.auth !== false; // default true

  // Inject overlays
  document.body.insertAdjacentHTML(
    "afterbegin",
    `
    <div class="overlay" id="overlay" onclick="closeAll()"></div>
    <div class="bottom-sheet-overlay" id="sheetOverlay" onclick="closeAll()"></div>
  `
  );

  // Inject header (different for auth vs unauth)
  if (isAuth) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `
      <header class="header">
        <div class="header-logo">
          <div class="logo-icon">P</div>
          <span class="logo-text">PinPoint</span>
        </div>
        <div class="header-actions">
          <button class="header-btn" aria-label="Notifications" onclick="togglePanel('notifPanel')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
            </svg>
            <span class="badge">6</span>
          </button>
          <button class="avatar-btn" aria-label="User menu" onclick="togglePanel('userMenu')">AU</button>
        </div>
      </header>
    `
    );
  } else {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `
      <header class="header">
        <div class="header-logo">
          <div class="logo-icon">P</div>
          <span class="logo-text">PinPoint</span>
        </div>
        <div class="header-actions">
          <a href="#" class="header-link-btn">Sign In</a>
          <a href="#" class="header-cta-btn">Sign Up</a>
        </div>
      </header>
    `
    );
  }

  // Inject notification panel (auth only)
  if (isAuth) {
    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <div class="dropdown-panel" id="notifPanel">
        <div class="notif-header">
          <h3>Notifications</h3>
          <button>Mark all read</button>
        </div>
        <div class="notif-item unread">
          <div class="notif-dot"></div>
          <div class="notif-content">
            <div class="notif-text"><strong>Sarah</strong> commented on <strong>Worn flipper bushings</strong></div>
            <div class="notif-meta"><span class="notif-tag">HD-01</span><span>2 min ago</span></div>
          </div>
        </div>
        <div class="notif-item unread">
          <div class="notif-dot"></div>
          <div class="notif-content">
            <div class="notif-text"><strong>Jake</strong> assigned you to <strong>Broken coin door latch</strong></div>
            <div class="notif-meta"><span class="notif-tag">AFM-03</span><span>15 min ago</span></div>
          </div>
        </div>
        <div class="notif-item unread">
          <div class="notif-dot"></div>
          <div class="notif-content">
            <div class="notif-text"><strong>Medieval Madness</strong> status changed to <strong>Operational</strong></div>
            <div class="notif-meta"><span class="notif-tag">MM</span><span>1 hour ago</span></div>
          </div>
        </div>
        <div class="notif-item">
          <div class="notif-dot read"></div>
          <div class="notif-content">
            <div class="notif-text"><strong>Admin</strong> added a new machine: <strong>Twilight Zone</strong></div>
            <div class="notif-meta"><span class="notif-tag">TZ</span><span>3 hours ago</span></div>
          </div>
        </div>
        <div class="notif-item">
          <div class="notif-dot read"></div>
          <div class="notif-content">
            <div class="notif-text"><strong>Sarah</strong> resolved <strong>Loose ramp bracket</strong></div>
            <div class="notif-meta"><span class="notif-tag">TAF-02</span><span>Yesterday</span></div>
          </div>
        </div>
        <div class="notif-item">
          <div class="notif-dot read"></div>
          <div class="notif-content">
            <div class="notif-text"><strong>Jake</strong> reported <strong>Display flickering</strong> on <strong>CFTBL</strong></div>
            <div class="notif-meta"><span class="notif-tag">CFTBL-01</span><span>2 days ago</span></div>
          </div>
        </div>
      </div>
    `
    );
  }

  // Inject user menu panel (auth only)
  if (isAuth) {
    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <div class="dropdown-panel" id="userMenu">
        <div class="user-menu-header">
          <div class="user-menu-avatar">AU</div>
          <div class="user-menu-info">
            <div class="user-menu-name">Admin User</div>
            <div class="user-menu-role">Admin</div>
          </div>
        </div>
        <button class="menu-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Profile &amp; Settings
        </button>
        <button class="menu-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
          Appearance
        </button>
        <div class="menu-divider"></div>
        <button class="menu-item destructive">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
          Sign Out
        </button>
      </div>
    `
    );
  }

  // Inject "More" bottom sheet (admin item only for auth users)
  const adminItem = isAuth
    ? `
      <div class="sheet-divider"></div>
      <button class="sheet-item admin-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        <div>Admin Panel<div class="sheet-item-desc">User management &amp; settings</div></div>
      </button>`
    : "";

  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div class="bottom-sheet" id="moreSheet">
      <div class="sheet-handle"></div>
      <div class="sheet-title">More</div>
      <button class="sheet-item whats-new-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        <div style="display:flex;align-items:center;">What's New<span class="whats-new-badge">3</span></div>
      </button>
      <button class="sheet-item feedback-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <div>Feedback<div class="sheet-item-desc">Report bugs or suggest features</div></div>
      </button>
      <button class="sheet-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
        Help
      </button>
      <button class="sheet-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>
        Roadmap
      </button>
      <button class="sheet-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        About
      </button>${adminItem}
    </div>
  `
  );

  // Inject tab bar
  const tabs = [
    {
      id: "home",
      label: "Home",
      icon: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    },
    {
      id: "issues",
      label: "Issues",
      icon: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    },
    {
      id: "machines",
      label: "Machines",
      icon: '<line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>',
    },
    {
      id: "report",
      label: "Report",
      icon: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    },
    {
      id: "more",
      label: "More",
      icon: '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
      isMore: true,
    },
  ];

  const tabBarHtml = tabs
    .map((tab) => {
      const activeClass = tab.id === activePage ? " active" : "";
      const onclick = tab.isMore ? ' onclick="toggleMore()"' : "";
      const tag = tab.isMore ? "button" : "a";
      const href = tab.isMore ? "" : ' href="#"';
      return `<${tag} class="tab-item${activeClass}"${href}${onclick} aria-label="${tab.label}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${tab.icon}</svg>
      <span>${tab.label}</span>
    </${tag}>`;
    })
    .join("\n  ");

  document.body.insertAdjacentHTML(
    "beforeend",
    `<nav class="tab-bar">${tabBarHtml}</nav>`
  );
}

// Panel interaction functions (global)
function togglePanel(id) {
  const panel = document.getElementById(id);
  const overlay = document.getElementById("overlay");
  const isOpen = panel.classList.contains("open");
  closeAll();
  if (!isOpen) {
    panel.classList.add("open");
    overlay.classList.add("open");
  }
}

function toggleMore() {
  const sheet = document.getElementById("moreSheet");
  const overlay = document.getElementById("sheetOverlay");
  const isOpen = sheet.classList.contains("open");
  closeAll();
  if (!isOpen) {
    sheet.classList.add("open");
    overlay.classList.add("open");
  }
}

function closeAll() {
  document
    .querySelectorAll(
      ".dropdown-panel, .overlay, .bottom-sheet, .bottom-sheet-overlay"
    )
    .forEach((el) => {
      el.classList.remove("open");
    });
}
