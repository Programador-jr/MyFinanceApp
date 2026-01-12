/* ===============================
   AUTH
================================ */

function checkAuth() {
  const token = localStorage.getItem("token");
  if (!token) window.location.href = "index.html";
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "index.html";
}

/* ===============================
   LOADER & BUTTON
================================ */

function setLoading(button, isLoading) {
  if (!button) return;

  if (isLoading) {
    button.disabled = true;
    button.dataset.originalHtml = button.innerHTML;
    button.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2"></span>
      Enviando...
    `;
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.originalHtml || button.innerHTML;
  }
}

/* ===============================
   ALERTS
================================ */

function showAlert(message, type = "success", icon = "check-circle") {
  const container = document.getElementById("alert-container");
  if (!container) return;

  container.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show d-flex align-items-center shadow" role="alert">
      <i class="fa-solid fa-${icon} me-2 fs-5"></i>
      <div>${message}</div>
    </div>
  `;

  setTimeout(() => {
    container.innerHTML = "";
  }, 2000);
}

/* ===============================
   HELPERS (bind safe)
================================ */

function bindOnce(el, key, handler, eventName = "click") {
  if (!el) return false;
  const attr = `data-bound-${key}`;
  if (el.getAttribute(attr) === "1") return false;
  el.addEventListener(eventName, handler);
  el.setAttribute(attr, "1");
  return true;
}

/* ===============================
   UI BINDINGS (Dashboard)
================================ */

function bindUI() {
  const filterBtn = document.getElementById("filterBtn");
  if (filterBtn && typeof applyFilter === "function") {
    bindOnce(filterBtn, "filterBtn", () => applyFilter());
  }

  const toggleBtn = document.getElementById("toggleAdvancedBtn");
  if (toggleBtn) {
    bindOnce(toggleBtn, "toggleAdvancedBtn", () => {
      const adv = document.getElementById("advancedContainer");
      if (!adv || typeof bootstrap === "undefined") return;

      const bs = new bootstrap.Collapse(adv, { toggle: false });

      if (!adv.classList.contains("show")) {
        bs.show();
        if (typeof advancedLoaded !== "undefined" && !advancedLoaded) {
          advancedLoaded = true;
        }
      } else {
        bs.hide();
      }
    });
  }

  const compareBtn = document.getElementById("compareBtn");
  if (compareBtn) {
    bindOnce(compareBtn, "compareBtn", () => {
      if (typeof loadAdvancedComparison === "function") {
        loadAdvancedComparison();
      } else {
        showAlert(
          "Funcionalidade de comparação não disponível",
          "danger",
          "triangle-exclamation"
        );
      }
    });
  }
}

/* ===============================
   INVITE / COPIAR / REGEN
================================ */

function bindInviteModal() {
  const inviteInput = document.getElementById("inviteCodeInput");
  const copyBtn = document.getElementById("copyInviteBtn");
  const regenBtn = document.getElementById("regenInviteBtn");
  const openBtn = document.getElementById("openInviteBtn");

  if (!inviteInput || !copyBtn || !regenBtn || !openBtn) return;

  async function loadInvite() {
    try {
      const data = await apiFetch("/family/invite-code");
      inviteInput.value = data.inviteCode || "";
    } catch (err) {
      inviteInput.value = "";
      showAlert("Não foi possível carregar o código", "danger", "triangle-exclamation");
    }
  }

  bindOnce(openBtn, "invite-open", loadInvite);

  bindOnce(copyBtn, "invite-copy", async () => {
    try {
      await navigator.clipboard.writeText(inviteInput.value);
      showAlert("Código copiado", "success", "copy");
    } catch {
      showAlert("Não foi possível copiar", "danger", "triangle-exclamation");
    }
  });

  bindOnce(regenBtn, "invite-regen", async () => {
    setLoading(regenBtn, true);
    try {
      const data = await apiFetch("/family/invite-code", "PATCH");
      inviteInput.value = data.inviteCode || "";
      showAlert("Novo código gerado", "success", "rotate");
    } catch (err) {
      showAlert(err.message || "Erro ao gerar código", "danger", "triangle-exclamation");
    } finally {
      setLoading(regenBtn, false);
    }
  });
}

/* ===============================
   LOGOUT MODAL (navbar)
================================ */

function bindLogoutModal() {
  const btn = document.getElementById("confirmLogout");
  const modalEl = document.getElementById("logoutConfirmModal");
  if (!btn || !modalEl) return;

  bindOnce(btn, "logout-confirm", () => {
    if (typeof bootstrap !== "undefined") {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
    logout();
  });
}

/* ===============================
   THEME - FUNÇÕES GLOBAIS (mantido)
================================ */

function initTheme() {
  if (window.__themeInitialized) return;
  window.__themeInitialized = true;

  const t = localStorage.getItem("theme") || "system";
  applyTheme(t);
  updateThemeIcon(t);

  setupThemeListeners();
}

function setupThemeListeners() {
  document.querySelectorAll(".theme-option").forEach((btn) => {
    btn.replaceWith(btn.cloneNode(true));
  });

  document.querySelectorAll(".theme-option").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const theme = btn.dataset.theme;
      applyTheme(theme);
    });
  });
}

function applyTheme(mode) {
  localStorage.setItem("theme", mode);

  const html = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (mode === "system") {
    html.setAttribute("data-bs-theme", prefersDark ? "dark" : "light");
  } else {
    html.setAttribute("data-bs-theme", mode);
  }

  updateThemeIcon(mode);

  window.dispatchEvent(new CustomEvent("themeChanged", { detail: { theme: mode } }));
}

function updateThemeIcon(mode) {
  const icon = document.querySelector("#themeBtn i");
  if (!icon) return;

  icon.className = "";

  if (mode === "light") {
    icon.classList.add("fa-solid", "fa-sun");
  } else if (mode === "dark") {
    icon.classList.add("fa-solid", "fa-moon");
  } else {
    icon.classList.add("fa-solid", "fa-display");
  }

  const themeText = document.querySelector("#themeBtn .d-none.d-sm-inline");
  if (themeText) {
    themeText.textContent =
      mode === "light" ? "Claro" : mode === "dark" ? "Escuro" : "Sistema";
  }
}

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  const currentTheme = localStorage.getItem("theme");
  if (currentTheme === "system") applyTheme("system");
});

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
});

if (document.readyState === "complete" || document.readyState === "interactive") {
  setTimeout(initTheme, 50);
}

/* ===============================
   COR DO APP (novo)
   - aplicada a partir do perfil
================================ */

function getAppColorPalette(color) {
  const palettes = {
    blue: { hex: "#0d6efd", rgb: "13,110,253" },
    purple: { hex: "#8b5cf6", rgb: "139,92,246" },
    yellow: { hex: "#f59e0b", rgb: "245,158,11" },
    red: { hex: "#ef4444", rgb: "239,68,68" },
  };
  return palettes[color] || palettes.blue;
}

// Aplica no Bootstrap (primary) e também expõe variáveis mf
function applyAppColor(color) {
  const p = getAppColorPalette(color);

  const root = document.documentElement;
  root.style.setProperty("--bs-primary", p.hex);
  root.style.setProperty("--bs-primary-rgb", p.rgb);

  root.style.setProperty("--mf-primary", p.hex);
  root.style.setProperty("--mf-primary-rgb", p.rgb);
}
