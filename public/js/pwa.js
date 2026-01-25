// public/js/pwa.js
(() => {
  const SW_URL = "/sw.js";
  const APP_NAME = "MyFinance";
  const ICON_URL = "/assets/icons/icon-192.png";
  const DISMISS_DAYS = 10;
  const HIDE_UNTIL_KEY = "mf_pwa_hide_until";
  const INSTALLED_KEY = "mf_pwa_installed";
  const INSTALL_BTN_ID = "pwaInstallBtn";

  let deferredPrompt = null;
  let bannerEl = null;
  let initialized = false;

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function canShow() {
    if (isStandalone()) return false;
    if (localStorage.getItem(INSTALLED_KEY) === "1") return false;
    const until = Number(localStorage.getItem(HIDE_UNTIL_KEY) || 0);
    return Date.now() > until;
  }

  function hideForDays(days) {
    const until = Date.now() + days * 24 * 60 * 60 * 1000;
    localStorage.setItem(HIDE_UNTIL_KEY, String(until));
    updateInstallButton();
  }

  function getInstallButton() {
    return document.getElementById(INSTALL_BTN_ID);
  }

  function bindInstallButton() {
    const btn = getInstallButton();
    if (!btn || btn.dataset.bound === "1") return;

    btn.addEventListener("click", async () => {
      if (isStandalone()) return;

      if (deferredPrompt) {
        deferredPrompt.prompt();
        try {
          const choice = await deferredPrompt.userChoice;
          if (choice && choice.outcome === "accepted") {
            localStorage.setItem(INSTALLED_KEY, "1");
          } else {
            hideForDays(DISMISS_DAYS);
          }
        } catch {
          hideForDays(DISMISS_DAYS);
        } finally {
          deferredPrompt = null;
          updateInstallButton();
        }
        return;
      }

      if (isIos()) showBanner("ios");
    });

    btn.dataset.bound = "1";
  }

  function updateInstallButton() {
    const btn = getInstallButton();
    if (!btn) return;
    bindInstallButton();

    if (isStandalone()) {
      btn.classList.add("d-none");
      return;
    }

    if (localStorage.getItem(INSTALLED_KEY) === "1") {
      btn.classList.add("d-none");
      return;
    }

    btn.classList.remove("d-none");
  }

  function ensureStyles() {
    if (document.getElementById("pwa-install-style")) return;
    const link = document.createElement("link");
    link.id = "pwa-install-style";
    link.rel = "stylesheet";
    link.href = "/assets/css/pwa-install.css";
    document.head.appendChild(link);
  }

  function init() {
    if (initialized) return;
    initialized = true;
    register();
    updateInstallButton();
    if (deferredPrompt) showBanner("default");
    if (isIos()) setTimeout(() => showBanner("ios"), 1200);
    bindOfflineRedirect();
    ensureOfflineCached();
  }

  async function ensureOfflineCached() {
    if (!("caches" in window)) return;
    try {
      const cache = await caches.open("offline-precache");
      await cache.add("/offline.html");
    } catch {
      // ignore caching failures
    }
  }

  function bindOfflineRedirect() {
    if (window.__pwaOfflineBound) return;
    window.__pwaOfflineBound = true;

    const LAST_URL_KEY = "mf_pwa_last_url";
    const RELOAD_GUARD_KEY = "mf_pwa_reload_guard";
    let offlineCheckTimer = null;

    const goOffline = async () => {
      if (window.location.pathname.endsWith("/offline.html")) return;
      if (navigator.onLine) return;
      // Evita re-renderizar offline.html em loop na mesma sessao
      if (window.__offlineRendered) return;
      try {
        sessionStorage.setItem(LAST_URL_KEY, window.location.href);
        sessionStorage.removeItem(RELOAD_GUARD_KEY);
      } catch {}
      try {
        if ("caches" in window) {
          const cached = await caches.match("/offline.html", { ignoreSearch: true });
          if (cached) {
            // Renderiza a pagina offline direto do cache para evitar tela padrao do navegador
            const html = await cached.text();
            window.__offlineRendered = true;
            history.replaceState(null, "", "/offline.html");
            document.open();
            document.write(html);
            document.close();
            return;
          }
        }
      } catch {}
      window.location.href = "/offline.html";
    };

    window.addEventListener("offline", () => { void goOffline(); });

    window.addEventListener("online", () => {
      if (window.location.pathname.endsWith("/offline.html")) {
        try {
          if (sessionStorage.getItem(RELOAD_GUARD_KEY) === "1") return;
          sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
          const lastUrl = sessionStorage.getItem(LAST_URL_KEY);
          if (lastUrl) {
            window.location.href = lastUrl;
            return;
          }
        } catch {}
        window.location.href = "/index.html";
      }
      ensureOfflineCached();
    });

    if (!navigator.onLine) void goOffline();

    // Fallback: alguns navegadores não disparam o evento "offline"
    offlineCheckTimer = window.setInterval(() => {
      if (!navigator.onLine) void goOffline();
    }, 3000);
  }

  function buildBanner(mode) {
    if (bannerEl) return bannerEl;

    ensureStyles();
    const el = document.createElement("div");
    el.id = "pwa-install";
    el.className = "pwa-install-card";
    if (mode === "ios") el.classList.add("pwa-install-card--ios");
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-live", "polite");

    el.innerHTML = `
      <div class="pwa-install-card__inner">
        <div class="pwa-install-card__icon">
          <img src="${ICON_URL}" alt="${APP_NAME}" />
        </div>
        <div class="pwa-install-card__content">
          <div class="pwa-install-card__title">Instale o ${APP_NAME}</div>
          <div class="pwa-install-card__text">
            Adicione o ${APP_NAME} à tela de início para acessar rapidamente e aproveitar uma experiência otimizada.
          </div>
          <div class="pwa-install-card__actions">
            <button class="pwa-btn pwa-btn--primary" data-action="install">Instalar</button>
            <button class="pwa-btn pwa-btn--ghost" data-action="dismiss">Agora nao</button>
          </div>
          <div class="pwa-install-card__hint">
            No iPhone: toque em Compartilhar e escolha "Adicionar a Tela de Inicio".
          </div>
        </div>
        <button class="pwa-install-card__close" aria-label="Fechar" data-action="dismiss">×</button>
      </div>
    `;

    document.body.appendChild(el);

    const installBtn = el.querySelector("[data-action='install']");
    const dismissBtns = el.querySelectorAll("[data-action='dismiss']");

    if (installBtn) {
      installBtn.addEventListener("click", async () => {
        if (isIos()) {
          hideForDays(DISMISS_DAYS);
          hideBanner();
          return;
        }
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        try {
          const choice = await deferredPrompt.userChoice;
          if (choice && choice.outcome === "accepted") {
            localStorage.setItem(INSTALLED_KEY, "1");
          } else {
            hideForDays(DISMISS_DAYS);
          }
        } catch {
          hideForDays(DISMISS_DAYS);
        } finally {
          deferredPrompt = null;
          hideBanner();
          updateInstallButton();
        }
      });
    }

    dismissBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        hideForDays(DISMISS_DAYS);
        hideBanner();
      });
    });

    bannerEl = el;
    return el;
  }

  function showBanner(mode) {
    if (!canShow()) return;
    const el = buildBanner(mode);
    el.classList.add("is-visible");
  }

  function hideBanner() {
    if (!bannerEl) return;
    bannerEl.classList.remove("is-visible");
  }

  async function register() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register(SW_URL);
      const SW_RELOAD_KEY = "mf_sw_reload_once";

      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;

        nw.addEventListener("statechange", () => {
          if (nw.state === "installed") {
            // Garante que o offline.html esteja no cache para renderizacao imediata
            if ("caches" in window) {
              caches.open("offline-precache").then((cache) => {
                cache.add("/offline.html").catch(() => {});
              }).catch(() => {});
            }

            if (navigator.serviceWorker.controller) {
              reg.waiting?.postMessage({ type: "SKIP_WAITING" });
            }
          }
        });
      });

      if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        try {
          sessionStorage.setItem(SW_RELOAD_KEY, "1");
        } catch {}
        // Evita loop de reload. Deixe o usuário recarregar manualmente.
      });

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
    } catch {
      // keep silent to avoid breaking UX
    }
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    updateInstallButton();
    if (document.readyState === "complete") {
      showBanner("default");
    }
  });

  window.addEventListener("appinstalled", () => {
    localStorage.setItem(INSTALLED_KEY, "1");
    hideBanner();
    updateInstallButton();
  });

  document.addEventListener("DOMContentLoaded", init);

  if (document.readyState === "complete" || document.readyState === "interactive") {
    init();
  }
})();
