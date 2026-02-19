function getToken() {
  return localStorage.getItem("token");
}

function parseJwt(token) {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getUserKey() {
  const token = getToken();
  const data = token ? parseJwt(token) : null;
  return data?.id || "anonymous";
}

function storageKey() {
  return `profilePrefs:${getUserKey()}`;
}

function getProfile() {
  try {
    return JSON.parse(localStorage.getItem(storageKey()) || "{}");
  } catch {
    return {};
  }
}

function setProfile(prefs) {
  localStorage.setItem(storageKey(), JSON.stringify(prefs));
}

function getLoggedUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function pickInitial(name) {
  const s = String(name || "").trim();
  return s ? s[0].toUpperCase() : "U";
}

function getProfileColorConfigSafe() {
  const fallback = {
    default: "blue",
    colors: [
      { key: "blue", label: "Azul", hex: "#3b82f6" },
      { key: "purple", label: "Roxo", hex: "#4a24a3" },
      { key: "yellow", label: "Amarelo", hex: "#f59e0b" },
      { key: "red", label: "Vermelho", hex: "#ef4444" },
    ],
  };

  if (typeof window.getProfileColorConfig === "function") {
    try {
      const config = window.getProfileColorConfig();
      if (config && Array.isArray(config.colors) && config.colors.length) return config;
    } catch {
      // use fallback
    }
  }

  return fallback;
}

function getProfileColorItems() {
  const config = getProfileColorConfigSafe();
  return Array.isArray(config.colors) ? config.colors : [];
}

function getDefaultProfileColorKey() {
  const config = getProfileColorConfigSafe();
  const items = getProfileColorItems();
  if (!items.length) return "blue";
  const defaultKey = String(config.default || "").trim().toLowerCase();
  if (items.some((item) => item.key === defaultKey)) return defaultKey;
  return items[0].key;
}

function isValidProfileColorKey(colorKey) {
  const key = String(colorKey || "").trim().toLowerCase();
  return getProfileColorItems().some((item) => item.key === key);
}

function escapeHtmlAttr(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function colorHex(color) {
  const key = String(color || "").trim().toLowerCase();
  const items = getProfileColorItems();
  const defaultKey = getDefaultProfileColorKey();
  const selected =
    items.find((item) => item.key === key) ||
    items.find((item) => item.key === defaultKey) ||
    items[0];
  return selected?.hex || "#3b82f6";
}

function renderProfileColorPickers() {
  const items = getProfileColorItems();
  if (!items.length) return;

  const markup = items
    .map((item) => {
      const key = escapeHtmlAttr(item.key);
      const title = escapeHtmlAttr(item.label || item.hex || item.key);
      const hex = escapeHtmlAttr(item.hex || "#3b82f6");
      return `<button class="profile-color" type="button" data-color="${key}" title="${title}" style="background:${hex}"></button>`;
    })
    .join("");

  document.querySelectorAll(".profile-color-picker").forEach((picker) => {
    picker.innerHTML = markup;
  });
}

function bindProfileColorButtons() {
  const defaultColor = getDefaultProfileColorKey();
  document
    .querySelectorAll(".profile-color-picker .profile-color")
    .forEach((btn) => {
      if (btn.dataset.profileColorBound === "1") return;
      btn.dataset.profileColorBound = "1";
      btn.addEventListener("click", () => {
        const prefs = getProfile();
        const selected = String(btn.dataset.color || "").trim().toLowerCase();
        prefs.color = isValidProfileColorKey(selected) ? selected : defaultColor;
        setProfile(prefs);
        applyProfileToNavbar();
      });
    });
}

function getApiOrigin() {
  const raw = (window.__API_URL__ || "http://localhost:3000").trim();

  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$|\/v\d+$/gi, "");
  }
}

function resolveAvatarUrl(avatarUrl) {
  if (!avatarUrl) return null;
  if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl;

  const origin = getApiOrigin();

  try {
    return new URL(avatarUrl, origin).toString();
  } catch {
    return `${origin}${avatarUrl}`;
  }
}

function setTextById(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setValueById(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function setBadgeColorById(id, colorHexValue) {
  const el = document.getElementById(id);
  if (el) el.style.background = colorHexValue;
}

function applyAvatar({ imgId, fallbackId, name, color, avatarUrl }) {
  const img = document.getElementById(imgId);
  const fallback = document.getElementById(fallbackId);
  if (!img || !fallback) return;

  const initial = pickInitial(name);

  fallback.style.background = color;
  fallback.textContent = initial;

  if (avatarUrl) {
    img.src = avatarUrl;
    img.classList.remove("d-none");
    fallback.classList.add("d-none");

    img.onerror = () => {
      img.classList.add("d-none");
      fallback.classList.remove("d-none");
      fallback.textContent = initial;
    };

    return;
  }

  img.classList.add("d-none");
  fallback.classList.remove("d-none");
}

function ensureDefaultProfileName() {
  const prefs = getProfile();
  if (prefs.name && prefs.name.trim()) return;

  const user = getLoggedUser();
  const fallbackName =
    (user && (user.name || user.nome)) ||
    (user && user.email) ||
    "Usuario";

  prefs.name = String(fallbackName).trim() || "Usuario";
  if (!isValidProfileColorKey(prefs.color)) prefs.color = getDefaultProfileColorKey();

  setProfile(prefs);
}

function emitProfileUpdated(name, color) {
  document.dispatchEvent(
    new CustomEvent("profileUpdated", {
      detail: {
        name,
        color,
        prefs: getProfile(),
        user: getLoggedUser(),
      },
    })
  );
}

function applyProfileToNavbar() {
  const prefs = getProfile();
  const user = getLoggedUser();

  const name =
    String(
      prefs.name ||
        user?.name ||
        user?.nome ||
        user?.email ||
        "Usuario"
    ).trim() || "Usuario";

  const colorKey = isValidProfileColorKey(prefs.color)
    ? String(prefs.color).trim().toLowerCase()
    : getDefaultProfileColorKey();
  const color = colorHex(colorKey);
  const avatarUrl = resolveAvatarUrl(prefs.avatarUrl) || prefs.avatarDataUrl || null;

  setTextById("userDisplayName", name);
  setTextById("mobileUserDisplayName", name);
  setTextById("settingsProfileName", name);

  if (user?.email) setTextById("settingsProfileEmail", user.email);

  setValueById("profileNameInput", prefs.name || "");

  setBadgeColorById("userAvatarBadge", color);
  setBadgeColorById("mobileUserAvatarBadge", color);
  setBadgeColorById("settingsAvatarBadge", color);

  applyAvatar({
    imgId: "userAvatarImg",
    fallbackId: "userAvatarFallback",
    name,
    color,
    avatarUrl,
  });

  applyAvatar({
    imgId: "mobileAvatarImg",
    fallbackId: "mobileAvatarFallback",
    name,
    color,
    avatarUrl,
  });

  applyAvatar({
    imgId: "mobileSidebarAvatarImg",
    fallbackId: "mobileSidebarAvatarFallback",
    name,
    color,
    avatarUrl,
  });

  applyAvatar({
    imgId: "settingsAvatarImg",
    fallbackId: "settingsAvatarFallback",
    name,
    color,
    avatarUrl,
  });

  document
    .querySelectorAll(".profile-color-picker .profile-color")
    .forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.color === colorKey);
    });

  if (typeof applyAppColor === "function") applyAppColor(colorKey);

  emitProfileUpdated(name, colorKey);
}

function closeUserDropdown() {
  const btn = document.getElementById("userMenuBtn");
  if (!btn || typeof bootstrap === "undefined") return;

  const inst = bootstrap.Dropdown.getInstance(btn) || new bootstrap.Dropdown(btn);
  inst.hide();
}

function openModalSafely(modalEl) {
  if (!modalEl || typeof bootstrap === "undefined") return;

  closeUserDropdown();
  setTimeout(() => {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }, 80);
}

function bindDropdownModalFix() {
  const userMenu = document.getElementById("userMenu");
  if (!userMenu || userMenu.__modalFixBound) return;

  userMenu.__modalFixBound = true;

  userMenu.addEventListener("click", (e) => {
    const trigger = e.target.closest('[data-bs-toggle="modal"]');
    if (!trigger) return;

    const selector = trigger.getAttribute("data-bs-target");
    if (!selector || !selector.startsWith("#")) return;

    const modalEl = document.querySelector(selector);
    if (!modalEl) return;

    e.preventDefault();
    e.stopPropagation();

    openModalSafely(modalEl);
  });
}

function bindProfileMenu() {
  if (window.__profileMenuBound) return;

  bindDropdownModalFix();
  renderProfileColorPickers();
  bindProfileColorButtons();

  const saveNameBtn = document.getElementById("saveProfileNameBtn");
  const nameInput = document.getElementById("profileNameInput");
  const avatarInput = document.getElementById("profileAvatarInput");

  window.__profileMenuBound = true;

  if (!saveNameBtn || !nameInput || !avatarInput) return;

  document.querySelectorAll('[data-profile-open="name"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const prefs = getProfile();
      nameInput.value = prefs.name || "";
      openModalSafely(document.getElementById("editNameModal"));
    });
  });

  document.querySelectorAll('[data-profile-open="avatar"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      openModalSafely(document.getElementById("editAvatarModal"));
    });
  });

  saveNameBtn.addEventListener("click", async () => {
    const newName = (nameInput.value || "").trim() || "Usuario";

    try {
      const data = await apiFetch("/users/me", "PATCH", { name: newName });

      const prefs = getProfile();
      prefs.name = data.user?.name || newName;
      if (!isValidProfileColorKey(prefs.color)) prefs.color = getDefaultProfileColorKey();
      setProfile(prefs);

      const user = getLoggedUser() || {};
      user.name = data.user?.name || newName;
      localStorage.setItem("user", JSON.stringify(user));

      const modalEl = document.getElementById("editNameModal");
      const modal = modalEl ? bootstrap.Modal.getInstance(modalEl) : null;
      if (modal) modal.hide();

      applyProfileToNavbar();
      if (typeof showAlert === "function") {
        showAlert("Nome atualizado", "success", "check-circle");
      }
    } catch {
      // apiFetch j? exibe erro
    }
  });

  avatarInput.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      if (typeof showAlert === "function") {
        showAlert("Imagem muito grande (max. 1MB)", "warning", "triangle-exclamation");
      }
      avatarInput.value = "";
      return;
    }

    try {
      const fd = new FormData();
      fd.append("avatar", file);

      const data = await apiFetch("/users/me/avatar", { method: "PATCH", body: fd });

      const prefs = getProfile();
      prefs.avatarUrl = data?.avatarUrl || null;
      delete prefs.avatarDataUrl;
      if (!isValidProfileColorKey(prefs.color)) prefs.color = getDefaultProfileColorKey();
      setProfile(prefs);

      applyProfileToNavbar();

      const modalEl = document.getElementById("editAvatarModal");
      const modal = modalEl ? bootstrap.Modal.getInstance(modalEl) : null;
      if (modal) modal.hide();

      if (typeof showAlert === "function") {
        showAlert("Avatar atualizado", "success", "check-circle");
      }
    } catch {
      // apiFetch j? exibe erro
    } finally {
      avatarInput.value = "";
    }
  });

}

function initProfileMenu() {
  ensureDefaultProfileName();

  const prefs = getProfile();
  if (!isValidProfileColorKey(prefs.color)) {
    prefs.color = getDefaultProfileColorKey();
    setProfile(prefs);
  }

  bindProfileMenu();
  applyProfileToNavbar();
}

document.addEventListener("navbarLoaded", initProfileMenu);
window.initProfileMenu = initProfileMenu;
