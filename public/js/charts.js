// public/js/charts.js

let incomeExpenseChart;
let expenseCategoryChart;

let __dashboardTransactions = [];

function setDashboardTransactions(transactions) {
  __dashboardTransactions = Array.isArray(transactions) ? transactions : [];
}

/* ===============================
   Preferência por usuário
================================ */
function getLoggedUserId() {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    return u?.id || null;
  } catch {
    return null;
  }
}

function expenseChartTypeKey() {
  const uid = getLoggedUserId() || "anonymous";
  return `chartPrefs:${uid}:expenseByCategory:type`;
}

function getExpenseChartType() {
  return localStorage.getItem(expenseChartTypeKey()) || "bar";
}

function setExpenseChartType(type) {
  localStorage.setItem(expenseChartTypeKey(), type);
}

/* ===============================
   Util: formatar dinheiro
================================ */
function formatBRL(value) {
  try {
    return Number(value || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  } catch {
    return `R$ ${value}`;
  }
}

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

  transactions.forEach((t) => {
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
      datasets: [
        {
          data: [income, expense],
          backgroundColor: ["#20a30f", "#fa1100"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });
}

/* ===============================
   DESPESAS POR CATEGORIA (4 tipos)
================================ */

// cores fixas e consistentes por categoria
function colorForLabel(label) {
  const s = String(label || "").toLowerCase().trim();

  // “defaults” bem reconhecíveis
  if (s.includes("aliment")) return "#f59e0b"; // amarelo/laranja
  if (s.includes("mercad")) return "#f59e0b";
  if (s.includes("transp") || s.includes("combust")) return "#3b82f6"; // azul
  if (s.includes("morad") || s.includes("alug")) return "#8b5cf6"; // roxo
  if (s.includes("saúd") || s.includes("farm")) return "#22c55e"; // verde
  if (s.includes("lazer")) return "#ec4899"; // rosa
  if (s.includes("educ")) return "#06b6d4"; // ciano

  // fallback determinístico por hash (categoria sempre com a mesma cor)
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue} 70% 55%)`;
}

function buildExpenseByCategory(transactions) {
  const map = {};

  transactions
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      const key = (t.category || "Sem categoria").trim();
      map[key] = (map[key] || 0) + Number(t.value || 0);
    });

  // transforma em lista e ordena por valor desc (mais informativo para barras/linhas)
  const items = Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);

  const labels = items.map((x) => x.label);
  const values = items.map((x) => x.value);
  const total = values.reduce((acc, v) => acc + v, 0);

  return { labels, values, total };
}

function expenseTooltipCallbacks(labels, values, total) {
  return {
    callbacks: {
      label: (ctx) => {
        const idx = ctx.dataIndex;
        const label = labels[idx] || "";
        const value = values[idx] || 0;
        const pct = total > 0 ? (value / total) * 100 : 0;
        return `${label}: ${formatBRL(value)} (${pct.toFixed(1)}%)`;
      },
    },
  };
}

function renderExpenseCategoryChart(transactions = []) {
  const { labels, values, total } = buildExpenseByCategory(transactions);

  const canvasId = "expenseCategoryChart";
  const ctx = document.getElementById(canvasId);

  if (expenseCategoryChart) expenseCategoryChart.destroy();

  if (!labels.length) {
    renderEmptyMessage(canvasId);
    return;
  }

  const typeSelect = document.getElementById("expenseCategoryChartType");
  const selectedType = (typeSelect?.value || getExpenseChartType());

  const colors = labels.map(colorForLabel);

  // Config base
  const config = {
    type: selectedType,
    data: {
      labels,
      datasets: [
        {
          label: "Despesas",
          data: values,
          backgroundColor: colors,
          borderColor: selectedType === "line" ? "#e5e7eb" : colors,
          borderWidth: selectedType === "line" ? 2 : 0,
          fill: selectedType === "line",
          tension: selectedType === "line" ? 0.35 : 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: selectedType === "pie" || selectedType === "doughnut",
          position: "bottom",
          labels: { usePointStyle: true },
        },
        tooltip: expenseTooltipCallbacks(labels, values, total),
      },
// eixos só quando faz sentido
scales:
  selectedType === "bar"
    ? {
        x: {
          type: "linear",
          ticks: {
            color: "#adb5bd",
            callback: (v) => formatBRL(v),
          },
          grid: { color: "rgba(255,255,255,0.06)" },
        },
        y: {
          type: "category",
          ticks: {
            color: "#adb5bd",
            // garante que o tick vira label (categoria) e não número
            callback: function (value) {
              return this.getLabelForValue(value);
            },
          },
          grid: { display: false },
        },
      }
    : selectedType === "line"
      ? {
          x: {
            type: "category",
            ticks: { color: "#adb5bd" },
            grid: { display: false },
          },
          y: {
            type: "linear",
            ticks: {
              color: "#adb5bd",
              callback: (v) => formatBRL(v),
            },
            grid: { color: "rgba(255,255,255,0.06)" },
          },
        }
      : {},
    },
  };

  // Ajustes específicos pra barras: horizontal (ranking fica mais legível)
  if (selectedType === "bar") {
    config.options.indexAxis = "y";
    config.options.plugins.legend.display = false;
  }

  // Ajustes pra pizza/rosca: melhorar legibilidade
  if (selectedType === "pie" || selectedType === "doughnut") {
    config.options.plugins.legend.display = true;
  }

  expenseCategoryChart = new Chart(ctx, config);
}

/* ===============================
   Bind do seletor (1x)
================================ */
function initExpenseCategoryChartTypePicker() {
  const sel = document.getElementById("expenseCategoryChartType");
  if (!sel || sel.__bound) return;
  sel.__bound = true;

  sel.value = getExpenseChartType();

  sel.addEventListener("change", () => {
    setExpenseChartType(sel.value);
    renderExpenseCategoryChart(__dashboardTransactions);
  });
}

/* ===============================
   Inicialização
================================ */
document.addEventListener("DOMContentLoaded", () => {
  initExpenseCategoryChartTypePicker();
});

window.setDashboardTransactions = setDashboardTransactions;
window.renderIncomeExpenseChart = renderIncomeExpenseChart;
window.renderExpenseCategoryChart = renderExpenseCategoryChart;
