let incomeExpenseChart;
let expenseCategoryChart;

let __dashboardTransactions = [];
let __dashboardAllTransactions = [];
let __dashboardFlowReferenceDate = null;

function setDashboardTransactions(transactions) {
 __dashboardTransactions = Array.isArray(transactions) ? transactions : [];
}

function setDashboardAllTransactions(transactions) {
 __dashboardAllTransactions = Array.isArray(transactions) ? transactions : [];
}

function toFlowReferenceDate(month, year) {
  const monthNumber = Math.max(1, Math.min(12, Math.floor(Number(month))));
  const yearNumber = Math.floor(Number(year));
  if (!monthNumber || !yearNumber) return null;
  const date = new Date(yearNumber, monthNumber - 1, 1, 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function setDashboardFlowReference(month, year) {
  __dashboardFlowReferenceDate = toFlowReferenceDate(month, year);
}

function syncChartExpanders() {
  if (typeof window.updateChartExpandersAvailability === "function") {
    window.updateChartExpandersAvailability();
  }
}

/* ===============================
   Preferencia por usuario
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

function incomeExpenseFlowRangeKey() {
  const uid = getLoggedUserId() || "anonymous";
 return `chartPrefs:${uid}:incomeExpenseFlow:range`;
}

function normalizeIncomeExpenseFlowRange(range) {
  const normalized = String(range || "").trim().toLowerCase();
  const valid = new Set([
    "last_6_months",
    "last_3_months",
    "current_month",
    "all_period",
  ]);

 return valid.has(normalized) ? normalized : "current_month";
}

function getIncomeExpenseFlowRange() {
  return normalizeIncomeExpenseFlowRange(localStorage.getItem(incomeExpenseFlowRangeKey()));
}

function setIncomeExpenseFlowRange(range) {
  localStorage.setItem(
    incomeExpenseFlowRangeKey(),
    normalizeIncomeExpenseFlowRange(range)
  );
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
   UTILIDADE: SEM DADOS
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
   ENTRADAS x SAIDAS
================================ */
function toValidDate(value) {
  if (typeof parseDateLikeLocal === "function") {
    return parseDateLikeLocal(value, { middayHour: 12 });
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthLabel(year, monthIndex0) {
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[monthIndex0]}/${String(year).slice(-2)}`;
}

function monthKey(year, monthIndex0) {
  return `${year}-${String(monthIndex0 + 1).padStart(2, "0")}`;
}

function addMonthsLocal(baseDate, diff) {
  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth() + diff,
    1,
    12, 0, 0, 0
  );
}

function buildMonthRange(startMonthDate, endMonthDate) {
  const months = [];
  let cursor = new Date(
    startMonthDate.getFullYear(),
    startMonthDate.getMonth(),
    1,
    12, 0, 0, 0
  );
  const end = new Date(
    endMonthDate.getFullYear(),
    endMonthDate.getMonth(),
    1,
    12, 0, 0, 0
  );

  while (cursor <= end) {
    months.push(new Date(cursor));
    cursor = addMonthsLocal(cursor, 1);
  }

  return months;
}

function buildMonthlyFlowSeries(transactions, monthDates) {
  const labels = monthDates.map((d) => monthLabel(d.getFullYear(), d.getMonth()));
  const incomeSeries = new Array(monthDates.length).fill(0);
  const expenseSeries = new Array(monthDates.length).fill(0);
  const monthIndexByKey = new Map();

  monthDates.forEach((d, index) => {
    monthIndexByKey.set(monthKey(d.getFullYear(), d.getMonth()), index);
  });

  transactions.forEach((tx) => {
    if (!tx.date) return;
    const key = monthKey(tx.date.getFullYear(), tx.date.getMonth());
    const index = monthIndexByKey.get(key);
    if (index === undefined) return;

    if (tx.type === "income") incomeSeries[index] += tx.value;
    if (tx.type === "expense") expenseSeries[index] += tx.value;
  });

  return { labels, incomeSeries, expenseSeries };
}

function buildSingleMonthTotalSeries(transactions, year, monthIndex0) {
  let income = 0;
  let expense = 0;

  transactions.forEach((tx) => {
    if (!tx.date) return;
    if (tx.date.getFullYear() !== year || tx.date.getMonth() !== monthIndex0) return;
    if (tx.type === "income") income += tx.value;
    if (tx.type === "expense") expense += tx.value;
  });

  return {
    labels: [monthLabel(year, monthIndex0)],
    incomeSeries: [income],
    expenseSeries: [expense],
  };
}

function normalizeTransactionsForFlow(transactions = []) {
 return (Array.isArray(transactions) ? transactions : [])
    .map((tx) => {
      const date = toValidDate(tx?.date || tx?.createdAt);
      const value = Number(tx?.value || 0);
      const type = String(tx?.type || "").trim().toLowerCase();
      return { date, value, type };
    })
    .filter((tx) => tx.date && (tx.type === "income" || tx.type === "expense"))
    .sort((a, b) => a.date - b.date);
}

function resolveFlowReferenceDate(referenceDate = null) {
  if (referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())) {
    return new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      1,
      12, 0, 0, 0
    );
  }

  if (
    __dashboardFlowReferenceDate instanceof Date &&
    !Number.isNaN(__dashboardFlowReferenceDate.getTime())
  ) {
    return new Date(
      __dashboardFlowReferenceDate.getFullYear(),
      __dashboardFlowReferenceDate.getMonth(),
      1,
      12, 0, 0, 0
    );
  }

  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0);
}

function buildIncomeExpenseFlowData(
  transactions = [],
  flowRange = "last_6_months",
  referenceDate = null
) {
  const list = normalizeTransactionsForFlow(transactions);
  if (!list.length) {
 return { labels: [], incomeSeries: [], expenseSeries: [] };
  }

  const reference = resolveFlowReferenceDate(referenceDate);
  const range = normalizeIncomeExpenseFlowRange(flowRange);

  if (range === "last_3_months" || range === "last_6_months") {
 const monthsCount = range === "last_3_months" ? 3 : 6;
    const end = new Date(
      reference.getFullYear(),
      reference.getMonth(),
      1,
      12, 0, 0, 0
    );
    const start = addMonthsLocal(end, -(monthsCount - 1));
    const monthDates = buildMonthRange(start, end);
    return buildMonthlyFlowSeries(list, monthDates);
  }

  if (range === "all_period") {
    const first = list[0].date;
    const start = new Date(first.getFullYear(), first.getMonth(), 1, 12, 0, 0, 0);
    const end = new Date(
      reference.getFullYear(),
      reference.getMonth(),
      1,
      12, 0, 0, 0
    );
    const safeStart = start <= end ? start : end;
    const monthDates = buildMonthRange(safeStart, end);
    return buildMonthlyFlowSeries(list, monthDates);
  }

  if (range === "current_month") {
    return buildSingleMonthTotalSeries(
      list,
      reference.getFullYear(),
      reference.getMonth()
    );
  }

 return { labels: [], incomeSeries: [], expenseSeries: [] };
}

function renderIncomeExpenseChart(transactions = [], options = {}) {
  const canvasId = "incomeExpenseChart";
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const referenceDate =
    options?.referenceDate instanceof Date
      ? options.referenceDate
      : toFlowReferenceDate(options?.month, options?.year);

  const rangeSelect = document.getElementById("incomeExpenseFlowRange");
  const selectedRange = normalizeIncomeExpenseFlowRange(
    rangeSelect?.value || getIncomeExpenseFlowRange()
  );
  if (rangeSelect) rangeSelect.value = selectedRange;

  const { labels, incomeSeries, expenseSeries } = buildIncomeExpenseFlowData(
    transactions,
    selectedRange,
    referenceDate
  );

  if (incomeExpenseChart) incomeExpenseChart.destroy();

  const total = [...incomeSeries, ...expenseSeries].reduce((acc, value) => acc + Number(value || 0), 0);
  if (!labels.length || total <= 0) {
    renderEmptyMessage(canvasId, "Sem fluxo para o per\u00edodo selecionado");
    syncChartExpanders();
    return;
  }

  incomeExpenseChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Receitas",
          data: incomeSeries,
          backgroundColor: "rgba(34, 197, 94, 0.78)",
          borderColor: "#22c55e",
          borderWidth: 1,
          borderRadius: 6,
        },
        {
          label: "Despesas",
          data: expenseSeries,
          backgroundColor: "rgba(239, 68, 68, 0.78)",
          borderColor: "#ef4444",
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true },
        },
        tooltip: {
          callbacks: {
            label(context) {
 return `${context.dataset.label}: ${formatBRL(context.parsed.y || 0)}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#adb5bd",
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 10,
          },
          grid: { display: false },
        },
        y: {
          ticks: {
            color: "#adb5bd",
 callback: (value) => formatBRL(value),
          },
          grid: { color: "rgba(255,255,255,0.06)" },
        },
      },
    },
  });

  syncChartExpanders();
}

/* ===============================
   DESPESAS POR CATEGORIA (4 tipos)
================================ */

// cores fixas e consistentes por categoria
function colorForLabel(label) {
  const s = String(label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  // defaults bem reconheciveis
  if (s.includes("aliment")) return "#f59e0b"; // amarelo/laranja
  if (s.includes("mercad")) return "#f59e0b";
  if (s.includes("transp") || s.includes("combust")) return "#3b82f6"; // azul
  if (s.includes("morad") || s.includes("alug")) return "#8b5cf6"; // roxo
  if (s.includes("saud") || s.includes("farm")) return "#22c55e"; // verde
  if (s.includes("lazer")) return "#ec4899"; // rosa
  if (s.includes("educ")) return "#06b6d4"; // ciano
  // fallback deterministico por hash (categoria sempre com a mesma cor)
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
    syncChartExpanders();
    return;
  }

  const typeSelect = document.getElementById("expenseCategoryChartType");
  const selectedType = (typeSelect?.value || getExpenseChartType());

  const isLightTheme = document.documentElement.getAttribute("data-bs-theme") === "light";
  const axisTickColor = isLightTheme ? "#475569" : "#adb5bd";
  const axisGridColor = isLightTheme ? "rgba(148, 163, 184, 0.28)" : "rgba(255,255,255,0.06)";
  const legendLabelColor = isLightTheme ? "#334155" : "#cbd5e1";
  const tooltipBackground = isLightTheme ? "rgba(248, 250, 252, 0.98)" : "rgba(15, 23, 42, 0.94)";
  const tooltipBorderColor = isLightTheme ? "rgba(148, 163, 184, 0.35)" : "rgba(148, 163, 184, 0.3)";
  const tooltipTitleColor = isLightTheme ? "#0f172a" : "#f8fafc";
  const tooltipBodyColor = isLightTheme ? "#1e293b" : "#e2e8f0";

  const colors = labels.map(colorForLabel);
  const lineColor = isLightTheme ? "#475569" : "#e2e8f0";
  const fillColor = isLightTheme ? "rgba(71, 85, 105, 0.16)" : "rgba(148, 163, 184, 0.2)";

  const dataset = {
    label: "Despesas",
    data: values,
  };

  if (selectedType === "line") {
    dataset.backgroundColor = fillColor;
    dataset.borderColor = lineColor;
    dataset.borderWidth = 2.2;
    dataset.fill = true;
    dataset.tension = 0.35;
    dataset.pointRadius = 3;
    dataset.pointHoverRadius = 5;
    dataset.pointBorderWidth = 1;
    dataset.pointBackgroundColor = colors;
    dataset.pointBorderColor = isLightTheme ? "#f8fafc" : "#0f172a";
  } else if (selectedType === "bar") {
    dataset.backgroundColor = colors;
    dataset.borderColor = colors;
    dataset.borderWidth = 1;
    dataset.borderRadius = 10;
    dataset.borderSkipped = false;
    dataset.categoryPercentage = 0.72;
    dataset.barPercentage = 0.86;
    dataset.maxBarThickness = 18;
  } else {
    dataset.backgroundColor = colors;
    dataset.borderColor = isLightTheme ? "rgba(241, 245, 249, 0.95)" : "rgba(15, 23, 42, 0.88)";
    dataset.borderWidth = 2;
    if (selectedType === "doughnut") {
      dataset.hoverOffset = 8;
    }
  }

  // Config base
  const config = {
    type: selectedType,
    data: {
      labels,
      datasets: [dataset],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
 display: selectedType === "pie" || selectedType === "doughnut",
          position: "bottom",
          labels: {
            usePointStyle: true,
            boxWidth: 10,
            boxHeight: 10,
            color: legendLabelColor,
          },
        },
        tooltip: {
          ...expenseTooltipCallbacks(labels, values, total),
          backgroundColor: tooltipBackground,
          borderColor: tooltipBorderColor,
          borderWidth: 1,
          titleColor: tooltipTitleColor,
          bodyColor: tooltipBodyColor,
          padding: 10,
        },
      },
// eixos so quando faz sentido
scales:
  selectedType === "bar"
    ? {
        x: {
          type: "linear",
          ticks: {
            color: axisTickColor,
            callback: (v) => formatBRL(v),
          },
          grid: { color: axisGridColor },
        },
        y: {
          type: "category",
          ticks: {
            color: axisTickColor,
            // garante que o tick vira label (categoria) e nao numero
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
            ticks: { color: axisTickColor },
            grid: { display: false },
          },
          y: {
            type: "linear",
            ticks: {
              color: axisTickColor,
 callback: (v) => formatBRL(v),
            },
            grid: { color: axisGridColor },
          },
        }
      : {},
    },
  };

 // Ajustes especificos para barras: horizontal (ranking mais legivel)
  if (selectedType === "bar") {
    config.options.indexAxis = "y";
    config.options.plugins.legend.display = false;
  }

  // Ajustes pra pizza/rosca: melhorar legibilidade
  if (selectedType === "pie" || selectedType === "doughnut") {
    config.options.plugins.legend.display = true;
    if (selectedType === "doughnut") config.options.cutout = "62%";
  }

  expenseCategoryChart = new Chart(ctx, config);
  syncChartExpanders();
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

function initIncomeExpenseFlowRangePicker() {
  const sel = document.getElementById("incomeExpenseFlowRange");
  if (!sel || sel.__bound) return;
  sel.__bound = true;

  const defaultRange = "current_month";
  sel.value = defaultRange;
  setIncomeExpenseFlowRange(defaultRange);

  sel.addEventListener("change", () => {
    const range = normalizeIncomeExpenseFlowRange(sel.value);
    sel.value = range;
    setIncomeExpenseFlowRange(range);
    renderIncomeExpenseChart(__dashboardAllTransactions, {
      referenceDate: __dashboardFlowReferenceDate,
    });
  });
}

/* ===============================
   Inicializacao
================================ */
document.addEventListener("DOMContentLoaded", () => {
  initIncomeExpenseFlowRangePicker();
  initExpenseCategoryChartTypePicker();
});

window.setDashboardTransactions = setDashboardTransactions;
window.setDashboardAllTransactions = setDashboardAllTransactions;
window.setDashboardFlowReference = setDashboardFlowReference;
window.renderIncomeExpenseChart = renderIncomeExpenseChart;
window.renderExpenseCategoryChart = renderExpenseCategoryChart;

