// js/profileMenu.js

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
  const s = (name || "").trim();
  return s ? s[0].toUpperCase() : "U";
}

function colorHex(color) {
  const map = {
    blue: "#3b82f6",
    purple: "#4a24a3",
    yellow: "#f59e0b",
    red: "#ef4444",
  };
  return map[color] || map.blue;
}

function ensureDefaultProfileName() {
  const prefs = getProfile();
  if (prefs.name && prefs.name.trim()) return;

  const user = getLoggedUser();
  const fallbackName =
    (user && (user.name || user.nome)) ||
    (user && user.email) ||
    "Usuário";

  prefs.name = String(fallbackName).trim() || "Usuário";
  if (!prefs.color) prefs.color = "blue";

  setProfile(prefs);
}

function applyProfileToNavbar() {
  const prefs = getProfile();

  const displayNameEl = document.getElementById("userDisplayName");
  const nameInput = document.getElementById("profileNameInput");
  const img = document.getElementById("userAvatarImg");
  const fallback = document.getElementById("userAvatarFallback");
  const badge = document.getElementById("userAvatarBadge");

  if (!displayNameEl || !img || !fallback || !badge) return;

  const name = prefs.name || "Usuário";
  const color = prefs.color || "blue";

  displayNameEl.textContent = name;
  if (nameInput) nameInput.value = prefs.name || "";

  const c = colorHex(color);
  fallback.style.background = c;
  badge.style.background = c;

  // Preferência: avatar vindo do backend (avatarUrl)
  // Fallback: avatar antigo em base64 (avatarDataUrl)
  const apiBase = window.__API_URL__ || "http://localhost:3000";
if (prefs.avatarUrl) {
  const isAbs = /^https?:\/\//i.test(prefs.avatarUrl);
  img.src = isAbs ? prefs.avatarUrl : (apiBase + prefs.avatarUrl);

  img.classList.remove("d-none");
  fallback.classList.add("d-none");
} else if (prefs.avatarDataUrl) {
  img.src = prefs.avatarDataUrl;
  img.classList.remove("d-none");
  fallback.classList.add("d-none");
} else {
  img.classList.add("d-none");
  fallback.classList.remove("d-none");
  fallback.textContent = pickInitial(name);
}

  document.querySelectorAll("#profileColorPicker .profile-color").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.color === color);
  });

  if (typeof applyAppColor === "function") applyAppColor(color);
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
  setTimeout(() => new bootstrap.Modal(modalEl).show(), 80);
}

// Intercepta clique em qualquer elemento com data-bs-toggle="modal" dentro do dropdown do perfil
function bindDropdownModalFix() {
  const userMenu = document.getElementById("userMenu");
  if (!userMenu) return;

  if (userMenu.__modalFixBound) return;
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

  const openNameBtn = document.getElementById("openEditNameModalBtn");
  const openAvatarBtn = document.getElementById("openEditAvatarModalBtn");

  const saveNameBtn = document.getElementById("saveProfileNameBtn");
  const nameInput = document.getElementById("profileNameInput");
  const avatarInput = document.getElementById("profileAvatarInput");
  const colorBtns = document.querySelectorAll("#profileColorPicker .profile-color");

  if (!openNameBtn || !openAvatarBtn || !saveNameBtn || !nameInput || !avatarInput) return;

  window.__profileMenuBound = true;

  bindDropdownModalFix();

  openNameBtn.addEventListener("click", () => {
    const prefs = getProfile();
    nameInput.value = prefs.name || "";
    openModalSafely(document.getElementById("editNameModal"));
  });

  openAvatarBtn.addEventListener("click", () => {
    openModalSafely(document.getElementById("editAvatarModal"));
  });

saveNameBtn.addEventListener("click", async () => {
  const newName = nameInput.value.trim() || "Usuário";

  try {
    const data = await apiFetch("/users/me", "PATCH", { name: newName });

    const prefs = getProfile();
    prefs.name = data.user?.name || newName;
    if (!prefs.color) prefs.color = "blue";
    setProfile(prefs);

    const u = getLoggedUser() || {};
    u.name = data.user?.name || newName;
    localStorage.setItem("user", JSON.stringify(u));

    const modal = bootstrap.Modal.getInstance(document.getElementById("editNameModal"));
    if (modal) modal.hide();

    applyProfileToNavbar();
    if (typeof showAlert === "function")
      showAlert("Nome atualizado", "success", "check-circle");
  } catch (err) {
    // apiFetch já mostra alerta de erro
  }
});


  // Upload REAL do avatar para o backend
  avatarInput.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // Sugestão: manter seu aviso (1MB), mas o backend pode aceitar mais.
    if (file.size > 1024 * 1024) {
      if (typeof showAlert === "function")
        showAlert("Imagem muito grande (máx. 1MB)", "warning", "triangle-exclamation");
      avatarInput.value = "";
      return;
    }

    try {
      const fd = new FormData();
      fd.append("avatar", file); // nome do campo esperado no backend [web:95]

      // Requer api.js atualizado para não forçar Content-Type application/json em FormData
      const data = await apiFetch("/users/me/avatar", { method: "PATCH", body: fd });

      const prefs = getProfile();
      prefs.avatarUrl = data?.avatarUrl || null;
      delete prefs.avatarDataUrl; // remove base64 local
      if (!prefs.color) prefs.color = "blue";
      setProfile(prefs);

      applyProfileToNavbar();

      const modal = bootstrap.Modal.getInstance(document.getElementById("editAvatarModal"));
      if (modal) modal.hide();

      if (typeof showAlert === "function")
        showAlert("Avatar atualizado", "success", "check-circle");
    } catch (err) {
      // apiFetch já trata e exibe alerta quando vem erro do backend
    } finally {
      avatarInput.value = "";
    }
  });

  colorBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const prefs = getProfile();
      prefs.color = btn.dataset.color || "blue";
      setProfile(prefs);
      applyProfileToNavbar();
    });
  });
}

// Inicialização única, pode ser chamada pelo loadNavbar.js
function initProfileMenu() {
  ensureDefaultProfileName();

  const prefs = getProfile();
  if (!prefs.color) {
    prefs.color = "blue";
    setProfile(prefs);
  }

  bindProfileMenu();
  applyProfileToNavbar();
}

// Mantém compatibilidade com o evento
document.addEventListener("navbarLoaded", initProfileMenu);

// Expõe para o loadNavbar.js chamar direto
window.initProfileMenu = initProfileMenu;
