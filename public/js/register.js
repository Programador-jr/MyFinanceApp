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
  const strengthFill = document.getElementById("strengthFill");
  const strengthText = document.getElementById("strengthText");
  const passwordMatch = document.getElementById("passwordMatch");

  const togglePassword = document.getElementById("togglePassword");
  const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");

  const termsCheck = document.getElementById("termsCheck");
  const termsCheckbox = document.getElementById("termsCheckbox");

  const reqLength = document.getElementById("reqLength");
  const reqLetter = document.getElementById("reqLetter");
  const reqNumber = document.getElementById("reqNumber");

  const legalModal = document.getElementById("legalModal");
  const legalModalTitle = document.getElementById("legalModalTitle");
  const legalModalBody = document.getElementById("legalModalBody");
  const legalTermsContent = document.getElementById("legalTermsContent");
  const legalPrivacyContent = document.getElementById("legalPrivacyContent");
  const legalLinks = document.querySelectorAll(".terms-link[data-legal]");
  const legalCloseControls = document.querySelectorAll("[data-legal-close]");

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

  function openLegalModal(type) {
    if (!legalModal || !legalModalTitle || !legalModalBody) return;

    if (type === "privacy") {
      legalModalTitle.textContent = "Pol\u00edtica de Privacidade";
      legalModalBody.innerHTML = legalPrivacyContent?.innerHTML || "";
    } else {
      legalModalTitle.textContent = "Termos de Uso";
      legalModalBody.innerHTML = legalTermsContent?.innerHTML || "";
    }

    legalModal.hidden = false;
    legalModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeLegalModal() {
    if (!legalModal) return;
    legalModal.hidden = true;
    legalModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function updateRequirementIcon(el, ok) {
    if (!el) return;

    el.classList.toggle("valid", ok);
    el.classList.toggle("fa-circle", !ok);
    el.classList.toggle("fa-check-circle", ok);
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

    if (strengthFill) {
      strengthFill.className = "strength-fill";
      if (score === 1) strengthFill.classList.add("weak");
      if (score === 2) strengthFill.classList.add("medium");
      if (score === 3) strengthFill.classList.add("strong");
    }

    if (strengthText) {
      if (!password) strengthText.textContent = "Digite uma senha";
      else if (score === 1) strengthText.textContent = "Senha fraca";
      else if (score === 2) strengthText.textContent = "Senha média";
      else strengthText.textContent = "Senha forte";
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

  legalLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openLegalModal(link.dataset.legal);
    });
  });

  legalCloseControls.forEach((btn) => {
    btn.addEventListener("click", closeLegalModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && legalModal && !legalModal.hidden) {
      closeLegalModal();
    }
  });

  // Clique no container alterna a checkbox (mantendo seu padrão visual)
  if (termsCheck && termsCheckbox) {
    termsCheck.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".terms-link")) return;
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
