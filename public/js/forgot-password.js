document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("forgotForm");
  if (!form) return;

  const submitBtn = document.getElementById("submitBtn") || form.querySelector("button");
  const emailInput = document.getElementById("email") || form.querySelector("input");

  const formContainer = document.getElementById("formContainer");
  const successMessage = document.getElementById("successMessage");
  const sentEmail = document.getElementById("sentEmail");
  const backToLoginBtn = document.getElementById("backToLoginBtn");

  // Botão "voltar ao login"
  if (backToLoginBtn) {
    backToLoginBtn.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = (emailInput?.value || "").trim();
    if (!email) {
      showAlert("Informe seu email", "warning", "triangle-exclamation");
      return;
    }

    setLoading(submitBtn, true);

    try {
      // Usando formato novo do apiFetch
      await apiFetch("/auth/forgot-password", "POST", { email });

      // UI success
      if (sentEmail) sentEmail.textContent = email;
      if (formContainer) formContainer.style.display = "none";
      if (successMessage) successMessage.style.display = "block";

      showAlert("Link de recuperação enviado!", "success", "envelope-circle-check");
    } catch (err) {
      showAlert(err.message || "Erro ao enviar email", "danger", "triangle-exclamation");
    } finally {
      setLoading(submitBtn, false);
    }
  });
});
