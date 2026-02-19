// public/js/history.js

document.addEventListener("DOMContentLoaded", () => {
  checkAuth();
  initTheme();
  bindInviteModal();

  const els = {
    filtersForm: document.getElementById("historyFiltersForm"),
    filterSummary: document.getElementById("historyFilterSummary"),
    filterSearch: document.getElementById("filterSearch"),
    filterPeriod: document.getElementById("filterPeriod"),
    filterStartDate: document.getElementById("filterStartDate"),
    filterEndDate: document.getElementById("filterEndDate"),
    filterType: document.getElementById("filterType"),
    filterGroup: document.getElementById("filterGroup"),
    filterCategory: document.getElementById("filterCategory"),
    filterMember: document.getElementById("filterMember"),
    filterMinValue: document.getElementById("filterMinValue"),
    filterMaxValue: document.getElementById("filterMaxValue"),
    filterSort: document.getElementById("filterSort"),
    clearFiltersBtn: document.getElementById("clearFiltersBtn"),
    filtersPanel: document.getElementById("historyFiltersPanel"),
    toggleFiltersPanelBtn: document.getElementById("toggleFiltersPanelBtn"),
    viewCardsBtn: document.getElementById("viewCardsBtn"),
    viewTableBtn: document.getElementById("viewTableBtn"),
    exportCsvBtn: document.getElementById("exportCsvBtn"),
    exportCsvOptionsModalEl: document.getElementById("exportCsvOptionsModal"),
    exportCsvIncludeMetadata: document.getElementById("exportCsvIncludeMetadata"),
    exportCsvIncludeImpact: document.getElementById("exportCsvIncludeImpact"),
    exportCsvModeComplete: document.getElementById("exportCsvModeComplete"),
    exportCsvModeEssentials: document.getElementById("exportCsvModeEssentials"),
    exportCsvConfirmBtn: document.getElementById("exportCsvConfirmBtn"),
    summaryIncome: document.getElementById("summaryIncome"),
    summaryExpense: document.getElementById("summaryExpense"),
    summaryBalance: document.getElementById("summaryBalance"),
    summaryCount: document.getElementById("summaryCount"),
    cardsWrap: document.getElementById("historyCards"),
    tableWrap: document.getElementById("historyTableWrap"),
    tableBody: document.getElementById("historyTableBody"),
    emptyState: document.getElementById("historyEmpty"),
    prevPageBtn: document.getElementById("prevPageBtn"),
    nextPageBtn: document.getElementById("nextPageBtn"),
    pageInfo: document.getElementById("pageInfo"),
    pageState: document.getElementById("historyPageState"),
    editModalEl: document.getElementById("historyEditModal"),
    editType: document.getElementById("historyEditType"),
    editValue: document.getElementById("historyEditValue"),
    editCategory: document.getElementById("historyEditCategory"),
    editGroup: document.getElementById("historyEditGroup"),
    editDate: document.getElementById("historyEditDate"),
    saveEditBtn: document.getElementById("historySaveEditBtn"),
    deleteModalEl: document.getElementById("historyDeleteModal"),
    confirmDeleteBtn: document.getElementById("historyConfirmDeleteBtn"),
  };

  const TYPE_LABELS = {
    income: "Entrada",
    expense: "Saída",
  };

  const GROUP_LABELS = {
    fixed: "Fixo",
    variable: "Variável",
    planned: "Previsto",
    unexpected: "Imprevisto",
  };

  const HISTORY_PAGE_SIZE_DESKTOP = 12;
  const HISTORY_PAGE_SIZE_MOBILE = 6;
  const HISTORY_VIEW_STORAGE_KEY = "myfinance_history_view";

  function resolveHistoryPageSize() {
    return window.matchMedia("(max-width: 991.98px)").matches
      ? HISTORY_PAGE_SIZE_MOBILE
      : HISTORY_PAGE_SIZE_DESKTOP;
  }

  function normalizeViewMode(value) {
    return value === "table" ? "table" : "cards";
  }

  function loadStoredViewMode() {
    try {
      return normalizeViewMode(localStorage.getItem(HISTORY_VIEW_STORAGE_KEY));
    } catch (_) {
      return "cards";
    }
  }

  function persistViewMode(value) {
    try {
      localStorage.setItem(HISTORY_VIEW_STORAGE_KEY, normalizeViewMode(value));
    } catch (_) {}
  }

  const state = {
    allTransactions: [],
    filteredTransactions: [],
    page: 1,
    pageSize: resolveHistoryPageSize(),
    view: loadStoredViewMode(),
    filtersPanelOpen: false,
    memberNamesById: new Map(),
    categories: [],
    editingTransactionId: "",
    deletingTransactionId: "",
  };

  const editModal =
    typeof bootstrap !== "undefined" && els.editModalEl
      ? new bootstrap.Modal(els.editModalEl)
      : null;
  const deleteModal =
    typeof bootstrap !== "undefined" && els.deleteModalEl
      ? new bootstrap.Modal(els.deleteModalEl)
      : null;
  const exportCsvOptionsModal =
    typeof bootstrap !== "undefined" && els.exportCsvOptionsModalEl
      ? new bootstrap.Modal(els.exportCsvOptionsModalEl)
      : null;

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  function toNumber(value, fallback = 0) {
    if (typeof toNumericValue === "function") return toNumericValue(value, fallback);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function formatMoney(value) {
    if (typeof formatCurrency === "function") return formatCurrency(value);
    return Number(value || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatDateTime(value) {
    if (typeof formatDateUserLocal === "function") {
      return formatDateUserLocal(value, {
        locale: "pt-BR",
        includeTime: true,
        dateStyle: "short",
        timeStyle: "short",
        fallback: "-",
      });
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("pt-BR");
  }

  function parseDate(value) {
    if (typeof parseDateLikeLocal === "function") {
      return parseDateLikeLocal(value, { middayHour: 12 });
    }
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function toApiDateValue(localDate) {
    if (typeof toApiIsoFromLocalDateInput === "function") {
      return toApiIsoFromLocalDateInput(localDate, { hour: 12 });
    }
    return `${String(localDate || "").trim()}T12:00:00`;
  }

  function toLocalDateInput(value) {
    if (typeof toLocalInputDate === "function") return toLocalInputDate(value);
    const date = parseDate(value);
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  function endOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  }

  function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  function cloneDate(date) {
    return new Date(date.getTime());
  }

  function getPeriodRange(period) {
    const now = new Date();

    if (period === "all") {
      return { start: null, end: null };
    }

    if (period === "custom") {
      const start = parseDate(els.filterStartDate.value);
      const end = parseDate(els.filterEndDate.value);
      return {
        start: start ? startOfDay(start) : null,
        end: end ? endOfDay(end) : null,
      };
    }

    if (period === "current_month") {
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
      };
    }

    if (period === "last_90_days") {
      const end = endOfDay(now);
      const start = startOfDay(cloneDate(now));
      start.setDate(start.getDate() - 89);
      return { start, end };
    }

    if (period === "last_6_months") {
      const end = endOfMonth(now);
      const start = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 5, 1));
      return { start, end };
    }

    if (period === "current_year") {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { start, end };
    }

    return { start: null, end: null };
  }

  function applyPeriodToDateInputs(period) {
    const customRangeEls = document.querySelectorAll(".history-custom-range");
    const isCustom = period === "custom";
    customRangeEls.forEach((el) => {
      el.classList.toggle("d-none", !isCustom);
    });

    if (isCustom) {
      if (!els.filterStartDate.value || !els.filterEndDate.value) {
        const monthRange = getPeriodRange("current_month");
        els.filterStartDate.value = toLocalDateInput(monthRange.start);
        els.filterEndDate.value = toLocalDateInput(monthRange.end);
      }
      return;
    }

    const range = getPeriodRange(period);
    els.filterStartDate.value = range.start ? toLocalDateInput(range.start) : "";
    els.filterEndDate.value = range.end ? toLocalDateInput(range.end) : "";
  }

  function normalizeId(value) {
    if (!value) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "number") return String(value);
    if (typeof value === "object") return String(value._id || value.id || "").trim();
    return String(value).trim();
  }

  function pickName(value) {
    if (typeof value !== "string") return "";
    return value.trim();
  }

  function resolveActorName(raw) {
    const inlineName =
      pickName(raw?.memberName) ||
      pickName(raw?.userName) ||
      pickName(raw?.createdByName) ||
      pickName(raw?.user?.name) ||
      pickName(raw?.userId?.name);

    if (inlineName) return inlineName;

    const userId = normalizeId(raw?.userId || raw?.createdBy || raw?.user);
    if (userId && state.memberNamesById.has(userId)) {
      return state.memberNamesById.get(userId);
    }

    return "Não informado";
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
      if (id && name) state.memberNamesById.set(id, name);
    } catch (_) {}
  }

  async function loadFamilyDirectory() {
    seedMemberMapWithLoggedUser();
    try {
      const data = await apiFetch("/family");
      const members = Array.isArray(data?.members) ? data.members : [];
      members.forEach((member) => {
        const id = normalizeId(member?.id || member?._id);
        const name = pickName(member?.name) || pickName(member?.email);
        if (id && name) state.memberNamesById.set(id, name);
      });
    } catch (error) {
      if (error?.message && !/404/.test(String(error.message))) {
        console.warn("Diretório de família não carregado.", error);
      }
    }
  }

  function extractTransactions(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.transactions)) return payload.transactions;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.transactions)) return payload.data.transactions;
    return [];
  }

  function extractCategories(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.categories)) return payload.categories;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
  }

  function resolveTitle(raw, typeLabel) {
    const candidate = [
      raw?.description,
      raw?.title,
      raw?.name,
      raw?.category,
      raw?.accountName,
      raw?.boxName,
    ].find((value) => String(value || "").trim());

    return candidate ? String(candidate).trim() : typeLabel;
  }

  function isYieldIncome(raw) {
    const type = normalizeText(raw?.type);
    const category = normalizeText(raw?.category);
    const group = normalizeText(raw?.group);
    return type === "income" && category === "rendimentos" && group === "variable";
  }

  function normalizeTransaction(raw) {
    const apiId = normalizeId(raw?._id || raw?.id);
    const type = normalizeText(raw?.type) === "income" ? "income" : "expense";
    const typeLabel = TYPE_LABELS[type];
    const dateSource = raw?.date || raw?.createdAt || null;
    const dateObj = parseDate(dateSource);
    const timestamp = dateObj ? dateObj.getTime() : 0;
    const value = Math.max(toNumber(raw?.value, 0), 0);
    const category = String(raw?.category || "Sem categoria").trim();
    const group = String(raw?.group || "unexpected").trim().toLowerCase();
    const actor = resolveActorName(raw);
    const title = resolveTitle(raw, typeLabel);
    const yieldIncome = isYieldIncome(raw);

    const searchIndex = normalizeText(
      [
        title,
        category,
        GROUP_LABELS[group] || group,
        actor,
        TYPE_LABELS[type],
      ].join(" ")
    );

    return {
      id: apiId || String(`${timestamp}-${title}-${value}`),
      apiId,
      raw,
      type,
      typeLabel,
      value,
      category,
      categoryKey: normalizeText(category),
      group,
      groupLabel: GROUP_LABELS[group] || "Outros",
      actor,
      actorKey: normalizeText(actor),
      title,
      dateObj,
      dateIso: dateObj ? toLocalDateInput(dateObj) : "",
      dateLabel: formatDateTime(dateSource),
      timestamp,
      yieldIncome,
      searchIndex,
    };
  }

  function fillSelectWithValues(selectEl, values, defaultLabel = "Todos") {
    if (!selectEl) return;
    const current = selectEl.value || "all";
    selectEl.innerHTML = `<option value="all">${defaultLabel}</option>`;

    values.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.key;
      option.textContent = item.label;
      selectEl.appendChild(option);
    });

    if ([...selectEl.options].some((opt) => opt.value === current)) {
      selectEl.value = current;
    } else {
      selectEl.value = "all";
    }
  }

  function updateFilterOptions() {
    const categoriesFromApi = state.categories
      .map((cat) => {
        const label = String(cat?.name || "").trim();
        return { key: normalizeText(label), label };
      })
      .filter((item) => item.key && item.label);

    const categoriesFromTransactions = state.allTransactions
      .map((tx) => ({ key: tx.categoryKey, label: tx.category }))
      .filter((item) => item.key && item.label);

    const categoriesMap = new Map();
    [...categoriesFromApi, ...categoriesFromTransactions].forEach((item) => {
      if (!categoriesMap.has(item.key)) categoriesMap.set(item.key, item.label);
    });

    const sortedCategories = [...categoriesMap.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
      .map(([key, label]) => ({ key, label }));

    fillSelectWithValues(els.filterCategory, sortedCategories, "Todas");

    const membersMap = new Map();
    state.allTransactions.forEach((tx) => {
      if (tx.actorKey && tx.actor) membersMap.set(tx.actorKey, tx.actor);
    });
    const sortedMembers = [...membersMap.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
      .map(([key, label]) => ({ key, label }));

    fillSelectWithValues(els.filterMember, sortedMembers, "Todos");
  }

  async function ensureCategoriesLoaded() {
    if (Array.isArray(state.categories) && state.categories.length) return state.categories;
    try {
      const categoriesPayload = await apiFetch("/categories");
      state.categories = extractCategories(categoriesPayload);
    } catch (_) {
      state.categories = [];
    }
    return state.categories;
  }

  async function loadEditCategories(type, selectedCategory = "") {
    await ensureCategoriesLoaded();

    const safeType = normalizeText(type) === "income" ? "income" : "expense";
    const current = String(selectedCategory || "").trim();
    const categories = state.categories.filter((cat) => normalizeText(cat?.type) === safeType);
    const options = categories
      .map((cat) => String(cat?.name || "").trim())
      .filter((name) => name);

    els.editCategory.innerHTML = "";
    options.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      els.editCategory.appendChild(option);
    });

    if (current && !options.includes(current)) {
      const customOption = document.createElement("option");
      customOption.value = current;
      customOption.textContent = current;
      els.editCategory.appendChild(customOption);
    }

    els.editCategory.value = current || options[0] || "";
  }

  function getEditPayload() {
    return {
      type: String(els.editType.value || "").trim(),
      value: toNumber(els.editValue.value, 0),
      category: String(els.editCategory.value || "").trim(),
      group: String(els.editGroup.value || "").trim(),
      date: String(els.editDate.value || "").trim(),
    };
  }

  function isEditPayloadValid(payload) {
    if (!payload.type) return false;
    if (!payload.category) return false;
    if (!payload.group) return false;
    if (!payload.date) return false;
    if (!Number.isFinite(payload.value) || payload.value <= 0) return false;
    if (!["income", "expense"].includes(payload.type)) return false;
    if (!Object.prototype.hasOwnProperty.call(GROUP_LABELS, payload.group)) return false;
    return true;
  }

  function setEditModalLoading(isLoading) {
    const loading = Boolean(isLoading);
    [els.editType, els.editValue, els.editCategory, els.editGroup, els.editDate].forEach((field) => {
      if (!field) return;
      field.disabled = loading;
    });
    if (els.saveEditBtn) els.saveEditBtn.disabled = loading;
    if (loading && els.editCategory) {
      els.editCategory.innerHTML = '<option value="">Carregando...</option>';
    }
  }

  function findTransactionForEdit(transactionId) {
    const safeId = String(transactionId || "").trim();
    if (!safeId) return null;
    const tx = state.allTransactions.find((item) => item.apiId === safeId);
    return tx?.raw || null;
  }

  async function fillEditModal(transaction) {
    els.editType.value = normalizeText(transaction?.type) === "income" ? "income" : "expense";
    if (typeof setMoneyInputValue === "function") {
      setMoneyInputValue(els.editValue, transaction?.value, { allowEmpty: false });
    } else {
      els.editValue.value = String(transaction?.value || "");
    }
    els.editGroup.value = String(transaction?.group || "unexpected").trim().toLowerCase();
    els.editDate.value = toLocalDateInput(transaction?.date || transaction?.createdAt);
    await loadEditCategories(els.editType.value, transaction?.category);
  }

  async function openEditTransaction(transactionId) {
    if (!transactionId) {
      showAlert("Transa\u00e7\u00e3o inv\u00e1lida para edi\u00e7\u00e3o.", "warning", "triangle-exclamation");
      return;
    }

    const safeId = String(transactionId).trim();
    state.editingTransactionId = safeId;
    setEditModalLoading(true);
    editModal?.show();

    try {
      const localTransaction = findTransactionForEdit(safeId);
      const transaction = localTransaction || await apiFetch(`/transactions/${safeId}`);
      await fillEditModal(transaction);
    } catch (error) {
      console.error(error);
      showAlert("Erro ao carregar transa\u00e7\u00e3o para edi\u00e7\u00e3o.", "danger", "triangle-exclamation");
      editModal?.hide();
    } finally {
      setEditModalLoading(false);
    }
  }

  async function saveEditTransaction() {
    const transactionId = state.editingTransactionId;
    if (!transactionId) return;

    const payload = getEditPayload();
    if (!isEditPayloadValid(payload)) {
      showAlert("Preencha os campos corretamente antes de salvar.", "warning", "triangle-exclamation");
      return;
    }

    setLoading(els.saveEditBtn, true);
    try {
      await apiFetch(`/transactions/${transactionId}`, "PUT", {
        type: payload.type,
        value: payload.value,
        category: payload.category,
        group: payload.group,
        date: toApiDateValue(payload.date),
      });

      editModal?.hide();
      showAlert("Transação atualizada com sucesso.", "success", "check-circle");
      await loadData();
    } catch (error) {
      console.error(error);
      showAlert(error.message || "Erro ao atualizar transação.", "danger", "triangle-exclamation");
    } finally {
      setLoading(els.saveEditBtn, false);
    }
  }

  function openDeleteTransaction(transactionId) {
    if (!transactionId) {
      showAlert("Transação inválida para exclusão.", "warning", "triangle-exclamation");
      return;
    }
    state.deletingTransactionId = transactionId;
    deleteModal?.show();
  }

  async function confirmDeleteTransaction() {
    const transactionId = state.deletingTransactionId;
    if (!transactionId) return;

    setLoading(els.confirmDeleteBtn, true);
    try {
      await apiFetch(`/transactions/${transactionId}`, "DELETE");
      deleteModal?.hide();
      showAlert("Transação excluída com sucesso.", "success", "check-circle");
      state.deletingTransactionId = "";
      await loadData();
    } catch (error) {
      console.error(error);
      showAlert(error.message || "Erro ao excluir transação.", "danger", "triangle-exclamation");
    } finally {
      setLoading(els.confirmDeleteBtn, false);
    }
  }

  function handleResultActionClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const action = String(button.dataset.action || "");
    const transactionId = String(button.dataset.id || "");

    if (action === "edit") openEditTransaction(transactionId);
    if (action === "delete") openDeleteTransaction(transactionId);
  }

  function readFilters() {
    const minValueRaw = String(els.filterMinValue.value || "").trim();
    const maxValueRaw = String(els.filterMaxValue.value || "").trim();
    const minValue = minValueRaw ? toNumber(minValueRaw, 0) : null;
    const maxValue = maxValueRaw ? toNumber(maxValueRaw, 0) : null;

    const period = String(els.filterPeriod.value || "current_month");
    const range = getPeriodRange(period);

    let min = minValue;
    let max = maxValue;
    if (min !== null && max !== null && min > max) {
      const temp = min;
      min = max;
      max = temp;
    }

    return {
      search: normalizeText(els.filterSearch.value),
      period,
      startDate: range.start,
      endDate: range.end,
      type: String(els.filterType.value || "all"),
      group: String(els.filterGroup.value || "all"),
      categoryKey: String(els.filterCategory.value || "all"),
      memberKey: String(els.filterMember.value || "all"),
      minValue: min,
      maxValue: max,
      sort: String(els.filterSort.value || "newest"),
    };
  }

  function isInsideDateRange(dateObj, startDate, endDate) {
    if (!startDate && !endDate) return true;
    if (!dateObj) return false;
    const time = dateObj.getTime();
    if (startDate && time < startDate.getTime()) return false;
    if (endDate && time > endDate.getTime()) return false;
    return true;
  }

  function sortTransactions(list, sortKey) {
    const cloned = [...list];

    if (sortKey === "oldest") {
      cloned.sort((a, b) => a.timestamp - b.timestamp);
      return cloned;
    }

    if (sortKey === "value_desc") {
      cloned.sort((a, b) => b.value - a.value || b.timestamp - a.timestamp);
      return cloned;
    }

    if (sortKey === "value_asc") {
      cloned.sort((a, b) => a.value - b.value || b.timestamp - a.timestamp);
      return cloned;
    }

    cloned.sort((a, b) => b.timestamp - a.timestamp);
    return cloned;
  }

  function formatCountLabel(count) {
    if (count === 1) return "1 lançamento";
    return `${count} lançamentos`;
  }

  function updateFilterSummary() {
    if (!els.filterSummary) return;
    const total = state.allTransactions.length;
    const filtered = state.filteredTransactions.length;
    els.filterSummary.textContent = `${formatCountLabel(filtered)} de ${formatCountLabel(total)}`;
  }

  function updateSummaryCards() {
    let income = 0;
    let expense = 0;

    state.filteredTransactions.forEach((tx) => {
      if (tx.type === "income") income += tx.value;
      else expense += tx.value;
    });

    const balance = income - expense;

    els.summaryIncome.textContent = formatMoney(income);
    els.summaryExpense.textContent = formatMoney(expense);
    els.summaryBalance.textContent = formatMoney(balance);
    els.summaryCount.textContent = String(state.filteredTransactions.length);

    els.summaryBalance.classList.remove("is-positive", "is-negative");
    els.summaryBalance.classList.add(balance >= 0 ? "is-positive" : "is-negative");
  }

  function renderCards(pageItems) {
    els.cardsWrap.innerHTML = "";

    pageItems.forEach((tx) => {
      const toneClass = tx.type === "income" ? "is-income" : "is-expense";
      const typeBadgeClass = tx.type === "income" ? "is-income" : "is-expense";
      const typeIcon = tx.type === "income" ? "fa-arrow-down-long" : "fa-arrow-up-long";
      const canMutate = Boolean(tx.apiId);

      const categoryExtra = tx.yieldIncome
        ? '<span class="history-pill">Liquidez diária</span>'
        : "";
      const actionsHtml = canMutate
        ? `
          <div class="history-item-actions">
            <button
              type="button"
              class="btn btn-sm btn-outline-primary me-1 history-action-btn"
              data-action="edit"
              data-id="${escapeHtml(tx.apiId)}"
              title="Editar"
              aria-label="Editar transação"
            >
              <i class="fa-solid fa-pen"></i>
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline-danger history-action-btn"
              data-action="delete"
              data-id="${escapeHtml(tx.apiId)}"
              title="Excluir"
              aria-label="Excluir transação"
            >
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        `
        : "";

      els.cardsWrap.innerHTML += `
        <article class="col-12 col-md-6 col-xl-4">
          <div class="history-item-card ${toneClass}">
            <div class="history-item-head">
              <span class="history-type-badge ${typeBadgeClass}">
                <i class="fa-solid ${typeIcon}"></i>
                ${escapeHtml(tx.typeLabel)}
              </span>
              <span class="history-item-date">${escapeHtml(tx.dateLabel)}</span>
            </div>

            <div class="history-item-meta">
              <span class="history-item-meta-item">
                <i class="fa-solid fa-tag"></i>
                ${escapeHtml(tx.category)}
                ${categoryExtra}
              </span>
              <span class="history-item-meta-item">
                <i class="fa-solid fa-layer-group"></i>
                ${escapeHtml(tx.groupLabel)}
              </span>
              <span class="history-item-meta-item">
                <i class="fa-solid fa-user"></i>
                ${escapeHtml(tx.actor)}
              </span>
            </div>

            <div class="history-item-footer">
              <p class="history-item-value ${toneClass}">${escapeHtml(formatMoney(tx.value))}</p>
              ${actionsHtml}
            </div>
          </div>
        </article>
      `;
    });
  }

  function renderTable(pageItems) {
    els.tableBody.innerHTML = "";

    pageItems.forEach((tx) => {
      const typeClass = tx.type === "income" ? "is-income" : "is-expense";
      const typeIcon = tx.type === "income" ? "fa-arrow-down-long" : "fa-arrow-up-long";
      const canMutate = Boolean(tx.apiId);
      const actionsHtml = canMutate
        ? `
          <div class="history-table-actions text-end">
            <button
              type="button"
              class="btn btn-sm btn-outline-primary me-1 history-action-btn"
              data-action="edit"
              data-id="${escapeHtml(tx.apiId)}"
              title="Editar"
              aria-label="Editar transação"
            >
              <i class="fa-solid fa-pen"></i>
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline-danger history-action-btn"
              data-action="delete"
              data-id="${escapeHtml(tx.apiId)}"
              title="Excluir"
              aria-label="Excluir transação"
            >
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        `
        : '<span class="text-muted small">-</span>';

      els.tableBody.innerHTML += `
        <tr>
          <td>${escapeHtml(tx.dateLabel)}</td>
          <td>${escapeHtml(tx.category)}</td>
          <td>${escapeHtml(tx.groupLabel)}</td>
          <td>${escapeHtml(tx.actor)}</td>
          <td>
            <span class="history-type-chip ${typeClass}">
              <i class="fa-solid ${typeIcon}"></i>
              ${escapeHtml(tx.typeLabel)}
            </span>
          </td>
          <td class="text-end fw-semibold">${escapeHtml(formatMoney(tx.value))}</td>
          <td class="text-end">${actionsHtml}</td>
        </tr>
      `;
    });
  }

  function updatePagination(totalPages) {
    const safeTotal = Math.max(totalPages, 1);
    if (state.page > safeTotal) state.page = safeTotal;
    if (state.page < 1) state.page = 1;

    els.prevPageBtn.disabled = state.page <= 1;
    els.nextPageBtn.disabled = state.page >= safeTotal;

    const pageText = `Página ${state.page} de ${safeTotal}`;
    els.pageInfo.textContent = pageText;
    els.pageState.textContent = pageText;
  }

  function renderResults() {
    const total = state.filteredTransactions.length;
    const totalPages = Math.max(Math.ceil(total / state.pageSize), 1);
    updatePagination(totalPages);

    if (!total) {
      els.cardsWrap.innerHTML = "";
      els.tableBody.innerHTML = "";
      els.emptyState.classList.remove("d-none");
      return;
    }

    els.emptyState.classList.add("d-none");

    const startIndex = (state.page - 1) * state.pageSize;
    const pageItems = state.filteredTransactions.slice(startIndex, startIndex + state.pageSize);

    renderCards(pageItems);
    renderTable(pageItems);
  }

  function syncPageSizeWithViewport(options = {}) {
    const { keepAnchor = true } = options;
    const nextPageSize = resolveHistoryPageSize();
    if (state.pageSize === nextPageSize) return;

    const firstVisibleIndex = Math.max((state.page - 1) * state.pageSize, 0);
    state.pageSize = nextPageSize;
    state.page = keepAnchor ? Math.floor(firstVisibleIndex / state.pageSize) + 1 : 1;

    if (!state.filteredTransactions.length && !state.allTransactions.length) return;
    renderResults();
    syncView();
  }

  function setFiltersPanelOpen(open) {
    const shouldOpen = Boolean(open);
    state.filtersPanelOpen = shouldOpen;

    if (els.filtersPanel) {
      els.filtersPanel.classList.toggle("is-open", shouldOpen);
    }

    if (els.toggleFiltersPanelBtn) {
      els.toggleFiltersPanelBtn.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
      els.toggleFiltersPanelBtn.innerHTML = shouldOpen
        ? '<i class="fa-solid fa-sliders me-1"></i> Ocultar filtros'
        : '<i class="fa-solid fa-sliders me-1"></i> Filtros';
    }
  }

  function syncView() {
    const showingCards = state.view === "cards";
    els.cardsWrap.classList.toggle("d-none", !showingCards);
    els.tableWrap.classList.toggle("d-none", showingCards);
    els.viewCardsBtn?.classList.toggle("is-active", showingCards);
    els.viewCardsBtn?.setAttribute("aria-pressed", showingCards ? "true" : "false");
    els.viewTableBtn?.classList.toggle("is-active", !showingCards);
    els.viewTableBtn?.setAttribute("aria-pressed", !showingCards ? "true" : "false");
  }

  function setView(nextView) {
    state.view = normalizeViewMode(nextView);
    persistViewMode(state.view);
    syncView();
  }

  function applyFilters(resetPage = true) {
    const filters = readFilters();

    const filtered = state.allTransactions.filter((tx) => {
      if (filters.search && !tx.searchIndex.includes(filters.search)) return false;
      if (filters.type !== "all" && tx.type !== filters.type) return false;
      if (filters.group !== "all" && tx.group !== filters.group) return false;
      if (filters.categoryKey !== "all" && tx.categoryKey !== filters.categoryKey) return false;
      if (filters.memberKey !== "all" && tx.actorKey !== filters.memberKey) return false;
      if (!isInsideDateRange(tx.dateObj, filters.startDate, filters.endDate)) return false;
      if (filters.minValue !== null && tx.value < filters.minValue) return false;
      if (filters.maxValue !== null && tx.value > filters.maxValue) return false;
      return true;
    });

    state.filteredTransactions = sortTransactions(filtered, filters.sort);
    if (resetPage) state.page = 1;

    updateFilterSummary();
    updateSummaryCards();
    renderResults();
    syncView();
  }

  function debounce(fn, delay = 220) {
    let timer = null;
    return (...args) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function csvSafeCell(value) {
    const raw = sanitizeCsvText(value);
    const trimmed = raw.trimStart();
    const safe = /^[=+\-@]/.test(trimmed) ? `'${raw}` : raw;
    return `"${safe.replaceAll('"', '""')}"`;
  }

  function tryRepairMojibake(value) {
    const original = String(value ?? "");
    if (!/[\u00c3\u00c2]/.test(original)) return original;

    try {
      const bytes = new Uint8Array(original.length);
      for (let i = 0; i < original.length; i += 1) {
        bytes[i] = original.charCodeAt(i) & 0xff;
      }

      const repaired = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      const score = (text) => (text.match(/[\u00c3\u00c2\ufffd]/g) || []).length;
      return score(repaired) < score(original) ? repaired : original;
    } catch (_) {
      return original;
    }
  }

  function sanitizeCsvText(value) {
    return tryRepairMojibake(String(value ?? ""))
      .normalize("NFC")
      .replace(/\r?\n+/g, " ")
      .replace(/\t+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function formatCsvNumber(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "0,00";
    return parsed.toFixed(2).replace(".", ",");
  }

  function formatCsvDateParts(dateObj) {
    if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) {
      return { date: "-", time: "-" };
    }
    const date = dateObj.toLocaleDateString("pt-BR");
    const time = dateObj.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return { date, time };
  }

  function getSelectLabel(selectEl, fallback = "Todos") {
    if (!selectEl) return fallback;
    const option = selectEl.options[selectEl.selectedIndex];
    return String(option?.textContent || fallback).trim() || fallback;
  }

  function buildCsvTimestamp(date) {
    const safeDate = date instanceof Date ? date : new Date();
    const pad = (value) => String(value).padStart(2, "0");
    const yyyy = safeDate.getFullYear();
    const mm = pad(safeDate.getMonth() + 1);
    const dd = pad(safeDate.getDate());
    const hh = pad(safeDate.getHours());
    const min = pad(safeDate.getMinutes());
    const ss = pad(safeDate.getSeconds());
    return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
  }

  function getCsvExportMode() {
    return els.exportCsvModeEssentials?.checked ? "essentials" : "complete";
  }

  function syncCsvExportOptionsUi() {
    const isEssentials = getCsvExportMode() === "essentials";
    if (!els.exportCsvIncludeImpact) return;
    els.exportCsvIncludeImpact.disabled = isEssentials;
    if (isEssentials) els.exportCsvIncludeImpact.checked = false;
  }

  function exportCsv(options = {}) {
    if (!state.filteredTransactions.length) {
      showAlert("Sem dados para exportar.", "warning", "triangle-exclamation");
      return;
    }

    const exportMode = options.mode === "essentials" ? "essentials" : "complete";
    const includeMetadata = options.includeMetadata === true;
    const includeImpact = exportMode === "complete" && options.includeImpact !== false;
    const triggerBtn = options.triggerButton || els.exportCsvBtn;

    const now = new Date();
    const filters = readFilters();
    const searchTerm = String(els.filterSearch.value || "").trim() || "-";
    const periodLabel = getSelectLabel(els.filterPeriod, "M\u00eas atual");
    const typeLabel = getSelectLabel(els.filterType, "Todos");
    const groupLabel = getSelectLabel(els.filterGroup, "Todos");
    const categoryLabel = getSelectLabel(els.filterCategory, "Todas");
    const memberLabel = getSelectLabel(els.filterMember, "Todos");
    const sortLabel = getSelectLabel(els.filterSort, "Mais recentes");

    const startLabel = filters.startDate ? formatCsvDateParts(filters.startDate).date : "-";
    const endLabel = filters.endDate ? formatCsvDateParts(filters.endDate).date : "-";
    const minValueLabel = filters.minValue !== null ? formatCsvNumber(filters.minValue) : "-";
    const maxValueLabel = filters.maxValue !== null ? formatCsvNumber(filters.maxValue) : "-";

    let totalIncome = 0;
    let totalExpense = 0;
    state.filteredTransactions.forEach((tx) => {
      if (tx.type === "income") totalIncome += tx.value;
      else totalExpense += tx.value;
    });
    const balance = totalIncome - totalExpense;

    const metadataRows = [
      ["Relatorio", "MyFinance - Historico de lancamentos"],
      ["Gerado em", formatDateTime(now)],
      ["Total de lancamentos", String(state.filteredTransactions.length)],
      ["Periodo", periodLabel],
      ["Data inicial", startLabel],
      ["Data final", endLabel],
      ["Tipo", typeLabel],
      ["Grupo", groupLabel],
      ["Categoria", categoryLabel],
      ["Membro", memberLabel],
      ["Busca", searchTerm],
      ["Valor minimo (R$)", minValueLabel],
      ["Valor maximo (R$)", maxValueLabel],
      ["Ordenacao", sortLabel],
      ["Total de entradas (R$)", formatCsvNumber(totalIncome)],
      ["Total de saidas (R$)", formatCsvNumber(totalExpense)],
      ["Saldo (R$)", formatCsvNumber(balance)],
    ];

    const header =
      exportMode === "essentials"
        ? ["Data", "Hora", "Lancamento", "Categoria", "Tipo", "Valor (R$)"]
        : [
            "Data",
            "Hora",
            "Lancamento",
            "Categoria",
            "Grupo",
            "Membro",
            "Tipo",
            "Valor (R$)",
            ...(includeImpact ? ["Impacto no saldo (R$)"] : []),
          ];

    const rows = state.filteredTransactions.map((tx) => {
      const dateParts = formatCsvDateParts(tx.dateObj);
      const signedImpact = tx.type === "income" ? tx.value : -tx.value;
      if (exportMode === "essentials") {
        return [
          dateParts.date,
          dateParts.time,
          tx.title,
          tx.category,
          tx.typeLabel,
          formatCsvNumber(tx.value),
        ];
      }

      return [
        dateParts.date,
        dateParts.time,
        tx.title,
        tx.category,
        tx.groupLabel,
        tx.actor,
        tx.typeLabel,
        formatCsvNumber(tx.value),
        ...(includeImpact ? [formatCsvNumber(signedImpact)] : []),
      ];
    });

    const csvLines = [header, ...rows];
    if (includeMetadata) {
      csvLines.push([""]);
      csvLines.push(["Resumo da exportacao"]);
      csvLines.push(["Campo", "Valor"]);
      metadataRows.forEach((line) => csvLines.push(line));
    }
    const csvDataLines = csvLines
      .map((line) => line.map(csvSafeCell).join(";"))
      .join("\r\n");
    const csvBody = csvDataLines;

    if (typeof setLoading === "function" && triggerBtn) setLoading(triggerBtn, true);

    try {
      const blob = new Blob([`\uFEFF${csvBody}`], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const modeSuffix = exportMode === "essentials" ? "essencial" : "completo";
      link.download = `myfinance-historico-${modeSuffix}-${buildCsvTimestamp(now)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showAlert(
        `${state.filteredTransactions.length} lancamentos exportados em CSV.`,
        "success",
        "file-csv"
      );
    } finally {
      if (typeof setLoading === "function" && triggerBtn) setLoading(triggerBtn, false);
    }
  }

  function clearFilters() {
    els.filterSearch.value = "";
    els.filterPeriod.value = "current_month";
    applyPeriodToDateInputs("current_month");
    els.filterType.value = "all";
    els.filterGroup.value = "all";
    els.filterCategory.value = "all";
    els.filterMember.value = "all";
    els.filterMinValue.value = "";
    els.filterMaxValue.value = "";
    els.filterSort.value = "newest";
    applyFilters(true);
  }

  function bindEvents() {
    const debouncedApply = debounce(() => applyFilters(true), 200);
    let resizeTimer = null;

    els.filterSearch.addEventListener("input", debouncedApply);
    els.filterType.addEventListener("change", () => applyFilters(true));
    els.filterGroup.addEventListener("change", () => applyFilters(true));
    els.filterCategory.addEventListener("change", () => applyFilters(true));
    els.filterMember.addEventListener("change", () => applyFilters(true));
    els.filterSort.addEventListener("change", () => applyFilters(true));
    els.filterMinValue.addEventListener("input", debouncedApply);
    els.filterMaxValue.addEventListener("input", debouncedApply);

    els.filterPeriod.addEventListener("change", () => {
      applyPeriodToDateInputs(els.filterPeriod.value);
      applyFilters(true);
    });

    els.filterStartDate.addEventListener("change", () => applyFilters(true));
    els.filterEndDate.addEventListener("change", () => applyFilters(true));

    els.clearFiltersBtn.addEventListener("click", clearFilters);
    els.toggleFiltersPanelBtn?.addEventListener("click", () => {
      setFiltersPanelOpen(!state.filtersPanelOpen);
    });

    els.viewCardsBtn?.addEventListener("click", () => {
      setView("cards");
    });
    els.viewTableBtn?.addEventListener("click", () => {
      setView("table");
    });

    els.exportCsvBtn.addEventListener("click", () => {
      if (!state.filteredTransactions.length) {
        showAlert("Sem dados para exportar.", "warning", "triangle-exclamation");
        return;
      }

      if (els.exportCsvModeComplete) els.exportCsvModeComplete.checked = true;
      if (els.exportCsvIncludeMetadata) els.exportCsvIncludeMetadata.checked = false;
      if (els.exportCsvIncludeImpact) els.exportCsvIncludeImpact.checked = true;
      syncCsvExportOptionsUi();

      if (exportCsvOptionsModal) {
        exportCsvOptionsModal.show();
        return;
      }

      exportCsv({
        mode: "complete",
        includeMetadata: true,
        includeImpact: true,
        triggerButton: els.exportCsvBtn,
      });
    });

    els.exportCsvConfirmBtn?.addEventListener("click", async () => {
      const mode = getCsvExportMode();
      const includeMetadata = Boolean(els.exportCsvIncludeMetadata?.checked);
      const includeImpact = Boolean(els.exportCsvIncludeImpact?.checked);

      await exportCsv({
        mode,
        includeMetadata,
        includeImpact,
        triggerButton: els.exportCsvConfirmBtn,
      });

      exportCsvOptionsModal?.hide();
    });

    els.exportCsvModeComplete?.addEventListener("change", syncCsvExportOptionsUi);
    els.exportCsvModeEssentials?.addEventListener("change", syncCsvExportOptionsUi);

    els.prevPageBtn.addEventListener("click", () => {
      if (state.page <= 1) return;
      state.page -= 1;
      renderResults();
      syncView();
    });

    els.nextPageBtn.addEventListener("click", () => {
      const totalPages = Math.max(Math.ceil(state.filteredTransactions.length / state.pageSize), 1);
      if (state.page >= totalPages) return;
      state.page += 1;
      renderResults();
      syncView();
    });

    if (els.filtersForm) {
      els.filtersForm.addEventListener("submit", (event) => {
        event.preventDefault();
        applyFilters(true);
      });
    }

    els.cardsWrap.addEventListener("click", handleResultActionClick);
    els.tableBody.addEventListener("click", handleResultActionClick);

    els.saveEditBtn.addEventListener("click", saveEditTransaction);
    els.confirmDeleteBtn.addEventListener("click", confirmDeleteTransaction);

    els.editType.addEventListener("change", async () => {
      await loadEditCategories(els.editType.value, els.editCategory.value);
    });

    if (els.editModalEl) {
      els.editModalEl.addEventListener("hidden.bs.modal", () => {
        state.editingTransactionId = "";
      });
    }

    if (els.deleteModalEl) {
      els.deleteModalEl.addEventListener("hidden.bs.modal", () => {
        state.deletingTransactionId = "";
      });
    }

    window.addEventListener("resize", () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        syncPageSizeWithViewport({ keepAnchor: true });
        resizeTimer = null;
      }, 120);
    });
  }

  async function loadData() {
    try {
      const [transactionsPayload, categoriesPayload] = await Promise.all([
        apiFetch("/transactions"),
        apiFetch("/categories").catch(() => []),
        loadFamilyDirectory(),
      ]);

      const rawTransactions = extractTransactions(transactionsPayload);
      const rawCategories = extractCategories(categoriesPayload);
      state.categories = rawCategories;

      state.allTransactions = rawTransactions
        .map((tx) => normalizeTransaction(tx))
        .sort((a, b) => b.timestamp - a.timestamp);

      updateFilterOptions();
      applyPeriodToDateInputs(els.filterPeriod.value);
      applyFilters(true);
    } catch (error) {
      console.error(error);
      showAlert("Erro ao carregar histórico de lançamentos.", "danger", "triangle-exclamation");
      state.allTransactions = [];
      state.filteredTransactions = [];
      updateFilterSummary();
      updateSummaryCards();
      renderResults();
      syncView();
    }
  }

  bindEvents();
  setFiltersPanelOpen(false);
  setView(state.view);
  syncCsvExportOptionsUi();
  loadData();
});


