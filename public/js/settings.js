function parseJwtSafe(token) {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getSettingsStorageKey() {
  const token = localStorage.getItem("token");
  const payload = token ? parseJwtSafe(token) : null;
  const userId = payload?.id || "anonymous";
  return `profilePrefs:${userId}`;
}

function getStoredPrefs() {
  try {
    return JSON.parse(localStorage.getItem(getSettingsStorageKey()) || "{}");
  } catch {
    return {};
  }
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function persistUser(user) {
  if (!user) return;

  const previous = getStoredUser() || {};
  const merged = {
    ...previous,
    ...user,
    id: user.id || user._id || previous.id,
  };

  localStorage.setItem("user", JSON.stringify(merged));
}

function getSettingsApiOrigin() {
  const raw = (window.__API_URL__ || "http://localhost:3000").trim();

  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/g, "");
  }
}

function resolveSettingsAvatarUrl(avatarUrl) {
  if (!avatarUrl) return null;
  if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl;

  const origin = getSettingsApiOrigin();

  try {
    return new URL(avatarUrl, origin).toString();
  } catch {
    return `${origin}${avatarUrl}`;
  }
}

function formatDatePtBr(value) {
  if (!value) return "-";
  if (typeof formatDateUserLocal === "function") {
    return formatDateUserLocal(value, { locale: "pt-BR", includeTime: false, dateStyle: "short" });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function shortId(value) {
  const text = String(value || "").trim();
  if (!text) return "-";
  if (text.length <= 10) return text;
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

function setTextById(id, value) {
  const el = document.getElementById(id);
  if (!el) return;

  const text = String(value ?? "-");
  el.textContent = text;

  if (text && text !== "-") {
    el.title = text;
  } else {
    el.removeAttribute("title");
  }
}

function validatePasswordPolicy(password) {
  const value = String(password || "");
  return {
    hasMinLength: value.length >= 8,
    hasUpperCase: /[A-Z]/.test(value),
    hasNumber: /\d/.test(value),
  };
}

function getResolvedSettingsUser(apiUser) {
  const stored = getStoredUser();
  return {
    ...(stored || {}),
    ...(apiUser || {}),
  };
}

let settingsCurrentUser = null;

function renderEmailVerificationStatus(user) {
  const statusEl = document.getElementById("settingsInfoEmailVerified");
  const resendBtn = document.getElementById("resendVerificationBtn");

  if (!statusEl) return;

  const verified = !!user?.emailVerified;
  const email = String(user?.email || "").trim();

  statusEl.classList.remove("is-verified", "is-pending");

  if (verified) {
    statusEl.classList.add("is-verified");
    statusEl.innerHTML = `
      <i class="fa-solid fa-circle-check"></i>
      <span>Verificado</span>
    `;
  } else {
    statusEl.classList.add("is-pending");
    statusEl.innerHTML = `
      <i class="fa-solid fa-circle-exclamation"></i>
      <span>Pendente</span>
    `;
  }

  if (!resendBtn) return;

  const shouldShowResend = !verified && !!email;
  resendBtn.classList.toggle("d-none", !shouldShowResend);
  resendBtn.dataset.email = email;
}

function renderSettingsProfile(apiUser = null) {
  const prefs = getStoredPrefs();
  const user = getResolvedSettingsUser(apiUser);
  settingsCurrentUser = user;

  const name = String(
    prefs.name || user?.name || user?.nome || user?.email || "Usuário"
  ).trim() || "Usuário";

  const email = String(user?.email || "Sem e-mail informado").trim();
  const avatarUrl = resolveSettingsAvatarUrl(prefs.avatarUrl || user?.avatarUrl) || prefs.avatarDataUrl || null;

  setTextById("settingsProfileName", name);
  setTextById("settingsProfileEmail", email);

  setTextById("settingsInfoUserId", shortId(user?.id || user?._id));
  setTextById("settingsInfoEmail", email);
  setTextById("settingsInfoFamilyId", shortId(user?.familyId));
  setTextById("settingsInfoCreatedAt", formatDatePtBr(user?.createdAt));
  renderEmailVerificationStatus(user);

  const forgotPasswordBtn = document.getElementById("forgotPasswordSettingsBtn");
  if (forgotPasswordBtn) forgotPasswordBtn.dataset.email = email;

  const avatarImg = document.getElementById("settingsAvatarImg");
  const avatarFallback = document.getElementById("settingsAvatarFallback");

  if (!avatarImg || !avatarFallback) return;

  const initial = name[0]?.toUpperCase() || "U";
  avatarFallback.textContent = initial;

  if (avatarUrl) {
    avatarImg.src = avatarUrl;
    avatarImg.classList.remove("d-none");
    avatarFallback.classList.add("d-none");

    avatarImg.onerror = () => {
      avatarImg.classList.add("d-none");
      avatarFallback.classList.remove("d-none");
      avatarFallback.textContent = initial;
    };

    return;
  }

  avatarImg.classList.add("d-none");
  avatarFallback.classList.remove("d-none");
}

async function loadUserMe() {
  try {
    const data = await apiFetch("/users/me");
    const user = data?.user || null;

    if (user) {
      persistUser(user);
      return user;
    }
  } catch {
    // fallback to local profile
  }

  return getStoredUser();
}

function bindResendVerificationButton() {
  const resendBtn = document.getElementById("resendVerificationBtn");
  if (!resendBtn || resendBtn.dataset.bound === "1") return;

  resendBtn.dataset.bound = "1";

  resendBtn.addEventListener("click", async () => {
    const email = String(resendBtn.dataset.email || "").trim();

    if (!email) {
      showAlert("Não foi possível identificar o e-mail para reenvio", "warning", "triangle-exclamation");
      return;
    }

    setLoading(resendBtn, true);

    try {
      await apiFetch("/auth/resend-verification", "POST", { email });
      showAlert("Link de verificação reenviado para seu e-mail", "success", "paper-plane");
    } catch {
      // apiFetch already handles errors
    } finally {
      setLoading(resendBtn, false);
    }
  });
}

function bindPasswordModal() {
  const modalEl = document.getElementById("changePasswordModal");
  const currentInput = document.getElementById("currentPasswordInput");
  const newInput = document.getElementById("newPasswordInput");
  const confirmInput = document.getElementById("confirmNewPasswordInput");
  const saveBtn = document.getElementById("saveNewPasswordBtn");
  const forgotPasswordBtn = document.getElementById("forgotPasswordSettingsBtn");

  if (!modalEl || !currentInput || !newInput || !confirmInput || !saveBtn) return;

  modalEl.addEventListener("show.bs.modal", () => {
    currentInput.value = "";
    newInput.value = "";
    confirmInput.value = "";

    const email =
      String(settingsCurrentUser?.email || "").trim() ||
      String(getStoredUser()?.email || "").trim() ||
      String(document.getElementById("settingsInfoEmail")?.textContent || "").trim();

    if (forgotPasswordBtn && email && email !== "-") {
      forgotPasswordBtn.dataset.email = email;
    }
  });

  if (forgotPasswordBtn && forgotPasswordBtn.dataset.bound !== "1") {
    forgotPasswordBtn.dataset.bound = "1";

    forgotPasswordBtn.addEventListener("click", async () => {
      const email =
        String(forgotPasswordBtn.dataset.email || "").trim() ||
        String(settingsCurrentUser?.email || "").trim() ||
        String(getStoredUser()?.email || "").trim();

      if (!email || email === "-") {
        showAlert("Não foi possível iniciar a redefinição de senha", "warning", "triangle-exclamation");
        return;
      }

      setLoading(forgotPasswordBtn, true);

      try {
        await apiFetch("/auth/forgot-password", "POST", { email });
        showAlert("Link de redefinição enviado", "success", "envelope-circle-check");
      } catch {
        // apiFetch already handles errors
      } finally {
        setLoading(forgotPasswordBtn, false);
      }
    });
  }

  saveBtn.addEventListener("click", async () => {
    const currentPassword = String(currentInput.value || "");
    const newPassword = String(newInput.value || "");
    const confirmPassword = String(confirmInput.value || "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      showAlert("Preencha todos os campos de senha", "warning", "triangle-exclamation");
      return;
    }

    const policy = validatePasswordPolicy(newPassword);
    if (!policy.hasMinLength || !policy.hasUpperCase || !policy.hasNumber) {
      showAlert(
        "A nova senha deve ter no mínimo 8 caracteres, uma letra maiúscula e um número",
        "warning",
        "triangle-exclamation"
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert("A confirmação da nova senha não confere", "warning", "triangle-exclamation");
      return;
    }

    setLoading(saveBtn, true);

    try {
      await apiFetch("/users/me/password", "PATCH", {
        currentPassword,
        newPassword,
      });

      const modal = typeof bootstrap !== "undefined" ? bootstrap.Modal.getInstance(modalEl) : null;
      if (modal) modal.hide();

      showAlert("Senha alterada com sucesso", "success", "check-circle");
    } catch {
      // apiFetch already handles errors
    } finally {
      setLoading(saveBtn, false);
    }
  });
}

function bindDeleteAccountModal() {
  const modalEl = document.getElementById("deleteAccountModal");
  const passwordInput = document.getElementById("deleteAccountPasswordInput");
  const confirmInput = document.getElementById("deleteAccountConfirmInput");
  const confirmBtn = document.getElementById("confirmDeleteAccountBtn");

  if (!modalEl || !passwordInput || !confirmInput || !confirmBtn) return;

  modalEl.addEventListener("show.bs.modal", () => {
    passwordInput.value = "";
    confirmInput.value = "";
  });

  confirmBtn.addEventListener("click", async () => {
    const password = String(passwordInput.value || "");
    const confirmation = String(confirmInput.value || "").trim().toUpperCase();

    if (!password) {
      showAlert("Informe sua senha para excluir a conta", "warning", "triangle-exclamation");
      return;
    }

    if (confirmation !== "EXCLUIR") {
      showAlert("Digite EXCLUIR para confirmar", "warning", "triangle-exclamation");
      return;
    }

    setLoading(confirmBtn, true);

    try {
      await apiFetch("/users/me", "DELETE", { password });

      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("last_activity_at");
      localStorage.setItem("logout_at", Date.now().toString());

      window.location.href = "index.html?reason=account-deleted";
    } catch {
      // apiFetch already handles errors
    } finally {
      setLoading(confirmBtn, false);
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  if (typeof checkAuth === "function") checkAuth();

  const user = await loadUserMe();
  renderSettingsProfile(user);

  bindResendVerificationButton();
  bindPasswordModal();
  bindDeleteAccountModal();
});

document.addEventListener("profileUpdated", async () => {
  const user = await loadUserMe();
  renderSettingsProfile(user);
});
