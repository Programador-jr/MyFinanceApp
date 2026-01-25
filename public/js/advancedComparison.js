// public/js/advancedComparison.js

let advancedChart;
let timelineChart;

let __compareInFlight = false;

/* ===============================
   Utils
================================ */
function formatBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function dateFromInputUTC(yyyy_mm_dd, endOfDay = false) {
  const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
  if (!endOfDay) return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
}

function monthRangeUTC(year, monthIndex0) {
  const start = new Date(Date.UTC(year, monthIndex0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex0 + 1, 0, 23, 59, 59, 999)); // dia 0 do próximo mês
  return { start, end };
}

function previousMonthRangeUTC(year, monthIndex0) {
  const prevMonth = monthIndex0 - 1;
  if (prevMonth >= 0) return monthRangeUTC(year, prevMonth);
  return monthRangeUTC(year - 1, 11);
}

function yearRangeUTC(year) {
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  return { start, end };
}

function previousYearRangeUTC(year) {
  return yearRangeUTC(year - 1);
}

function previousPeriodSameLengthUTC(startA, endA) {
  const diffMs = endA.getTime() - startA.getTime();
  const endB = new Date(startA.getTime() - 1);
  const startB = new Date(endB.getTime() - diffMs);
  return { start: startB, end: endB, diffMs };
}

function getMetricLabel(metric) {
  if (metric === "income") return "Entradas";
  if (metric === "expense") return "Saídas";
  return "Saldo";
}

// Cores consistentes por categoria
function colorForLabel(label) {
  const s = String(label || "").toLowerCase().trim();

  if (s.includes("aliment") || s.includes("mercad")) return "#f59e0b";
  if (s.includes("transp") || s.includes("combust")) return "#3b82f6";
  if (s.includes("morad") || s.includes("alug")) return "#8b5cf6";
  if (s.includes("saúd") || s.includes("farm")) return "#22c55e";
  if (s.includes("lazer")) return "#ec4899";
  if (s.includes("educ")) return "#06b6d4";

  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue} 70% 55%)`;
}

/* ===============================
   UI: compare mode
   - Só controla o bloco Custom (B)
================================ */
function bindCompareModeUI() {
  const mode = document.getElementById("compareMode");
  const monthBlock = document.getElementById("monthPickerBlock");
  const yearBlock = document.getElementById("yearPickerBlock");

  if (!mode) return;

  const sync = () => {
    const v = mode.value;
    if (monthBlock) monthBlock.classList.toggle("d-none", v !== "month");
    if (yearBlock) yearBlock.classList.toggle("d-none", v !== "year");
  };

  if (!mode.__bound) {
    mode.__bound = true;
    mode.addEventListener("change", sync);
  }

  sync();
}



/* ===============================
   Pega mês/ano do dashboard (ou fallback no "agora")
   - #year geralmente é "2026"
   - #month pode ser:
     - 0..11 (recomendado), OU
     - 1..12, OU
     - string; nesse caso faz fallback pro mês atual
================================ */
function getMonthYearFromDashboardOrNow() {
  const monthEl = document.getElementById("month");
  const yearEl = document.getElementById("year");
  const now = new Date();

  const year = yearEl?.value ? Number(yearEl.value) : now.getFullYear();

  let rawMonth;
  if (monthEl?.value !== undefined && monthEl?.value !== "") rawMonth = Number(monthEl.value);

  // Se não for número válido, cai no mês atual (0..11)
  if (!Number.isFinite(rawMonth)) {
    return { year, monthIndex0: now.getMonth() };
  }

  // Normaliza:
  // - se vier 1..12 => vira 0..11
  // - se vier 0..11 => mantém
  // - qualquer coisa > 11 => tenta tratar como 1..12
  const monthIndex0 = rawMonth > 11 ? rawMonth - 1 : rawMonth;

  // Clamp final
  const safeMonth = Math.min(11, Math.max(0, monthIndex0));
  return { year, monthIndex0: safeMonth };
}

/* ===============================
   Build ranges (A/B)
   Agora:
   - previous_month => usa month/year do dashboard (sem datas)
   - previous_year  => usa year do dashboard (sem datas)
   - previous_period => usa startDate/endDate
   - custom => usa startDate/endDate e startDateB/endDateB
================================ */
function buildRangesFromUI() {
  const mode = document.getElementById("compareMode")?.value || "month";

  // MÊS atual vs mês anterior (mês fechado)
  if (mode === "month") {
    const monthRef = document.getElementById("monthRef")?.value; // YYYY-MM
    if (!monthRef) return null;

    const [y, mm] = monthRef.split("-").map(Number);
    if (!y || !mm) return null;

    const a = monthRangeUTC(y, mm - 1);
    const b = previousMonthRangeUTC(y, mm - 1);

    const diffMs = a.end.getTime() - a.start.getTime();
    return { startA: a.start, endA: a.end, startB: b.start, endB: b.end, diffMs, compareMode: "previous_month" };
  }

  // ANO atual vs ano anterior (ano fechado)
  if (mode === "year") {
    const y = Number(document.getElementById("yearRef")?.value);
    if (!y) return null;

    const a = yearRangeUTC(y);
    const b = previousYearRangeUTC(y);

    const diffMs = a.end.getTime() - a.start.getTime();
    return { startA: a.start, endA: a.end, startB: b.start, endB: b.end, diffMs, compareMode: "previous_year" };
  }

  return null;
}



/* ===============================
   Entry
================================ */
async function loadAdvancedComparison() {
  if (__compareInFlight) return;
  __compareInFlight = true;

  const metric = document.getElementById("metricType")?.value || "expense";
  const view = document.getElementById("advancedView")?.value || "category";

  const compareBtn = document.getElementById("compareBtn");
  const originalHtml = compareBtn ? compareBtn.innerHTML : "";

  function setCompareLoading(isLoading) {
    if (!compareBtn) return;
    compareBtn.disabled = isLoading;
    compareBtn.innerHTML = isLoading ? "Comparando..." : originalHtml;
  }

  setCompareLoading(true);

  try {
    const ranges = buildRangesFromUI();
    if (!ranges) {
      showAlert("Selecione um período válido (e no modo Custom, preencha o período B).", "warning", "triangle-exclamation");
      return;
    }

    const { startA, endA, startB, endB, diffMs, compareMode } = ranges;

    const current = await apiFetch(
      `/transactions/range?start=${startA.toISOString()}&end=${endA.toISOString()}`
    );

    const previous = await apiFetch(
      `/transactions/range?start=${startB.toISOString()}&end=${endB.toISOString()}`
    );

    const currTx = current.transactions || [];
    const prevTx = previous.transactions || [];

    // Por categoria (total do período A vs total do período B)
    const currentGrouped = groupByCategory(currTx, metric);
    const previousGrouped = groupByCategory(prevTx, metric);
    const comparison = compareCategories(currentGrouped, previousGrouped);

    renderAdvancedChart(comparison, metric);
    renderRanking(comparison, metric);
    renderTable(comparison);
    renderBadge(currentGrouped, previousGrouped, metric);
    renderPeriodAlerts(comparison, metric, diffMs, compareMode);

    // Timeline só no modo "daily"
    if (view === "daily") {
      renderTimeline(currTx, prevTx, metric, startA, endA, startB, endB, compareMode);
    } else {
      if (timelineChart) timelineChart.destroy();
      renderEmptyMessage("timelineChart", "Selecione 'Dia a dia (linha)' para ver a linha");
    }
  } catch (err) {
    console.error(err);
    showAlert("Erro ao comparar períodos", "danger", "triangle-exclamation");
  } finally {
    setCompareLoading(false);
    __compareInFlight = false;
  }
}

/* ===============================
   Aggregations
================================ */
function groupByCategory(transactions, metric) {
  const result = {};

  transactions.forEach((t) => {
    const cat = (t.category || "").trim();
    if (!cat) return;

    if (!result[cat]) result[cat] = 0;

    if (metric === "income" && t.type === "income") result[cat] += Number(t.value || 0);
    if (metric === "expense" && t.type === "expense") result[cat] += Number(t.value || 0);

    if (metric === "balance") {
      result[cat] += t.type === "income" ? Number(t.value || 0) : -Number(t.value || 0);
    }
  });

  return result;
}

function compareCategories(current, previous) {
  const categories = new Set([...Object.keys(current), ...Object.keys(previous)]);

  const rows = [];
  categories.forEach((category) => {
    const curr = Number(current[category] || 0);
    const prev = Number(previous[category] || 0);

    if (curr === 0 && prev === 0) return;

    const diff = curr - prev;

    let percent = 0;
    if (prev === 0 && curr > 0) percent = 100;
    else if (prev > 0 && curr === 0) percent = -100;
    else if (prev !== 0) percent = (diff / prev) * 100;

    rows.push({ category, current: curr, previous: prev, diff, percent });
  });

  rows.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  return rows;
}

/* ===============================
   Chart: categorias
================================ */
function renderAdvancedChart(comparison, metric) {
  const canvasId = "advancedComparisonChart";
  const ctx = document.getElementById(canvasId);

  if (advancedChart) advancedChart.destroy();

  if (!comparison.length || !ctx) {
    renderEmptyMessage(canvasId);
    return;
  }

  const top = comparison.slice(0, 10);
  const labels = top.map((c) => c.category);
  const curr = top.map((c) => c.current);
  const prev = top.map((c) => c.previous);

  const title = getMetricLabel(metric);
  const perCategoryColors = labels.map(colorForLabel);

  advancedChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: `${title} (período A)`, data: curr, backgroundColor: perCategoryColors },
        { label: `${title} (período B)`, data: prev, backgroundColor: "rgba(148, 163, 184, 0.35)" },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        legend: { position: "bottom", labels: { usePointStyle: true } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatBRL(ctx.parsed.x)}` } },
      },
      scales: {
        x: { ticks: { color: "#adb5bd", callback: (v) => formatBRL(v) } },
        y: { ticks: { color: "#adb5bd" } },
      },
    },
  });
}

/* ===============================
   Timeline helpers (UTC)
================================ */
function dayKeyUTC(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function monthKeyUTC(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

function buildDayLabels31() {
  return Array.from({ length: 31 }, (_, i) => `Dia ${i + 1}`);
}

function buildMonthLabels12() {
  return ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
}

function groupByDayUTC(transactions, metric) {
  const grouped = {};

  transactions.forEach((t) => {
    if (metric === "income" && t.type !== "income") return;
    if (metric === "expense" && t.type !== "expense") return;

    const k = dayKeyUTC(t.date);
    if (!grouped[k]) grouped[k] = 0;

    if (metric === "balance") grouped[k] += t.type === "income" ? Number(t.value || 0) : -Number(t.value || 0);
    else grouped[k] += Number(t.value || 0);
  });

  return grouped;
}

function groupByMonthUTC(transactions, metric) {
  const grouped = {};

  transactions.forEach((t) => {
    if (metric === "income" && t.type !== "income") return;
    if (metric === "expense" && t.type !== "expense") return;

    const k = monthKeyUTC(t.date);
    if (!grouped[k]) grouped[k] = 0;

    if (metric === "balance") grouped[k] += t.type === "income" ? Number(t.value || 0) : -Number(t.value || 0);
    else grouped[k] += Number(t.value || 0);
  });

  return grouped;
}

function renderTimeline(currTx, prevTx, metric, startA, endA, startB, endB, compareMode) {
  const canvasId = "timelineChart";
  const ctx = document.getElementById(canvasId);

  if (!ctx) return;
  if (timelineChart) timelineChart.destroy();

  const title = getMetricLabel(metric);

  if (!currTx.length && !prevTx.length) {
    renderEmptyMessage(canvasId, "Sem dados para a linha do tempo");
    return;
  }

  // previous_month => dia do mês (1..31)
  if (compareMode === "previous_month") {
    const currByDay = groupByDayUTC(currTx, metric);
    const prevByDay = groupByDayUTC(prevTx, metric);

    const labels = buildDayLabels31();

    const aYear = startA.getUTCFullYear();
    const aMonth = startA.getUTCMonth();
    const bYear = startB.getUTCFullYear();
    const bMonth = startB.getUTCMonth();

    const currValues = Array.from({ length: 31 }, (_, i) => {
      const day = i + 1;
      const key = `${aYear}-${pad2(aMonth + 1)}-${pad2(day)}`;
      return currByDay[key] || 0;
    });

    const prevValues = Array.from({ length: 31 }, (_, i) => {
      const day = i + 1;
      const key = `${bYear}-${pad2(bMonth + 1)}-${pad2(day)}`;
      return prevByDay[key] || 0;
    });

    timelineChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: `${title} (mês atual)`,
            data: currValues,
            borderColor: "#0d6efd",
            backgroundColor: "rgba(13,110,253,0.10)",
            fill: true,
            tension: 0.25,
            pointRadius: 2,
          },
          {
            label: `${title} (mês anterior)`,
            data: prevValues,
            borderColor: "#94a3b8",
            backgroundColor: "rgba(148,163,184,0.10)",
            fill: true,
            tension: 0.25,
            pointRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true } },
          tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${formatBRL(c.parsed.y)}` } },
        },
        scales: {
          x: { ticks: { color: "#adb5bd" }, grid: { display: false } },
          y: { ticks: { color: "#adb5bd", callback: (v) => formatBRL(v) }, grid: { color: "rgba(255,255,255,0.06)" } },
        },
      },
    });

    return;
  }

  // previous_year => mês do ano (Jan..Dez)
  if (compareMode === "previous_year") {
    const currByMonth = groupByMonthUTC(currTx, metric);
    const prevByMonth = groupByMonthUTC(prevTx, metric);

    const labels = buildMonthLabels12();

    const aYear = startA.getUTCFullYear();
    const bYear = startB.getUTCFullYear();

    const currValues = Array.from({ length: 12 }, (_, i) => {
      const key = `${aYear}-${pad2(i + 1)}`;
      return currByMonth[key] || 0;
    });

    const prevValues = Array.from({ length: 12 }, (_, i) => {
      const key = `${bYear}-${pad2(i + 1)}`;
      return prevByMonth[key] || 0;
    });

    timelineChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: `${title} (ano atual)`,
            data: currValues,
            borderColor: "#0d6efd",
            backgroundColor: "rgba(13,110,253,0.10)",
            fill: true,
            tension: 0.25,
            pointRadius: 2,
          },
          {
            label: `${title} (ano anterior)`,
            data: prevValues,
            borderColor: "#94a3b8",
            backgroundColor: "rgba(148,163,184,0.10)",
            fill: true,
            tension: 0.25,
            pointRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true } },
          tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${formatBRL(c.parsed.y)}` } },
        },
        scales: {
          x: { ticks: { color: "#adb5bd" }, grid: { display: false } },
          y: { ticks: { color: "#adb5bd", callback: (v) => formatBRL(v) }, grid: { color: "rgba(255,255,255,0.06)" } },
        },
      },
    });

    return;
  }

  // previous_period / custom => dia 1..N (índice do range)
  {
    const currByDay = groupByDayUTC(currTx, metric);
    const prevByDay = groupByDayUTC(prevTx, metric);

    const daysA = [];
    const daysB = [];

    let dA = new Date(Date.UTC(startA.getUTCFullYear(), startA.getUTCMonth(), startA.getUTCDate(), 0, 0, 0, 0));
    let dB = new Date(Date.UTC(startB.getUTCFullYear(), startB.getUTCMonth(), startB.getUTCDate(), 0, 0, 0, 0));

    const endDayA = new Date(Date.UTC(endA.getUTCFullYear(), endA.getUTCMonth(), endA.getUTCDate(), 0, 0, 0, 0));
    const endDayB = new Date(Date.UTC(endB.getUTCFullYear(), endB.getUTCMonth(), endB.getUTCDate(), 0, 0, 0, 0));

    while (dA <= endDayA) {
      daysA.push(`${dA.getUTCFullYear()}-${pad2(dA.getUTCMonth() + 1)}-${pad2(dA.getUTCDate())}`);
      dA.setUTCDate(dA.getUTCDate() + 1);
    }

    while (dB <= endDayB) {
      daysB.push(`${dB.getUTCFullYear()}-${pad2(dB.getUTCMonth() + 1)}-${pad2(dB.getUTCDate())}`);
      dB.setUTCDate(dB.getUTCDate() + 1);
    }

    const n = Math.min(daysA.length, daysB.length);
    const labels = Array.from({ length: n }, (_, i) => `Dia ${i + 1}`);

    const currValues = Array.from({ length: n }, (_, i) => currByDay[daysA[i]] || 0);
    const prevValues = Array.from({ length: n }, (_, i) => prevByDay[daysB[i]] || 0);

    timelineChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: `${title} (período A)`,
            data: currValues,
            borderColor: "#0d6efd",
            backgroundColor: "rgba(13,110,253,0.10)",
            fill: true,
            tension: 0.25,
            pointRadius: 2,
          },
          {
            label: `${title} (período B)`,
            data: prevValues,
            borderColor: "#94a3b8",
            backgroundColor: "rgba(148,163,184,0.10)",
            fill: true,
            tension: 0.25,
            pointRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true } },
          tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${formatBRL(c.parsed.y)}` } },
        },
        scales: {
          x: { ticks: { color: "#adb5bd" }, grid: { display: false } },
          y: { ticks: { color: "#adb5bd", callback: (v) => formatBRL(v) }, grid: { color: "rgba(255,255,255,0.06)" } },
        },
      },
    });
  }
}

/* ===============================
   Ranking / Table / Badge / Alerts
================================ */
function renderRanking(comparison, metric) {
  const topUp = document.getElementById("topUp");
  const topDown = document.getElementById("topDown");
  if (!topUp || !topDown) return;

  topUp.innerHTML = "";
  topDown.innerHTML = "";

  if (!comparison.length) {
    topUp.innerHTML = `<li class="list-group-item text-muted">Sem dados</li>`;
    topDown.innerHTML = `<li class="list-group-item text-muted">Sem dados</li>`;
    return;
  }

  const ups = comparison.filter((c) => c.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 5);
  const downs = comparison.filter((c) => c.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 5);

  const upClass = metric === "expense" ? "text-danger" : "text-success";
  const downClass = metric === "expense" ? "text-success" : "text-danger";

  if (!ups.length) topUp.innerHTML = `<li class="list-group-item text-muted">Sem altas</li>`;
  ups.forEach((c) => {
    topUp.innerHTML += `
      <li class="list-group-item ${upClass}">
        ↑ ${c.category}: ${formatBRL(c.diff)} (${Math.abs(c.percent).toFixed(1)}%)
      </li>`;
  });

  if (!downs.length) topDown.innerHTML = `<li class="list-group-item text-muted">Sem quedas</li>`;
  downs.forEach((c) => {
    topDown.innerHTML += `
      <li class="list-group-item ${downClass}">
        ↓ ${c.category}: ${formatBRL(Math.abs(c.diff))} (${Math.abs(c.percent).toFixed(1)}%)
      </li>`;
  });
}

function renderTable(comparison) {
  const table = document.getElementById("comparisonTable");
  if (!table) return;

  table.innerHTML = "";

  if (!comparison.length) {
    table.innerHTML = `
      <tr>
        <td colspan="3" class="text-center text-muted">Sem dados</td>
      </tr>`;
    return;
  }

  const rows = [...comparison].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  rows.forEach((c) => {
    const up = c.percent >= 0;
    const color = up ? "text-success" : "text-danger";
    const arrow = up ? "↑" : "↓";

    table.innerHTML += `
      <tr>
        <td>${c.category}</td>
        <td>
          <div class="small text-muted">B: ${formatBRL(c.previous)}</div>
          <div><strong>A:</strong> ${formatBRL(c.current)}</div>
        </td>
        <td class="${color}">
          ${arrow} ${formatBRL(Math.abs(c.diff))}<br/>
          <span class="small">${Math.abs(c.percent).toFixed(1)}%</span>
        </td>
      </tr>`;
  });
}

function setDefaultMonthYear() {
  const now = new Date();

  const monthRef = document.getElementById("monthRef");
  const yearRef = document.getElementById("yearRef");

  if (monthRef && !monthRef.value) {
    monthRef.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  if (yearRef && !yearRef.value) {
    yearRef.value = String(now.getFullYear());
  }
}


function renderBadge(current, previous, metric) {
  const badge = document.getElementById("comparisonBadge");
  if (!badge) return;

  const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

  const curr = sum(current);
  const prev = sum(previous);

  if (!prev) {
    badge.innerHTML = `<span class="badge bg-secondary">Sem comparação</span>`;
    return;
  }

  const diff = curr - prev;
  const percent = ((diff / prev) * 100).toFixed(1);
  const up = diff >= 0;

  const color =
    metric === "expense"
      ? (up ? "danger" : "success")
      : (up ? "success" : "danger");

  badge.innerHTML = `
    <span class="badge bg-${color}">
      ${up ? "↑" : "↓"} ${Math.abs(percent)}% (A vs B)
    </span>`;
}

function renderPeriodAlerts(comparison, metric, diffMs, compareMode) {
  const alerts = document.getElementById("alerts");
  if (!alerts) return;

  alerts.innerHTML = "";

  if (!comparison.length) {
    alerts.innerHTML = `<div class="alert alert-secondary">Nenhuma variação detectada.</div>`;
    return;
  }

  const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  const label =
    compareMode === "previous_month" ? "relação ao mês anterior" :
    compareMode === "previous_year" ? "relação ao ano anterior" :
    (days <= 7 ? "período B (semana)" : "período B");

  const withPrev = comparison.filter((c) => c.previous > 0);
  withPrev.sort((a, b) => Math.abs(b.percent) - Math.abs(a.percent));
  const top = withPrev.slice(0, 3);

  top.forEach((c) => {
    const up = c.diff > 0;
    const pct = Math.abs(c.percent).toFixed(1);

    const isBadForExpense = metric === "expense" && up;
    const isGoodForIncome = metric === "income" && up;

    const cls =
      isBadForExpense ? "alert-danger" :
      isGoodForIncome ? "alert-success" :
      "alert-warning";

    const verb =
      metric === "expense"
        ? (up ? "teve um aumento de" : "teve uma redução de")
        : (up ? "teve um aumento de" : "teve uma redução de");

    alerts.innerHTML += `
      <div class="alert ${cls}">
        <strong>${c.category}</strong>: ${verb} ${pct}% em ${label}.
        <div class="small text-muted">Diferença: ${formatBRL(c.diff)}</div>
      </div>`;
  });

  if (!alerts.innerHTML) {
    alerts.innerHTML = `<div class="alert alert-secondary">Nenhuma variação relevante detectada.</div>`;
  }
}

/* ===============================
   Bind
================================ */
document.addEventListener("DOMContentLoaded", () => {
  setDefaultMonthYear(); // mantém
  bindCompareModeUI();

  const btn = document.getElementById("compareBtn");
  if (!btn || btn.__bound) return;
  btn.__bound = true;

  btn.addEventListener("click", (e) => {
    e.preventDefault?.();
    loadAdvancedComparison();
  });
});