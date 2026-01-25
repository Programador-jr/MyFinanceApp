// public/js/idleLogout.js
(function () {
  const IDLE_LIMIT_MS = 30 * 60 * 1000
  const TOKEN_KEY = "token";
  const LAST_ACTIVITY_KEY = "last_activity_at";

  let idleTimer = null;

  function doLogout(reason = "idle") {
    if (typeof window.appLogout === "function") {
      window.appLogout(reason);
      return;
    }

    // fallback (se api.js não estiver carregado)
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(LAST_ACTIVITY_KEY);
    } catch (_) {}

    if (!window.location.pathname.endsWith("index.html")) {
      window.location.href = "index.html?reason=" + encodeURIComponent(reason);
    }
  }

  function setLastActivityNow() {
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    } catch (_) {}
  }

  function getLastActivity() {
    const v = localStorage.getItem(LAST_ACTIVITY_KEY);
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function resetIdleTimer() {
    if (!localStorage.getItem(TOKEN_KEY)) return;

    setLastActivityNow();

    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => doLogout("idle"), IDLE_LIMIT_MS);
  }

  function checkIdleOnReturn() {
    if (!localStorage.getItem(TOKEN_KEY)) return;

    const last = getLastActivity();

    // Se não existe last_activity_at, trata como “acabou de entrar”
    if (!last) {
      resetIdleTimer();
      return;
    }

    const diff = Date.now() - last;

    if (diff >= IDLE_LIMIT_MS) doLogout("idle");
    else resetIdleTimer();
  }

  // Eventos que contam como atividade
  ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"].forEach((evt) => {
    window.addEventListener(evt, resetIdleTimer, { passive: true });
  });

  window.addEventListener("focus", checkIdleOnReturn);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkIdleOnReturn();
  });

  // IMPORTANTE: ao carregar a página, conta como atividade (evita deslogar “na hora”)
  resetIdleTimer();
})();
