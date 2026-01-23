// public/js/auth.js

/**
 * =========================================================
 * LOGIN (index.html)
 * - Toggle de senha
 * - "Lembrar usuário" (salva apenas o email em localStorage)
 * - Submit real via /auth/login
 * - Salva { token, user } retornados pelo backend
 * =========================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (isStandalone) {
    const existingToken = localStorage.getItem("token");
    const redirectKey = "mf_login_redirect_once";

    try {
      if (existingToken && sessionStorage.getItem(redirectKey) !== "1") {
        sessionStorage.setItem(redirectKey, "1");
        window.location.href = "dashboard.html";
        return;
      }
    } catch {
      // fallback: if sessionStorage fails, avoid looping
    }
  }

  const form = document.getElementById("loginForm");
  if (!form) return;

  const submitBtn = form.querySelector(".btn-auth");

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");

  /* =========================
   * Toggle de senha (UI)
   * ========================= */
  const togglePassword = document.getElementById("togglePassword");
  if (togglePassword && passwordInput) {
    const eyeIcon = togglePassword.querySelector("i");

    togglePassword.addEventListener("click", () => {
      const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
      passwordInput.setAttribute("type", type);

      if (eyeIcon) {
        eyeIcon.classList.toggle("fa-eye");
        eyeIcon.classList.toggle("fa-eye-slash");
      }
    });
  }

  /* =========================
   * Lembrar usuário (email)
   * ========================= */
  const rememberCheckbox = document.getElementById("rememberCheckbox");
  const rememberMe = document.getElementById("rememberMe");

  // Restaura email salvo
  const savedEmail = localStorage.getItem("rememberedEmail");
  if (savedEmail && emailInput) {
    emailInput.value = savedEmail;
    rememberCheckbox?.classList.add("checked");
  }

  if (rememberMe && rememberCheckbox) {
    rememberMe.addEventListener("click", () => {
      rememberCheckbox.classList.toggle("checked");
    });
  }

  /* =========================
   * Submit real (API)
   * ========================= */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = (emailInput?.value || "").trim();
    const password = passwordInput?.value || "";

    if (!email || !password) {
      showAlert("Informe email e senha.", "warning", "triangle-exclamation");
      return;
    }

    setLoading(submitBtn, true);

    try {
      const data = await apiFetch("/auth/login", "POST", { email, password });

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user || null));

      // =========================
      // SYNC PROFILE PREFS (nome/avatar) para o navbar
      // - O profileMenu.js lê de profilePrefs:<userId>
      // =========================
      if (data.user?.id) {
        const key = `profilePrefs:${data.user.id}`;
        let prefs = {};
        try {
          prefs = JSON.parse(localStorage.getItem(key) || "{}");
        } catch {
          prefs = {};
        }

        // mantém cor anterior se existir
        if (!prefs.color) prefs.color = "blue";

        // sincroniza do backend
        if (data.user.name) prefs.name = data.user.name;
        prefs.avatarUrl = data.user.avatarUrl || null;

        // se existir base64 antigo, remove para priorizar backend
        if (prefs.avatarUrl) delete prefs.avatarDataUrl;

        localStorage.setItem(key, JSON.stringify(prefs));
      }

      const isRemembered = rememberCheckbox?.classList.contains("checked");
      if (isRemembered) localStorage.setItem("rememberedEmail", email);
      else localStorage.removeItem("rememberedEmail");

      showAlert("Login realizado com sucesso!", "success", "check-circle");

      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 800);
    } catch (err) {
      showAlert(err.message || "Email ou senha inválidos", "danger", "triangle-exclamation");
    } finally {
      setLoading(submitBtn, false);
    }
  });

  // Foco inicial
  emailInput?.focus();
});
