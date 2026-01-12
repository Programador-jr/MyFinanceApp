const params = new URLSearchParams(window.location.search);
const token = params.get("token");

const status = document.getElementById("status");
const statusIcon = document.getElementById("statusIcon");
const statusTitle = document.getElementById("statusTitle");
const pageSubtitle = document.getElementById("pageSubtitle");
const resendContainer = document.getElementById("resend-container");
const instructionText = document.getElementById("instructionText");
const resendBtn = document.getElementById("resendBtn");
const emailInput = document.getElementById("email");

// Função para mostrar o estado de sucesso
function showSuccessState() {
  statusIcon.className = "fa-solid fa-check-circle fa-3x";
  statusIcon.style.color = "var(--success-color)";
  statusTitle.textContent = "Email verificado!";
  pageSubtitle.textContent = "Verificação concluída";
  status.textContent = "Redirecionando para o login...";
}

// Função para mostrar o estado de erro
function showErrorState(message, showResend = true) {
  statusIcon.className = "fa-solid fa-exclamation-circle fa-3x";
  statusIcon.style.color = "var(--warning-color)";
  statusTitle.textContent = "Verificação falhou";
  pageSubtitle.textContent = "Verificação necessária";
  status.textContent = message;
  
  if (showResend) {
    resendContainer.classList.remove("d-none");
  }
}

// Função para mostrar o estado de carregamento
function showLoadingState() {
  statusIcon.className = "fa-solid fa-circle-notch fa-spin fa-3x";
  statusIcon.style.color = "var(--primary-blue)";
  statusTitle.textContent = "Verificando seu email";
  pageSubtitle.textContent = "Verificação em andamento";
  status.textContent = "Aguarde enquanto verificamos seu token...";
}

// Verificação inicial
if (!token) {
  showErrorState("Token de verificação não encontrado na URL.", true);
  instructionText.textContent = "Link de verificação incompleto";
  
  showAlert(
    "Link de verificação inválido",
    "warning",
    "exclamation-circle"
  );
} else {
  showLoadingState();
  
  apiFetch(`/auth/verify-email?token=${token}`)
    .then(() => {
      showSuccessState();
      
      showAlert(
        "Email verificado com sucesso!",
        "success",
        "envelope-circle-check"
      );

      setTimeout(() => {
        window.location.href = "index.html";
      }, 2000);
    })
    .catch((err) => {
      const errorMessage = err.message || "Token inválido ou expirado";
      showErrorState(errorMessage, true);
      instructionText.textContent = "Seu token expirou ou é inválido";
      
      showAlert(
        "Token expirado. Você pode reenviar o email",
        "danger",
        "circle-xmark"
      );
    });
}

// Event listener para reenviar verificação
resendBtn.addEventListener("click", async () => {
  const email = emailInput.value;

  if (!email) {
    showAlert(
      "Informe seu email",
      "warning",
      "exclamation-circle"
    );
    return;
  }

  // Validação básica de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showAlert(
      "Por favor, insira um email válido",
      "warning",
      "exclamation-circle"
    );
    return;
  }

  setLoading(resendBtn, true);

  try {
    await apiFetch("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email })
    });

    showAlert(
      "Email de verificação reenviado com sucesso!",
      "success",
      "paper-plane"
    );
    
    // Atualiza a UI após reenvio bem-sucedido
    instructionText.innerHTML = '<i class="fa-solid fa-check-circle me-2 text-success"></i> Email enviado! Verifique sua caixa de entrada.';
    emailInput.disabled = true;
    resendBtn.disabled = true;
    resendBtn.innerHTML = '<i class="fa-solid fa-clock me-2"></i> Aguarde 60 segundos';
    
    // Timer de 60 segundos
    let seconds = 60;
    const countdown = setInterval(() => {
      seconds--;
      resendBtn.innerHTML = `<i class="fa-solid fa-clock me-2"></i> Aguarde ${seconds}s`;
      
      if (seconds <= 0) {
        clearInterval(countdown);
        emailInput.disabled = false;
        resendBtn.disabled = false;
        resendBtn.innerHTML = '<i class="fa-solid fa-paper-plane me-2"></i> Reenviar verificação';
        instructionText.textContent = "Precisa de outro email?";
      }
    }, 1000);
    
  } catch (err) {
    showAlert(
      err.message || "Erro ao reenviar email",
      "danger",
      "triangle-exclamation"
    );
  } finally {
    setLoading(resendBtn, false);
  }
});

// Foco no campo de email quando o container de reenvio é mostrado
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.attributeName === 'class') {
      if (!resendContainer.classList.contains('d-none') && emailInput) {
        setTimeout(() => emailInput.focus(), 100);
      }
    }
  });
});

observer.observe(resendContainer, { attributes: true });