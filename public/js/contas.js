document.addEventListener("DOMContentLoaded", async () => {
  if (typeof checkAuth === "function") checkAuth();
  if (typeof initTheme === "function") initTheme();

  const tableBody = document.getElementById("accountsTable");
  const tableWrap = document.getElementById("accountsTableWrap");
  const cardsView = document.getElementById("accountsCardsView");
  const emptyState = document.getElementById("accountsEmpty");
  const searchInput = document.getElementById("accountsSearchInput");
  const statusFilter = document.getElementById("accountsStatusFilter");
  const clearFiltersBtn = document.getElementById("clearAccountsFiltersBtn");
  const viewTableBtn = document.getElementById("accountsViewTableBtn");
  const viewCardsBtn = document.getElementById("accountsViewCardsBtn");

  const summaryTotalValue = document.getElementById("summaryTotalValue");
  const summaryOpenValue = document.getElementById("summaryOpenValue");
  const summaryActiveCount = document.getElementById("summaryActiveCount");

  const openCreateBtn = document.getElementById("openCreateAccountBtn");
  const openCreateSubscriptionBtn = document.getElementById("openCreateSubscriptionBtn");
  const saveAccountBtn = document.getElementById("saveAccountBtn");
  const confirmPayBtn = document.getElementById("confirmPayBtn");
  const confirmDeleteBtn = document.getElementById("confirmDeleteAccountBtn");
  const confirmAdjustSubscriptionBtn = document.getElementById("confirmAdjustSubscriptionBtn");

  const editorTitle = document.getElementById("accountEditorTitle");
  const accountNameInput = document.getElementById("accountNameInput");
  const accountTypeSelect = document.getElementById("accountTypeSelect");
  const accountBillingCycleWrap = document.getElementById("accountBillingCycleWrap");
  const accountBillingCycleSelect = document.getElementById("accountBillingCycleSelect");
  const accountInstallmentValueWrap = document.getElementById("accountInstallmentValueWrap");
  const accountInstallmentValueLabel = document.getElementById("accountInstallmentValueLabel");
  const accountInstallmentValueInput = document.getElementById("accountInstallmentValueInput");
  const accountDownWrap = document.getElementById("accountDownWrap");
  const accountDownInput = document.getElementById("accountDownInput");
  const accountInstallmentsWrap = document.getElementById("accountInstallmentsWrap");
  const accountInstallmentsInput = document.getElementById("accountInstallmentsInput");
  const accountFirstDueLabel = document.getElementById("accountFirstDueLabel");
  const accountFirstDueInput = document.getElementById("accountFirstDueInput");
  const accountNextDueLabel = document.getElementById("accountNextDueLabel");
  const accountNextDueInput = document.getElementById("accountNextDueInput");
  const accountCategorySelect = document.getElementById("accountCategorySelect");
  const accountTotalPreviewLabel = document.getElementById("accountTotalPreviewLabel");
  const accountTotalPreview = document.getElementById("accountTotalPreview");
  const accountInstallmentPreviewLabel = document.getElementById("accountInstallmentPreviewLabel");
  const accountInstallmentPreview = document.getElementById("accountInstallmentPreview");

  const payAccountName = document.getElementById("payAccountName");
  const payCycleInfoLabel = document.getElementById("payCycleInfoLabel");
  const payInstallmentInfo = document.getElementById("payInstallmentInfo");
  const payInstallmentValue = document.getElementById("payInstallmentValue");
  const payNextDueLabel = document.getElementById("payNextDueLabel");
  const payNextDueDate = document.getElementById("payNextDueDate");
  const payCategorySelectWrap = document.getElementById("payCategorySelectWrap");
  const payCategorySelect = document.getElementById("payCategorySelect");
  const payCategoryFixedWrap = document.getElementById("payCategoryFixedWrap");
  const payCategoryFixedText = document.getElementById("payCategoryFixedText");
  const adjustAccountName = document.getElementById("adjustAccountName");
  const adjustCurrentValue = document.getElementById("adjustCurrentValue");
  const adjustNewValueInput = document.getElementById("adjustNewValueInput");
  const adjustDateInput = document.getElementById("adjustDateInput");
  const adjustNoteInput = document.getElementById("adjustNoteInput");

  const editorModalEl = document.getElementById("accountEditorModal");
  const payModalEl = document.getElementById("payAccountModal");
  const deleteModalEl = document.getElementById("deleteAccountModal");
  const adjustSubscriptionModalEl = document.getElementById("adjustSubscriptionModal");

  const editorModal =
    typeof bootstrap !== "undefined" && editorModalEl
      ? new bootstrap.Modal(editorModalEl)
      : null;
  const payModal =
    typeof bootstrap !== "undefined" && payModalEl
      ? new bootstrap.Modal(payModalEl)
      : null;
  const deleteModal =
    typeof bootstrap !== "undefined" && deleteModalEl
      ? new bootstrap.Modal(deleteModalEl)
      : null;
  const adjustSubscriptionModal =
    typeof bootstrap !== "undefined" && adjustSubscriptionModalEl
      ? new bootstrap.Modal(adjustSubscriptionModalEl)
      : null;

  let accounts = [];
  let expenseCategories = [];
  let editingAccountId = null;
  let payingAccountId = null;
  let deletingAccountId = null;
  let adjustingSubscriptionId = null;
  const ACCOUNT_TYPE_INSTALLMENT = "installment";
  const ACCOUNT_TYPE_SUBSCRIPTION = "subscription";
  const ACCOUNT_TYPE_FIXED = "fixed";
  const VIEW_MODE_TABLE = "table";
  const VIEW_MODE_CARDS = "cards";
  const VIEW_MODE_STORAGE_KEY = "contas:view-mode";
  const BILLING_MONTHLY = "monthly";
  const BILLING_ANNUAL = "annual";
  let accountsViewMode = VIEW_MODE_TABLE;

  function toNumber(value, fallback = 0) {
    if (typeof toNumericValue === "function") return toNumericValue(value, fallback);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    const n = toNumber(value, 0);
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function formatBRL(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function todayISO() {
    if (typeof toLocalISODate === "function") return toLocalISODate(new Date());
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function formatDateBR(isoDate) {
    if (!isoDate) return "-";
    if (typeof formatDateUserLocal === "function") {
      return formatDateUserLocal(isoDate, { locale: "pt-BR", includeTime: false });
    }
    const date = new Date(`${String(isoDate).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("pt-BR");
  }

  function parseDateSafe(value) {
    if (typeof parseDateLikeLocal === "function") {
      return parseDateLikeLocal(value, { middayHour: 12 });
    }
    const date = new Date(String(value || ""));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isSameYearMonth(dateA, dateB) {
    if (!(dateA instanceof Date) || Number.isNaN(dateA.getTime())) return false;
    if (!(dateB instanceof Date) || Number.isNaN(dateB.getTime())) return false;
    return (
      dateA.getFullYear() === dateB.getFullYear() &&
      dateA.getMonth() === dateB.getMonth()
    );
  }

  function countElapsedCycles(firstDueDate, cycle, referenceDate = new Date()) {
    const first = parseDateSafe(firstDueDate);
    if (!first) return 0;

    const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    if (Number.isNaN(ref.getTime()) || first > ref) return 0;

    if (cycle === BILLING_ANNUAL) {
      let yearsDiff = ref.getFullYear() - first.getFullYear();
      const anchor = new Date(first);
      anchor.setFullYear(anchor.getFullYear() + yearsDiff);
      if (anchor > ref) yearsDiff -= 1;
      return Math.max(yearsDiff + 1, 0);
    }

    let monthsDiff =
      (ref.getFullYear() - first.getFullYear()) * 12 +
      (ref.getMonth() - first.getMonth());
    const anchor = new Date(first);
    anchor.setMonth(anchor.getMonth() + monthsDiff);
    if (anchor > ref) monthsDiff -= 1;
    return Math.max(monthsDiff + 1, 0);
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  function addMonthsISO(baseIsoDate, monthsToAdd) {
    const base = parseDateSafe(baseIsoDate);
    if (!(base instanceof Date) || Number.isNaN(base.getTime())) return "";
    const copy = new Date(base);
    copy.setMonth(copy.getMonth() + monthsToAdd);
    if (typeof toLocalISODate === "function") return toLocalISODate(copy);
    const y = copy.getFullYear();
    const m = String(copy.getMonth() + 1).padStart(2, "0");
    const d = String(copy.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function normalizeAccountType(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === ACCOUNT_TYPE_SUBSCRIPTION) return ACCOUNT_TYPE_SUBSCRIPTION;
    if (raw === ACCOUNT_TYPE_FIXED) return ACCOUNT_TYPE_FIXED;
    return ACCOUNT_TYPE_INSTALLMENT;
  }

  function normalizeBillingCycle(value) {
    return value === BILLING_ANNUAL ? BILLING_ANNUAL : BILLING_MONTHLY;
  }

  function isRecurringType(accountType) {
    return accountType === ACCOUNT_TYPE_SUBSCRIPTION || accountType === ACCOUNT_TYPE_FIXED;
  }

  function getNamePlaceholderByType(accountType) {
    if (accountType === ACCOUNT_TYPE_SUBSCRIPTION) {
      return "Ex: Netflix, Spotify, iCloud+";
    }
    if (accountType === ACCOUNT_TYPE_FIXED) {
      return "Ex: Aluguel, Condominio, Internet";
    }
    return "Ex: Cartao principal";
  }

  function applyNamePlaceholderByType(accountType) {
    if (!accountNameInput) return;
    accountNameInput.placeholder = getNamePlaceholderByType(accountType);
  }

  function normalizeViewMode(value) {
    return value === VIEW_MODE_CARDS ? VIEW_MODE_CARDS : VIEW_MODE_TABLE;
  }

  function loadSavedViewMode() {
    try {
      const raw = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      return normalizeViewMode(raw);
    } catch {
      return VIEW_MODE_TABLE;
    }
  }

  function applyViewModeUi() {
    const isCards = accountsViewMode === VIEW_MODE_CARDS;
    tableWrap?.classList.toggle("d-none", isCards);
    cardsView?.classList.toggle("d-none", !isCards);
    viewTableBtn?.classList.toggle("active", !isCards);
    viewCardsBtn?.classList.toggle("active", isCards);
  }

  function setViewMode(mode) {
    accountsViewMode = normalizeViewMode(mode);
    applyViewModeUi();
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, accountsViewMode);
    } catch {
      // ignore storage errors
    }
  }

  function addBillingCycleISO(baseIsoDate, cycle) {
    const base = parseDateSafe(baseIsoDate);
    if (!(base instanceof Date) || Number.isNaN(base.getTime())) return "";
    const copy = new Date(base);
    if (normalizeBillingCycle(cycle) === BILLING_ANNUAL) {
      copy.setFullYear(copy.getFullYear() + 1);
    } else {
      copy.setMonth(copy.getMonth() + 1);
    }
    if (typeof toLocalISODate === "function") return toLocalISODate(copy);
    const y = copy.getFullYear();
    const m = String(copy.getMonth() + 1).padStart(2, "0");
    const d = String(copy.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function normalizeDateInput(value, fallback = "") {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      if (typeof toLocalISODate === "function") return toLocalISODate(value);
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, "0");
      const d = String(value.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    const raw = String(value || "").trim();
    if (!raw) return fallback;
    const date = parseDateSafe(raw);
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return fallback;
    if (typeof toLocalISODate === "function") return toLocalISODate(date);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function getRecurringCyclesPaidBySchedule(firstPaymentDate, nextDueDate, billingCycle) {
    const first = normalizeDateInput(firstPaymentDate, "");
    const next = normalizeDateInput(nextDueDate, "");
    if (!first || !next) return 0;

    const firstDate = parseDateSafe(first);
    const nextDate = parseDateSafe(next);
    if (
      !(firstDate instanceof Date) ||
      Number.isNaN(firstDate.getTime()) ||
      !(nextDate instanceof Date) ||
      Number.isNaN(nextDate.getTime())
    ) return 0;

    if (firstDate > new Date()) return 0;

    // nextDueDate representa a próxima cobrança pendente:
    // pagamentos realizados = ciclos entre primeiro pagamento e próxima cobrança.
    return Math.max(countElapsedCycles(first, billingCycle, nextDate) - 1, 0);
  }

  function resolveRecurringValueOnDate(account, atDate) {
    const currentValue = Math.max(
      toNumber(account?.recurringValue ?? account?.installmentValue, 0),
      0
    );
    const history = Array.isArray(account?.adjustmentHistory)
      ? [...account.adjustmentHistory].sort((a, b) => {
        const da = parseDateSafe(a?.changedAt)?.getTime() || 0;
        const db = parseDateSafe(b?.changedAt)?.getTime() || 0;
        return da - db;
      })
      : [];

    if (!history.length) return round2(currentValue);

    let value = currentValue;
    const firstOldValue = Math.max(toNumber(history[0]?.oldValue, 0), 0);
    if (firstOldValue > 0) value = firstOldValue;

    history.forEach((item) => {
      const changedAtDate = parseDateSafe(item?.changedAt);
      if (!(changedAtDate instanceof Date) || Number.isNaN(changedAtDate.getTime())) return;
      if (changedAtDate <= atDate) {
        const nextValue = Math.max(toNumber(item?.newValue, value), 0);
        value = round2(nextValue);
      }
    });

    return round2(value);
  }

  function calculateRecurringTotalSpent(account, paidCycles, billingCycle) {
    const cycles = Math.max(Math.floor(toNumber(paidCycles, 0)), 0);
    if (cycles <= 0) return 0;

    const firstPaymentDate = normalizeDateInput(
      account?.firstPaymentDate || account?.firstDueDate,
      ""
    );
    if (!firstPaymentDate) {
      const fallbackValue = Math.max(
        toNumber(account?.recurringValue ?? account?.installmentValue, 0),
        0
      );
      return round2(fallbackValue * cycles);
    }

    let cursorDate = parseDateSafe(firstPaymentDate);
    if (!(cursorDate instanceof Date) || Number.isNaN(cursorDate.getTime())) return 0;

    let total = 0;
    for (let i = 0; i < cycles; i++) {
      total += resolveRecurringValueOnDate(account, cursorDate);

      const nextCycleDate = addBillingCycleISO(
        normalizeDateInput(cursorDate, firstPaymentDate),
        billingCycle
      );
      if (!nextCycleDate) break;
      const parsedNext = parseDateSafe(nextCycleDate);
      if (!(parsedNext instanceof Date) || Number.isNaN(parsedNext.getTime())) break;
      cursorDate = parsedNext;
    }

    return round2(total);
  }

  function normalizeInstallments(value) {
    const n = Math.floor(toNumber(value, 1));
    return Math.max(1, n);
  }

  function normalizeAccount(raw) {
    const accountType = normalizeAccountType(raw.accountType);
    const recurring = isRecurringType(accountType);
    const billingCycle = accountType === ACCOUNT_TYPE_FIXED
      ? BILLING_MONTHLY
      : normalizeBillingCycle(raw.billingCycle);

    const recurringValue = Math.max(
      round2(toNumber(raw.recurringValue ?? raw.installmentValue, 0)),
      0
    );
    const installmentValue = Math.max(round2(toNumber(raw.installmentValue, recurringValue)), 0);
    const downPayment = Math.max(round2(toNumber(raw.downPayment, 0)), 0);
    const installments = recurring
      ? 1
      : normalizeInstallments(raw.installments);

    const paidInstallments = recurring
      ? 0
      : Math.min(
        Math.max(Math.floor(toNumber(raw.paidInstallments, 0)), 0),
        installments
      );

    const nextDueDateRaw = String(raw.nextDueDate || "").trim();
    const firstPaymentDateRaw = String(raw.firstPaymentDate || raw.firstDueDate || "").trim();
    const fallbackFirstPaymentDate = normalizeDateInput(nextDueDateRaw, todayISO());
    const firstPaymentDate = normalizeDateInput(firstPaymentDateRaw, fallbackFirstPaymentDate);
    const nextDueDate = normalizeDateInput(nextDueDateRaw, firstPaymentDate);
    const lastPaymentAt = String(raw.lastPaymentAt || "").trim();
    const subscriptionPayments = Math.max(
      Math.floor(toNumber(raw.subscriptionPayments, 0)),
      0
    );
    const adjustmentHistory = Array.isArray(raw.adjustmentHistory)
      ? raw.adjustmentHistory
        .map((item) => ({
          changedAt: String(item?.changedAt || "").trim(),
          oldValue: round2(Math.max(toNumber(item?.oldValue, 0), 0)),
          newValue: round2(Math.max(toNumber(item?.newValue, 0), 0)),
          note: String(item?.note || "").trim()
        }))
        .filter((item) => item.changedAt && item.newValue > 0)
        .sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt))
      : [];

    return {
      id: String(raw._id || raw.id || "").trim(),
      name: String(raw.name || "").trim(),
      accountType,
      billingCycle,
      recurringValue,
      downPayment,
      installmentValue,
      installments,
      firstPaymentDate,
      firstDueDate: firstPaymentDate,
      nextDueDate,
      lastPaymentAt,
      category: String(raw.category || "").trim(),
      paidInstallments,
      subscriptionPayments,
      adjustmentHistory,
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString(),
    };
  }

  function calculateAccount(account) {
    const accountType = normalizeAccountType(account.accountType);
    const recurring = isRecurringType(accountType);

    if (recurring) {
      const recurringValue = Math.max(
        toNumber(account.recurringValue ?? account.installmentValue, 0),
        0
      );
      const billingCycle = accountType === ACCOUNT_TYPE_FIXED
        ? BILLING_MONTHLY
        : normalizeBillingCycle(account.billingCycle);
      const firstPaymentDate = normalizeDateInput(
        account.firstPaymentDate || account.firstDueDate,
        todayISO()
      );
      const nextDueDate = normalizeDateInput(
        account.nextDueDate || account.firstPaymentDate || account.firstDueDate,
        firstPaymentDate
      );
      const nowDate = new Date();
      const nextDueDateObj = parseDateSafe(nextDueDate);
      const elapsedCycles = getRecurringCyclesPaidBySchedule(
        firstPaymentDate,
        nextDueDate,
        billingCycle
      );
      const paidCycles = Math.max(
        Math.floor(toNumber(account.subscriptionPayments, 0)),
        elapsedCycles
      );
      const totalSpent = calculateRecurringTotalSpent(account, paidCycles, billingCycle);
      const canPayNow = !!(
        nextDueDateObj instanceof Date &&
        !Number.isNaN(nextDueDateObj.getTime()) &&
        nextDueDateObj <= nowDate
      );

      return {
        accountType,
        billingCycle,
        recurringValue: round2(recurringValue),
        downPayment: 0,
        installmentValue: round2(recurringValue),
        installments: 1,
        financedAmount: round2(recurringValue),
        totalAccountValue: round2(recurringValue),
        paidInstallments: 0,
        paidAmount: 0,
        remainingInstallments: 1,
        remainingAmount: round2(recurringValue),
        nextPaymentValue: round2(recurringValue),
        firstPaymentDate,
        firstDueDate: firstPaymentDate,
        nextDueDate: nextDueDate || todayISO(),
        status: "active",
        canPayNow,
        paidThisMonth: !canPayNow,
        elapsedCycles,
        paidCycles,
        totalSpent,
        subscriptionPayments: Math.max(Math.floor(toNumber(account.subscriptionPayments, 0)), 0),
      };
    }

    const downPayment = Math.max(toNumber(account.downPayment, 0), 0);
    const installmentValue = Math.max(toNumber(account.installmentValue, 0), 0);
    const installments = normalizeInstallments(account.installments);

    const financedAmount = installmentValue * installments;
    const totalAccountValue = downPayment + financedAmount;

    const paidInstallments = Math.min(
      Math.max(Math.floor(toNumber(account.paidInstallments, 0)), 0),
      installments
    );
    const paidAmount = installmentValue * paidInstallments;
    const remainingInstallments = Math.max(installments - paidInstallments, 0);
    const remainingAmount = Math.max(financedAmount - paidAmount, 0);
    const nextPaymentValue = remainingInstallments <= 1 ? remainingAmount : installmentValue;
    const status = remainingInstallments === 0 ? "paid" : "active";
    const totalSpent = round2(downPayment + paidAmount);
    const progressPercent = installments > 0
      ? Math.min(100, Math.max(0, round2((paidInstallments / installments) * 100)))
      : 0;
    const nextDueDate =
      status === "active"
        ? addMonthsISO(account.firstPaymentDate || account.firstDueDate, paidInstallments)
        : "";

    return {
      accountType,
      billingCycle: BILLING_MONTHLY,
      recurringValue: 0,
      downPayment: round2(downPayment),
      installmentValue: round2(installmentValue),
      installments,
      firstPaymentDate: normalizeDateInput(
        account.firstPaymentDate || account.firstDueDate,
        todayISO()
      ),
      financedAmount: round2(financedAmount),
      totalAccountValue: round2(totalAccountValue),
      paidInstallments,
      paidAmount: round2(paidAmount),
      remainingInstallments,
      remainingAmount: round2(remainingAmount),
      totalSpent,
      progressPercent,
      nextPaymentValue: round2(nextPaymentValue),
      nextDueDate,
      status,
      canPayNow: status === "active",
      paidThisMonth: false,
      subscriptionPayments: 0,
    };
  }

  async function refreshAccounts({ silent = false } = {}) {
    try {
      const data = await apiFetch("/accounts");
      const list = Array.isArray(data) ? data : data?.accounts || [];
      accounts = list.map((raw) => normalizeAccount(raw));
      renderSummary();
      renderTable();
    } catch (err) {
      accounts = [];
      renderSummary();
      renderTable();
      if (!silent) {
        showAlert(err.message || "Não foi possível carregar contas", "danger", "triangle-exclamation");
      }
    }
  }

  async function loadExpenseCategories({ silent = false } = {}) {
    try {
      const data = await apiFetch("/categories");
      const list = Array.isArray(data) ? data : data?.categories || [];
      const names = list
        .filter((c) => c.type === "expense")
        .map((c) => String(c.name || "").trim())
        .filter(Boolean);
      expenseCategories = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
    } catch (err) {
      expenseCategories = [];
      if (!silent) {
        showAlert(err.message || "Não foi possível carregar categorias", "warning", "triangle-exclamation");
      }
    }
  }

  function fillCategorySelect(selectEl, selected = "", allowBlank = true, blankLabel = "Selecione...") {
    if (!selectEl) return;

    const current = String(selected || "").trim();
    const options = [...expenseCategories];

    if (current && !options.includes(current)) options.push(current);

    options.sort((a, b) => a.localeCompare(b));
    selectEl.innerHTML = "";

    if (allowBlank) {
      selectEl.innerHTML += `<option value="">${blankLabel}</option>`;
    }

    options.forEach((name) => {
      selectEl.innerHTML += `<option value="${name}">${name}</option>`;
    });

    selectEl.value = current;
  }

  function getSubscriptionCategorySuggestion() {
    return (
      expenseCategories.find((name) => {
        const normalized = normalizeText(name);
        return (
          normalized === "assinatura" ||
          normalized === "assinaturas" ||
          normalized.includes("assinatura")
        );
      }) || ""
    );
  }

  function getEditorPayload() {
    const accountType = normalizeAccountType(accountTypeSelect?.value);
    const recurring = isRecurringType(accountType);
    const billingCycle = accountType === ACCOUNT_TYPE_SUBSCRIPTION
      ? normalizeBillingCycle(accountBillingCycleSelect?.value)
      : BILLING_MONTHLY;
    const inputValue = toNumber(accountInstallmentValueInput.value);
    const recurringValue = recurring ? inputValue : 0;

    const firstPaymentDate = normalizeDateInput(accountFirstDueInput.value, "");
    const nextDueDate = normalizeDateInput(accountNextDueInput?.value, firstPaymentDate);

    return {
      name: String(accountNameInput.value || "").trim(),
      accountType,
      billingCycle,
      recurringValue,
      installmentValue: inputValue,
      downPayment: recurring ? 0 : toNumber(accountDownInput.value),
      installments: recurring
        ? 1
        : normalizeInstallments(accountInstallmentsInput.value),
      paidInstallments: recurring ? 0 : 0,
      firstPaymentDate,
      firstDueDate: firstPaymentDate,
      nextDueDate,
      category: String(accountCategorySelect.value || "").trim(),
    };
  }

  function validateEditorPayload(payload) {
    if (!payload.name) return "Informe o nome da conta.";

    const firstPaymentDate = normalizeDateInput(payload.firstPaymentDate, "");
    const nextDueDate = normalizeDateInput(payload.nextDueDate, "");

    if (!firstPaymentDate) return "Informe a data do primeiro pagamento.";
    if (!nextDueDate) return "Informe a data da próxima cobrança.";

    const firstDateObj = parseDateSafe(firstPaymentDate);
    const nextDateObj = parseDateSafe(nextDueDate);
    if (
      firstDateObj instanceof Date &&
      nextDateObj instanceof Date &&
      !Number.isNaN(firstDateObj.getTime()) &&
      !Number.isNaN(nextDateObj.getTime()) &&
      nextDateObj < firstDateObj
    ) {
      return "A próxima cobrança deve ser igual ou posterior ao primeiro pagamento.";
    }

    if (payload.accountType === ACCOUNT_TYPE_SUBSCRIPTION) {
      if (!Number.isFinite(payload.recurringValue) || payload.recurringValue <= 0) {
        return "Informe um valor da assinatura maior que zero.";
      }
      if (![BILLING_MONTHLY, BILLING_ANNUAL].includes(payload.billingCycle)) {
        return "Escolha a cobrança mensal ou anual.";
      }
      return null;
    }

    if (payload.accountType === ACCOUNT_TYPE_FIXED) {
      if (!Number.isFinite(payload.recurringValue) || payload.recurringValue <= 0) {
        return "Informe um valor fixo maior que zero.";
      }
      return null;
    }

    if (!Number.isFinite(payload.installmentValue) || payload.installmentValue <= 0) {
      return "Informe um valor da parcela maior que zero.";
    }
    if (!Number.isFinite(payload.installments) || payload.installments < 1) {
      return "Parcelas deve ser no minimo 1.";
    }
    if (payload.downPayment < 0) return "Entrada não pode ser negativa.";
    return null;
  }

  function syncEditorByType() {
    const accountType = normalizeAccountType(accountTypeSelect?.value);
    const isSubscription = accountType === ACCOUNT_TYPE_SUBSCRIPTION;
    const isFixed = accountType === ACCOUNT_TYPE_FIXED;
    const recurring = isSubscription || isFixed;

    if (accountBillingCycleWrap) {
      accountBillingCycleWrap.classList.toggle("d-none", !isSubscription);
    }
    if (accountDownWrap) {
      accountDownWrap.classList.toggle("d-none", recurring);
    }
    if (accountInstallmentsWrap) {
      accountInstallmentsWrap.classList.toggle("d-none", recurring);
    }
    if (accountInstallmentValueWrap) {
      accountInstallmentValueWrap.classList.remove("col-md-6", "col-md-4");
        accountInstallmentValueWrap.classList.add(recurring ? "col-md-6" : "col-md-4");
    }

    if (accountInstallmentValueLabel) {
      accountInstallmentValueLabel.textContent = isSubscription
        ? "Valor da assinatura"
        : (isFixed ? "Valor mensal fixo" : "Valor da parcela");
    }
    if (accountFirstDueLabel) {
      accountFirstDueLabel.textContent = "Data do primeiro pagamento";
    }
    if (accountNextDueLabel) {
      accountNextDueLabel.textContent = isSubscription
        ? "Data da próxima cobrança"
        : (isFixed ? "Próximo vencimento" : "Data do próximo vencimento");
    }
    if (accountTotalPreviewLabel) {
      accountTotalPreviewLabel.textContent = isSubscription
        ? "Custo por ciclo"
        : (isFixed ? "Custo mensal" : "Total contabilizado");
    }
    if (accountInstallmentPreviewLabel) {
      accountInstallmentPreviewLabel.textContent = isSubscription
        ? "Valor recorrente"
        : (isFixed ? "Valor mensal" : "Valor da parcela");
    }

    if (recurring) {
      if (typeof setMoneyInputValue === "function") {
        setMoneyInputValue(accountDownInput, 0, { allowEmpty: false });
      } else {
        accountDownInput.value = "0";
      }
      accountInstallmentsInput.value = "1";
      if (isFixed) {
        accountBillingCycleSelect.value = BILLING_MONTHLY;
      }
      if (!accountBillingCycleSelect.value) {
        accountBillingCycleSelect.value = BILLING_MONTHLY;
      }
    }

    if (accountFirstDueInput && !accountFirstDueInput.value) {
      accountFirstDueInput.value = todayISO();
    }
    if (accountNextDueInput && !accountNextDueInput.value) {
      const firstPayment = accountFirstDueInput?.value || todayISO();
      accountNextDueInput.value = firstPayment;
    }

    applyNamePlaceholderByType(accountType);
  }

  function updateEditorPreview() {
    const payload = getEditorPayload();
    const simulated = calculateAccount({
      accountType: payload.accountType,
      billingCycle: payload.billingCycle,
      recurringValue: payload.recurringValue,
      installmentValue: payload.installmentValue,
      downPayment: payload.downPayment,
      installments: payload.installments,
      paidInstallments: 0,
      firstPaymentDate: payload.firstPaymentDate || todayISO(),
      firstDueDate: payload.firstPaymentDate || todayISO(),
      nextDueDate: payload.nextDueDate || payload.firstPaymentDate || todayISO(),
      adjustmentHistory: [],
    });

    accountTotalPreview.textContent = formatBRL(simulated.totalAccountValue);
    accountInstallmentPreview.textContent = payload.accountType === ACCOUNT_TYPE_SUBSCRIPTION
      ? `${formatBRL(simulated.recurringValue)} / ${simulated.billingCycle === BILLING_ANNUAL ? "ano" : "mês"}`
      : (payload.accountType === ACCOUNT_TYPE_FIXED
        ? `${formatBRL(simulated.recurringValue)} / mês`
        : formatBRL(simulated.installmentValue));
  }

  function renderSummary() {
    const states = accounts.map((acc) => calculateAccount(acc));
    const total = states.reduce((sum, st) => {
      return sum + toNumber(st.totalSpent, 0);
    }, 0);
    const open = states.reduce((sum, st) => {
      if (isRecurringType(st.accountType)) {
        return sum + st.recurringValue;
      }
      return sum + st.remainingAmount;
    }, 0);
    const activeCount = states.filter((st) => st.status === "active").length;

    summaryTotalValue.textContent = formatBRL(total);
    summaryOpenValue.textContent = formatBRL(open);
    summaryActiveCount.textContent = String(activeCount);
  }

  function statusBadge(status, accountType = ACCOUNT_TYPE_INSTALLMENT) {
    if (accountType === ACCOUNT_TYPE_SUBSCRIPTION) {
      return `<span class="status-chip subscription">Assinatura</span>`;
    }
    if (accountType === ACCOUNT_TYPE_FIXED) {
      return `<span class="status-chip fixed">Fixa</span>`;
    }
    if (status === "paid") return `<span class="status-chip paid">Concluída</span>`;
    return `<span class="status-chip active">Ativa</span>`;
  }

  function buildFilteredRows() {
    const term = String(searchInput.value || "").trim().toLowerCase();
    const status = statusFilter.value || "all";

    return accounts
      .map((account) => ({ account, calc: calculateAccount(account) }))
      .filter(({ account, calc }) => {
        if (status !== "all" && calc.status !== status) return false;
        if (!term) return true;
        const haystack = `${account.name} ${account.category}`.toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => {
        if (a.calc.status !== b.calc.status) return a.calc.status === "active" ? -1 : 1;
        if (!a.calc.nextDueDate && !b.calc.nextDueDate) return 0;
        if (!a.calc.nextDueDate) return 1;
        if (!b.calc.nextDueDate) return -1;
        return a.calc.nextDueDate.localeCompare(b.calc.nextDueDate);
      });
  }

  function buildAccountDisplayState(account, calc) {
    const isSubscription = calc.accountType === ACCOUNT_TYPE_SUBSCRIPTION;
    const isFixed = calc.accountType === ACCOUNT_TYPE_FIXED;
    const recurring = isSubscription || isFixed;
    const showDownPayment = !recurring;
    const showRemaining = isFixed;
    const installmentsTextBase = isSubscription
      ? `<span class="status-chip subscription">${calc.billingCycle === BILLING_ANNUAL ? "Anual" : "Mensal"}</span>`
      : (isFixed
        ? `<span class="status-chip fixed">Mensal</span>`
        : `${calc.paidInstallments}/${calc.installments}`);
    const progressMarkup = !recurring
      ? `
        <div class="contas-progress mt-1">
          <div class="progress" role="progressbar" aria-label="Progresso da conta" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(calc.progressPercent || 0)}">
            <div class="progress-bar" style="width: ${Math.max(0, Math.min(100, calc.progressPercent || 0))}%"></div>
          </div>
          <span class="contas-progress-label">${Math.round(calc.progressPercent || 0)}%</span>
        </div>
      `
      : "";
    const installmentsText = installmentsTextBase;
    const installmentValueText = isSubscription
      ? `${formatBRL(calc.recurringValue)} / ${calc.billingCycle === BILLING_ANNUAL ? "ano" : "mês"}`
      : (isFixed ? `${formatBRL(calc.recurringValue)} / mês` : formatBRL(calc.installmentValue));
    const downPaymentText = showDownPayment ? formatBRL(calc.downPayment) : "";
    const totalSpentText = formatBRL(calc.totalSpent);
    const remainingValueText = showRemaining ? formatBRL(calc.remainingAmount) : "";
    const payButtonText = isSubscription ? "Pagar ciclo" : (isFixed ? "Pagar mês" : "Pagar");
    const canPay = calc.status === "active" && (!recurring || calc.canPayNow);
    const payButtonLabel = canPay ? payButtonText : (recurring ? "Pago no mês" : "Pago");
    const lastAdjustment = isSubscription && account.adjustmentHistory?.length
      ? account.adjustmentHistory[account.adjustmentHistory.length - 1]
      : null;
    const adjustmentInfo = lastAdjustment
      ? `<div class="contas-muted small mt-1">Último reajuste: ${formatDateBR(lastAdjustment.changedAt)}</div>`
      : "";
    const adjustButton = isSubscription
      ? `<button class="btn btn-sm btn-outline-warning" type="button" data-action="adjust" data-id="${account.id}" title="Reajustar assinatura"><i class="fa-solid fa-arrow-trend-up"></i></button>`
      : "";

    return {
      recurring,
      showDownPayment,
      showRemaining,
      installmentsText,
      progressMarkup,
      installmentValueText,
      downPaymentText,
      totalSpentText,
      remainingValueText,
      canPay,
      payButtonLabel,
      adjustmentInfo,
      adjustButton
    };
  }

  function renderTableRows(rows) {
    if (!tableBody) return;

    tableBody.innerHTML = "";

    rows.forEach(({ account, calc }) => {
      const state = buildAccountDisplayState(account, calc);

      tableBody.innerHTML += `
        <tr>
          <td>
            <div class="contas-name">${account.name}</div>
            ${state.adjustmentInfo}
          </td>
          <td>${state.installmentsText}${state.progressMarkup}</td>
          <td class="contas-money">${state.installmentValueText}</td>
          <td>${formatDateBR(calc.nextDueDate)}</td>
          <td class="contas-money">${state.showDownPayment ? state.downPaymentText : ""}</td>
          <td class="contas-money">${state.totalSpentText}</td>
          <td class="contas-money">${state.showRemaining ? state.remainingValueText : ""}</td>
          <td>${account.category ? account.category : '<span class="contas-muted">Não definida</span>'}</td>
          <td>${statusBadge(calc.status, calc.accountType)}</td>
          <td class="text-end">
            <div class="contas-actions">
              ${
                state.canPay
                  ? `<button class="btn btn-sm btn-success" type="button" data-action="pay" data-id="${account.id}">${state.payButtonLabel}</button>`
                  : `<button class="btn btn-sm btn-success" type="button" disabled>${state.payButtonLabel}</button>`
              }
              <button class="btn btn-sm btn-outline-primary" type="button" data-action="edit" data-id="${account.id}">
                <i class="fa-solid fa-pen"></i>
              </button>
              ${state.adjustButton}
              <button class="btn btn-sm btn-outline-danger" type="button" data-action="delete" data-id="${account.id}">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });
  }

  function renderCards(rows) {
    if (!cardsView) return;
    cardsView.innerHTML = "";

    rows.forEach(({ account, calc }) => {
      const state = buildAccountDisplayState(account, calc);

      cardsView.innerHTML += `
        <div class="col-12 col-md-6 col-xl-4">
          <article class="contas-card-item">
            <div class="contas-card-header">
              <div>
                <div class="contas-name">${account.name}</div>
                ${state.adjustmentInfo}
              </div>
              ${statusBadge(calc.status, calc.accountType)}
            </div>

            <div class="contas-meta">
              <div>
                <span class="contas-meta-label">Ciclo/Parcelas</span>
                <span class="contas-meta-value">${state.installmentsText}</span>
                ${state.progressMarkup}
              </div>
              <div>
                <span class="contas-meta-label">Valor</span>
                <span class="contas-meta-value">${state.installmentValueText}</span>
              </div>
              <div>
                <span class="contas-meta-label">Próx. vencimento</span>
                <span class="contas-meta-value">${formatDateBR(calc.nextDueDate)}</span>
              </div>
              ${
                state.showDownPayment
                  ? `
                    <div>
                      <span class="contas-meta-label">Entrada</span>
                      <span class="contas-meta-value">${state.downPaymentText}</span>
                    </div>
                  `
                  : ""
              }
              <div>
                <span class="contas-meta-label">Total gasto</span>
                <span class="contas-meta-value">${state.totalSpentText}</span>
              </div>
              ${
                state.showRemaining
                  ? `
                    <div>
                      <span class="contas-meta-label">Restante</span>
                      <span class="contas-meta-value">${state.remainingValueText}</span>
                    </div>
                  `
                  : ""
              }
              <div class="contas-meta-full">
                <span class="contas-meta-label">Categoria</span>
                <span class="contas-meta-value">${account.category ? account.category : '<span class="contas-muted">Não definida</span>'}</span>
              </div>
            </div>

            <div class="contas-card-footer">
              <div class="contas-actions">
                ${
                  state.canPay
                    ? `<button class="btn btn-sm btn-success" type="button" data-action="pay" data-id="${account.id}">${state.payButtonLabel}</button>`
                    : `<button class="btn btn-sm btn-success" type="button" disabled>${state.payButtonLabel}</button>`
                }
                <button class="btn btn-sm btn-outline-primary" type="button" data-action="edit" data-id="${account.id}">
                  <i class="fa-solid fa-pen"></i>
                </button>
                ${state.adjustButton}
                <button class="btn btn-sm btn-outline-danger" type="button" data-action="delete" data-id="${account.id}">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
          </article>
        </div>
      `;
    });
  }

  function renderTable() {
    const rows = buildFilteredRows();
    renderTableRows(rows);
    renderCards(rows);
    applyViewModeUi();

    const hasRows = rows.length > 0;
    emptyState.classList.toggle("d-none", hasRows);
  }

  function resetEditor() {
    editingAccountId = null;
    editorTitle.textContent = "Nova conta";

    accountTypeSelect.value = ACCOUNT_TYPE_INSTALLMENT;
    accountBillingCycleSelect.value = BILLING_MONTHLY;
    accountNameInput.value = "";
    if (typeof setMoneyInputValue === "function") {
      setMoneyInputValue(accountInstallmentValueInput, "", { allowEmpty: true });
      setMoneyInputValue(accountDownInput, 0, { allowEmpty: false });
    } else {
      accountInstallmentValueInput.value = "";
      accountDownInput.value = "0";
    }
    accountInstallmentsInput.value = "1";
    accountFirstDueInput.value = todayISO();
    accountNextDueInput.value = todayISO();
    fillCategorySelect(
      accountCategorySelect,
      "",
      true,
      "Definir na primeira vez que pagar"
    );
    syncEditorByType();
    updateEditorPreview();
  }

  function openCreateEditor() {
    resetEditor();
    editorModal?.show();
    accountNameInput.focus();
  }

  async function openCreateSubscriptionEditor() {
    if (!expenseCategories.length) {
      await loadExpenseCategories({ silent: true });
    }

    resetEditor();
    editorTitle.textContent = "Novo servico por assinatura";
    accountTypeSelect.value = ACCOUNT_TYPE_SUBSCRIPTION;
    accountBillingCycleSelect.value = BILLING_MONTHLY;
    syncEditorByType();
    if (typeof setMoneyInputValue === "function") {
      setMoneyInputValue(accountDownInput, 0, { allowEmpty: false });
    } else {
      accountDownInput.value = "0";
    }
    accountInstallmentsInput.value = "1";
    accountFirstDueInput.value = todayISO();
    accountNextDueInput.value = todayISO();

    const suggestion = getSubscriptionCategorySuggestion();
    if (suggestion) {
      accountCategorySelect.value = suggestion;
    }

    updateEditorPreview();
    editorModal?.show();
    accountNameInput.focus();
  }

  function openEditEditor(accountId) {
    const account = accounts.find((x) => x.id === accountId);
    if (!account) return;

    const calc = calculateAccount(account);
    editingAccountId = account.id;
    editorTitle.textContent = account.accountType === ACCOUNT_TYPE_SUBSCRIPTION
      ? "Editar assinatura"
      : (account.accountType === ACCOUNT_TYPE_FIXED ? "Editar conta fixa" : "Editar conta");

    accountNameInput.value = account.name;
    accountTypeSelect.value = normalizeAccountType(account.accountType);
    accountBillingCycleSelect.value = normalizeBillingCycle(account.billingCycle);
    const installmentValue = isRecurringType(calc.accountType)
      ? calc.recurringValue
      : calc.installmentValue;
    if (typeof setMoneyInputValue === "function") {
      setMoneyInputValue(accountInstallmentValueInput, installmentValue, { allowEmpty: false });
      setMoneyInputValue(accountDownInput, calc.downPayment, { allowEmpty: false });
    } else {
      accountInstallmentValueInput.value = String(installmentValue);
      accountDownInput.value = String(calc.downPayment);
    }
    accountInstallmentsInput.value = String(calc.installments);
    accountFirstDueInput.value = account.firstPaymentDate || account.firstDueDate || todayISO();
    accountNextDueInput.value = account.nextDueDate || accountFirstDueInput.value;
    fillCategorySelect(
      accountCategorySelect,
      account.category || "",
      true,
      "Definir na primeira vez que pagar"
    );
    syncEditorByType();
    updateEditorPreview();
    editorModal?.show();
  }

  async function saveEditor() {
    const payload = getEditorPayload();
    const validationError = validateEditorPayload(payload);

    if (validationError) {
      showAlert(validationError, "warning", "triangle-exclamation");
      return;
    }

    setLoading(saveAccountBtn, true);

    try {
      if (!editingAccountId) {
        await apiFetch("/accounts", "POST", {
          ...payload,
          paidInstallments: 0,
        });
        showAlert("Conta criada com sucesso", "success", "check-circle");
      } else {
        await apiFetch(`/accounts/${editingAccountId}`, "PUT", payload);
        showAlert("Conta atualizada com sucesso", "success", "check-circle");
      }

      editorModal?.hide();
      await refreshAccounts({ silent: true });
    } catch {
      // apiFetch already handles alert
    } finally {
      setLoading(saveAccountBtn, false);
    }
  }

  async function openPayModal(accountId) {
    const account = accounts.find((x) => x.id === accountId);
    if (!account) return;

    await loadExpenseCategories({ silent: true });

    const calc = calculateAccount(account);
    if (calc.status !== "active") {
      showAlert("Essa conta já está concluída", "warning", "triangle-exclamation");
      return;
    }
    if (isRecurringType(calc.accountType) && !calc.canPayNow) {
      showAlert("Essa conta recorrente já está paga no ciclo atual", "warning", "triangle-exclamation");
      return;
    }

    payingAccountId = accountId;
    payAccountName.textContent = account.name;
    if (calc.accountType === ACCOUNT_TYPE_SUBSCRIPTION) {
      payCycleInfoLabel.textContent = "Ciclo";
      payNextDueLabel.textContent = "Próxima cobrança";
      payInstallmentInfo.textContent = calc.billingCycle === BILLING_ANNUAL ? "Anual" : "Mensal";
    } else if (calc.accountType === ACCOUNT_TYPE_FIXED) {
      payCycleInfoLabel.textContent = "Ciclo";
      payNextDueLabel.textContent = "Próximo vencimento";
      payInstallmentInfo.textContent = "Mensal";
    } else {
      payCycleInfoLabel.textContent = "Parcela";
      payNextDueLabel.textContent = "Vencimento";
      payInstallmentInfo.textContent = `${calc.paidInstallments + 1}/${calc.installments}`;
    }
    payInstallmentValue.textContent = formatBRL(calc.nextPaymentValue);
    payNextDueDate.textContent = formatDateBR(calc.nextDueDate);

    if (account.category) {
      payCategorySelectWrap.classList.add("d-none");
      payCategoryFixedWrap.classList.remove("d-none");
      payCategoryFixedText.textContent = account.category;
    } else {
      fillCategorySelect(payCategorySelect, "", true, "Selecione a categoria");
      payCategorySelectWrap.classList.remove("d-none");
      payCategoryFixedWrap.classList.add("d-none");
      payCategoryFixedText.textContent = "-";
    }

    payModal?.show();
  }

  async function confirmPay() {
    if (!payingAccountId) return;

    const account = accounts.find((x) => x.id === payingAccountId);
    if (!account) return;

    const calc = calculateAccount(account);
    if (calc.status !== "active") return;
    if (isRecurringType(calc.accountType) && !calc.canPayNow) return;

    let category = account.category;
    if (!category) {
      category = String(payCategorySelect.value || "").trim();
      if (!category) {
        showAlert("Escolha uma categoria para vincular a conta", "warning", "triangle-exclamation");
        return;
      }
    }

    setLoading(confirmPayBtn, true);

    try {
      const payDateIso = typeof toApiIsoFromLocalDateInput === "function"
        ? toApiIsoFromLocalDateInput(todayISO(), { hour: 12 })
        : `${todayISO()}T12:00:00`;
      const body = {
        date: payDateIso,
      };

      if (!account.category) {
        body.category = category;
      }

      await apiFetch(`/accounts/${payingAccountId}/pay`, "POST", body);

      payModal?.hide();
      await refreshAccounts({ silent: true });
      showAlert("Pagamento registrado e descontado do saldo", "success", "check-circle");
    } catch {
      // apiFetch already handles alert
    } finally {
      setLoading(confirmPayBtn, false);
    }
  }

  function openAdjustSubscriptionModal(accountId) {
    const account = accounts.find((x) => x.id === accountId);
    if (!account) return;

    const calc = calculateAccount(account);
    if (calc.accountType !== ACCOUNT_TYPE_SUBSCRIPTION) {
      showAlert("Somente assinaturas podem ser reajustadas", "warning", "triangle-exclamation");
      return;
    }

    adjustingSubscriptionId = accountId;
    adjustAccountName.textContent = account.name;
    adjustCurrentValue.textContent = formatBRL(calc.recurringValue);
    if (typeof setMoneyInputValue === "function") {
      setMoneyInputValue(adjustNewValueInput, calc.recurringValue, { allowEmpty: false });
    } else {
      adjustNewValueInput.value = String(calc.recurringValue);
    }
    adjustDateInput.value = todayISO();
    adjustNoteInput.value = "";

    adjustSubscriptionModal?.show();
    adjustNewValueInput.focus();
  }

  async function confirmAdjustSubscription() {
    if (!adjustingSubscriptionId) return;

    const account = accounts.find((x) => x.id === adjustingSubscriptionId);
    if (!account) return;

    const calc = calculateAccount(account);
    if (calc.accountType !== ACCOUNT_TYPE_SUBSCRIPTION) return;

    const newValue = round2(toNumber(adjustNewValueInput.value, -1));
    if (!Number.isFinite(newValue) || newValue <= 0) {
      showAlert("Informe um novo valor maior que zero", "warning", "triangle-exclamation");
      return;
    }

    if (Math.abs(newValue - calc.recurringValue) < 0.01) {
      showAlert("Informe um valor diferente do atual", "warning", "triangle-exclamation");
      return;
    }

    const changedAt = String(adjustDateInput.value || "").trim();
    if (!changedAt) {
      showAlert("Informe a data do reajuste", "warning", "triangle-exclamation");
      return;
    }

    const note = String(adjustNoteInput.value || "").trim();

    setLoading(confirmAdjustSubscriptionBtn, true);

    try {
      const changedAtIso = typeof toApiIsoFromLocalDateInput === "function"
        ? toApiIsoFromLocalDateInput(changedAt, { hour: 12 })
        : `${changedAt}T12:00:00`;
      await apiFetch(`/accounts/${adjustingSubscriptionId}/adjust-subscription`, "POST", {
        newValue,
        changedAt: changedAtIso,
        note
      });

      adjustSubscriptionModal?.hide();
      await refreshAccounts({ silent: true });
      showAlert("Reajuste aplicado com sucesso", "success", "check-circle");
    } catch {
      // apiFetch already handles alert
    } finally {
      setLoading(confirmAdjustSubscriptionBtn, false);
    }
  }

  function openDeleteModal(accountId) {
    deletingAccountId = accountId;
    deleteModal?.show();
  }

  async function deleteAccount() {
    if (!deletingAccountId) return;

    try {
      await apiFetch(`/accounts/${deletingAccountId}`, "DELETE");
      deletingAccountId = null;
      deleteModal?.hide();
      await refreshAccounts({ silent: true });
      showAlert("Conta excluída", "success", "check-circle");
    } catch {
      // apiFetch already handles alert
    }
  }

  function handleActionClick(e) {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "pay") {
      void openPayModal(id);
      return;
    }
    if (action === "edit") {
      openEditEditor(id);
      return;
    }
    if (action === "adjust") {
      openAdjustSubscriptionModal(id);
      return;
    }
    if (action === "delete") {
      openDeleteModal(id);
    }
  }

  tableBody?.addEventListener("click", handleActionClick);
  cardsView?.addEventListener("click", handleActionClick);

  openCreateBtn.addEventListener("click", openCreateEditor);
  if (openCreateSubscriptionBtn) {
    openCreateSubscriptionBtn.addEventListener("click", () => {
      void openCreateSubscriptionEditor();
    });
  }
  saveAccountBtn.addEventListener("click", saveEditor);
  confirmPayBtn.addEventListener("click", confirmPay);
  confirmDeleteBtn.addEventListener("click", deleteAccount);
  if (confirmAdjustSubscriptionBtn) {
    confirmAdjustSubscriptionBtn.addEventListener("click", confirmAdjustSubscription);
  }
  if (adjustSubscriptionModalEl) {
    adjustSubscriptionModalEl.addEventListener("hidden.bs.modal", () => {
      adjustingSubscriptionId = null;
    });
  }

  [accountInstallmentValueInput, accountDownInput, accountInstallmentsInput].forEach((input) => {
    if (!input) return;
    input.addEventListener("input", updateEditorPreview);
    input.addEventListener("change", updateEditorPreview);
  });
  [accountFirstDueInput, accountNextDueInput, accountBillingCycleSelect].forEach((input) => {
    if (!input) return;
    input.addEventListener("change", updateEditorPreview);
  });

  accountFirstDueInput?.addEventListener("change", () => {
    if (!accountNextDueInput) return;
    if (String(accountNextDueInput.value || "").trim()) return;

    const firstPayment = accountFirstDueInput.value || todayISO();
    accountNextDueInput.value = firstPayment;
  });

  if (accountTypeSelect) {
    accountTypeSelect.addEventListener("change", () => {
      syncEditorByType();
      updateEditorPreview();
    });
  }

  searchInput.addEventListener("input", renderTable);
  statusFilter.addEventListener("change", renderTable);
  clearFiltersBtn.addEventListener("click", () => {
    searchInput.value = "";
    statusFilter.value = "all";
    renderTable();
  });

  viewTableBtn?.addEventListener("click", () => {
    setViewMode(VIEW_MODE_TABLE);
  });
  viewCardsBtn?.addEventListener("click", () => {
    setViewMode(VIEW_MODE_CARDS);
  });

  accountsViewMode = loadSavedViewMode();
  applyViewModeUi();
  await loadExpenseCategories({ silent: true });
  resetEditor();
  await refreshAccounts({ silent: true });
});
