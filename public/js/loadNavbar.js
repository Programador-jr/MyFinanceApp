function getCurrentPage() {
  const page = (window.location.pathname.split("/").pop() || "dashboard.html").trim().toLowerCase();
  if (!page.includes(".")) return `${page}.html`;
  return page;
}

function normalizeRoute(value) {
  return (value || "").split("/").pop().trim().toLowerCase();
}

function setActiveRoute(currentPage) {
  document.querySelectorAll(".js-route-link").forEach((link) => {
    const route = normalizeRoute(link.getAttribute("data-route") || link.getAttribute("href"));
    const active = route && route === currentPage;

    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function openModalById(id) {
  if (typeof bootstrap === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;

  const modal = bootstrap.Modal.getOrCreateInstance(el);
  modal.show();
}

function closeModalById(id) {
  if (typeof bootstrap === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;

  const modal = bootstrap.Modal.getInstance(el);
  if (modal) modal.hide();
}

function bindMobileExperience() {
  const sidebar = document.getElementById("mfSidebar");
  const overlay = document.getElementById("mfOverlay");
  const comboBtn = document.getElementById("mobileComboBtn");
  const closeBtn = document.getElementById("mfSidebarClose");
  const bottomNav = document.querySelector(".mf-bottom-nav");

  const moreBtn = document.getElementById("mobileMoreBtn");
  const moreSheetEl = document.getElementById("mobileMoreSheet");
  const moreSheet =
    typeof bootstrap !== "undefined" && moreSheetEl
      ? bootstrap.Modal.getOrCreateInstance(moreSheetEl)
      : null;

  const isDesktop = () => window.matchMedia("(min-width: 992px)").matches;

  function setBottomNavVisible(visible) {
    if (!bottomNav) return;
    bottomNav.classList.toggle("is-hidden", !visible);
  }

  function openSidebar() {
    if (!sidebar || !overlay || isDesktop()) return;

    sidebar.classList.add("show");
    overlay.classList.add("show");
    if (comboBtn) comboBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    setBottomNavVisible(false);
  }

  function closeSidebar() {
    if (!sidebar || !overlay) return;

    sidebar.classList.remove("show");
    overlay.classList.remove("show");
    if (comboBtn) comboBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    setBottomNavVisible(true);
  }

  function toggleSidebar() {
    if (!sidebar) return;
    if (sidebar.classList.contains("show")) closeSidebar();
    else openSidebar();
  }

  function closeSheet() {
    if (moreSheet) moreSheet.hide();
  }

  comboBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    toggleSidebar();
  });

  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    closeSidebar();
  });

  overlay?.addEventListener("click", closeSidebar);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !isDesktop()) {
      closeSidebar();
      closeSheet();
    }
  });

  document.querySelectorAll(".mf-sidebar .js-route-link").forEach((link) => {
    link.addEventListener("click", () => {
      closeSidebar();
      closeSheet();
    });
  });

  moreBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    closeSidebar();
    if (moreSheet) moreSheet.show();
  });

  document.getElementById("openInviteBtnMobile")?.addEventListener("click", () => {
    closeSidebar();
    closeSheet();
    openModalById("inviteModal");
  });

  document.getElementById("openInviteFromSheet")?.addEventListener("click", () => {
    closeSheet();
    openModalById("inviteModal");
  });

  document.getElementById("openLogoutBtnMobile")?.addEventListener("click", () => {
    closeSidebar();
    closeSheet();

    if (document.getElementById("logoutConfirmModal")) {
      openModalById("logoutConfirmModal");
      return;
    }

    if (typeof logout === "function") logout();
  });

  document.getElementById("openLogoutFromSheet")?.addEventListener("click", () => {
    closeSheet();

    if (document.getElementById("logoutConfirmModal")) {
      openModalById("logoutConfirmModal");
      return;
    }

    if (typeof logout === "function") logout();
  });

  document.getElementById("openLogoutBtnDesktop")?.addEventListener("click", (e) => {
    if (document.getElementById("logoutConfirmModal")) return;

    e.preventDefault();
    if (typeof logout === "function") logout();
  });

  document.querySelectorAll('[data-profile-open="name"], [data-profile-open="avatar"]').forEach((trigger) => {
    trigger.addEventListener("click", () => {
      closeSidebar();
      closeSheet();
    });
  });

  window.addEventListener("resize", () => {
    if (isDesktop()) {
      closeSidebar();
      closeSheet();
      setBottomNavVisible(true);
      return;
    }

    closeSidebar();
    setBottomNavVisible(true);
  });

  setBottomNavVisible(true);
}

function bindNavbarAutoHide() {
  const navbar = document.querySelector(".mf-navbar");
  const sidebar = document.getElementById("mfSidebar");
  if (!navbar) return;

  const getScrollTop = () =>
    Math.max(
      window.scrollY || 0,
      window.pageYOffset || 0,
      document.documentElement?.scrollTop || 0,
      document.body?.scrollTop || 0
    );

  let lastY = getScrollTop();
  let ticking = false;
  const delta = 2;
  const minOffsetToHide = 48;

  function showNavbar() {
    navbar.classList.remove("is-scroll-hidden");
  }

  function hideNavbar() {
    navbar.classList.add("is-scroll-hidden");
  }

  function update() {
    const currentY = Math.max(getScrollTop(), 0);
    const diff = currentY - lastY;

    if (Math.abs(diff) < delta) {
      ticking = false;
      return;
    }

    const scrollingDown = currentY > lastY + delta;
    const scrollingUp = currentY < lastY - delta;
    const sidebarOpen = Boolean(sidebar?.classList.contains("show"));

    if (currentY <= 8 || scrollingUp || sidebarOpen) {
      showNavbar();
    } else if (scrollingDown && currentY > minOffsetToHide) {
      hideNavbar();
    }

    lastY = currentY;
    ticking = false;
  }

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener("scroll", onScroll, { passive: true });

  window.addEventListener("resize", () => {
    showNavbar();
    lastY = getScrollTop();
  });

  showNavbar();
}

function bindNavbarContentOffset() {
  const navbar = document.querySelector(".mf-navbar");
  const body = document.body;
  if (!navbar || !body) return;

  const applyOffset = () => {
    const navbarHeight = Math.ceil(navbar.getBoundingClientRect().height || 0);

    // Lê o padding "natural" do CSS sem o inline atual
    const prevInlinePaddingTop = body.style.paddingTop;
    body.style.paddingTop = "";
    const naturalPaddingTop = Number.parseFloat(window.getComputedStyle(body).paddingTop) || 0;

    const requiredPaddingTop = Math.max(naturalPaddingTop, navbarHeight + 6);
    body.style.paddingTop = `${requiredPaddingTop}px`;

    if (prevInlinePaddingTop && prevInlinePaddingTop !== body.style.paddingTop) {
      // Mantém comportamento determinístico em trocas de breakpoint
      body.style.paddingTop = `${requiredPaddingTop}px`;
    }
  };

  applyOffset();
  window.requestAnimationFrame(applyOffset);
  window.setTimeout(applyOffset, 120);

  window.addEventListener("resize", applyOffset);
  window.addEventListener("orientationchange", applyOffset);
}

document.addEventListener("DOMContentLoaded", async () => {
  const navbarContainer = document.getElementById("loadNavbar");
  if (!navbarContainer) return;

  try {
    const res = await fetch("navbar.html", { cache: "no-store" });
    if (!res.ok) throw new Error("Erro ao carregar navbar.html");

    const html = await res.text();
    navbarContainer.innerHTML = html;

    const currentPage = getCurrentPage();
    setActiveRoute(currentPage);

    bindMobileExperience();
    bindNavbarContentOffset();
    bindNavbarAutoHide();

    document.dispatchEvent(new Event("navbarLoaded"));

    if (typeof window.initProfileMenu === "function") {
      window.initProfileMenu();
    }

    if (typeof initTheme === "function") initTheme();
    if (typeof setupThemeListeners === "function") setupThemeListeners();

    if (typeof bindInviteModal === "function") bindInviteModal();
    if (typeof bindLogoutModal === "function") bindLogoutModal();
  } catch (err) {
    console.error(err);
    navbarContainer.innerHTML = `
      <div class="p-2 text-danger small">
        Navbar não carregada
      </div>
    `;
  }
});
