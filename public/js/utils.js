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
   GLOBAL API LOADER (boot)
================================ */

function isApiBootLoaderEnabledForCurrentPage() {
  const page = (window.location.pathname.split("/").pop() || "index.html")
    .trim()
    .toLowerCase();

  const publicPages = new Set([
    "",
    "index.html",
    "register.html",
    "forgot-password.html",
    "reset-password.html",
    "verify-email.html",
    "offline.html",
  ]);

  return !publicPages.has(page);
}

const __mfApiBootLoader = {
  pending: 0,
  visible: false,
  bootActive: isApiBootLoaderEnabledForCurrentPage(),
  hadRequests: false,
  shownAt: 0,
  hideTimer: null,
};

function ensureApiBootLoaderStyles() {
  if (document.getElementById("mf-api-boot-loader-style")) return;

  const style = document.createElement("style");
  style.id = "mf-api-boot-loader-style";
  style.textContent = `
    html.mf-no-scroll,
    body.mf-no-scroll {
      overflow: hidden !important;
      overscroll-behavior: none;
    }

    .mf-api-boot-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483600;
      background: rgba(2, 6, 23, 0.7);
      backdrop-filter: blur(7px);
      -webkit-backdrop-filter: blur(7px);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 0.24s ease, visibility 0.24s ease;
    }

    .mf-api-boot-overlay.show {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }

    .mf-api-boot-card {
      min-width: min(88vw, 320px);
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--mf-primary, #3b82f6) 20%, #0f172a 80%),
        color-mix(in srgb, var(--mf-primary-light, #60a5fa) 22%, #0f172a 78%)
      );
      box-shadow: 0 20px 44px rgba(0, 0, 0, 0.34);
      padding: 18px 18px 16px;
      color: rgba(255, 255, 255, 0.96);
      text-align: center;
    }

    .mf-api-boot-transfer {
      width: 92px;
      height: 48px;
      margin: 0 auto 10px;
      position: relative;
    }

    .mf-api-boot-dot {
      width: 12px;
      height: 12px;
      border-radius: 999px;
      position: absolute;
      top: 18px;
      box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.08);
    }

    .mf-api-boot-dot.from {
      left: 0;
      background: #86efac;
    }

    .mf-api-boot-dot.to {
      right: 0;
      background: #93c5fd;
    }

    .mf-api-boot-line {
      position: absolute;
      left: 14px;
      right: 14px;
      top: 24px;
      height: 2px;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.18);
    }

    .mf-api-boot-line::before {
      content: "";
      position: absolute;
      top: 0;
      left: -36%;
      width: 36%;
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.95));
      animation: mfApiFlow 0.95s linear infinite;
    }

    .mf-api-boot-line.reverse::before {
      animation-direction: reverse;
      animation-duration: 1.08s;
      opacity: 0.7;
    }

    @keyframes mfApiFlow {
      from { transform: translateX(0); }
      to { transform: translateX(380%); }
    }

    .mf-api-boot-title {
      font-weight: 800;
      font-size: 0.98rem;
      letter-spacing: 0.01em;
      margin-bottom: 4px;
    }

    .mf-api-boot-subtitle {
      font-size: 0.82rem;
      color: rgba(255, 255, 255, 0.75);
    }
  `;

  document.head.appendChild(style);
}

function setGlobalScrollLocked(locked) {
  const action = locked ? "add" : "remove";
  document.documentElement?.classList[action]("mf-no-scroll");
  document.body?.classList[action]("mf-no-scroll");
}

function ensureApiBootLoaderElement() {
  let el = document.getElementById("mfApiBootLoader");
  if (el) return el;
  if (!document.body) return null;

  el = document.createElement("div");
  el.id = "mfApiBootLoader";
  el.className = "mf-api-boot-overlay";
  el.setAttribute("aria-live", "polite");
  el.setAttribute("aria-busy", "true");
  el.innerHTML = `
    <div class="mf-api-boot-card">
      <div class="mf-api-boot-transfer" aria-hidden="true">
        <span class="mf-api-boot-dot from"></span>
        <span class="mf-api-boot-dot to"></span>
        <span class="mf-api-boot-line"></span>
        <span class="mf-api-boot-line reverse"></span>
      </div>
      <div class="mf-api-boot-title">Carregando transações...</div>
      <div class="mf-api-boot-subtitle">Sincronizando dados da API</div>
    </div>
  `;
  document.body.appendChild(el);
  return el;
}

function setApiBootLoaderVisible(visible) {
  ensureApiBootLoaderStyles();
  const el = ensureApiBootLoaderElement();
  if (!el) return;

  __mfApiBootLoader.visible = !!visible;
  el.classList.toggle("show", !!visible);
  setGlobalScrollLocked(!!visible);
}

function markApiBootStart() {
  __mfApiBootLoader.pending += 1;
  __mfApiBootLoader.hadRequests = true;

  if (!__mfApiBootLoader.bootActive) return;

  if (__mfApiBootLoader.hideTimer) {
    clearTimeout(__mfApiBootLoader.hideTimer);
    __mfApiBootLoader.hideTimer = null;
  }

  if (!__mfApiBootLoader.visible) {
    __mfApiBootLoader.shownAt = Date.now();
    setApiBootLoaderVisible(true);
  }
}

function markApiBootEnd() {
  __mfApiBootLoader.pending = Math.max(__mfApiBootLoader.pending - 1, 0);

  if (!__mfApiBootLoader.bootActive) return;
  if (!__mfApiBootLoader.hadRequests) return;
  if (__mfApiBootLoader.pending > 0) return;

  const minVisibleMs = 420;
  const elapsed = Date.now() - __mfApiBootLoader.shownAt;
  const wait = Math.max(minVisibleMs - elapsed, 0);

  if (__mfApiBootLoader.hideTimer) clearTimeout(__mfApiBootLoader.hideTimer);
  __mfApiBootLoader.hideTimer = setTimeout(() => {
    setApiBootLoaderVisible(false);
    __mfApiBootLoader.bootActive = false;
    __mfApiBootLoader.hideTimer = null;
  }, wait);
}

window.__mfApiLoadingStart = markApiBootStart;
window.__mfApiLoadingEnd = markApiBootEnd;
window.__mfShowApiLoader = () => setApiBootLoaderVisible(true);
window.__mfHideApiLoader = () => setApiBootLoaderVisible(false);

function shouldTrackApiRequest(input) {
  const requestUrl = typeof input === "string" ? input : String(input?.url || "");
  if (!requestUrl) return false;

  let resolvedUrl;
  try {
    resolvedUrl = new URL(requestUrl, window.location.origin);
  } catch {
    return false;
  }

  const apiPrefixes = [
    "/dashboard",
    "/transactions",
    "/categories",
    "/boxes",
    "/accounts",
    "/family",
    "/settings",
    "/auth",
    "/users",
    "/profile",
    "/verify",
    "/register",
    "/reset-password",
    "/forgot-password",
    "/resend",
    "/email",
  ];

  const apiBaseRaw = String(window.__API_URL__ || "").trim();
  if (apiBaseRaw) {
    try {
      const apiBase = new URL(apiBaseRaw, window.location.origin);
      const basePath = apiBase.pathname.replace(/\/+$/, "");
      if (resolvedUrl.origin !== apiBase.origin) return false;
      if (!basePath || basePath === "/") {
        return apiPrefixes.some((prefix) => resolvedUrl.pathname.startsWith(prefix));
      }
      return resolvedUrl.pathname === basePath || resolvedUrl.pathname.startsWith(`${basePath}/`);
    } catch {
      return false;
    }
  }

  // Fallback quando API_URL não estiver definido explicitamente.

  return apiPrefixes.some((prefix) => resolvedUrl.pathname.startsWith(prefix));
}

function installApiFetchTracker() {
  if (window.__mfApiFetchTrackerInstalled) return;
  if (typeof window.fetch !== "function") return;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = function trackedFetch(input, init) {
    const trackThis = shouldTrackApiRequest(input);

    if (trackThis && typeof window.__mfApiLoadingStart === "function") {
      window.__mfApiLoadingStart();
    }

    const finalize = () => {
      if (trackThis && typeof window.__mfApiLoadingEnd === "function") {
        window.__mfApiLoadingEnd();
      }
    };

    try {
      const result = nativeFetch(input, init);
      if (!result || typeof result.finally !== "function") {
        finalize();
        return result;
      }
      return result.finally(finalize);
    } catch (err) {
      finalize();
      throw err;
    }
  };

  window.__mfApiFetchTrackerInstalled = true;
}

installApiFetchTracker();

/* ===============================
   ALERTS
================================ */

let __mfAlertHideTimer = null;

function ensureGlobalAlertStyles() {
  if (document.getElementById("mf-global-alert-styles")) return;

  const style = document.createElement("style");
  style.id = "mf-global-alert-styles";
  style.textContent = `
    #alert-container {
      pointer-events: none;
    }

    #alert-container .mf-global-alert {
      pointer-events: auto;
      margin: 0;
      border-radius: 12px;
      border: 1px solid rgba(var(--mf-primary-rgb, 59, 130, 246), 0.2);
      border-left-width: 4px;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9));
      color: #f1f5f9;
      box-shadow: 0 10px 24px rgba(2, 6, 23, 0.36);
      animation: mfAlertSlideDown 0.22s ease-out;
    }

    #alert-container .mf-global-alert .mf-alert-icon {
      width: 1.25rem;
      text-align: center;
      color: #e2e8f0;
      flex-shrink: 0;
    }

    #alert-container .mf-global-alert .mf-alert-message {
      color: #f1f5f9;
      line-height: 1.35;
      font-weight: 500;
      word-break: break-word;
      overflow-wrap: anywhere;
    }

    #alert-container .mf-global-alert.alert-success {
      border-left-color: #00be19;
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(30, 41, 59, 0.9));
    }

    #alert-container .mf-global-alert.alert-danger {
      border-left-color: #ef4444;
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(30, 41, 59, 0.9));
    }

    #alert-container .mf-global-alert.alert-warning {
      border-left-color: #f59e0b;
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(30, 41, 59, 0.9));
    }

    #alert-container .mf-global-alert.alert-info {
      border-left-color: #0ea5e9;
      background: linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(30, 41, 59, 0.9));
    }

    #alert-container .mf-global-alert.alert-secondary {
      border-left-color: #64748b;
      background: linear-gradient(135deg, rgba(100, 116, 139, 0.2), rgba(30, 41, 59, 0.9));
    }

    #alert-container .mf-global-alert.alert-primary {
      border-left-color: var(--mf-primary, #3b82f6);
      background: linear-gradient(
        135deg,
        rgba(var(--mf-primary-rgb, 59, 130, 246), 0.24),
        rgba(30, 41, 59, 0.9)
      );
    }

    @keyframes mfAlertSlideDown {
      from {
        opacity: 0;
        transform: translateY(-12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;

  document.head.appendChild(style);
}

function showAlert(message, type = "success", icon = "check-circle") {
  const container = document.getElementById("alert-container");
  if (!container) return;

  ensureGlobalAlertStyles();

  const validTypes = new Set([
    "primary",
    "secondary",
    "success",
    "danger",
    "warning",
    "info",
    "light",
    "dark",
  ]);
  const safeType = validTypes.has(String(type || "").trim()) ? String(type).trim() : "secondary";

  container.style.zIndex = "2147483647";

  if (__mfAlertHideTimer) {
    clearTimeout(__mfAlertHideTimer);
    __mfAlertHideTimer = null;
  }

  container.innerHTML = `
    <div class="alert alert-${safeType} mf-global-alert d-flex align-items-center gap-2" role="alert">
      <i class="fa-solid fa-${icon} mf-alert-icon"></i>
      <div class="mf-alert-message">${message}</div>
    </div>
  `;

  __mfAlertHideTimer = setTimeout(() => {
    container.innerHTML = "";
    __mfAlertHideTimer = null;
  }, 2200);
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
   FORMATTERS
================================ */

function toNumericValue(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    let raw = value.trim();
    if (!raw) return fallback;

    raw = raw
      .replace(/\s+/g, "")
      .replace(/[R$\u00A0]/g, "")
      .replace(/%/g, "");

    const hasComma = raw.includes(",");
    const hasDot = raw.includes(".");

    if (hasComma && hasDot) {
      if (raw.lastIndexOf(",") > raw.lastIndexOf(".")) {
        raw = raw.replace(/\./g, "").replace(",", ".");
      } else {
        raw = raw.replace(/,/g, "");
      }
    } else if (hasComma) {
      raw = raw.replace(/\./g, "").replace(",", ".");
    } else if (hasDot) {
      // Caso comum de moeda BR sem casas decimais: 1.234 / 12.345.678
      if (/^-?\d{1,3}(\.\d{3})+$/.test(raw)) {
        raw = raw.replace(/\./g, "");
      } else {
        // Se houver múltiplos pontos e não for padrão de milhar,
        // mantém apenas o último como separador decimal.
        const parts = raw.split(".");
        if (parts.length > 2) {
          const decimal = parts.pop();
          raw = `${parts.join("")}.${decimal}`;
        }
      }
    } else {
      raw = raw.replace(/,/g, "");
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumberBR(value, options = {}) {
  const number = toNumericValue(value, 0);
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  return number.toLocaleString("pt-BR", {
    minimumFractionDigits,
    maximumFractionDigits,
  });
}

function formatCurrency(value, options = {}) {
  const number = toNumericValue(value, 0);

  return number.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  });
}

function formatPercentBR(value, options = {}) {
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    suffix = "%",
  } = options;

  return `${formatNumberBR(value, { minimumFractionDigits, maximumFractionDigits })}${suffix}`;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function toLocalISODate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
}

function parseDateLikeLocal(value, options = {}) {
  const { middayHour = 12 } = options;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getTime());
  }

  const raw = String(value || "").trim();
  if (!raw) return null;

  const onlyDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (onlyDate) {
    const year = Number(onlyDate[1]);
    const month = Number(onlyDate[2]) - 1;
    const day = Number(onlyDate[3]);
    const date = new Date(year, month, day, middayHour, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toApiIsoFromLocalDateInput(value, options = {}) {
  const { hour = 12 } = options;
  const date = parseDateLikeLocal(value, { middayHour: hour });
  if (!date) return "";
  return date.toISOString();
}

function toLocalInputDate(value) {
  const date = parseDateLikeLocal(value, { middayHour: 12 });
  if (!date) return "";
  return toLocalISODate(date);
}

function formatDateUserLocal(value, options = {}) {
  const {
    locale = "pt-BR",
    includeTime = false,
    dateStyle = "short",
    timeStyle = "short",
    fallback = "-",
  } = options;

  const date = parseDateLikeLocal(value, { middayHour: 12 });
  if (!date) return fallback;

  const formatterOptions = includeTime
    ? { dateStyle, timeStyle }
    : { dateStyle };

  try {
    return new Intl.DateTimeFormat(locale, formatterOptions).format(date);
  } catch (_) {
    return includeTime
      ? date.toLocaleString(locale)
      : date.toLocaleDateString(locale);
  }
}

function addThousandsSeparatorBRInt(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "0";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function normalizeMoneyTyping(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";

  const padded = digits.padStart(3, "0");
  const intPartRaw = padded.slice(0, -2).replace(/^0+(?=\d)/, "");
  const decimalPart = padded.slice(-2);
  const intPartFormatted = addThousandsSeparatorBRInt(intPartRaw);

  return `${intPartFormatted},${decimalPart}`;
}

function setMoneyInputValue(input, value, options = {}) {
  if (!input) return;
  const { allowEmpty = true } = options;
  const raw = String(value ?? "").trim();

  if (!raw) {
    input.value = allowEmpty ? "" : "0,00";
    return;
  }

  const numeric = toNumericValue(value, NaN);
  if (!Number.isFinite(numeric)) {
    input.value = allowEmpty ? "" : "0,00";
    return;
  }

  input.value = formatNumberBR(numeric, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getMoneyInputValue(input, fallback = 0) {
  if (!input) return fallback;
  return toNumericValue(input.value, fallback);
}

function bindMoneyInputMask(input) {
  if (!input) return false;
  if (input.getAttribute("data-money-mask-bound") === "1") return false;

  const onInput = () => {
    input.value = normalizeMoneyTyping(input.value);
  };

  const onBlur = () => {
    const raw = String(input.value || "").trim();
    if (!raw) {
      input.value = "";
      return;
    }
    input.value = normalizeMoneyTyping(raw);
  };

  input.addEventListener("input", onInput);
  input.addEventListener("blur", onBlur);
  input.setAttribute("data-money-mask-bound", "1");

  if (String(input.value || "").trim()) {
    onInput();
    onBlur();
  }

  return true;
}

function bindMoneyInputMasks(root = document) {
  const scope = root && typeof root.querySelectorAll === "function" ? root : document;
  scope
    .querySelectorAll('input[data-money-mask="brl"]')
    .forEach((input) => bindMoneyInputMask(input));
}

function initMoneyInputMasks() {
  bindMoneyInputMasks(document);
}

window.toNumericValue = toNumericValue;
window.formatNumberBR = formatNumberBR;
window.formatCurrency = formatCurrency;
window.formatPercentBR = formatPercentBR;
window.toLocalISODate = toLocalISODate;
window.parseDateLikeLocal = parseDateLikeLocal;
window.toApiIsoFromLocalDateInput = toApiIsoFromLocalDateInput;
window.toLocalInputDate = toLocalInputDate;
window.formatDateUserLocal = formatDateUserLocal;
window.setMoneyInputValue = setMoneyInputValue;
window.getMoneyInputValue = getMoneyInputValue;
window.bindMoneyInputMask = bindMoneyInputMask;
window.bindMoneyInputMasks = bindMoneyInputMasks;

/* ===============================
   UI BINDINGS (Dashboard)
================================ */

function bindUI() {
  const filterBtn = document.getElementById("filterBtn");
  if (filterBtn && typeof applyFilter === "function") {
    bindOnce(filterBtn, "filterBtn", () => applyFilter());
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
  const inviteModal = document.getElementById("inviteModal");
  const openBtns = [
    ...document.querySelectorAll("#openInviteBtn, #openInviteBtnMobile, #openInviteFromSheet"),
  ];

  if (!inviteInput || !copyBtn || !regenBtn || !inviteModal) return;

  async function copyTextSafe(value) {
    const text = String(value || "").trim();
    if (!text) throw new Error("EMPTY_COPY_TEXT");

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
        // fallback below
      }
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    } finally {
      document.body.removeChild(textarea);
    }

    if (!copied) {
      throw new Error("COPY_FAILED");
    }
  }

  async function loadInvite() {
    try {
      const data = await apiFetch("/family/invite-code");
      inviteInput.value = data.inviteCode || "";
    } catch (err) {
      inviteInput.value = "";
      showAlert("Não foi possível carregar o código", "danger", "triangle-exclamation");
    }
  }

  bindOnce(inviteModal, "invite-show", loadInvite, "shown.bs.modal");
  openBtns.forEach((btn, i) => {
    bindOnce(btn, `invite-open-${i}`, loadInvite);
  });

  bindOnce(copyBtn, "invite-copy", async () => {
    try {
      await copyTextSafe(inviteInput.value);
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
   THEME
================================ */

function getStoredThemeMode() {
  const mode = localStorage.getItem("theme") || "system";
 return ["system", "dark", "light"].includes(mode) ? mode : "system";
}

function getResolvedTheme(mode) {
 const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
 if (mode === "system") return prefersDark ? "dark" : "light";
 return mode === "dark" ? "dark" : "light";
}

function syncThemeControls(mode) {
  const resolved = getResolvedTheme(mode);

  const desktopToggleBtn = document.getElementById("themeToggleBtn");
  if (desktopToggleBtn) {
 const nextLabel = resolved === "dark" ? "Ativar tema claro" : "Ativar tema escuro";
    desktopToggleBtn.setAttribute("aria-label", nextLabel);
    desktopToggleBtn.setAttribute("title", nextLabel);
    desktopToggleBtn.setAttribute("data-theme", resolved);
  }

  const mobileToggle = document.getElementById("mobileThemeToggle");
  if (mobileToggle) mobileToggle.checked = resolved === "dark";

  document.querySelectorAll(".theme-option").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === mode);
  });
}

let __mfThemeSwitchTimer = null;

function ensureThemeSwitchStyles() {
  if (document.getElementById("mf-theme-switch-style")) return;

  const style = document.createElement("style");
  style.id = "mf-theme-switch-style";
  style.textContent = `
    html.mf-theme-switching *,
    html.mf-theme-switching *::before,
    html.mf-theme-switching *::after {
      transition: none !important;
      animation: none !important;
    }
  `;

  document.head.appendChild(style);
}

function setThemeSwitchingState(enabled) {
  const root = document.documentElement;
  if (!root) return;

  root.classList.toggle("mf-theme-switching", !!enabled);
  if (document.body) {
    document.body.classList.toggle("mf-theme-switching", !!enabled);
  }
}

function initTheme() {
  if (window.__themeInitialized) return;
  window.__themeInitialized = true;

  applyTheme(getStoredThemeMode());
  setupThemeListeners();
}

function setupThemeListeners() {
  document.querySelectorAll(".theme-option").forEach((btn, i) => {
    bindOnce(btn, `theme-option-${i}`, (e) => {
      e.preventDefault();
      applyTheme(btn.dataset.theme || "system");
    });
  });

  const desktopToggleBtn = document.getElementById("themeToggleBtn");
  bindOnce(desktopToggleBtn, "theme-desktop-toggle", (e) => {
    e.preventDefault();

    const currentResolved =
      document.documentElement.getAttribute("data-bs-theme") === "dark"
        ? "dark"
        : "light";
 const nextTheme = currentResolved === "dark" ? "light" : "dark";

    desktopToggleBtn.classList.remove("is-animating");
    void desktopToggleBtn.offsetWidth;
    desktopToggleBtn.classList.add("is-animating");
    setTimeout(() => desktopToggleBtn.classList.remove("is-animating"), 320);

    applyTheme(nextTheme);
  });

  const mobileToggle = document.getElementById("mobileThemeToggle");
  bindOnce(
    mobileToggle,
    "theme-mobile-toggle",
    () => {
      applyTheme(mobileToggle.checked ? "dark" : "light");
    },
    "change"
  );

  syncThemeControls(getStoredThemeMode());
}

function applyTheme(mode) {
 const normalized = ["system", "light", "dark"].includes(mode) ? mode : "system";
  ensureThemeSwitchStyles();
  setThemeSwitchingState(true);

  if (__mfThemeSwitchTimer) {
    clearTimeout(__mfThemeSwitchTimer);
    __mfThemeSwitchTimer = null;
  }

  localStorage.setItem("theme", normalized);

  const resolved = getResolvedTheme(normalized);
  document.documentElement.setAttribute("data-bs-theme", resolved);

  updateThemeIcon(normalized);

  window.dispatchEvent(
    new CustomEvent("themeChanged", {
      detail: { theme: normalized, resolvedTheme: resolved },
    })
  );

  requestAnimationFrame(() => {
    __mfThemeSwitchTimer = setTimeout(() => {
      setThemeSwitchingState(false);
      __mfThemeSwitchTimer = null;
    }, 120);
  });
}

function updateThemeIcon(mode) {
 const normalized = ["system", "light", "dark"].includes(mode) ? mode : "system";
  syncThemeControls(normalized);
}

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  const currentTheme = getStoredThemeMode();
  if (currentTheme === "system") applyTheme("system");
});

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initMoneyInputMasks();
});

if (document.readyState === "complete" || document.readyState === "interactive") {
  setTimeout(() => {
    initTheme();
    initMoneyInputMasks();
  }, 50);
}

/* ===============================
   COR DO APP (novo)
   - aplicada a partir do perfil
================================ */

function normalizeHexColor(value, fallback = "#3b82f6") {
  const raw = String(value || "").trim();
  const match = raw.match(/^#([0-9a-fA-F]{6})$/);
  return match ? `#${match[1].toLowerCase()}` : fallback;
}

function hexToRgbTuple(hex) {
  const normalized = normalizeHexColor(hex, "#3b82f6");
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ];
}

function rgbTupleToHex(rgb) {
  const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
}

function mixHexColor(baseHex, mixHex, mixWeight) {
  const base = hexToRgbTuple(baseHex);
  const mix = hexToRgbTuple(mixHex);
  const w = Math.max(0, Math.min(1, Number(mixWeight) || 0));
  return rgbTupleToHex([
    base[0] * (1 - w) + mix[0] * w,
    base[1] * (1 - w) + mix[1] * w,
    base[2] * (1 - w) + mix[2] * w,
  ]);
}

function getDefaultProfileColorConfig() {
  return {
    default: "blue",
    colors: [
      { key: "blue", label: "Azul", hex: "#3b82f6" },
      { key: "purple", label: "Roxo", hex: "#4a24a3" },
      { key: "yellow", label: "Amarelo", hex: "#f59e0b" },
      { key: "red", label: "Vermelho", hex: "#ef4444" },
      { key: "mint", label: "#00FA9A", hex: "#00FA9A" },
      { key: "spring", label: "#00FF7F", hex: "#00FF7F" },
      { key: "magenta", label: "#D02090", hex: "#D02090" },
    ],
  };
}

function sanitizeProfileColorEntry(entry, index = 0) {
  const fallbackKey = `color_${index + 1}`;
  const key = String(entry?.key || fallbackKey)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  const hex = normalizeHexColor(entry?.hex, "#3b82f6");
  const label = String(entry?.label || hex).trim() || hex;
  const rgb = hexToRgbTuple(hex).join(",");
  const dark = normalizeHexColor(entry?.dark, mixHexColor(hex, "#000000", 0.22));
  const light = normalizeHexColor(entry?.light, mixHexColor(hex, "#ffffff", 0.22));
  return { key, label, hex, rgb, dark, light };
}

function getProfileColorConfig() {
  if (window.__mfProfileColorConfigCache) return window.__mfProfileColorConfigCache;

  const fallback = getDefaultProfileColorConfig();
  const source = window.__MF_PROFILE_COLORS && typeof window.__MF_PROFILE_COLORS === "object"
    ? window.__MF_PROFILE_COLORS
    : fallback;

  const sourceColors = Array.isArray(source.colors) ? source.colors : fallback.colors;
  const seen = new Set();
  const colors = sourceColors
    .map((item, index) => sanitizeProfileColorEntry(item, index))
    .filter((item) => {
      if (!item.key || seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    });

  const safeColors = colors.length
    ? colors
    : fallback.colors.map((item, index) => sanitizeProfileColorEntry(item, index));

  const requestedDefault = String(source.default || "").trim().toLowerCase();
  const defaultKey = safeColors.some((item) => item.key === requestedDefault)
    ? requestedDefault
    : safeColors[0].key;

  const resolved = { default: defaultKey, colors: safeColors };
  window.__mfProfileColorConfigCache = resolved;
  return resolved;
}

function getAppColorPalette(color) {
  const config = getProfileColorConfig();
  const requested = String(color || "").trim().toLowerCase();
  const selected =
    config.colors.find((item) => item.key === requested) ||
    config.colors.find((item) => item.key === config.default) ||
    config.colors[0];

  return {
    key: selected.key,
    label: selected.label,
    hex: selected.hex,
    rgb: selected.rgb,
    dark: selected.dark,
    light: selected.light,
  };
}

// Aplica no Bootstrap (primary) e também expõe variáveis mf
function applyAppColor(color) {
  const p = getAppColorPalette(color);

  const root = document.documentElement;
  root.style.setProperty("--bs-primary", p.hex);
  root.style.setProperty("--bs-primary-rgb", p.rgb);

  root.style.setProperty("--mf-primary", p.hex);
  root.style.setProperty("--mf-primary-rgb", p.rgb);
  root.style.setProperty("--mf-primary-dark", p.dark);
  root.style.setProperty("--mf-primary-light", p.light);
}

window.getProfileColorConfig = getProfileColorConfig;
window.getProfileColorPalette = getAppColorPalette;
