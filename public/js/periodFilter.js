let _periodTimer = null;

function applyPeriodAuto() {
  clearTimeout(_periodTimer);
  _periodTimer = setTimeout(() => {
    if (typeof applyDefaultFilter === "function") {
      applyDefaultFilter();
      return;
    }

    const year = document.getElementById("year")?.value;
    const month = document.getElementById("month")?.value;
    if (year && month && typeof loadSummary === "function" && typeof loadCharts === "function") {
      loadSummary(month, year);
      loadCharts(month, year);
    }
  }, 120);
}

function initPeriodUI() {
  const monthSelect = document.getElementById("month");
  const yearSelect = document.getElementById("year");

  const pickerMonth = document.getElementById("pickerMonth");
  const pickerYear = document.getElementById("pickerYear");
  const label = document.getElementById("periodLabel");

  if (!monthSelect || !yearSelect || !pickerMonth || !pickerYear || !label) return;

  if (monthSelect.options.length === 0 || yearSelect.options.length === 0) {
    if (typeof initFilter === "function") initFilter();
  }

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril",
    "Maio", "Junho", "Julho", "Agosto",
    "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  pickerMonth.innerHTML = "";
  Array.from(monthSelect.options).forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.text;
    pickerMonth.appendChild(o);
  });

  pickerYear.innerHTML = "";
  Array.from(yearSelect.options).forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.text;
    pickerYear.appendChild(o);
  });

  function getState() {
    return {
      m: parseInt(monthSelect.value, 10),
      y: parseInt(yearSelect.value, 10),
    };
  }

  function yearExists(y) {
    return Array.from(yearSelect.options).some(o => parseInt(o.value, 10) === y);
  }

  function setState(m, y, shouldApply) {
    monthSelect.value = String(m);
    yearSelect.value = String(y);
    label.textContent = `${months[m - 1]} ${y}`;
    pickerMonth.value = String(m);
    pickerYear.value = String(y);
    if (shouldApply) applyPeriodAuto();
  }

  function shiftMonth(delta) {
    let { m, y } = getState();
    m += delta;
    if (m <= 0) { m = 12; y -= 1; }
    if (m >= 13) { m = 1; y += 1; }
    if (!yearExists(y)) return;
    setState(m, y, true);
  }

  {
    const { m, y } = getState();
    setState(m, y, false);
  }

  document.getElementById("prevPeriod")?.addEventListener("click", () => shiftMonth(-1));
  document.getElementById("nextPeriod")?.addEventListener("click", () => shiftMonth(1));

  document.getElementById("periodModal")?.addEventListener("show.bs.modal", () => {
    const { m, y } = getState();
    pickerMonth.value = String(m);
    pickerYear.value = String(y);
  });

  document.getElementById("setPeriod")?.addEventListener("click", () => {
    const m = parseInt(pickerMonth.value, 10);
    const y = parseInt(pickerYear.value, 10);
    setState(m, y, true);

    const modalEl = document.getElementById("periodModal");
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.hide();
  });

  document.getElementById("clearPeriod")?.addEventListener("click", () => {
    const now = new Date();
    const m = now.getMonth() + 1;
    const y = now.getFullYear();
    if (!yearExists(y)) return;
    setState(m, y, true);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initPeriodUI();
});
