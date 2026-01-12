let incomeExpenseChart;
let expenseCategoryChart;

/* ===============================
   UTILIDADE – SEM DADOS
================================ */
function renderEmptyMessage(canvasId, message = "Sem dados") {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "16px Arial";
  ctx.fillStyle = "#6c757d";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(message, canvas.width / 2, canvas.height / 2);
}

/* ===============================
   ENTRADAS x SAÍDAS
================================ */
function renderIncomeExpenseChart(transactions = []) {
  let income = 0;
  let expense = 0;

  transactions.forEach(t => {
    if (t.type === "income") income += t.value;
    if (t.type === "expense") expense += t.value;
  });

  const canvasId = "incomeExpenseChart";
  const ctx = document.getElementById(canvasId);

  if (incomeExpenseChart) incomeExpenseChart.destroy();

  if (income === 0 && expense === 0) {
    renderEmptyMessage(canvasId);
    return;
  }

  incomeExpenseChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Entradas", "Saídas"],
      datasets: [{
        data: [income, expense],
        backgroundColor: ["#20a30f", "#fa1100"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      }
    }
  });
}

/* ===============================
   DESPESAS POR CATEGORIA
================================ */
function renderExpenseCategoryChart(transactions = []) {
  const categories = {};

  transactions
    .filter(t => t.type === "expense")
    .forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + t.value;
    });

  const labels = Object.keys(categories);
  const values = Object.values(categories);

  const canvasId = "expenseCategoryChart";
  const ctx = document.getElementById(canvasId);

  if (expenseCategoryChart) expenseCategoryChart.destroy();

  if (!labels.length) {
    renderEmptyMessage(canvasId);
    return;
  }

  expenseCategoryChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: values
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}
