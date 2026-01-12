let advancedChart;
let timelineChart;

/* ===============================
   COMPARAÇÃO AVANÇADA (ENTRY)
================================ */
async function loadAdvancedComparison() {
  const startInput = document.getElementById("startDate").value;
  const endInput = document.getElementById("endDate").value;
  const metric = document.getElementById("metricType").value;

  if (!startInput || !endInput) {
    showAlert("Selecione o período", "warning", "triangle-exclamation");
    return;
  }

  const startDate = new Date(`${startInput}T00:00:00`);
  const endDate = new Date(`${endInput}T23:59:59`);

  const diffMs = endDate - startDate;
  const prevEnd = new Date(startDate);
  const prevStart = new Date(startDate.getTime() - diffMs);

  const current = await apiFetch(
    `/transactions/range?start=${startDate.toISOString()}&end=${endDate.toISOString()}`
  );

  const previous = await apiFetch(
    `/transactions/range?start=${prevStart.toISOString()}&end=${prevEnd.toISOString()}`
  );

  const currentGrouped = groupByCategory(current.transactions, metric);
  const previousGrouped = groupByCategory(previous.transactions, metric);

  const comparison = compareCategories(currentGrouped, previousGrouped);

  renderAdvancedChart(currentGrouped);
  renderTimelineChart(current.transactions, metric);
  renderRanking(comparison);
  renderTable(comparison);
  renderBadge(currentGrouped, previousGrouped, metric);
  renderPeriodAlerts(currentGrouped, previousGrouped, metric, diffMs);
}

/* ===============================
   AGRUPAMENTO
================================ */
function groupByCategory(transactions, metric) {
  const result = {};

  transactions.forEach(t => {
    if (!t.category) return;

    if (!result[t.category]) result[t.category] = 0;

    if (metric === "income" && t.type === "income") result[t.category] += t.value;
    if (metric === "expense" && t.type === "expense") result[t.category] += t.value;
    if (metric === "balance") {
      result[t.category] += t.type === "income" ? t.value : -t.value;
    }
  });

  return result;
}

/* ===============================
   COMPARAÇÃO REAL
================================ */
function compareCategories(current, previous) {
  const categories = new Set([
    ...Object.keys(current),
    ...Object.keys(previous)
  ]);

  return [...categories].map(category => {
    const curr = current[category] || 0;
    const prev = previous[category] || 0;

    if (curr === 0 && prev === 0) return null;

    const diff = curr - prev;
    let percent = 0;

    if (prev === 0 && curr > 0) percent = 100;
    else if (prev > 0 && curr === 0) percent = -100;
    else percent = (diff / prev) * 100;

    return { category, current: curr, diff, percent };
  }).filter(Boolean);
}

/* ===============================
   GRÁFICO POR CATEGORIA
================================ */
function renderAdvancedChart(data) {
  const canvasId = "advancedComparisonChart";
  const ctx = document.getElementById(canvasId);

  if (advancedChart) advancedChart.destroy();

  if (!Object.keys(data).length) {
    renderEmptyMessage(canvasId);
    return;
  }

  advancedChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(data),
      datasets: [{
        data: Object.values(data),
        backgroundColor: "#0d6efd"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}

/* ===============================
   GRÁFICO TEMPORAL
================================ */
function renderTimelineChart(transactions, metric) {
  const ctx = document.getElementById("timelineChart");
  if (!ctx) return;

  if (timelineChart) timelineChart.destroy();

  const grouped = {};

  transactions.forEach(t => {
    if (
      (metric === "income" && t.type !== "income") ||
      (metric === "expense" && t.type !== "expense")
    ) return;

    const day = new Date(t.date).toISOString().slice(0, 10);
    grouped[day] = (grouped[day] || 0) + (t.type === "income" ? t.value : -t.value);
  });

  const labels = Object.keys(grouped).sort();
  const values = labels.map(l => grouped[l]);

  if (!labels.length) {
    renderEmptyMessage("timelineChart");
    return;
  }

  timelineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: values,
        borderWidth: 2,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}

/* ===============================
   RANKING
================================ */
function renderRanking(comparison) {
  const topUp = document.getElementById("topUp");
  const topDown = document.getElementById("topDown");

  topUp.innerHTML = "";
  topDown.innerHTML = "";

  if (!comparison.length) {
    topUp.innerHTML = `<li class="list-group-item text-muted">Sem dados</li>`;
    topDown.innerHTML = `<li class="list-group-item text-muted">Sem dados</li>`;
    return;
  }

  comparison.filter(c => c.diff > 0).slice(0, 3).forEach(c => {
    topUp.innerHTML += `
      <li class="list-group-item text-success">
        ↑ ${c.category}: R$ ${c.diff.toFixed(2)}
      </li>`;
  });

  comparison.filter(c => c.diff < 0).slice(0, 3).forEach(c => {
    topDown.innerHTML += `
      <li class="list-group-item text-danger">
        ↓ ${c.category}: R$ ${Math.abs(c.diff).toFixed(2)}
      </li>`;
  });
}

/* ===============================
   TABELA
================================ */
function renderTable(comparison) {
  const table = document.getElementById("comparisonTable");
  table.innerHTML = "";

  if (!comparison.length) {
    table.innerHTML = `
      <tr>
        <td colspan="3" class="text-center text-muted">Sem dados</td>
      </tr>`;
    return;
  }

  comparison.forEach(c => {
    const arrow = c.percent >= 0 ? "↑" : "↓";
    const color = c.percent >= 0 ? "text-success" : "text-danger";

    table.innerHTML += `
      <tr>
        <td>${c.category}</td>
        <td>R$ ${c.current.toFixed(2)}</td>
        <td class="${color}">
          ${arrow} ${Math.abs(c.percent).toFixed(1)}%
        </td>
      </tr>`;
  });
}

/* ===============================
   BADGE
================================ */
function renderBadge(current, previous, metric) {
  const badge = document.getElementById("comparisonBadge");

  const sum = obj => Object.values(obj).reduce((a, b) => a + b, 0);

  const curr = sum(current);
  const prev = sum(previous);

  if (!prev) {
    badge.innerHTML = `<span class="badge bg-secondary">Sem comparação anterior</span>`;
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
      ${up ? "↑" : "↓"} ${Math.abs(percent)}% em relação ao período anterior
    </span>`;
}

/* ===============================
   ALERTAS
================================ */
function renderPeriodAlerts(current, previous, metric, diffMs) {
  const alerts = document.getElementById("alerts");
  alerts.innerHTML = "";

  const days = diffMs / (1000 * 60 * 60 * 24);
  const label = days <= 7 ? "semana passada" : "mês passado";

  Object.keys(current).forEach(cat => {
    const curr = current[cat];
    const prev = previous[cat];

    if (!prev) return;

    const diff = curr - prev;
    const percent = ((diff / prev) * 100).toFixed(1);

    if (metric === "expense" && diff > 0) {
      alerts.innerHTML += `
        <div class="alert alert-danger">
          Gastos com <strong>${cat}</strong> aumentaram ${percent}% em relação à ${label}
        </div>`;
    }

    if (metric === "income" && diff > 0) {
      alerts.innerHTML += `
        <div class="alert alert-success">
          Entradas com <strong>${cat}</strong> cresceram ${percent}% em relação à ${label}
        </div>`;
    }
  });

  if (!alerts.innerHTML) {
    alerts.innerHTML = `
      <div class="alert alert-secondary">
        Nenhuma variação relevante detectada.
      </div>`;
  }
}