document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("resetForm");
  if (!form) return;

  const submitBtn = document.getElementById("submitBtn") || form.querySelector("button");

  const newPasswordInput = document.getElementById("newPassword");
  const confirmPasswordInput = document.getElementById("confirmPassword");

  const toggleNewPassword = document.getElementById("toggleNewPassword");
  const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");

  const passwordMatch = document.getElementById("passwordMatch");

  const reqLength = document.getElementById("reqLength");
  const reqLetter = document.getElementById("reqLetter");
  const reqNumber = document.getElementById("reqNumber");

  const strengthFill = document.getElementById("strengthFill");
  const strengthText = document.getElementById("strengthText");

  const formContainer = document.getElementById("formContainer");
  const successMessage = document.getElementById("successMessage");
  const backToLoginBtn = document.getElementById("backToLoginBtn");

  // Token da URL
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  if (!token) {
    showAlert("Token inválido ou ausente", "danger", "triangle-exclamation");
    setTimeout(() => (window.location.href = "index.html"), 1500);
    return;
  }

  // Botão voltar ao login
  if (backToLoginBtn) {
    backToLoginBtn.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  // Toggle eye (UI)
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

  bindToggle(toggleNewPassword, newPasswordInput);
  bindToggle(toggleConfirmPassword, confirmPasswordInput);

  // Helpers UI requisitos
  function setReq(el, ok) {
    if (!el) return;
    el.classList.toggle("valid", ok);
    el.classList.toggle("fa-circle", !ok);
    el.classList.toggle("fa-check-circle", ok);
  }

  function computeStrength(password) {
    const hasMinLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);

    setReq(reqLength, hasMinLength);
    setReq(reqLetter, hasUpper);
    setReq(reqNumber, hasNumber);

    const score = [hasMinLength, hasUpper, hasNumber].filter(Boolean).length;

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

    return { hasMinLength, hasUpper, hasNumber };
  }

  function updateMatchUI() {
    if (!passwordMatch || !newPasswordInput || !confirmPasswordInput) return;

    const p = newPasswordInput.value;
    const c = confirmPasswordInput.value;

    if (!p || !c) {
      passwordMatch.style.display = "none";
      return;
    }

    passwordMatch.style.display = "block";
    if (p === c) {
      passwordMatch.style.color = "#10b981";
      passwordMatch.innerHTML = `<i class="fa-solid fa-check me-2"></i>As senhas coincidem`;
    } else {
      passwordMatch.style.color = "#ef4444";
      passwordMatch.innerHTML = `<i class="fa-solid fa-xmark me-2"></i>As senhas não coincidem`;
    }
  }

  // Listeners de UI
  newPasswordInput?.addEventListener("input", () => {
    computeStrength(newPasswordInput.value);
    updateMatchUI();
  });

  confirmPasswordInput?.addEventListener("input", () => {
    updateMatchUI();
  });

  // Submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const password = newPasswordInput?.value || "";
    const confirm = confirmPasswordInput?.value || "";

    const { hasMinLength, hasUpper, hasNumber } = computeStrength(password);

    if (!hasMinLength || !hasUpper || !hasNumber) {
      showAlert("A senha não atende aos requisitos", "warning", "triangle-exclamation");
      return;
    }

    if (password !== confirm) {
      showAlert("As senhas não coincidem", "warning", "exclamation-circle");
      return;
    }

    setLoading(submitBtn, true);

    try {
      await apiFetch("/auth/reset-password", "POST", { token, password });

      // UI success
      if (formContainer) formContainer.style.display = "none";
      if (successMessage) successMessage.style.display = "block";

      showAlert("Senha redefinida com sucesso", "success", "lock-open");
    } catch (err) {
      showAlert(err.message || "Erro ao redefinir senha", "danger", "triangle-exclamation");
    } finally {
      setLoading(submitBtn, false);
    }
  });
});
