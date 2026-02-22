// public/js/transactions.js

/**
 * =========================================================
 * TRANSACTIONS
 * - Remove onclick do HTML e de linhas geradas via JS
 * - Usa event delegation para Editar/Excluir
 * - Centraliza init em DOMContentLoaded
 *
 * MELHORIA (EDIÇÃO):
 * - Não permite salvar se não houver mudanças (dirty = false)
 * - Não permite salvar se algum campo obrigatório estiver vazio/inválido
 * - Botão "Salvar" do modal fica desabilitado até ficar válido + dirty
 * =========================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  // Segurança: não deixa executar sem token
  checkAuth();

  // Navbar/tema (utils.js)
  initTheme();
  bindInviteModal();

  // Elementos
  const transactionsCards = document.getElementById("latestTransactionsCards");
  const transactionsTableWrap = document.getElementById("latestTransactionsTableWrap");
  const transactionsTableBody = document.getElementById("latestTransactionsTableBody");
  const transactionsEmptyState = document.getElementById("transactionsEmptyState");
  const transactionsViewCardsBtn = document.getElementById("transactionsViewCardsBtn");
  const transactionsViewTableBtn = document.getElementById("transactionsViewTableBtn");
  const form = document.getElementById("transactionForm");

  const monthIncome = document.getElementById("monthIncome");
  const monthExpense = document.getElementById("monthExpense");
  const monthBalance = document.getElementById("monthBalance");

  // Modal editar
  const editType = document.getElementById("editType");
  const editValue = document.getElementById("editValue");
  const editCategory = document.getElementById("editCategory");
  const editGroup = document.getElementById("editGroup");
  const editDate = document.getElementById("editDate");
  const editDescription = document.getElementById("editDescription");
  const saveEditBtn = document.getElementById("saveEditBtn");

  // Modal excluir
  const confirmDeleteBtn = document.getElementById("confirmDelete");

  // Modal categoria
  const openCategoryBtn = document.getElementById("openCategoryBtn");
  const saveCategoryBtn = document.getElementById("saveCategoryBtn");

  // Modals bootstrap (instâncias)
  const editModalEl = document.getElementById("editTransactionModal");
  const deleteModalEl = document.getElementById("deleteConfirmModal");
  const categoryModalEl = document.getElementById("categoryModal");

  const editModal = editModalEl ? new bootstrap.Modal(editModalEl) : null;
  const deleteModal = deleteModalEl ? new bootstrap.Modal(deleteModalEl) : null;
  const categoryModal = categoryModalEl ? new bootstrap.Modal(categoryModalEl) : null;

  // Estado
  let editingTransactionId = null;
  let transactionToDelete = null;
  let cachedCategories = null;
  const latestTransactionsById = new Map();

  // Snapshot do original (para detectar se houve alteração)
  let editOriginal = null;

  const groupLabels = {
    fixed: "Fixo",
    variable: "Variável",
    planned: "Previsto",
    unexpected: "Imprevisto"
  };

  const yieldIncomeCategoryKey = "rendimentos";
  const memberNameById = new Map();
  let memberDirectoryLoaded = false;
  const TRANSACTIONS_VIEW_STORAGE_KEY = "myfinance_transactions_view";
  let transactionsView = loadStoredTransactionsView();

  /* ===============================
   * Helpers
   * =============================== */

  function fmtBRL(n) {
    if (typeof formatCurrency === "function") return formatCurrency(n);
    return Number(n || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function toAmount(value, fallback = 0) {
    if (typeof toNumericValue === "function") return toNumericValue(value, fallback);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function todayLocalISO() {
    if (typeof toLocalISODate === "function") return toLocalISODate(new Date());
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function toApiDateValue(localDate) {
    if (typeof toApiIsoFromLocalDateInput === "function") {
      return toApiIsoFromLocalDateInput(localDate, { hour: 12 });
    }
    return `${String(localDate || "").trim()}T12:00:00`;
  }

  function formatDateCell(value) {
    if (typeof formatDateUserLocal === "function") {
      return formatDateUserLocal(value, { locale: "pt-BR", includeTime: false });
    }
    return (String(value || "").slice(0, 10)).split("-").reverse().join("/");
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  function isYieldIncomeTransaction(transaction) {
    const type = normalizeText(transaction?.type);
    const category = normalizeText(transaction?.category);
    const group = normalizeText(transaction?.group);
    return type === "income" && category === yieldIncomeCategoryKey && group === "variable";
  }

  function normalizeId(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    if (typeof value === "object") {
      return String(value._id || value.id || "").trim();
    }
    return String(value).trim();
  }

  function pickName(value) {
    if (typeof value === "string" && value.trim()) return value.trim();
    return "";
  }

  function seedMemberMapWithLoggedUser() {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return;
      const user = JSON.parse(raw);
      if (!user) return;

      const id = normalizeId(user.id || user._id);
      const name =
        pickName(user.name) ||
        pickName(user.nome) ||
        pickName(user.email) ||
        "Você";

      if (id) memberNameById.set(id, name);
    } catch (_) {}
  }

  async function silentApiFetch(url, options = {}) {
    const token = localStorage.getItem("token");
    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const response = await fetch(API_URL + url, {
      ...options,
      headers
    });

    if (response.status === 401) {
      if (typeof window.appLogout === "function") window.appLogout("401");
      throw new Error("Sessão expirada");
    }

    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok) {
      const error = new Error(data?.error || "Erro na requisição");
      error.status = response.status;
      throw error;
    }

    return data;
  }

  async function ensureMemberDirectoryLoaded() {
    if (memberDirectoryLoaded) return;

    seedMemberMapWithLoggedUser();

    try {
      const familyData = await silentApiFetch("/family");
      const members = Array.isArray(familyData?.members) ? familyData.members : [];

      members.forEach((member) => {
        const id = normalizeId(member?.id || member?._id);
        const name =
          pickName(member?.name) ||
          pickName(member?.email) ||
          "";

        if (id && name) {
          memberNameById.set(id, name);
        }
      });
    } catch (error) {
      if (error?.status !== 404) {
        console.warn("Não foi possível carregar o diretório de membros.", error);
      }
    } finally {
      memberDirectoryLoaded = true;
    }
  }

  function resolveMemberName(transaction) {
    const inlineName =
      pickName(transaction?.memberName) ||
      pickName(transaction?.userName) ||
      pickName(transaction?.createdByName) ||
      pickName(transaction?.user?.name) ||
      pickName(transaction?.userId?.name);

    if (inlineName) return inlineName;

    const userId = normalizeId(
      transaction?.userId ||
      transaction?.createdBy ||
      transaction?.user
    );

    if (userId && memberNameById.has(userId)) {
      return memberNameById.get(userId);
    }

    return "Não informado";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function getCurrentYearMonth() {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    };
  }

  function parseTransactionDate(value) {
    if (typeof parseDateLikeLocal === "function") {
      return parseDateLikeLocal(value, { middayHour: 12 });
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function isSameYearMonth(date, year, month) {
    if (!date) return false;
    return date.getFullYear() === year && date.getMonth() + 1 === month;
  }

  function extractTransactions(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.transactions)) return payload.transactions;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data?.transactions)) return payload.data.transactions;
    return [];
  }

  function getLatestTransactions(items, limit = 5) {
    const list = Array.isArray(items) ? items : [];
    const maxItems = Math.max(0, Number(limit) || 5);

    return list
      .map((item) => {
        const date = parseTransactionDate(item?.date || item?.createdAt);
        return {
          item,
          dateMs: date ? date.getTime() : 0
        };
      })
      .sort((a, b) => b.dateMs - a.dateMs)
      .slice(0, maxItems)
      .map((entry) => entry.item);
  }

  function normalizeTransactionsView(value) {
    return value === "table" ? "table" : "cards";
  }

  function loadStoredTransactionsView() {
    try {
      return normalizeTransactionsView(localStorage.getItem(TRANSACTIONS_VIEW_STORAGE_KEY));
    } catch (_) {
      return "cards";
    }
  }

  function persistTransactionsView(value) {
    try {
      localStorage.setItem(
        TRANSACTIONS_VIEW_STORAGE_KEY,
        normalizeTransactionsView(value)
      );
    } catch (_) {}
  }

  function syncTransactionsView() {
    const showingCards = transactionsView === "cards";
    transactionsCards?.classList.toggle("d-none", !showingCards);
    transactionsTableWrap?.classList.toggle("d-none", showingCards);
    transactionsViewCardsBtn?.classList.toggle("is-active", showingCards);
    transactionsViewCardsBtn?.setAttribute("aria-pressed", showingCards ? "true" : "false");
    transactionsViewTableBtn?.classList.toggle("is-active", !showingCards);
    transactionsViewTableBtn?.setAttribute("aria-pressed", !showingCards ? "true" : "false");
  }

  function setTransactionsView(nextView) {
    transactionsView = normalizeTransactionsView(nextView);
    persistTransactionsView(transactionsView);
    syncTransactionsView();
  }

  /**
   * Retorna um objeto com os valores atuais do modal de edição, normalizados
   * (isso ajuda a comparar com o original e a validar).
   */
  function getEditPayload() {
    return {
      type: (editType?.value || "").trim(),
      value: toAmount(editValue?.value, 0),
      category: (editCategory?.value || "").trim(),
      group: (editGroup?.value || "").trim(),
      date: (editDate?.value || "").trim(), // YYYY-MM-DD
      description: (editDescription?.value || "").trim()
    };
  }

  /**
   * Validação do modal de edição (campos obrigatórios).
   * Regra do usuário: "categoria e qualquer outra opção vazia" => bloqueia.
   */
  function isEditValid(p) {
    if (!p.type) return false;
    if (!p.category) return false;
    if (!p.group) return false;
    if (!p.date) return false;

    // value precisa ser número e > 0
    if (!Number.isFinite(p.value) || p.value <= 0) return false;

    // validações opcionais (ajuda a evitar lixo)
    if (p.type !== "income" && p.type !== "expense") return false;
    if (!Object.prototype.hasOwnProperty.call(groupLabels, p.group)) return false;

    return true;
  }

  /**
   * Retorna true se houve mudança em qualquer campo do modal vs snapshot original.
   */
  function isEditDirty(p) {
    if (!editOriginal) return false;
    return (
      p.type !== editOriginal.type ||
      toAmount(p.value, 0) !== toAmount(editOriginal.value, 0) ||
      p.category !== editOriginal.category ||
      p.group !== editOriginal.group ||
      p.date !== editOriginal.date ||
      p.description !== editOriginal.description
    );
  }

  /**
   * Atualiza o estado do botão "Salvar" do modal:
   * - habilita apenas se (valid && dirty)
   */
  function updateEditSaveState() {
    if (!saveEditBtn) return;

    const p = getEditPayload();
    const valid = isEditValid(p);
    const dirty = isEditDirty(p);

    const canSave = valid && dirty;

    saveEditBtn.disabled = !canSave;
    saveEditBtn.style.opacity = canSave ? "1" : "0.6";
    saveEditBtn.style.cursor = canSave ? "pointer" : "not-allowed";
  }

  /**
   * Ao abrir modal, começa travado para evitar salvar sem mudança.
   */
  function disableEditSaveBtn() {
    if (!saveEditBtn) return;
    saveEditBtn.disabled = true;
    saveEditBtn.style.opacity = "0.6";
    saveEditBtn.style.cursor = "not-allowed";
  }

  function setEditFormDisabled(disabled) {
    [editType, editValue, editCategory, editGroup, editDate].forEach((el) => {
      if (!el) return;
      el.disabled = Boolean(disabled);
    });
  }

  function setEditModalLoading(isLoading) {
    const loading = Boolean(isLoading);
    setEditFormDisabled(loading);
    if (loading) {
      disableEditSaveBtn();
      if (editCategory) {
        editCategory.innerHTML = '<option value="">Carregando...</option>';
      }
    }
  }

  async function getCategoriesCached(force = false) {
    if (!force && Array.isArray(cachedCategories)) return cachedCategories;
    const categories = await apiFetch("/categories");
    cachedCategories = Array.isArray(categories) ? categories : [];
    return cachedCategories;
  }

  async function fillEditModalFromTransaction(transaction) {
    editType.value = transaction?.type === "income" ? "income" : "expense";
    if (typeof setMoneyInputValue === "function") {
      setMoneyInputValue(editValue, transaction?.value, { allowEmpty: false });
    } else {
      editValue.value = String(transaction?.value ?? "");
    }
    editGroup.value = String(transaction?.group || "unexpected").trim().toLowerCase();
    if (typeof toLocalInputDate === "function") {
      editDate.value = toLocalInputDate(transaction?.date || transaction?.createdAt);
    } else {
      editDate.value = String(transaction?.date || transaction?.createdAt || "").slice(0, 10);
    }
    editDescription.value = transaction?.description || "";

    await loadEditCategories(editType.value, transaction?.category);

    editOriginal = {
      type: (editType.value || "").trim(),
      value: toAmount(editValue.value, 0),
      category: (editCategory.value || "").trim(),
      group: (editGroup.value || "").trim(),
      date: (editDate.value || "").trim(),
      description: (editDescription.value || "").trim()
    };
  }

  /* ===============================
   * Carregar mês e render tabela
   * =============================== */

  async function loadLatestTransactions(limit = 5) {
    try {
      const { year, month } = getCurrentYearMonth();

      const [allData, monthData] = await Promise.all([
        apiFetch("/transactions"),
        apiFetch(`/transactions/month?year=${year}&month=${month}`).catch(() => null),
      ]);

      const allTransactions = extractTransactions(allData);
      const monthTransactionsRaw = extractTransactions(monthData);
      const monthTransactions = monthTransactionsRaw.length
        ? monthTransactionsRaw
        : allTransactions.filter((tx) =>
          isSameYearMonth(
            parseTransactionDate(tx?.date || tx?.createdAt),
            year,
            month
          )
        );

      const latestTransactions = getLatestTransactions(allTransactions, limit);
      latestTransactionsById.clear();
      latestTransactions.forEach((tx) => {
        const txId = String(tx?._id || tx?.id || "").trim();
        if (txId) latestTransactionsById.set(txId, tx);
      });

      await ensureMemberDirectoryLoaded();

      let income = 0;
      let expense = 0;

      monthTransactions.forEach((t) => {
        if (t.type === "income") income += toAmount(t.value, 0);
        if (t.type === "expense") expense += toAmount(t.value, 0);
      });

      monthIncome.textContent = fmtBRL(income);
      monthExpense.textContent = fmtBRL(expense);
      monthBalance.textContent = fmtBRL(income - expense);

      transactionsCards.innerHTML = "";
      if (transactionsTableBody) transactionsTableBody.innerHTML = "";

      if (!latestTransactions.length) {
        transactionsEmptyState?.classList.remove("d-none");
        return;
      }

      transactionsEmptyState?.classList.add("d-none");

      latestTransactions.forEach((t) => {
        const txId = String(t?._id || t?.id || "").trim();
        const dateStr = formatDateCell(t?.date || t?.createdAt);
        const typeLabel = t.type === "income" ? "Entrada" : "Saída";
        const isYieldIncome = isYieldIncomeTransaction(t);
        const normalizedTypeLabel =
          t.type === "income" && isYieldIncome
            ? "Entrada (Liquidez diária)"
            : typeLabel;
        const groupLabel = groupLabels[t.group] || t.group || "-";
        const memberName = resolveMemberName(t);
        const categorySafe = escapeHtml(t?.category || "Sem categoria");
        const descriptionSafe = t?.description ? escapeHtml(t.description) : "";
        const yieldPill = isYieldIncome
          ? '<span class="transaction-origin-pill">Liquidez diária</span>'
          : "";
        const typeClass = t.type === "income" ? "is-income" : "is-expense";
        const typeIcon = t.type === "income" ? "fa-arrow-down-long" : "fa-arrow-up-long";
        const typeChipClass = t.type === "income" ? "is-income" : "is-expense";
        const actionsHtml = txId
          ? `
            <div class="transaction-latest-actions">
              <button class="btn btn-sm btn-outline-primary me-1 transactions-action-btn" type="button" data-action="edit" data-id="${escapeHtml(txId)}">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger transactions-action-btn" type="button" data-action="delete" data-id="${escapeHtml(txId)}">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          `
          : "";
        const tableActionsHtml = txId
          ? `
            <div class="transactions-table-actions text-end">
              <button
                type="button"
                class="btn btn-sm btn-outline-primary me-1 transactions-action-btn"
                data-action="edit"
                data-id="${escapeHtml(txId)}"
                title="Editar"
                aria-label="Editar transação"
              >
                <i class="fa-solid fa-pen"></i>
              </button>
              <button
                type="button"
                class="btn btn-sm btn-outline-danger transactions-action-btn"
                data-action="delete"
                data-id="${escapeHtml(txId)}"
                title="Excluir"
                aria-label="Excluir transação"
              >
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          `
          : '<span class="text-muted small">-</span>';

        transactionsCards.innerHTML += `
          <div class="col-12 col-md-6 col-xl-4">
            <article class="transaction-latest-card ${typeClass} ${isYieldIncome ? "transaction-row-yield" : ""}">
              <div class="transaction-latest-head">
                <span class="transaction-latest-type ${typeClass}">
                  <i class="fa-solid ${typeIcon} me-1"></i>${escapeHtml(normalizedTypeLabel)}
                </span>
                <span class="transaction-latest-date">${escapeHtml(dateStr)}</span>
              </div>

              <div class="transaction-latest-meta">
                <div class="transaction-latest-meta-item">
                  <i class="fa-solid fa-tag"></i>
                  <span>${categorySafe} ${yieldPill}</span>
                </div>
                ${descriptionSafe ? `
                <div class="transaction-latest-meta-item">
                  <i class="fa-solid fa-align-left"></i>
                  <span>${descriptionSafe}</span>
                </div>
                ` : ""}
                <div class="transaction-latest-meta-item">
                  <i class="fa-solid fa-layer-group"></i>
                  <span>${escapeHtml(groupLabel)}</span>
                </div>
                <div class="transaction-latest-meta-item">
                  <i class="fa-solid fa-user"></i>
                  <span>${escapeHtml(memberName)}</span>
                </div>
              </div>

              <div class="transaction-latest-footer">
                <strong class="transaction-latest-value">${fmtBRL(t.value)}</strong>
                ${actionsHtml}
              </div>
            </article>
          </div>
        `;

        if (transactionsTableBody) {
          transactionsTableBody.innerHTML += `
            <tr${isYieldIncome ? ' class="transaction-row-yield"' : ""}>
              <td>${escapeHtml(dateStr)}</td>
              <td>
                <span class="transactions-type-chip ${typeChipClass}">
                  <i class="fa-solid ${typeIcon}"></i>
                  ${escapeHtml(normalizedTypeLabel)}
                </span>
              </td>
              <td>${categorySafe} ${yieldPill}</td>
              <td>${escapeHtml(t.description || "")}</td>
              <td>${escapeHtml(groupLabel)}</td>
              <td>${escapeHtml(memberName)}</td>
              <td class="text-end fw-semibold">${escapeHtml(fmtBRL(t.value))}</td>
              <td class="text-end">${tableActionsHtml}</td>
            </tr>
          `;
        }
      });
    } catch (error) {
      showAlert("Erro ao carregar transações", "danger", "triangle-exclamation");
      transactionsCards.innerHTML = "";
      if (transactionsTableBody) transactionsTableBody.innerHTML = "";
      transactionsEmptyState?.classList.remove("d-none");
      monthIncome.textContent = fmtBRL(0);
      monthExpense.textContent = fmtBRL(0);
      monthBalance.textContent = fmtBRL(0);
    }
  }

  /* ===============================
   * CRUD Transação (criar)
   * =============================== */

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    setLoading(submitBtn, true);

    try {
      const payload = {
        type: document.getElementById("type").value,
        value: toAmount(document.getElementById("value").value, 0),
        category: document.getElementById("category").value,
        group: document.getElementById("group").value,
        date: toApiDateValue(document.getElementById("date").value),
        description: (document.getElementById("description").value || "").trim()
      };

      await apiFetch("/transactions", "POST", payload);

      form.reset();

      // Define data atual novamente
      const today = todayLocalISO();
      document.getElementById("date").value = today;

      showAlert("Transação criada com sucesso!", "success", "check-circle");

      await loadLatestTransactions(5);
    } catch (error) {
      showAlert(error.message || "Erro ao criar transação", "danger", "triangle-exclamation");
    } finally {
      setLoading(submitBtn, false);
    }
  });

  /* ===============================
   * Editar / Atualizar (modal)
   * =============================== */

  async function editTransaction(id) {
    const transactionId = String(id || "").trim();
    if (!transactionId) return;

    editingTransactionId = transactionId;
    setEditModalLoading(true);
    editModal?.show();

    try {
      const localTransaction = latestTransactionsById.get(transactionId) || null;
      const transaction = localTransaction || await apiFetch(`/transactions/${transactionId}`);
      await fillEditModalFromTransaction(transaction);

      // Atualiza estado do botao com base em (valid && dirty)
      updateEditSaveState();
    } catch (error) {
      showAlert("Erro ao carregar transa\u00e7\u00e3o para edi\u00e7\u00e3o", "danger", "triangle-exclamation");
      editModal?.hide();
    } finally {
      setEditModalLoading(false);
    }
  }

  async function updateTransaction() {
    if (!editingTransactionId) return;

    const p = getEditPayload();

    // Blindagem: não salva se estiver inválido
    if (!isEditValid(p)) {
      showAlert("Preencha todos os campos antes de salvar.", "warning", "triangle-exclamation");
      updateEditSaveState();
      return;
    }

    // Blindagem: não salva se não houve alteração
    if (!isEditDirty(p)) {
      showAlert("Nenhuma alteração detectada.", "warning", "triangle-exclamation");
      updateEditSaveState();
      return;
    }

    setLoading(saveEditBtn, true);

    try {
      await apiFetch(`/transactions/${editingTransactionId}`, "PUT", {
        type: p.type,
        value: p.value,
        category: p.category,
        group: p.group,
        date: toApiDateValue(p.date),
        description: p.description
      });

      editModal?.hide();
      showAlert("Transação atualizada com sucesso!", "success", "check-circle");

      await loadLatestTransactions(5);
    } catch (error) {
      showAlert(error.message || "Erro ao atualizar transação", "danger", "triangle-exclamation");
    } finally {
      setLoading(saveEditBtn, false);
      // Depois do save, ainda vale recalcular (se o modal permanecer aberto por algum motivo)
      updateEditSaveState();
    }
  }

  /* ===============================
   * Excluir (modal)
   * =============================== */

  function openDeleteModal(id) {
    transactionToDelete = id;
    deleteModal?.show();
  }

  async function deleteTransactionConfirmed() {
    if (!transactionToDelete) return;

    setLoading(confirmDeleteBtn, true);

    try {
      await apiFetch(`/transactions/${transactionToDelete}`, "DELETE");

      deleteModal?.hide();
      showAlert("Transação excluída com sucesso!", "success", "check-circle");

      await loadLatestTransactions(5);
    } catch (error) {
      showAlert(error.message || "Erro ao excluir transação", "danger", "triangle-exclamation");
    } finally {
      setLoading(confirmDeleteBtn, false);
      transactionToDelete = null;
    }
  }

  /* ===============================
   * Categorias
   * =============================== */

  async function loadCategories(type) {
    try {
      const categories = await getCategoriesCached();
      const categorySelect = document.getElementById("category");

      categorySelect.innerHTML = "";

      (categories || [])
        .filter((c) => c.type === type)
        .forEach((c) => {
          categorySelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
        });
    } catch (error) {
      showAlert("Erro ao carregar categorias", "danger", "triangle-exclamation");
    }
  }

  async function loadEditCategories(type, selected) {
    try {
      const categories = await getCategoriesCached();

      editCategory.innerHTML = "";

      (categories || [])
        .filter((c) => c.type === type)
        .forEach((c) => {
          editCategory.innerHTML += `<option value="${c.name}">${c.name}</option>`;
        });

      // Pode acontecer de não existir nenhuma categoria => select fica vazio
      // Nesse caso, editCategory.value vira "" e a validação vai bloquear o salvar.
      editCategory.value = selected || "";

      // Como o select mudou, recalcula o estado do botão
      updateEditSaveState();
    } catch (error) {
      showAlert("Erro ao carregar categorias", "danger", "triangle-exclamation");
    }
  }

  function openCategoryModal() {
    categoryModal?.show();
  }

  async function createCategoryFromModal() {
    const name = (document.getElementById("newCategoryName").value || "").trim();
    const type = document.getElementById("newCategoryType").value;

    if (!name) {
      showAlert("Por favor, insira um nome para a categoria.", "warning", "exclamation-circle");
      return;
    }

    setLoading(saveCategoryBtn, true);

    try {
      await apiFetch("/categories", "POST", { name, type });
      cachedCategories = null;

      categoryModal?.hide();
      showAlert("Categoria criada com sucesso!", "success", "check-circle");

      // Recarrega categorias do select principal conforme tipo atual do form
      const currentType = document.getElementById("type").value;
      await loadCategories(currentType);

      // Se a categoria criada for do mesmo tipo selecionado, já marca
      if (currentType === type) {
        document.getElementById("category").value = name;
      }

      // Se o modal de edição estiver aberto e o tipo bater, recarrega também o select do modal
      if (editModalEl?.classList.contains("show") && editType?.value === type) {
        await loadEditCategories(type, editCategory.value || "");
      }

      document.getElementById("newCategoryName").value = "";
    } catch (error) {
      showAlert(error.message || "Erro ao criar categoria", "danger", "triangle-exclamation");
    } finally {
      setLoading(saveCategoryBtn, false);
    }
  }

  /* ===============================
   * Event delegation (cards)
   * =============================== */

  transactionsCards?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "edit") editTransaction(id);
    if (action === "delete") openDeleteModal(id);
  });

  transactionsTableBody?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "edit") editTransaction(id);
    if (action === "delete") openDeleteModal(id);
  });

  /* ===============================
   * Binds de botões do HTML (sem onclick)
   * =============================== */

  saveEditBtn?.addEventListener("click", updateTransaction);
  confirmDeleteBtn?.addEventListener("click", deleteTransactionConfirmed);
  openCategoryBtn?.addEventListener("click", openCategoryModal);
  saveCategoryBtn?.addEventListener("click", createCategoryFromModal);
  transactionsViewCardsBtn?.addEventListener("click", () => {
    setTransactionsView("cards");
  });
  transactionsViewTableBtn?.addEventListener("click", () => {
    setTransactionsView("table");
  });

  // Sempre que o usuário mexer nos campos do modal de edição, recalcula botão salvar
  [editType, editValue, editCategory, editGroup, editDate, editDescription].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", updateEditSaveState);
    el.addEventListener("change", updateEditSaveState);
  });

  // Tipo no form principal muda as categorias
  document.getElementById("type").addEventListener("change", function () {
    loadCategories(this.value);
  });

  // Tipo no modal de edição muda as categorias do modal (e recalcula estado do salvar)
  editType.addEventListener("change", async function () {
    await loadEditCategories(this.value, editCategory.value);
    updateEditSaveState();
  });

  /* ===============================
   * INIT
   * =============================== */

  // Define mês atual no filtro

  // Define data atual no input do formulário
  document.getElementById("date").value = todayLocalISO();

  // Carrega categorias iniciais e lista do mês atual
  loadCategories(document.getElementById("type").value);

  setTransactionsView(transactionsView);
  loadLatestTransactions(5);

});

