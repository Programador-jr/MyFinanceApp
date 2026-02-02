// Controle de inicialização do dashboard
let advancedLoaded = false;

document.addEventListener("DOMContentLoaded", () => {
  checkAuth();
  initTheme();
  initFilter();
  bindUI();
  applyDefaultFilter();
  bindInviteModal();
});

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
    const [periodResult, overallResult] = await Promise.allSettled([
      apiFetch(`/dashboard/summary?month=${month}&year=${year}`),
      apiFetch("/transactions"),
    ]);
    if (periodResult.status !== "fulfilled") {
      throw periodResult.reason;
    }
    const periodData = periodResult.value;
    let overallBalance = periodData.balance;
    if (overallResult.status === "fulfilled") {
      const transactions = overallResult.value?.transactions || [];
      overallBalance = transactions.reduce((total, transaction) => {
        const value = Number(transaction.value) || 0;
        return transaction.type === "income" ? total + value : total - value;
      }, 0);
    }

    const formatMoney = (value) => `R$ ${(Number(value) || 0).toFixed(2)}`;

    document.getElementById("income").innerText = formatMoney(periodData.income);
    document.getElementById("expense").innerText = formatMoney(periodData.expense);
    document.getElementById("balance").innerText = formatMoney(overallBalance);

    const boxes = document.getElementById("boxes");
    boxes.innerHTML = "";

    (periodData.boxes || []).forEach((box) => {
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
