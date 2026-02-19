function getStoredUserSafe() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function persistUserSafe(user) {
  if (!user) return;

  const previous = getStoredUserSafe() || {};
  localStorage.setItem(
    "user",
    JSON.stringify({
      ...previous,
      ...user,
      id: user.id || user._id || previous.id,
    })
  );
}

function shortId(value) {
  const text = String(value || "").trim();
  if (!text) return "-";
  if (text.length <= 12) return text;
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  if (["owner", "admin", "member"].includes(role)) return role;
  return "member";
}

function roleLabel(role) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Membro";
}

function roleBadgeClass(role) {
  if (role === "owner") return "owner";
  if (role === "admin") return "admin";
  return "member";
}

function normalizeMember(raw) {
  const role = normalizeRole(raw?.familyRole);
  return {
    id: String(raw?.id || raw?._id || "").trim(),
    name: String(raw?.name || raw?.nome || "").trim(),
    email: String(raw?.email || "").trim(),
    createdAt: raw?.createdAt || null,
    familyRole: role,
    isOwner: role === "owner" || !!raw?.isOwner,
  };
}

function clearSessionAndRedirectToLogin(reason = "family-updated") {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("last_activity_at");
  localStorage.setItem("logout_at", Date.now().toString());
  window.location.href = `index.html?reason=${encodeURIComponent(reason)}`;
}

function setButtonBusy(button, isBusy, busyText = "Processando...") {
  if (!button) return;

  if (isBusy) {
    button.disabled = true;
    button.dataset.originalHtml = button.innerHTML;
    if (!button.style.width) {
      button.style.width = `${button.offsetWidth}px`;
    }
    button.classList.add("is-busy");
    button.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2"></span>
      ${busyText}
    `;
    return;
  }

  button.disabled = false;
  button.classList.remove("is-busy");
  button.innerHTML = button.dataset.originalHtml || button.innerHTML;
  button.style.width = "";
}

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

async function silentApiFetch(url, method = "GET", body = null) {
  const token = localStorage.getItem("token");

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
  };

  const options = {
    method,
    headers,
  };

  if (body !== null && body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(API_URL + url, options);

  if (res.status === 401) {
    if (typeof window.appLogout === "function") window.appLogout("401");
    throw new Error("Sessão expirada");
  }

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.error || "Erro na requisição");
  }

  return data;
}

document.addEventListener("DOMContentLoaded", async () => {
  if (typeof checkAuth === "function") checkAuth();
  if (typeof initTheme === "function") initTheme();

  const summaryFamilyName = document.getElementById("summaryFamilyName");
  const summaryMembersCount = document.getElementById("summaryMembersCount");
  const summaryRoleBadge = document.getElementById("summaryRoleBadge");
  const summaryHintText = document.getElementById("summaryHintText");

  const refreshFamilyBtn = document.getElementById("refreshFamilyBtn");
  const joinFamilySection = document.getElementById("joinFamilySection");
  const familyContent = document.getElementById("familyContent");

  const joinCodeInput = document.getElementById("joinCodeInput");
  const joinFamilyBtn = document.getElementById("joinFamilyBtn");

  const manageFamilySection = document.getElementById("manageFamilySection");
  const managementRoleChip = document.getElementById("managementRoleChip");
  const familyNameInput = document.getElementById("familyNameInput");
  const saveFamilyNameBtn = document.getElementById("saveFamilyNameBtn");
  const transferOwnerSection = document.getElementById("transferOwnerSection");
  const transferOwnerSelect = document.getElementById("transferOwnerSelect");
  const transferOwnerBtn = document.getElementById("transferOwnerBtn");
  const leaveFamilySection = document.getElementById("leaveFamilySection");
  const leaveFamilyBtn = document.getElementById("leaveFamilyBtn");

  const inviteOwnerSection = document.getElementById("inviteOwnerSection");
  const inviteCodeField = document.getElementById("inviteCodeField");
  const copyInviteCodeBtn = document.getElementById("copyInviteCodeBtn");
  const regenInviteCodeBtn = document.getElementById("regenInviteCodeBtn");

  const membersCountChip = document.getElementById("membersCountChip");
  const membersSectionHint = document.getElementById("membersSectionHint");
  const familyLoadError = document.getElementById("familyLoadError");
  const familyMembersCards = document.getElementById("familyMembersCards");
  const familyMembersTableWrap = document.getElementById("familyMembersTableWrap");
  const familyMembersTable = document.getElementById("familyMembersTable");
  const familyMembersEmpty = document.getElementById("familyMembersEmpty");
  const familyViewCardsBtn = document.getElementById("familyViewCardsBtn");
  const familyViewTableBtn = document.getElementById("familyViewTableBtn");
  const actionConfirmModalEl = document.getElementById("actionConfirmModal");
  const actionConfirmTitle = document.getElementById("actionConfirmTitle");
  const actionConfirmMessage = document.getElementById("actionConfirmMessage");
  const actionConfirmOkBtn = document.getElementById("actionConfirmOkBtn");
  const actionConfirmCancelBtn = document.getElementById("actionConfirmCancelBtn");
  const actionConfirmModal =
    typeof bootstrap !== "undefined" && actionConfirmModalEl
      ? bootstrap.Modal.getOrCreateInstance(actionConfirmModalEl)
      : null;

  const state = {
    user: null,
    family: null,
    members: [],
    inviteCode: "",
    currentUserRole: "member",
    permissions: {
      canManageFamily: false,
      canManageMembers: false,
      canAssignAdmin: false,
      canTransferOwnership: false,
      canLeaveFamily: false,
    },
    familyLoadFailed: false,
  };

  const FAMILY_MEMBERS_VIEW_STORAGE_KEY = "myfinance_family_members_view";
  let familyMembersView = loadStoredMembersView();

  function normalizeMembersView(value) {
    return value === "table" ? "table" : "cards";
  }

  function loadStoredMembersView() {
    try {
      return normalizeMembersView(localStorage.getItem(FAMILY_MEMBERS_VIEW_STORAGE_KEY));
    } catch {
      return "cards";
    }
  }

  function persistMembersView(value) {
    try {
      localStorage.setItem(FAMILY_MEMBERS_VIEW_STORAGE_KEY, normalizeMembersView(value));
    } catch {}
  }

  function syncMembersView() {
    const showingCards = familyMembersView === "cards";
    const hasMembers = (Array.isArray(state.members) ? state.members : []).length > 0;
    const canToggleView = hasMembers && !state.familyLoadFailed;

    if (canToggleView) {
      familyMembersCards?.classList.toggle("d-none", !showingCards);
      familyMembersTableWrap?.classList.toggle("d-none", showingCards);
    }

    if (familyViewCardsBtn) familyViewCardsBtn.disabled = !canToggleView;
    if (familyViewTableBtn) familyViewTableBtn.disabled = !canToggleView;

    familyViewCardsBtn?.classList.toggle("is-active", showingCards);
    familyViewCardsBtn?.setAttribute("aria-pressed", showingCards ? "true" : "false");
    familyViewTableBtn?.classList.toggle("is-active", !showingCards);
    familyViewTableBtn?.setAttribute("aria-pressed", !showingCards ? "true" : "false");
  }

  function setMembersView(nextView) {
    familyMembersView = normalizeMembersView(nextView);
    persistMembersView(familyMembersView);
    syncMembersView();
  }

  function hasFamily() {
    return !!state.user?.familyId;
  }

  function isCurrentUserOwner() {
    return state.currentUserRole === "owner";
  }

  function setSummaryState() {
    if (!hasFamily()) {
      summaryFamilyName.textContent = "Sem família";
      summaryMembersCount.textContent = "0";
      summaryRoleBadge.textContent = "Solo";
      summaryHintText.textContent = "Você ainda não está vinculado a uma família.";
      return;
    }

    summaryFamilyName.textContent =
      String(state.family?.name || "").trim() || `ID ${shortId(state.user.familyId)}`;

    summaryMembersCount.textContent =
      state.members.length > 0 ? String(state.members.length) : "-";

    summaryRoleBadge.textContent = roleLabel(state.currentUserRole);

    if (state.familyLoadFailed) {
      summaryHintText.textContent =
        "Não foi possível carregar os detalhes da família agora. Tente atualizar.";
      return;
    }

    const ownerName = String(state.family?.ownerId?.name || "").trim();
    const ownerEmail = String(state.family?.ownerId?.email || "").trim();
    const ownerLabel = ownerName || ownerEmail || "-";

    summaryHintText.textContent = isCurrentUserOwner()
      ? "Você é owner da família e possui controle total."
      : `Owner da família: ${ownerLabel}`;
  }

  function renderTransferOwnerOptions() {
    if (!transferOwnerSelect) return;

    const options = state.members
      .filter((m) => m.id !== state.user?.id && m.familyRole !== "owner")
      .sort((a, b) => a.name.localeCompare(b.name));

    transferOwnerSelect.innerHTML = `<option value="">Selecione um membro</option>`;

    options.forEach((member) => {
      transferOwnerSelect.innerHTML += `
        <option value="${escapeHtml(member.id)}">
          ${escapeHtml(member.name || member.email || member.id)} (${roleLabel(member.familyRole)})
        </option>
      `;
    });

    transferOwnerBtn.disabled = options.length === 0;
  }

  function setSectionsState() {
    const hasFamilyState = hasFamily();

    joinFamilySection.classList.toggle("d-none", hasFamilyState);
    familyContent.classList.toggle("d-none", !hasFamilyState);

    manageFamilySection.classList.toggle("d-none", !hasFamilyState);
    inviteOwnerSection.classList.toggle("d-none", !hasFamilyState || !isCurrentUserOwner());
    transferOwnerSection.classList.toggle(
      "d-none",
      !hasFamilyState || !state.permissions.canTransferOwnership
    );
    leaveFamilySection.classList.toggle(
      "d-none",
      !hasFamilyState || !state.permissions.canLeaveFamily
    );

    if (!hasFamilyState) return;

    const canManageFamily = !!state.permissions.canManageFamily;
    managementRoleChip.textContent = roleLabel(state.currentUserRole);
    managementRoleChip.className = `family-chip ${roleBadgeClass(state.currentUserRole)}`;

    familyNameInput.value = String(state.family?.name || "").trim();
    familyNameInput.readOnly = !canManageFamily;
    saveFamilyNameBtn.disabled = !canManageFamily;
    saveFamilyNameBtn.classList.toggle("d-none", !canManageFamily);

    renderTransferOwnerOptions();
  }

  function memberActionCapabilities(member) {
    const isSelf = member.id === state.user?.id;

    const canRemove =
      state.permissions.canManageMembers &&
      !isSelf &&
      member.familyRole !== "owner" &&
      (state.currentUserRole === "owner" ||
        (state.currentUserRole === "admin" && member.familyRole === "member"));

    const canChangeRole =
      state.permissions.canAssignAdmin &&
      !isSelf &&
      member.familyRole !== "owner";

    return {
      canRemove,
      canChangeRole,
      nextRole: member.familyRole === "admin" ? "member" : "admin",
    };
  }
  function renderMembers() {
    if (familyMembersTable) familyMembersTable.innerHTML = "";
    if (familyMembersCards) familyMembersCards.innerHTML = "";

    const members = Array.isArray(state.members) ? state.members : [];
    const hasMembers = members.length > 0;

    members.forEach((member) => {
      const caps = memberActionCapabilities(member);
      const memberName = member.name || "Sem nome";
      const memberEmail = member.email || "-";
      const memberRoleLabel = roleLabel(member.familyRole);
      const memberDate = formatDatePtBr(member.createdAt);

      let actionsHtml = `<span class="family-no-actions">-</span>`;
      if (caps.canChangeRole || caps.canRemove) {
        actionsHtml = `<div class="family-actions">`;

        if (caps.canChangeRole) {
          const label = caps.nextRole === "admin" ? "Tornar admin" : "Tornar membro";
          const icon = caps.nextRole === "admin" ? "shield" : "user";
          actionsHtml += `
            <button
              class="btn btn-sm btn-outline-primary family-member-action-btn"
              type="button"
              data-action="toggle-role"
              data-member-id="${escapeHtml(member.id)}"
              data-next-role="${escapeHtml(caps.nextRole)}"
            >
              <i class="fa-solid fa-${icon} me-1"></i>${label}
            </button>
          `;
        }

        if (caps.canRemove) {
          actionsHtml += `
            <button
              class="btn btn-sm btn-outline-danger family-member-action-btn"
              type="button"
              data-action="remove-member"
              data-member-id="${escapeHtml(member.id)}"
            >
              <i class="fa-solid fa-user-xmark me-1"></i>Remover
            </button>
          `;
        }

        actionsHtml += `</div>`;
      }

      if (familyMembersTable) {
        familyMembersTable.innerHTML += `
          <tr>
            <td>
              <strong class="family-ellipsis" title="${escapeHtml(memberName)}">${escapeHtml(memberName)}</strong>
            </td>
            <td>
              <span class="family-ellipsis" title="${escapeHtml(memberEmail)}">${escapeHtml(memberEmail)}</span>
            </td>
            <td>
              <span class="family-chip ${roleBadgeClass(member.familyRole)}">
                ${escapeHtml(memberRoleLabel)}
              </span>
            </td>
            <td>
              <span class="family-ellipsis" title="${escapeHtml(memberDate)}">${escapeHtml(memberDate)}</span>
            </td>
            <td class="text-end">${actionsHtml}</td>
          </tr>
        `;
      }

      if (familyMembersCards) {
        familyMembersCards.innerHTML += `
          <div class="col-12 col-md-6 col-xl-4">
            <article class="family-member-card">
              <div class="family-member-head">
                <h6 class="family-member-name" title="${escapeHtml(memberName)}">${escapeHtml(memberName)}</h6>
                <span class="family-chip ${roleBadgeClass(member.familyRole)}">
                  ${escapeHtml(memberRoleLabel)}
                </span>
              </div>

              <div class="family-member-meta">
                <p class="mb-1">
                  <i class="fa-solid fa-envelope me-2"></i>${escapeHtml(memberEmail)}
                </p>
                <p class="mb-0">
                  <i class="fa-regular fa-calendar me-2"></i>${escapeHtml(memberDate)}
                </p>
              </div>

              <div class="family-member-footer">
                ${actionsHtml}
              </div>
            </article>
          </div>
        `;
      }
    });

    membersCountChip.textContent = `${members.length} ${members.length === 1 ? "membro" : "membros"}`;
    familyMembersEmpty.classList.toggle("d-none", hasMembers);

    if (state.familyLoadFailed) {
      familyLoadError.classList.remove("d-none");
      familyLoadError.textContent =
        "Nao foi possivel carregar a lista de membros neste momento.";
      membersSectionHint.textContent =
        "Seu vinculo de familia existe, mas os detalhes nao foram retornados pela API.";
      familyMembersEmpty.classList.add("d-none");
      familyMembersCards?.classList.add("d-none");
      familyMembersTableWrap?.classList.add("d-none");
      syncMembersView();
      return;
    }

    familyLoadError.classList.add("d-none");
    familyLoadError.textContent = "";
    membersSectionHint.textContent = "Lista de membros vinculados a sua familia.";

    if (!hasMembers) {
      familyMembersCards?.classList.add("d-none");
      familyMembersTableWrap?.classList.add("d-none");
      syncMembersView();
      return;
    }

    syncMembersView();
  }
  function renderInviteCode() {
    inviteCodeField.value = state.inviteCode || "";
  }

  function renderAll() {
    setSummaryState();
    setSectionsState();
    renderMembers();
    renderInviteCode();
  }

  async function confirmWithModal({
    title = "Confirmar ação",
    message = "Deseja continuar?",
    confirmLabel = "Confirmar",
    confirmClass = "btn-danger",
    iconClass = "fa-triangle-exclamation text-warning",
  } = {}) {
    if (
      !actionConfirmModalEl ||
      !actionConfirmTitle ||
      !actionConfirmMessage ||
      !actionConfirmOkBtn ||
      !actionConfirmCancelBtn ||
      !actionConfirmModal ||
      typeof bootstrap === "undefined"
    ) {
      showAlert(
        "Não foi possível abrir a confirmação agora. Recarregue a página.",
        "warning",
        "triangle-exclamation"
      );
      return false;
    }

    return new Promise((resolve) => {
      let resolved = false;

      const finish = (value) => {
        if (resolved) return;
        resolved = true;
        actionConfirmOkBtn.removeEventListener("click", onConfirm);
        actionConfirmCancelBtn.removeEventListener("click", onCancel);
        actionConfirmModalEl.removeEventListener("hidden.bs.modal", onHidden);
        resolve(value);
      };

      const onConfirm = () => {
        finish(true);
        actionConfirmModal.hide();
      };

      const onCancel = () => {
        finish(false);
        actionConfirmModal.hide();
      };

      const onHidden = () => {
        finish(false);
      };

      actionConfirmTitle.innerHTML = `
        <i class="fa-solid ${iconClass} me-2"></i>
        ${escapeHtml(title)}
      `;
      actionConfirmMessage.textContent = String(message || "Deseja continuar?");
      actionConfirmOkBtn.className = `btn ${confirmClass}`;
      actionConfirmOkBtn.textContent = String(confirmLabel || "Confirmar");

      actionConfirmOkBtn.addEventListener("click", onConfirm);
      actionConfirmCancelBtn.addEventListener("click", onCancel);
      actionConfirmModalEl.addEventListener("hidden.bs.modal", onHidden);

      actionConfirmModal.show();
    });
  }

  async function loadCurrentUser() {
    try {
      const data = await silentApiFetch("/users/me");
      const user = data?.user || null;
      state.user = user;
      persistUserSafe(user);
    } catch {
      state.user = getStoredUserSafe();
    }
  }

  async function loadFamilyDetails() {
    state.family = null;
    state.members = [];
    state.inviteCode = "";
    state.currentUserRole = "member";
    state.permissions = {
      canManageFamily: false,
      canManageMembers: false,
      canAssignAdmin: false,
      canTransferOwnership: false,
      canLeaveFamily: false,
    };
    state.familyLoadFailed = false;

    await loadCurrentUser();

    if (!hasFamily()) {
      renderAll();
      return;
    }

    try {
      const data = await silentApiFetch("/family");
      state.family = data?.family || null;
      state.members = (Array.isArray(data?.members) ? data.members : []).map(normalizeMember);
      state.currentUserRole = normalizeRole(data?.currentUserRole || state.user?.familyRole);
      state.permissions = {
        ...state.permissions,
        ...(data?.permissions || {}),
      };
    } catch {
      state.familyLoadFailed = true;
    }

    if (isCurrentUserOwner()) {
      try {
        const inviteData = await silentApiFetch("/family/invite-code");
        state.inviteCode = String(inviteData?.inviteCode || "").trim();
      } catch {
        state.inviteCode = "";
      }
    }

    renderAll();
  }

  async function refreshWithLoading(button, successMessage = "") {
    setButtonBusy(button, true, "Atualizando...");
    try {
      await loadFamilyDetails();
      if (successMessage) {
        showAlert(successMessage, "success", "check-circle");
      }
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function updateMemberRole(memberId, role, triggerBtn) {
    const roleText = role === "admin" ? "admin" : "membro";
    const ok = await confirmWithModal({
      title: "Alterar papel",
      message: `Confirmar alteração de papel para ${roleText}?`,
      confirmLabel: "Salvar",
      confirmClass: "btn-primary",
      iconClass: "fa-shield-halved text-primary",
    });
    if (!ok) return;

    setButtonBusy(triggerBtn, true, "Salvando...");
    try {
      await apiFetch(`/family/members/${memberId}/role`, "PATCH", { role });
      await loadFamilyDetails();
      showAlert("Papel do membro atualizado", "success", "check-circle");
    } catch {
      // apiFetch already handles errors
    } finally {
      setButtonBusy(triggerBtn, false);
    }
  }

  async function removeMember(memberId, triggerBtn) {
    const ok = await confirmWithModal({
      title: "Remover membro",
      message: "Tem certeza que deseja remover este membro da família?",
      confirmLabel: "Remover",
      confirmClass: "btn-danger",
      iconClass: "fa-user-xmark text-danger",
    });
    if (!ok) return;

    setButtonBusy(triggerBtn, true, "Removendo...");
    try {
      await apiFetch(`/family/members/${memberId}`, "DELETE");
      await loadFamilyDetails();
      showAlert("Membro removido da família", "success", "check-circle");
    } catch {
      // apiFetch already handles errors
    } finally {
      setButtonBusy(triggerBtn, false);
    }
  }

  joinCodeInput?.addEventListener("input", () => {
    joinCodeInput.value = String(joinCodeInput.value || "").toUpperCase().replace(/\s+/g, "");
  });

  joinFamilyBtn?.addEventListener("click", async () => {
    const code = String(joinCodeInput.value || "").trim().toUpperCase();

    if (!code) {
      showAlert("Informe o código de convite", "warning", "triangle-exclamation");
      return;
    }

    setButtonBusy(joinFamilyBtn, true, "Entrando...");
    try {
      await apiFetch("/family/join", "POST", { code });
      showAlert(
        "Você entrou na família. Faça login novamente para atualizar sua sessão.",
        "success",
        "check-circle"
      );

      setTimeout(() => {
        clearSessionAndRedirectToLogin("family-joined");
      }, 1700);
    } catch {
      // apiFetch already handles errors
    } finally {
      setButtonBusy(joinFamilyBtn, false);
    }
  });

  refreshFamilyBtn?.addEventListener("click", async () => {
    await refreshWithLoading(refreshFamilyBtn, "Dados da família atualizados");
  });

  saveFamilyNameBtn?.addEventListener("click", async () => {
    const name = String(familyNameInput.value || "").trim();
    if (!name) {
      showAlert("Informe o nome da família", "warning", "triangle-exclamation");
      return;
    }

    setButtonBusy(saveFamilyNameBtn, true, "Salvando...");
    try {
      await apiFetch("/family/name", "PATCH", { name });
      await loadFamilyDetails();
      showAlert("Nome da família atualizado", "success", "check-circle");
    } catch {
      // apiFetch already handles errors
    } finally {
      setButtonBusy(saveFamilyNameBtn, false);
    }
  });

  transferOwnerBtn?.addEventListener("click", async () => {
    const memberId = String(transferOwnerSelect.value || "").trim();
    if (!memberId) {
      showAlert("Selecione um membro para receber ownership", "warning", "triangle-exclamation");
      return;
    }

    const ok = await confirmWithModal({
      title: "Transferir ownership",
      message: "Esta ação concederá controle total para o membro selecionado. Deseja continuar?",
      confirmLabel: "Transferir",
      confirmClass: "btn-warning",
      iconClass: "fa-crown text-warning",
    });
    if (!ok) return;

    setButtonBusy(transferOwnerBtn, true, "Transferindo...");
    try {
      await apiFetch("/family/owner", "PATCH", { memberId });
      await loadFamilyDetails();
      showAlert("Ownership transferido com sucesso", "success", "crown");
    } catch {
      // apiFetch already handles errors
    } finally {
      setButtonBusy(transferOwnerBtn, false);
    }
  });

  leaveFamilyBtn?.addEventListener("click", async () => {
    const ok = await confirmWithModal({
      title: "Sair da família",
      message: "Tem certeza que deseja sair da família?",
      confirmLabel: "Sair",
      confirmClass: "btn-danger",
      iconClass: "fa-person-walking-arrow-right text-danger",
    });
    if (!ok) return;

    setButtonBusy(leaveFamilyBtn, true, "Saindo...");
    try {
      await apiFetch("/family/leave", "POST");
      showAlert("Você saiu da família. Faça login novamente.", "success", "check-circle");
      setTimeout(() => {
        clearSessionAndRedirectToLogin("family-left");
      }, 1500);
    } catch {
      // apiFetch already handles errors
      setButtonBusy(leaveFamilyBtn, false);
    }
  });

  copyInviteCodeBtn?.addEventListener("click", async () => {
    const code = String(inviteCodeField.value || "").trim();
    if (!code) {
      showAlert("Nenhum código disponível para copiar", "warning", "triangle-exclamation");
      return;
    }

    try {
      await copyTextSafe(code);
      showAlert("Código copiado", "success", "copy");
    } catch {
      showAlert("Não foi possível copiar o código", "danger", "triangle-exclamation");
    }
  });

  regenInviteCodeBtn?.addEventListener("click", async () => {
    setButtonBusy(regenInviteCodeBtn, true, "Gerando...");
    try {
      const data = await apiFetch("/family/invite-code", "PATCH");
      state.inviteCode = String(data?.inviteCode || "").trim();
      renderInviteCode();
      showAlert("Novo código de convite gerado", "success", "rotate");
    } catch {
      // apiFetch already handles errors
    } finally {
      setButtonBusy(regenInviteCodeBtn, false);
    }
  });

  familyMembersTable?.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const action = String(button.dataset.action || "").trim();
    const memberId = String(button.dataset.memberId || "").trim();
    if (!memberId) return;

    if (action === "toggle-role") {
      const nextRole = normalizeRole(button.dataset.nextRole);
      await updateMemberRole(memberId, nextRole, button);
      return;
    }

    if (action === "remove-member") {
      await removeMember(memberId, button);
    }
  });

  familyMembersCards?.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const action = String(button.dataset.action || "").trim();
    const memberId = String(button.dataset.memberId || "").trim();
    if (!memberId) return;

    if (action === "toggle-role") {
      const nextRole = normalizeRole(button.dataset.nextRole);
      await updateMemberRole(memberId, nextRole, button);
      return;
    }

    if (action === "remove-member") {
      await removeMember(memberId, button);
    }
  });

  familyViewCardsBtn?.addEventListener("click", () => {
    setMembersView("cards");
  });

  familyViewTableBtn?.addEventListener("click", () => {
    setMembersView("table");
  });

  setMembersView(familyMembersView);

  await loadFamilyDetails();
});


