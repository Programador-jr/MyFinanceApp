// public/js/register.js

/**
 * =========================================================
 * REGISTER (Cadastro)
 * Objetivos:
 * - Remover dependência de JS inline do register.html
 * - Centralizar validação (senha, confirmação e termos) aqui
 * - Habilitar/desabilitar botão conforme regras
 * - Enviar cadastro via /auth/register
 * =========================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");
  if (!form) return;

  // Inputs
  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const inviteCodeInput = document.getElementById("inviteCode");

  // UI elements
  const submitBtn = document.getElementById("submitBtn");
  const passwordStrength = document.getElementById("passwordStrength");
  const passwordMatch = document.getElementById("passwordMatch");

  const togglePassword = document.getElementById("togglePassword");
  const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");

  const termsCheck = document.getElementById("termsCheck");
  const termsCheckbox = document.getElementById("termsCheckbox");

  const reqLength = document.getElementById("reqLength");
  const reqLetter = document.getElementById("reqLetter");
  const reqNumber = document.getElementById("reqNumber");

  // Estado inicial: botão desabilitado até validar
  if (submitBtn) submitBtn.disabled = true;

  /* =========================
   * Helpers de UI
   * ========================= */

  function bindToggle(toggleBtn, input) {
    if (!toggleBtn || !input) return;

    const icon = toggleBtn.querySelector("i");
    toggleBtn.addEventListener("click", () => {
      const type = input.getAttribute("type") === "password" ? "text" : "password";
      input.setAttribute("type", type);

      if (icon) {
        icon.classList.toggle("fa-eye");
        icon.classList.toggle("fa-eye-slash");
      }
    });
  }

  function updateRequirementIcon(el, ok) {
    if (!el) return;

    // Mantém compatível com seu CSS atual (ícones do FontAwesome)
    el.classList.remove("fa-circle", "fa-check-circle", "text-secondary", "text-success");

    if (ok) el.classList.add("fa-check-circle", "text-success");
    else el.classList.add("fa-circle", "text-secondary");
  }

  function validatePasswordRules(password) {
    const hasMinLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);

    updateRequirementIcon(reqLength, hasMinLength);
    updateRequirementIcon(reqLetter, hasUpperCase);
    updateRequirementIcon(reqNumber, hasNumber);

    // força simples: 0..3
    const score = [hasMinLength, hasUpperCase, hasNumber].filter(Boolean).length;

    if (passwordStrength) {
      if (!password) {
        passwordStrength.textContent = "";
        passwordStrength.className = "mt-2";
      } else if (score === 1) {
        passwordStrength.textContent = "Senha fraca";
        passwordStrength.className = "mt-2 text-danger";
      } else if (score === 2) {
        passwordStrength.textContent = "Senha média";
        passwordStrength.className = "mt-2 text-warning";
      } else {
        passwordStrength.textContent = "Senha forte";
        passwordStrength.className = "mt-2 text-success";
      }
    }

    return { hasMinLength, hasUpperCase, hasNumber, isPasswordValid: score === 3 };
  }

  function validatePasswordMatch(password, confirmPassword) {
    const ok = password && confirmPassword && password === confirmPassword;

    if (passwordMatch) {
      if (!confirmPassword) {
        passwordMatch.textContent = "";
        passwordMatch.className = "mt-2";
      } else if (ok) {
        passwordMatch.textContent = "As senhas coincidem";
        passwordMatch.className = "mt-2 text-success";
      } else {
        passwordMatch.textContent = "As senhas não coincidem";
        passwordMatch.className = "mt-2 text-danger";
      }
    }

    return ok;
  }

  function isTermsChecked() {
    return !!termsCheckbox?.classList.contains("checked");
  }

  function setSubmitState(enabled) {
    if (!submitBtn) return;
    submitBtn.disabled = !enabled;
    submitBtn.style.opacity = enabled ? "1" : "0.6";
    submitBtn.style.cursor = enabled ? "pointer" : "not-allowed";
  }

  function getErrors() {
    const errors = [];

    const name = (nameInput?.value || "").trim();
    const email = (emailInput?.value || "").trim();
    const password = passwordInput?.value || "";
    const confirmPassword = confirmPasswordInput?.value || "";

    if (!name) errors.push("Informe seu nome.");
    if (!email) errors.push("Informe seu email.");

    const rules = validatePasswordRules(password);
    if (!rules.hasMinLength) errors.push("A senha deve ter no mínimo 8 caracteres.");
    if (!rules.hasUpperCase) errors.push("A senha deve conter pelo menos uma letra maiúscula.");
    if (!rules.hasNumber) errors.push("A senha deve conter pelo menos um número.");

    if (!validatePasswordMatch(password, confirmPassword)) {
      errors.push("As senhas não coincidem.");
    }

    if (!isTermsChecked()) {
      errors.push("Você precisa aceitar os termos para continuar.");
    }

    return errors;
  }

  function validateAll() {
    const errors = getErrors();
    setSubmitState(errors.length === 0);
    return { isValid: errors.length === 0, errors };
  }

  /* =========================
   * Binds de UI
   * ========================= */

  bindToggle(togglePassword, passwordInput);
  bindToggle(toggleConfirmPassword, confirmPasswordInput);

  // Clique no container alterna a checkbox (mantendo seu padrão visual)
  if (termsCheck && termsCheckbox) {
    termsCheck.addEventListener("click", () => {
      termsCheckbox.classList.toggle("checked");
      validateAll();
    });
  }

  // Validação em tempo real
  passwordInput?.addEventListener("input", validateAll);
  confirmPasswordInput?.addEventListener("input", validateAll);
  nameInput?.addEventListener("input", validateAll);
  emailInput?.addEventListener("input", validateAll);

  // Inicializa estado
  validateAll();
  nameInput?.focus();

  /* =========================
   * Submit (cadastro)
   * ========================= */

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const { isValid, errors } = validateAll();
    if (!isValid) {
      // Mostra todos os erros de uma vez
      showAlert(errors.join("<br>"), "warning", "triangle-exclamation");
      return;
    }

    const payload = {
      name: (nameInput.value || "").trim(),
      email: (emailInput.value || "").trim(),
      password: passwordInput.value,
      inviteCode: (inviteCodeInput?.value || "").trim() || null
    };

    setLoading(submitBtn, true);

    try {
      // Usa o formato novo do apiFetch
      await apiFetch("/auth/register", "POST", payload);

      showAlert("Conta criada com sucesso! Verifique seu email.", "success", "envelope");

      setTimeout(() => {
        window.location.href = "index.html";
      }, 1500);
    } catch (err) {
      showAlert(err.message || "Erro ao criar conta", "danger", "triangle-exclamation");
    } finally {
      setLoading(submitBtn, false);
    }
  });
});
