// Controle de inicialização do dashboard
let advancedLoaded = false;
const ACCOUNT_STORAGE_KEY = "mf_accounts";

document.addEventListener("DOMContentLoaded", () => {
  checkAuth();
  initTheme();
  initFilter();
  bindUI();
  applyDefaultFilter();
  initAccounts();
  bindInviteModal();
});

function formatMoney(value) {
  return `R$ ${(Number(value) || 0).toFixed(2)}`;
}

/* ===============================
   FILTROS
================================ */

function initFilter() {
  const monthSelect = document.getElementById("month");
  const yearSelect = document.getElementById("year");

  const now = new Date();

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril",
    "Maio", "Junho", "Julho", "Agosto",
    "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  months.forEach((name, index) => {
    const option = document.createElement("option");
    option.value = index + 1;
    option.text = name;
    if (index === now.getMonth()) option.selected = true;
    monthSelect.appendChild(option);
  });

  const currentYear = now.getFullYear();
  for (let y = currentYear - 3; y <= currentYear + 1; y++) {
    const option = document.createElement("option");
    option.value = y;
    option.text = y;
    if (y === currentYear) option.selected = true;
    yearSelect.appendChild(option);
  }
}

function applyDefaultFilter() {
  const year = document.getElementById("year").value;
  const month = document.getElementById("month").value;
  loadSummary(month, year);
  loadCharts(month, year);
}

/* ===============================
   RESUMO
================================ */

async function loadSummary(month, year) {
  try {
    const [summary, allTransactions] = await Promise.all([
      apiFetch(`/dashboard/summary?month=${month}&year=${year}`),
      apiFetch("/transactions")
    ]);

    const allTransactionsList = Array.isArray(allTransactions?.transactions)
      ? allTransactions.transactions
      : Array.isArray(allTransactions)
        ? allTransactions
        : [];
    const overallBalance = allTransactionsList.reduce((acc, t) => {
      const value = Number(t.value || 0);
      return acc + (t.type === "income" ? value : -value);
    }, 0);

    document.getElementById("income").innerText = formatMoney(summary.income);
    document.getElementById("expense").innerText = formatMoney(summary.expense);
    document.getElementById("balance").innerText = formatMoney(overallBalance);

    const boxes = document.getElementById("boxes");
    boxes.innerHTML = "";

    (summary.boxes || []).forEach((box) => {
      boxes.innerHTML += `
        <div class="col-md-3">
          <div class="card p-3 shadow-sm mb-3">
            <h6>${box.name}</h6>
            <strong>${formatMoney(box.currentValue)}</strong>
          </div>
        </div>
      `;
    });
  } catch (err) {
    console.error(err);
    showAlert("Erro ao carregar resumo", "danger", "triangle-exclamation");
  }
}

/* ===============================
   CONTAS
================================ */

function getAccountsFromStorage() {
  try {
    const stored = JSON.parse(localStorage.getItem(ACCOUNT_STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function saveAccountsToStorage(accounts) {
  localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(accounts));
}

function computeAccountTotals(account) {
  const amount = Number(account.amount || 0);
  const entry = Number(account.entry || 0);
  const interest = Number(account.interest || 0);
  const total = amount + amount * (interest / 100);
  const remaining = Math.max(total - entry, 0);
  return { total, remaining };
}

function buildAccountId() {
  return `acc_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

async function initAccounts() {
  const accountsList = document.getElementById("accountsList");
  const emptyAccounts = document.getElementById("emptyAccounts");
  const accountForm = document.getElementById("accountForm");
  const accountModalEl = document.getElementById("accountModal");
  const categoryModalEl = document.getElementById("accountCategoryModal");
  const accountCategorySelect = document.getElementById("accountCategory");
  const accountPayCategory = document.getElementById("accountPayCategory");
  const confirmPayCategory = document.getElementById("confirmPayCategory");
  const totalPreview = document.getElementById("accountTotalPreview");

  if (!accountsList || !accountForm || !accountModalEl) return;

  const accountModal = bootstrap.Modal.getOrCreateInstance(accountModalEl);
  const categoryModal = categoryModalEl
    ? bootstrap.Modal.getOrCreateInstance(categoryModalEl)
    : null;

  let accounts = getAccountsFromStorage();
  let categories = [];
  let payTargetId = null;

  async function loadCategories() {
    try {
      const data = await apiFetch("/categories");
      categories = (data?.categories || data || []).filter((c) => c.type === "expense");
    } catch (err) {
      console.error(err);
      showAlert("Erro ao carregar categorias", "danger", "triangle-exclamation");
    }
  }

  function renderCategoryOptions(selectEl, selectedId = "") {
    if (!selectEl) return;
    const options = categories
      .map((cat) => `<option value="${cat._id}" ${cat._id === selectedId ? "selected" : ""}>${cat.name}</option>`)
      .join("");
    selectEl.innerHTML = `${selectEl.id === "accountCategory" ? "<option value=\"\">Selecionar depois</option>" : ""}${options}`;
  }

  function getCategoryName(categoryId) {
    const match = categories.find((cat) => cat._id === categoryId);
    return match ? match.name : "Categoria não definida";
  }

  function renderAccounts() {
    accountsList.innerHTML = "";
    if (!accounts.length) {
      emptyAccounts?.classList.remove("d-none");
      return;
    }
    emptyAccounts?.classList.add("d-none");

    accounts.forEach((account) => {
      const { total, remaining } = computeAccountTotals(account);
      const statusLabel = account.paid ? "Paga" : "Ativa";
      const statusClass = account.paid ? "bg-success" : "bg-warning text-dark";
      const installmentsLabel = account.installments ? `${account.installments}x` : "Sem parcelas";
      const interestLabel = account.interest ? `${account.interest}%` : "Sem juros";
      const dueLabel = account.dueDate ? account.dueDate.split("-").reverse().join("/") : "Sem vencimento";
      const entryLabel = account.entry ? formatMoney(account.entry) : "Sem entrada";
      const categoryLabel = account.categoryId ? getCategoryName(account.categoryId) : "Categoria pendente";

      accountsList.innerHTML += `
        <div class="col">
          <div class="account-card h-100 d-flex flex-column gap-3">
            <div class="d-flex align-items-start justify-content-between gap-2">
              <div>
                <h6 class="mb-1">${account.name}</h6>
                <span class="badge badge-status ${statusClass}">${statusLabel}</span>
              </div>
              <div class="text-end">
                <div class="fw-semibold">${formatMoney(total)}</div>
                <div class="account-meta">Total calculado</div>
              </div>
            </div>
            <div class="row g-2 account-meta">
              <div class="col-6">Entrada: <strong>${entryLabel}</strong></div>
              <div class="col-6">Restante: <strong>${formatMoney(remaining)}</strong></div>
              <div class="col-6">Parcelas: <strong>${installmentsLabel}</strong></div>
              <div class="col-6">Juros: <strong>${interestLabel}</strong></div>
              <div class="col-6">Vencimento: <strong>${dueLabel}</strong></div>
              <div class="col-6">Categoria: <strong>${categoryLabel}</strong></div>
            </div>
            <div class="account-actions d-flex flex-wrap gap-2">
              <button class="btn btn-outline-primary btn-sm" data-action="edit" data-id="${account.id}">
                <i class="fa-solid fa-pen me-1"></i> Editar
              </button>
              <button class="btn btn-success btn-sm" data-action="pay" data-id="${account.id}" ${account.paid ? "disabled" : ""}>
                <i class="fa-solid fa-check me-1"></i> Pagar
              </button>
            </div>
          </div>
        </div>
      `;
    });
  }

  function resetAccountForm() {
    accountForm.reset();
    document.getElementById("accountId").value = "";
    totalPreview.textContent = formatMoney(0);
    renderCategoryOptions(accountCategorySelect);
  }

  function populateAccountForm(account) {
    document.getElementById("accountId").value = account.id;
    document.getElementById("accountName").value = account.name || "";
    document.getElementById("accountAmount").value = account.amount ?? "";
    document.getElementById("accountEntry").value = account.entry ?? "";
    document.getElementById("accountInstallments").value = account.installments ?? "";
    document.getElementById("accountInterest").value = account.interest ?? "";
    document.getElementById("accountDueDate").value = account.dueDate || "";
    renderCategoryOptions(accountCategorySelect, account.categoryId || "");
    totalPreview.textContent = formatMoney(computeAccountTotals(account).total);
  }

  function updateTotalPreview() {
    const account = {
      amount: document.getElementById("accountAmount").value,
      entry: document.getElementById("accountEntry").value,
      interest: document.getElementById("accountInterest").value,
    };
    totalPreview.textContent = formatMoney(computeAccountTotals(account).total);
  }

  async function payAccount(account) {
    const { remaining } = computeAccountTotals(account);
    if (remaining <= 0) {
      showAlert("Valor restante inválido para pagamento.", "warning", "triangle-exclamation");
      return;
    }

    const dateValue = account.dueDate || new Date().toISOString().split("T")[0];

    await apiFetch("/transactions", "POST", {
      type: "expense",
      value: Number(remaining),
      category: account.categoryId,
      group: "planned",
      date: `${dateValue}T12:00:00`
    });

    account.paid = true;
    account.paidAt = new Date().toISOString();
    saveAccountsToStorage(accounts);

    showAlert("Conta paga com sucesso!", "success", "check-circle");

    const month = document.getElementById("month").value;
    const year = document.getElementById("year").value;
    loadSummary(month, year);
    loadCharts(month, year);
    renderAccounts();
  }

  await loadCategories();
  renderCategoryOptions(accountCategorySelect);
  renderCategoryOptions(accountPayCategory);
  renderAccounts();

  accountModalEl.addEventListener("show.bs.modal", () => {
    if (!document.getElementById("accountId").value) {
      resetAccountForm();
    }
  });

  accountForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const id = document.getElementById("accountId").value || buildAccountId();
    const accountData = {
      id,
      name: document.getElementById("accountName").value.trim(),
      amount: Number(document.getElementById("accountAmount").value || 0),
      entry: Number(document.getElementById("accountEntry").value || 0),
      installments: Number(document.getElementById("accountInstallments").value || 0),
      interest: Number(document.getElementById("accountInterest").value || 0),
      dueDate: document.getElementById("accountDueDate").value,
      categoryId: accountCategorySelect.value || "",
      paid: false,
    };

    const existingIndex = accounts.findIndex((acc) => acc.id === id);
    if (existingIndex >= 0) {
      accountData.paid = accounts[existingIndex].paid;
      accountData.paidAt = accounts[existingIndex].paidAt;
      accounts[existingIndex] = accountData;
    } else {
      accounts.push(accountData);
    }

    saveAccountsToStorage(accounts);
    renderAccounts();
    accountModal.hide();
  });

  accountsList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const id = button.dataset.id;
    const account = accounts.find((acc) => acc.id === id);
    if (!account) return;

    if (button.dataset.action === "edit") {
      populateAccountForm(account);
      accountModal.show();
      return;
    }

    if (button.dataset.action === "pay") {
      if (!account.categoryId) {
        payTargetId = account.id;
        renderCategoryOptions(accountPayCategory);
        categoryModal?.show();
        return;
      }
      payAccount(account).catch((err) => {
        console.error(err);
        showAlert("Erro ao pagar conta", "danger", "triangle-exclamation");
      });
    }
  });

  confirmPayCategory?.addEventListener("click", () => {
    if (!payTargetId) return;
    const account = accounts.find((acc) => acc.id === payTargetId);
    if (!account) return;
    const selected = accountPayCategory.value;
    if (!selected) {
      showAlert("Selecione uma categoria para pagar.", "warning", "triangle-exclamation");
      return;
    }
    account.categoryId = selected;
    saveAccountsToStorage(accounts);
    categoryModal?.hide();
    payAccount(account).catch((err) => {
      console.error(err);
      showAlert("Erro ao pagar conta", "danger", "triangle-exclamation");
    });
    payTargetId = null;
  });

  ["accountAmount", "accountEntry", "accountInterest"].forEach((id) => {
    const input = document.getElementById(id);
    input?.addEventListener("input", updateTotalPreview);
  });
}

/* ===============================
   GRÁFICOS
================================ */

async function loadCharts(month, year) {
  try {
    const data = await apiFetch(`/transactions/month?month=${month}&year=${year}`);
    const transactions = data.transactions || [];

    // importante: guarda as transações ANTES, para o seletor conseguir re-renderizar
    window.setDashboardTransactions(transactions);

    renderIncomeExpenseChart(transactions);
    renderExpenseCategoryChart(transactions);
  } catch (err) {
    console.error(err);
    showAlert("Erro ao carregar gráficos", "danger", "triangle-exclamation");
  }
}

function applyFilter() {
  const month = document.getElementById("month").value;
  const year = document.getElementById("year").value;
  loadSummary(month, year);
  loadCharts(month, year);
}
