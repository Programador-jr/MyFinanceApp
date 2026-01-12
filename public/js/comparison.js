let periodComparisonChart;

/* ===============================
   COMPARAÇÃO DE PERÍODOS
================================ */

async function loadPeriodComparison() {
  const mode = document.getElementById("compareMode").value;
  const chartType = document.getElementById("compareChartType").value;

  const now = new Date();

  let periodA, periodB;
  let labelA, labelB;

  if (mode === "month") {
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    periodA = await fetchMonth(currentYear, currentMonth);
    periodB = await fetchMonth(previousYear, previousMonth);

    labelA = "Mês Atual";
    labelB = "Mês Anterior";
  }

  if (mode === "year") {
    const year = now.getFullYear();

    periodA = await fetchYear(year);
    periodB = await fetchYear(year - 1);

    labelA = "Ano Atual";
    labelB = "Ano Anterior";
  }

  const merged = mergePeriods(periodA, periodB);
  renderPeriodComparisonChart(merged, labelA, labelB, chartType);
}

/* ===============================
   FETCH DE DADOS
================================ */

async function fetchMonth(year, month) {
  const res = await apiRequest(`/transactions/month?year=${year}&month=${month}`);
  return res.transactions || [];
}

async function fetchYear(year) {
  const res = await apiRequest(`/transactions/year?year=${year}`);
  return res.transactions || [];
}

/* ===============================
   AGRUPAMENTO
================================ */

function groupByCategory(transactions) {
  const data = {};

  transactions.forEach(t => {
    if (!data[t.category]) {
      data[t.category] = { income: 0, expense: 0 };
    }

    if (t.type === "income") data[t.category].income += t.value;
    if (t.type === "expense") data[t.category].expense += t.value;
  });

  return data;
}

function mergePeriods(a, b) {
  const groupA = groupByCategory(a);
  const groupB = groupByCategory(b);

  const categories = new Set([
    ...Object.keys(groupA),
    ...Object.keys(groupB)
  ]);

  const result = {};

  categories.forEach(cat => {
    result[cat] = {
      a: groupA[cat] || { income: 0, expense: 0 },
      b: groupB[cat] || { income: 0, expense: 0 }
    };
  });

  return result;
}

/* ===============================
   CÁLCULO DE VARIAÇÃO %
================================ */

function calculateVariation(current, previous) {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;

  return ((current - previous) / previous) * 100;
}

/* ===============================
   RENDERIZAÇÃO DO GRÁFICO
================================ */

function renderPeriodComparisonChart(data, labelA, labelB, type) {
  const ctx = document.getElementById("periodComparisonChart");

  if (periodComparisonChart) periodComparisonChart.destroy();

  const labels = Object.keys(data);

  const expenseA = labels.map(l => data[l].a.expense);
  const expenseB = labels.map(l => data[l].b.expense);

  const variations = labels.map(l =>
    calculateVariation(data[l].a.expense, data[l].b.expense)
  );

  periodComparisonChart = new Chart(ctx, {
    type,
    data: {
      labels,
      datasets: [
        {
          label: `Saídas - ${labelA}`,
          data: expenseA
        },
        {
          label: `Saídas - ${labelB}`,
          data: expenseB
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            afterBody: function (context) {
              const index = context[0].dataIndex;
              const value = variations[index];

              const signal = value > 0 ? "+" : "";
              return `Variação: ${signal}${value.toFixed(1)}%`;
            }
          }
        }
      }
    }
  });
}
