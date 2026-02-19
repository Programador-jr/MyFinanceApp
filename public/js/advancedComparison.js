let advancedChart;
let timelineChart;

let __compareInFlight = false;

function setAdvancedResultsVisible(visible) {
  const results = document.getElementById("advancedResults");
  if (!results) return;
  results.classList.toggle("d-none", !visible);
}

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

function monthRangeLocal(year, monthIndex0) {
  const start = new Date(year, monthIndex0, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex0 + 1, 0, 23, 59, 59, 999); // dia 0 do próximo mês
  return { start, end };
}

function previousMonthRangeLocal(year, monthIndex0) {
  const prevMonth = monthIndex0 - 1;
  if (prevMonth >= 0) return monthRangeLocal(year, prevMonth);
  return monthRangeLocal(year - 1, 11);
}

function yearRangeLocal(year) {
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  return { start, end };
}

function previousYearRangeLocal(year) {
  return yearRangeLocal(year - 1);
}

function getMetricLabel(metric) {
  if (metric === "income") return "Entradas";
  if (metric === "expense") return "Saídas";
  return "Saldo";
}

function escapeHtmlText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sumObjectValues(obj) {
  return Object.values(obj || {}).reduce((acc, value) => acc + Number(value || 0), 0);
}

function getTrendSemantic(metric, diff) {
  const value = Number(diff || 0);
  if (Math.abs(value) < 0.005) return "neutral";
  if (metric === "expense") return value > 0 ? "bad" : "good";
  return value > 0 ? "good" : "bad";
}

function getTrendClass(metric, diff) {
  const semantic = getTrendSemantic(metric, diff);
  if (semantic === "good") return "is-good";
  if (semantic === "bad") return "is-bad";
  return "is-neutral";
}

function formatSignedPercent(value) {
  const numeric = Number(value || 0);
  const sign = numeric > 0 ? "+" : numeric < 0 ? "-" : "";
  return `${sign}${Math.abs(numeric).toFixed(1)}%`;
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

    const a = monthRangeLocal(y, mm - 1);
    const b = previousMonthRangeLocal(y, mm - 1);

    const diffMs = a.end.getTime() - a.start.getTime();
    return { startA: a.start, endA: a.end, startB: b.start, endB: b.end, diffMs, compareMode: "previous_month" };
  }

  // ANO atual vs ano passado (ano fechado)
  if (mode === "year") {
    const y = Number(document.getElementById("yearRef")?.value);
    if (!y) return null;

    const a = yearRangeLocal(y);
    const b = previousYearRangeLocal(y);

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
      showAlert("Selecione um período válido para comparar.", "warning", "triangle-exclamation");
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

    // Por categoria (total do período atual vs período passado)
    const currentGrouped = groupByCategory(currTx, metric);
    const previousGrouped = groupByCategory(prevTx, metric);
    const comparison = compareCategories(currentGrouped, previousGrouped);

    setAdvancedResultsVisible(true);
    updateComparisonTableHeader(compareMode);

    renderAdvancedSummary(currentGrouped, previousGrouped, comparison, metric, compareMode);
    renderAdvancedChart(comparison, metric, compareMode);
    renderRanking(comparison, metric, compareMode);
    renderTable(comparison, metric, compareMode);
    renderBadge(currentGrouped, previousGrouped, metric, compareMode);
    renderPeriodAlerts(comparison, metric, diffMs, compareMode);

    // Sempre renderiza os dois blocos: categoria + linha do tempo.
    renderTimeline(currTx, prevTx, metric, startA, endA, startB, endB, compareMode);
  } catch (err) {
    console.error(err);
    showAlert("Erro ao comparar períodos", "danger", "triangle-exclamation");
  } finally {
    if (typeof window.updateChartExpandersAvailability === "function") {
      window.updateChartExpandersAvailability();
    }
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
function renderAdvancedChart(comparison, metric, compareMode) {
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
  const comparisonContext = getComparisonContext(compareMode);
  const perCategoryColors = labels.map(colorForLabel);
  const isLightTheme = document.documentElement.getAttribute("data-bs-theme") === "light";
  const axisTickColor = isLightTheme ? "#475569" : "#a8b2c5";
  const axisGridColor = isLightTheme ? "rgba(148, 163, 184, 0.32)" : "rgba(148, 163, 184, 0.2)";
  const tooltipBackground = isLightTheme ? "rgba(248, 250, 252, 0.98)" : "rgba(15, 23, 42, 0.94)";
  const tooltipBorderColor = isLightTheme ? "rgba(148, 163, 184, 0.35)" : "rgba(148, 163, 184, 0.3)";
  const tooltipTitleColor = isLightTheme ? "#0f172a" : "#f8fafc";
  const tooltipBodyColor = isLightTheme ? "#1e293b" : "#e2e8f0";

  advancedChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: `${title} (${comparisonContext.currentLabel.toLocaleLowerCase("pt-BR")})`,
          data: curr,
          backgroundColor: perCategoryColors,
          borderColor: perCategoryColors,
          borderWidth: 1,
          borderRadius: 10,
          borderSkipped: false,
          categoryPercentage: 0.72,
          barPercentage: 0.86,
          maxBarThickness: 18,
        },
        {
          label: `${title} (${comparisonContext.previousLabel.toLocaleLowerCase("pt-BR")})`,
          data: prev,
          backgroundColor: "rgba(148, 163, 184, 0.3)",
          borderColor: "rgba(148, 163, 184, 0.48)",
          borderWidth: 1,
          borderRadius: 10,
          borderSkipped: false,
          categoryPercentage: 0.72,
          barPercentage: 0.86,
          maxBarThickness: 18,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            color: axisTickColor,
            boxWidth: 10,
            boxHeight: 10,
          },
        },
        tooltip: {
          backgroundColor: tooltipBackground,
          borderColor: tooltipBorderColor,
          borderWidth: 1,
          titleColor: tooltipTitleColor,
          bodyColor: tooltipBodyColor,
          padding: 10,
          callbacks: {
            label: (itemCtx) => `${itemCtx.dataset.label}: ${formatBRL(itemCtx.parsed.x)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: axisGridColor },
          ticks: {
            color: axisTickColor,
            callback: (v) => formatBRL(v),
          },
        },
        y: {
          grid: { display: false },
          ticks: {
            color: axisTickColor,
          },
        },
      },
    },
  });
}

/* ===============================
   Timeline helpers (local)
================================ */
function dayKeyLocal(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function monthKeyLocal(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function buildDayLabels31() {
  return Array.from({ length: 31 }, (_, i) => `Dia ${i + 1}`);
}

function buildMonthLabels12() {
  return ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
}

function groupByDayLocal(transactions, metric) {
  const grouped = {};

  transactions.forEach((t) => {
    if (metric === "income" && t.type !== "income") return;
    if (metric === "expense" && t.type !== "expense") return;

    const k = dayKeyLocal(t.date);
    if (!grouped[k]) grouped[k] = 0;

    if (metric === "balance") grouped[k] += t.type === "income" ? Number(t.value || 0) : -Number(t.value || 0);
    else grouped[k] += Number(t.value || 0);
  });

  return grouped;
}

function groupByMonthLocal(transactions, metric) {
  const grouped = {};

  transactions.forEach((t) => {
    if (metric === "income" && t.type !== "income") return;
    if (metric === "expense" && t.type !== "expense") return;

    const k = monthKeyLocal(t.date);
    if (!grouped[k]) grouped[k] = 0;

    if (metric === "balance") grouped[k] += t.type === "income" ? Number(t.value || 0) : -Number(t.value || 0);
    else grouped[k] += Number(t.value || 0);
  });

  return grouped;
}

function formatIsoDateToBrShort(isoDate) {
  const raw = String(isoDate || "").trim();
  const parts = raw.split("-");
  if (parts.length !== 3) return raw || "-";
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getTimelinePalette(metric) {
  if (metric === "income") {
    return {
      currentLine: "#22c55e",
      currentFill: "rgba(34,197,94,0.16)",
      previousLine: "#94a3b8",
      previousFill: "rgba(148,163,184,0.08)"
    };
  }

  if (metric === "expense") {
    return {
      currentLine: "#ef4444",
      currentFill: "rgba(239,68,68,0.14)",
      previousLine: "#94a3b8",
      previousFill: "rgba(148,163,184,0.08)"
    };
  }

  return {
    currentLine: "#0d6efd",
    currentFill: "rgba(13,110,253,0.14)",
    previousLine: "#94a3b8",
    previousFill: "rgba(148,163,184,0.08)"
  };
}

function buildTimelineChart(ctx, config) {
  const {
    metric,
    labels,
    currentValues,
    previousValues,
    currentLabel,
    previousLabel,
    tooltipDetails,
  } = config;

  const palette = getTimelinePalette(metric);
  const denseSeries = labels.length > 24;
  const pointRadius = denseSeries ? 0 : 2;
  const pointHoverRadius = denseSeries ? 3 : 4;

  const totalCurrent = currentValues.reduce((sum, value) => sum + Number(value || 0), 0);
  const totalPrevious = previousValues.reduce((sum, value) => sum + Number(value || 0), 0);

  timelineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: `${currentLabel} (${formatBRL(totalCurrent)})`,
          data: currentValues,
          borderColor: palette.currentLine,
          backgroundColor: palette.currentFill,
          fill: true,
          tension: 0.3,
          pointRadius,
          pointHoverRadius,
          pointHitRadius: 16,
          borderWidth: 2.2,
          spanGaps: false,
        },
        {
          label: `${previousLabel} (${formatBRL(totalPrevious)})`,
          data: previousValues,
          borderColor: palette.previousLine,
          backgroundColor: palette.previousFill,
          fill: false,
          tension: 0.3,
          pointRadius,
          pointHoverRadius,
          pointHitRadius: 16,
          borderWidth: 2,
          borderDash: [6, 4],
          spanGaps: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true }
        },
        tooltip: {
          callbacks: {
            title(items) {
              if (!items?.length) return "";
              const index = items[0].dataIndex;
              if (Array.isArray(tooltipDetails) && tooltipDetails[index]) {
                return `${items[0].label} - ${tooltipDetails[index]}`;
              }
              return items[0].label;
            },
            label(context) {
              if (context.raw === null || context.raw === undefined) {
                return `${context.dataset.label}: sem registro`;
              }
              return `${context.dataset.label}: ${formatBRL(context.parsed.y)}`;
            },
            afterBody(items) {
              if (!Array.isArray(items) || items.length < 2) return [];
              const currentItem = items.find((item) => item.datasetIndex === 0);
              const previousItem = items.find((item) => item.datasetIndex === 1);
              if (!currentItem || !previousItem) return [];
              if (currentItem.raw === null || previousItem.raw === null) return [];

              const diff = Number(currentItem.parsed.y || 0) - Number(previousItem.parsed.y || 0);
              const sign = diff > 0 ? "+" : "";
              return [`Diferença: ${sign}${formatBRL(diff)}`];
            },
          }
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#adb5bd",
            autoSkip: true,
            maxTicksLimit: denseSeries ? 9 : 14,
            maxRotation: 0,
          },
          grid: { display: false },
        },
        y: {
          ticks: {
            color: "#adb5bd",
            callback: (value) => formatBRL(value),
          },
          grid: {
            color: (context) => {
              if (metric === "balance" && Number(context.tick?.value || 0) === 0) {
                return "rgba(148,163,184,0.35)";
              }
              return "rgba(255,255,255,0.06)";
            },
            lineWidth: (context) => {
              if (metric === "balance" && Number(context.tick?.value || 0) === 0) {
                return 1.4;
              }
              return 1;
            }
          },
        },
      },
    },
  });
}

function renderTimeline(currTx, prevTx, metric, startA, endA, startB, endB, compareMode) {
  const canvasId = "timelineChart";
  const ctx = document.getElementById(canvasId);

  if (!ctx) return;
  if (timelineChart) timelineChart.destroy();

  const title = getMetricLabel(metric);
  const comparisonContext = getComparisonContext(compareMode);
  const currentSeriesLabel = `${title} (${comparisonContext.currentLabel.toLocaleLowerCase("pt-BR")})`;
  const previousSeriesLabel = `${title} (${comparisonContext.previousLabel.toLocaleLowerCase("pt-BR")})`;

  if (!currTx.length && !prevTx.length) {
    renderEmptyMessage(canvasId, "Sem dados para a linha do tempo");
    return;
  }

  // previous_month => dia do mês
  if (compareMode === "previous_month") {
    const currByDay = groupByDayLocal(currTx, metric);
    const prevByDay = groupByDayLocal(prevTx, metric);

    const yearA = startA.getFullYear();
    const monthA = startA.getMonth();
    const yearB = startB.getFullYear();
    const monthB = startB.getMonth();
    const daysInA = new Date(yearA, monthA + 1, 0).getDate();
    const daysInB = new Date(yearB, monthB + 1, 0).getDate();
    const size = Math.max(daysInA, daysInB);

    const labels = Array.from({ length: size }, (_, i) => String(i + 1));
    const currValues = Array.from({ length: size }, (_, i) => {
      const day = i + 1;
      if (day > daysInA) return null;
      const key = `${yearA}-${pad2(monthA + 1)}-${pad2(day)}`;
      return currByDay[key] || 0;
    });

    const prevValues = Array.from({ length: size }, (_, i) => {
      const day = i + 1;
      if (day > daysInB) return null;
      const key = `${yearB}-${pad2(monthB + 1)}-${pad2(day)}`;
      return prevByDay[key] || 0;
    });

    const tooltipDetails = Array.from({ length: size }, (_, i) => {
      const day = i + 1;
      const dateA = day <= daysInA ? `${pad2(day)}/${pad2(monthA + 1)}/${yearA}` : "-";
      const dateB = day <= daysInB ? `${pad2(day)}/${pad2(monthB + 1)}/${yearB}` : "-";
      return `${comparisonContext.shortCurrent} ${dateA} | ${comparisonContext.shortPrevious} ${dateB}`;
    });

    buildTimelineChart(ctx, {
      metric,
      labels,
      currentValues: currValues,
      previousValues: prevValues,
      currentLabel: currentSeriesLabel,
      previousLabel: previousSeriesLabel,
      tooltipDetails,
    });

    return;
  }

  // previous_year => mês do ano (Jan..Dez)
  if (compareMode === "previous_year") {
    const currByMonth = groupByMonthLocal(currTx, metric);
    const prevByMonth = groupByMonthLocal(prevTx, metric);

    const labels = buildMonthLabels12();
    const yearA = startA.getFullYear();
    const yearB = startB.getFullYear();

    const currValues = Array.from({ length: 12 }, (_, i) => {
      const key = `${yearA}-${pad2(i + 1)}`;
      return currByMonth[key] || 0;
    });

    const prevValues = Array.from({ length: 12 }, (_, i) => {
      const key = `${yearB}-${pad2(i + 1)}`;
      return prevByMonth[key] || 0;
    });

    const tooltipDetails = labels.map((_, index) => {
      const monthNumber = pad2(index + 1);
      return `${comparisonContext.shortCurrent} ${monthNumber}/${yearA} | ${comparisonContext.shortPrevious} ${monthNumber}/${yearB}`;
    });

    buildTimelineChart(ctx, {
      metric,
      labels,
      currentValues: currValues,
      previousValues: prevValues,
      currentLabel: currentSeriesLabel,
      previousLabel: previousSeriesLabel,
      tooltipDetails,
    });

    return;
  }

  // previous_period / custom => dia 1..N (índice do range)
  const currByDay = groupByDayLocal(currTx, metric);
  const prevByDay = groupByDayLocal(prevTx, metric);
  const daysA = [];
  const daysB = [];

  let cursorA = new Date(startA.getFullYear(), startA.getMonth(), startA.getDate(), 0, 0, 0, 0);
  let cursorB = new Date(startB.getFullYear(), startB.getMonth(), startB.getDate(), 0, 0, 0, 0);

  const endDayA = new Date(endA.getFullYear(), endA.getMonth(), endA.getDate(), 0, 0, 0, 0);
  const endDayB = new Date(endB.getFullYear(), endB.getMonth(), endB.getDate(), 0, 0, 0, 0);

  while (cursorA <= endDayA) {
    daysA.push(`${cursorA.getFullYear()}-${pad2(cursorA.getMonth() + 1)}-${pad2(cursorA.getDate())}`);
    cursorA.setDate(cursorA.getDate() + 1);
  }

  while (cursorB <= endDayB) {
    daysB.push(`${cursorB.getFullYear()}-${pad2(cursorB.getMonth() + 1)}-${pad2(cursorB.getDate())}`);
    cursorB.setDate(cursorB.getDate() + 1);
  }

  const size = Math.max(daysA.length, daysB.length);
  const labels = Array.from({ length: size }, (_, i) => String(i + 1));

  const currValues = Array.from({ length: size }, (_, i) => {
    const dayKey = daysA[i];
    if (!dayKey) return null;
    return currByDay[dayKey] || 0;
  });

  const prevValues = Array.from({ length: size }, (_, i) => {
    const dayKey = daysB[i];
    if (!dayKey) return null;
    return prevByDay[dayKey] || 0;
  });

  const tooltipDetails = Array.from({ length: size }, (_, i) => {
    const dateA = formatIsoDateToBrShort(daysA[i]);
    const dateB = formatIsoDateToBrShort(daysB[i]);
    return `${comparisonContext.shortCurrent} ${dateA} | ${comparisonContext.shortPrevious} ${dateB}`;
  });

  buildTimelineChart(ctx, {
    metric,
    labels,
    currentValues: currValues,
    previousValues: prevValues,
    currentLabel: currentSeriesLabel,
    previousLabel: previousSeriesLabel,
    tooltipDetails,
  });
}

/* ===============================
   Ranking / Table / Badge / Alerts
================================ */
function getComparisonContext(compareMode) {
  if (compareMode === "previous_month") {
    return {
      currentLabel: "Mês atual",
      previousLabel: "Mês passado",
      currentTotalLabel: "Total do mês atual",
      previousTotalLabel: "Total do mês passado",
      pairLabel: "Mês atual x mês passado",
      shortCurrent: "Atual",
      shortPrevious: "Passado",
    };
  }

  if (compareMode === "previous_year") {
    return {
      currentLabel: "Ano atual",
      previousLabel: "Ano passado",
      currentTotalLabel: "Total do ano atual",
      previousTotalLabel: "Total do ano passado",
      pairLabel: "Ano atual x ano passado",
      shortCurrent: "Atual",
      shortPrevious: "Passado",
    };
  }

  return {
    currentLabel: "Período atual",
    previousLabel: "Período passado",
    currentTotalLabel: "Total do período atual",
    previousTotalLabel: "Total do período passado",
    pairLabel: "Período atual x período passado",
    shortCurrent: "Atual",
    shortPrevious: "Passado",
  };
}

function getComparisonModeLabel(compareMode) {
  return getComparisonContext(compareMode).pairLabel;
}

function updateComparisonTableHeader(compareMode) {
  const label = document.getElementById("comparisonTableLabel");
  if (!label) return;
  label.textContent = getComparisonModeLabel(compareMode);
}

function renderAdvancedSummary(current, previous, comparison, metric, compareMode) {
  const summary = document.getElementById("advancedSummary");
  if (!summary) return;

  const comparisonContext = getComparisonContext(compareMode);

  const totalA = sumObjectValues(current);
  const totalB = sumObjectValues(previous);
  const diff = totalA - totalB;
  const percent = totalB !== 0 ? (diff / totalB) * 100 : 0;

  const ups = comparison.filter((item) => item.diff > 0).length;
  const downs = comparison.filter((item) => item.diff < 0).length;
  const topImpact = comparison.length
    ? [...comparison].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0]
    : null;

  const trendClass = getTrendClass(metric, diff);
  const trendIcon = diff >= 0 ? "fa-arrow-up" : "fa-arrow-down";
  const impactLabel = topImpact
    ? `${escapeHtmlText(topImpact.category)} (${formatBRL(Math.abs(topImpact.diff))})`
    : "Sem destaque";

  summary.innerHTML = `
    <article class="advanced-summary-card">
      <div class="advanced-summary-label">${comparisonContext.currentTotalLabel}</div>
      <div class="advanced-summary-value">${formatBRL(totalA)}</div>
      <div class="advanced-summary-sub">Base atual da comparação</div>
    </article>
    <article class="advanced-summary-card">
      <div class="advanced-summary-label">${comparisonContext.previousTotalLabel}</div>
      <div class="advanced-summary-value">${formatBRL(totalB)}</div>
      <div class="advanced-summary-sub">Base de referência</div>
    </article>
    <article class="advanced-summary-card">
      <div class="advanced-summary-label">Variação total</div>
      <div class="advanced-summary-value">${formatBRL(Math.abs(diff))}</div>
      <div class="advanced-summary-sub">
        <span class="advanced-trend-chip ${trendClass}">
          <i class="fa-solid ${trendIcon}"></i>${formatSignedPercent(percent)}
        </span>
      </div>
    </article>
    <article class="advanced-summary-card">
      <div class="advanced-summary-label">Leitura rápida</div>
      <div class="advanced-summary-value">${ups} altas / ${downs} quedas</div>
      <div class="advanced-summary-sub">Maior impacto: ${impactLabel}</div>
    </article>
  `;

  summary.setAttribute("aria-label", getComparisonModeLabel(compareMode));
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


// Overrides visuais para leitura mais clara na comparacao avancada.
function renderRanking(comparison, metric, compareMode) {
  const topUp = document.getElementById("topUp");
  const topDown = document.getElementById("topDown");
  if (!topUp || !topDown) return;

  const comparisonContext = getComparisonContext(compareMode);

  topUp.innerHTML = "";
  topDown.innerHTML = "";

  if (!comparison.length) {
    topUp.innerHTML = `<li class="list-group-item advanced-rank-item text-muted">Sem dados no período.</li>`;
    topDown.innerHTML = `<li class="list-group-item advanced-rank-item text-muted">Sem dados no período.</li>`;
    return;
  }

  const ups = comparison.filter((c) => c.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 5);
  const downs = comparison.filter((c) => c.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 5);

  function buildRankingItem(item, index) {
    const toneClass = getTrendClass(metric, item.diff);
    const percentAbs = Math.abs(Number(item.percent || 0));
    const width = Math.max(8, Math.min(percentAbs, 100));
    const arrow = item.diff >= 0 ? "fa-arrow-up" : "fa-arrow-down";
    const categoryColor = colorForLabel(item.category);

    return `
      <li class="list-group-item advanced-rank-item ${toneClass}">
        <div class="advanced-rank-head">
          <span class="advanced-rank-main">
            <span class="advanced-rank-index">${index + 1}</span>
            <span class="advanced-table-category">
              <span class="advanced-table-dot" style="background:${categoryColor}"></span>
              <span class="advanced-rank-category">${escapeHtmlText(item.category)}</span>
            </span>
          </span>
          <span class="advanced-trend-chip ${toneClass}">
            <i class="fa-solid ${arrow}"></i>${Math.abs(item.percent).toFixed(1)}%
          </span>
        </div>
        <div class="advanced-rank-values">
          <span class="advanced-rank-diff">${formatBRL(Math.abs(item.diff))}</span>
          <span class="advanced-rank-base">${comparisonContext.shortCurrent}: ${formatBRL(item.current)} | ${comparisonContext.shortPrevious}: ${formatBRL(item.previous)}</span>
        </div>
        <div class="advanced-rank-meter">
          <span style="width: ${width}%"></span>
        </div>
      </li>
    `;
  }

  if (!ups.length) topUp.innerHTML = `<li class="list-group-item advanced-rank-item text-muted">Sem altas.</li>`;
  ups.forEach((item, index) => {
    topUp.innerHTML += buildRankingItem(item, index);
  });

  if (!downs.length) topDown.innerHTML = `<li class="list-group-item advanced-rank-item text-muted">Sem quedas.</li>`;
  downs.forEach((item, index) => {
    topDown.innerHTML += buildRankingItem(item, index);
  });
}

function renderTable(comparison, metric, compareMode) {
  const list = document.getElementById("comparisonTable");
  if (!list) return;

  const comparisonContext = getComparisonContext(compareMode);

  list.innerHTML = "";

  if (!comparison.length) {
    list.innerHTML = `<li class="list-group-item advanced-rank-item text-muted">Sem dados no período.</li>`;
    return;
  }

  const rows = [...comparison].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  rows.forEach((item, index) => {
    const toneClass = getTrendClass(metric, item.diff);
    const arrow = item.diff >= 0 ? "fa-arrow-up" : "fa-arrow-down";
    const categoryColor = colorForLabel(item.category);
    const width = Math.max(8, Math.min(Math.abs(Number(item.percent || 0)), 100));

    list.innerHTML += `
      <li class="list-group-item advanced-rank-item is-detailed ${toneClass}">
        <div class="advanced-rank-head">
          <span class="advanced-rank-main">
            <span class="advanced-rank-index">${index + 1}</span>
            <span class="advanced-table-category">
              <span class="advanced-table-dot" style="background:${categoryColor}"></span>
              <span class="advanced-rank-category">${escapeHtmlText(item.category)}</span>
            </span>
          </span>
          <span class="advanced-trend-chip ${toneClass}">
            <i class="fa-solid ${arrow}"></i>${Math.abs(item.percent).toFixed(1)}%
          </span>
        </div>
        <div class="advanced-rank-values">
          <span class="advanced-rank-diff">${formatBRL(Math.abs(item.diff))}</span>
          <span class="advanced-rank-base">${comparisonContext.currentLabel}: ${formatBRL(item.current)} | ${comparisonContext.previousLabel}: ${formatBRL(item.previous)}</span>
        </div>
        <span class="advanced-table-meta"><i class="fa-solid fa-circle-info me-1"></i>Impacto no resultado geral</span>
        <div class="advanced-rank-meter">
          <span style="width: ${width}%"></span>
        </div>
      </li>`;
  });
}

function renderBadge(current, previous, metric, compareMode) {
  const badge = document.getElementById("comparisonBadge");
  if (!badge) return;

  const curr = sumObjectValues(current);
  const prev = sumObjectValues(previous);
  const diff = curr - prev;
  const percent = prev !== 0 ? (diff / prev) * 100 : 0;
  const toneClass = getTrendClass(metric, diff);
  const icon = diff >= 0 ? "fa-arrow-up" : "fa-arrow-down";
  const comparisonContext = getComparisonContext(compareMode);

  if (!prev) {
    badge.innerHTML = `
      <div class="advanced-badge-title">Resumo da comparação</div>
      <div class="advanced-badge-value is-neutral">Sem base para comparar</div>
      <div class="advanced-badge-note">${getComparisonModeLabel(compareMode)}</div>
    `;
    return;
  }

  badge.innerHTML = `
    <div class="advanced-badge-title">Resumo da comparação</div>
    <div class="advanced-badge-value ${toneClass}">
      <i class="fa-solid ${icon} me-1"></i>${formatSignedPercent(percent)}
    </div>
    <div class="advanced-badge-note">
      ${comparisonContext.currentTotalLabel}: ${formatBRL(curr)} | ${comparisonContext.previousTotalLabel}: ${formatBRL(prev)} | Diferença: ${formatBRL(Math.abs(diff))}
    </div>
  `;
}

function renderPeriodAlerts(comparison, metric, diffMs, compareMode) {
  const alerts = document.getElementById("alerts");
  if (!alerts) return;

  alerts.innerHTML = "";

  if (!comparison.length) {
    alerts.innerHTML = `<div class="alert alert-secondary advanced-alert is-neutral">Nenhuma variação detectada.</div>`;
    return;
  }

  const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  const label =
    compareMode === "previous_month" ? "em relação ao mês passado" :
    compareMode === "previous_year" ? "em relação ao ano passado" :
    (days <= 7 ? "no período comparado (semana)" : "no período comparado");

  const withPrev = comparison.filter((c) => c.previous > 0);
  withPrev.sort((a, b) => Math.abs(b.percent) - Math.abs(a.percent));
  const top = withPrev.slice(0, 3);

  top.forEach((item) => {
    const tone = getTrendSemantic(metric, item.diff);
    const toneClass = tone === "good" ? "is-good" : tone === "bad" ? "is-bad" : "is-neutral";
    const bootstrapClass = tone === "good" ? "alert-success" : tone === "bad" ? "alert-danger" : "alert-secondary";
    const verb = item.diff >= 0 ? "aumento" : "redução";

    alerts.innerHTML += `
      <div class="alert ${bootstrapClass} advanced-alert ${toneClass}">
        <strong>${escapeHtmlText(item.category)}</strong>: ${verb} de ${Math.abs(item.percent).toFixed(1)}% ${label}.
        <div class="small text-muted">Diferença observada: ${formatBRL(item.diff)}</div>
      </div>`;
  });

  if (!alerts.innerHTML) {
    alerts.innerHTML = `<div class="alert alert-secondary advanced-alert is-neutral">Nenhuma variação relevante detectada.</div>`;
  }
}

/* ===============================
   Bind
================================ */
document.addEventListener("DOMContentLoaded", () => {
  setDefaultMonthYear(); // mantém
  bindCompareModeUI();
  setAdvancedResultsVisible(false);

  const btn = document.getElementById("compareBtn");
  if (!btn || btn.__bound) return;
  btn.__bound = true;

  btn.addEventListener("click", (e) => {
    e.preventDefault?.();
    loadAdvancedComparison();
  });
});



