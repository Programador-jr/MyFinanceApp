let monthlyEconomyChart = null;
let activeExpandedChart = null;
let chartExpandersBound = false;
const chartExpanderButtons = new WeakMap();
let dashboardMobileCarouselResizeBound = false;
const DASHBOARD_LAYOUT_LIMIT = 3;
const SPENDING_PROFILE_GROUP_LABELS = {
  fixed: "Fixo",
  variable: "Vari\u00e1vel",
  planned: "Previsto",
  unexpected: "Imprevisto",
};
let spendingProfileGroupModal = null;
const spendingProfileState = {
  month: 0,
  year: 0,
  formatMoney: null,
  groups: {
    fixed: [],
    variable: [],
    planned: [],
    unexpected: [],
  },
};

document.addEventListener("DOMContentLoaded", () => {
  checkAuth();
  initTheme();
  initFilter();
  bindUI();
  applyDefaultFilter();
  bindInviteModal();
  initChartExpanders();
  bindDashboardMobileCarouselResize();
  bindSpendingProfileGroupActions();
  bindSpendingProfileGroupModalState();
});

function isMobileChartViewport() {
 return window.matchMedia("(max-width: 991.98px)").matches;
}

function shouldRotateExpandedChartOnMobile() {
  return (
    isMobileChartViewport() &&
    window.matchMedia("(orientation: portrait)").matches
  );
}

function getChartInstanceFromContainer(container) {
  if (!container || typeof Chart === "undefined") return null;
  const canvas = container.querySelector("canvas");
  if (!canvas || typeof Chart.getChart !== "function") return null;
  return Chart.getChart(canvas) || null;
}

function resizeChartInContainer(container) {
  const chart = getChartInstanceFromContainer(container);
  if (!chart) return;

  try {
    chart.resize();
    chart.update("none");
  } catch {
    try {
      chart.resize();
    } catch {
      // noop
    }
  }
}

function resizeExpandedChartSoon(container) {
  if (!container) return;
  [40, 180, 320].forEach((delay) => {
    setTimeout(() => resizeChartInContainer(container), delay);
  });
}

function syncChartExpandButton(button, isExpanded) {
  if (!button) return;
  const title = button.dataset.chartTitle || "gráfico";
  button.innerHTML = isExpanded
    ? '<i class="fa-solid fa-down-left-and-up-right-to-center"></i>'
    : '<i class="fa-solid fa-up-right-and-down-left-from-center"></i>';
  button.setAttribute(
    "aria-label",
    isExpanded ? `Reduzir ${title}` : `Expandir ${title}`
  );
  button.setAttribute("title", isExpanded ? `Reduzir ${title}` : `Expandir ${title}`);
}

function applyExpandedChartClasses(container, isExpanded) {
  if (!container) return;

  container.classList.toggle("is-chart-expanded", isExpanded);
  container.classList.toggle(
    "is-chart-expanded-mobile-rotate",
    isExpanded && shouldRotateExpandedChartOnMobile()
  );

  const button = chartExpanderButtons.get(container);
  if (button) {
    button.classList.toggle("is-active", isExpanded);
    syncChartExpandButton(button, isExpanded);
  }

  const keepBodyLocked =
    isExpanded ||
    !!document.fullscreenElement ||
    (activeExpandedChart && activeExpandedChart.classList.contains("is-chart-expanded"));
  document.body.classList.toggle("chart-expanded-open", keepBodyLocked);
}

async function lockLandscapeOnMobileIfPossible() {
  if (!isMobileChartViewport()) return;
  if (!screen.orientation || typeof screen.orientation.lock !== "function") return;
  try {
    await screen.orientation.lock("landscape");
  } catch {
    // fallback css handles portrait lock limitations
  }
}

function unlockLandscapeIfPossible() {
  if (!screen.orientation || typeof screen.orientation.unlock !== "function") return;
  try {
    screen.orientation.unlock();
  } catch {
    // noop
  }
}

async function openExpandedChart(container) {
  if (!container) return;

  if (activeExpandedChart && activeExpandedChart !== container) {
    await closeExpandedChart(activeExpandedChart);
  }

  activeExpandedChart = container;
  applyExpandedChartClasses(container, true);

  if (!document.fullscreenElement && typeof container.requestFullscreen === "function") {
    try {
      await container.requestFullscreen({ navigationUI: "hide" });
    } catch {
      // sem fullscreen, segue com fallback por css
    }
  }

  await lockLandscapeOnMobileIfPossible();
  resizeExpandedChartSoon(container);
}

async function closeExpandedChart(container = activeExpandedChart) {
  if (!container) return;

  if (document.fullscreenElement === container && typeof document.exitFullscreen === "function") {
    try {
      await document.exitFullscreen();
    } catch {
      // noop
    }
  }

  applyExpandedChartClasses(container, false);
  if (activeExpandedChart === container) activeExpandedChart = null;
  unlockLandscapeIfPossible();
  resizeExpandedChartSoon(container);
}

async function toggleExpandedChart(container) {
  if (!container) return;
  const isExpanded = container.classList.contains("is-chart-expanded");
  if (isExpanded) {
    await closeExpandedChart(container);
    return;
  }
  await openExpandedChart(container);
}

function createChartExpandButton(container) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "chart-expand-btn";
  button.dataset.chartTitle = container.dataset.chartTitle || "grafico";
  syncChartExpandButton(button, false);
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await toggleExpandedChart(container);
  });
  return button;
}

function updateChartExpandersAvailability() {
  const containers = Array.from(document.querySelectorAll(".chart-expandable"));
  if (!containers.length) return;

  containers.forEach((container) => {
    const button =
      chartExpanderButtons.get(container) ||
      container.querySelector(".chart-expand-btn");
    if (!button) return;

    const hasChart = !!getChartInstanceFromContainer(container);

    let shouldShowByContext = true;
    const expandWhen = String(container.dataset.expandWhen || "").trim();
    if (expandWhen === "flow-range-not-current") {
      const rangeSelect = document.getElementById("incomeExpenseFlowRange");
      const currentRange = String(rangeSelect?.value || "").trim().toLowerCase();
      shouldShowByContext = currentRange !== "current_month";
    }

    const canExpand = hasChart && shouldShowByContext;
    button.classList.toggle("d-none", !canExpand);
    button.disabled = !canExpand;
    button.setAttribute("aria-hidden", canExpand ? "false" : "true");

    if (!canExpand && activeExpandedChart === container) {
      closeExpandedChart(container);
    }
  });
}

function bindChartExpandGlobalListeners() {
  if (chartExpandersBound) return;
  chartExpandersBound = true;

  document.addEventListener("keydown", async (event) => {
    if (event.key !== "Escape") return;
    if (!activeExpandedChart) return;
    await closeExpandedChart(activeExpandedChart);
  });

  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement) return;
    if (!activeExpandedChart) {
      document.body.classList.remove("chart-expanded-open");
      unlockLandscapeIfPossible();
      return;
    }

    const chart = activeExpandedChart;
    applyExpandedChartClasses(chart, false);
    activeExpandedChart = null;
    unlockLandscapeIfPossible();
    resizeExpandedChartSoon(chart);
  });

  window.addEventListener("resize", () => {
    if (!activeExpandedChart) return;
    activeExpandedChart.classList.toggle(
      "is-chart-expanded-mobile-rotate",
      shouldRotateExpandedChartOnMobile()
    );
    resizeExpandedChartSoon(activeExpandedChart);
  });
}

function initChartExpanders() {
  const containers = Array.from(document.querySelectorAll(".chart-expandable"));
  if (!containers.length) return;

  containers.forEach((container) => {
    if (container.dataset.chartExpandReady === "1") return;
    container.dataset.chartExpandReady = "1";

    let button = container.querySelector(".chart-expand-btn");
    if (!button) {
      button = createChartExpandButton(container);
      container.appendChild(button);
    } else {
      button.dataset.chartTitle = container.dataset.chartTitle || "grafico";
      syncChartExpandButton(button, false);
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await toggleExpandedChart(container);
      });
    }

    chartExpanderButtons.set(container, button);
  });

  bindChartExpandGlobalListeners();
  updateChartExpandersAvailability();
}

window.updateChartExpandersAvailability = updateChartExpandersAvailability;

function isMobileDashboardViewport() {
 return window.matchMedia("(max-width: 991.98px)").matches;
}

function setDashboardCarouselActive(container, items, dots, index) {
  const safeIndex = Math.max(0, Math.min(index, items.length - 1));
  container.dataset.carouselIndex = String(safeIndex);

  items.forEach((item, itemIndex) => {
    item.classList.toggle("is-active-slide", itemIndex === safeIndex);
  });

  dots.forEach((dot, dotIndex) => {
    const isActive = dotIndex === safeIndex;
    dot.classList.toggle("is-active", isActive);
    dot.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}

function getDashboardCarouselClosestIndex(container, items) {
  if (!items.length) return 0;
  const centerX = container.scrollLeft + (container.clientWidth / 2);
  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  items.forEach((item, index) => {
    const itemCenter = item.offsetLeft + (item.offsetWidth / 2);
    const distance = Math.abs(itemCenter - centerX);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
}

function scrollDashboardCarouselTo(container, items, dots, index) {
  if (!items.length) return;
  const total = items.length;
  const normalizedIndex = ((index % total) + total) % total;
  const target = items[normalizedIndex];
  if (!target) return;

  setDashboardCarouselActive(container, items, dots, normalizedIndex);
  const targetLeft = target.offsetLeft - container.offsetLeft;
  container.scrollTo({
    left: targetLeft,
    behavior: "smooth"
  });
}

function setupDashboardSectionMobileCarousel(sectionId, sourceCount) {
  const container = document.getElementById(sectionId);
  if (!container) return false;

  const controlsId = `${sectionId}MobileCarouselControls`;
  const oldControls = document.getElementById(controlsId);
  if (oldControls) oldControls.remove();

  let items = Array.from(container.children).filter((child) =>
    child?.classList?.contains("dashboard-layout-item")
  );
  if (!items.length) {
    items = Array.from(container.querySelectorAll(".dashboard-layout-item"));
  }
  items.forEach((item) => item.classList.remove("is-active-slide"));
  container.classList.remove("dashboard-mobile-carousel");
  container.onscroll = null;
  container.dataset.carouselIndex = "0";

  const shouldEnable =
    isMobileDashboardViewport() &&
    toNumber(sourceCount, items.length) > 1 &&
    items.length > 1;

  if (!shouldEnable) return false;

  container.classList.add("dashboard-mobile-carousel");

  const controls = document.createElement("div");
  controls.id = controlsId;
  controls.className = "dashboard-mobile-carousel-controls";
  controls.innerHTML = `
    <button type="button" class="dashboard-mobile-carousel-nav" data-dir="-1" aria-label="Item anterior">
      <i class="fa-solid fa-chevron-left"></i>
    </button>
    <div class="dashboard-mobile-carousel-dots" role="tablist" aria-label="Navegação do carrossel"></div>
    <button type="button" class="dashboard-mobile-carousel-nav" data-dir="1" aria-label="Próximo item">
      <i class="fa-solid fa-chevron-right"></i>
    </button>
  `;

  container.insertAdjacentElement("afterend", controls);

  const dotsWrap = controls.querySelector(".dashboard-mobile-carousel-dots");
  const dots = items.map((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "dashboard-mobile-carousel-dot";
    dot.setAttribute("aria-label", `Ver item ${index + 1}`);
    dot.setAttribute("role", "tab");
    dot.addEventListener("click", () => {
      scrollDashboardCarouselTo(container, items, dots, index);
    });
    dotsWrap.appendChild(dot);
    return dot;
  });

  controls.querySelectorAll(".dashboard-mobile-carousel-nav").forEach((button) => {
    button.addEventListener("click", () => {
      const direction = Number(button.dataset.dir || "0");
      const currentIndex = Math.max(
        0,
        Math.min(
          toNumber(container.dataset.carouselIndex, 0),
          items.length - 1
        )
      );
      scrollDashboardCarouselTo(container, items, dots, currentIndex + direction);
    });
  });

  let scrollRafId = 0;
  container.onscroll = () => {
    if (scrollRafId) cancelAnimationFrame(scrollRafId);
    scrollRafId = requestAnimationFrame(() => {
      const closestIndex = getDashboardCarouselClosestIndex(container, items);
      setDashboardCarouselActive(container, items, dots, closestIndex);
      scrollRafId = 0;
    });
  };

  setDashboardCarouselActive(container, items, dots, 0);
  return true;
}

function bindDashboardMobileCarouselResize() {
  if (dashboardMobileCarouselResizeBound) return;
  dashboardMobileCarouselResizeBound = true;

  let resizeTimeout = null;
  window.addEventListener("resize", () => {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const boxesEl = document.getElementById("boxes");
      const accountsEl = document.getElementById("accounts");
      if (boxesEl) {
        setupDashboardSectionMobileCarousel(
          "boxes",
          toNumber(boxesEl.dataset.sourceCount, boxesEl.children.length)
        );
      }
      if (accountsEl) {
        setupDashboardSectionMobileCarousel(
          "accounts",
          toNumber(accountsEl.dataset.sourceCount, accountsEl.children.length)
        );
      }
      resizeTimeout = null;
    }, 120);
  });
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

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function extractArrayFromPayload(payload, preferredKeys = []) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  for (const key of preferredKeys) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && typeof payload.data === "object") {
    for (const key of preferredKeys) {
      if (Array.isArray(payload.data[key])) return payload.data[key];
    }
    if (Array.isArray(payload.data.items)) return payload.data.items;
  }

  if (Array.isArray(payload.items)) return payload.items;

  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) return value;
  }

  return [];
}

function extractArrayFromPayloadStrict(payload, preferredKeys = []) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  for (const key of preferredKeys) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  if (payload.data && typeof payload.data === "object") {
    for (const key of preferredKeys) {
      if (Array.isArray(payload.data[key])) return payload.data[key];
    }
  }

  return [];
}

function round2(value) {
  const parsed = toNumber(value, 0);
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = String(value).trim().toLowerCase();
  if (["false", "0", "no", "off", "nao", "não"].includes(normalized)) return false;
  if (["true", "1", "yes", "on", "sim"].includes(normalized)) return true;
  return fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getBoxYieldSnapshot(box) {
  const rawType = String(box?.investmentType || "").trim().toLowerCase();
  const hasYieldSignal =
    toNumber(box?.effectiveAnnualRate, 0) > 0 ||
    toNumber(box?.cdiAnnualRate, 0) > 0 ||
    toNumber(box?.benchmarkAnnualRate, 0) > 0 ||
    toNumber(box?.dailyGrossYield, 0) > 0 ||
    toNumber(box?.estimatedDailyGrossYield, 0) > 0 ||
    toNumber(box?.netProfit, 0) > 0 ||
    toNumber(box?.grossProfit, 0) > 0;

  const autoCdi = parseBoolean(box?.autoCdi, false);
  const hasYieldType =
    rawType === "cdb_cdi" || rawType === "cdi" || rawType === "fixed";
  const investmentType =
    hasYieldType || hasYieldSignal || autoCdi ? "cdb_cdi" : "none";

  const cdiAnnualRate = Math.max(
    round2(toNumber(box?.cdiAnnualRate ?? box?.benchmarkAnnualRate, 0)),
    0
  );
  const cdiPercentage = Math.max(
    round2(toNumber(box?.cdiPercentage ?? box?.yieldPercentage, 100)),
    0
  );

  const effectiveAnnualRateRaw =
    toNumber(box?.effectiveAnnualRate, 0) > 0
      ? toNumber(box?.effectiveAnnualRate, 0)
      : cdiAnnualRate > 0 && cdiPercentage > 0
        ? cdiAnnualRate * (cdiPercentage / 100)
        : 0;
  const effectiveAnnualRate = Math.max(round2(effectiveAnnualRateRaw), 0);

  const currentValue = Math.max(toNumber(box?.currentValue, 0), 0);
  const principalValue = Math.max(
    toNumber(box?.principalValue, currentValue),
    0
  );
  const netCurrentValue = Math.max(
    toNumber(box?.netCurrentValue, currentValue),
    0
  );

  const totalYieldRaw =
    Number.isFinite(toNumber(box?.netProfit, NaN))
      ? toNumber(box?.netProfit, 0)
      : netCurrentValue - principalValue;
  const totalYield = round2(totalYieldRaw);
  const goalAmount = Math.max(round2(toNumber(box?.goalAmount, 0)), 0);
  const goalProgressFallback = goalAmount > 0
    ? (currentValue / goalAmount) * 100
    : 0;
  const goalProgressPercent = goalAmount > 0
    ? Math.max(
      0,
      Math.min(round2(toNumber(box?.goalProgressPercent, goalProgressFallback)), 100)
    )
    : 0;
  const goalRemainingFallback = goalAmount > 0 ? goalAmount - currentValue : 0;
  const goalRemainingValue = goalAmount > 0
    ? Math.max(round2(toNumber(box?.goalRemainingValue, goalRemainingFallback)), 0)
    : 0;
  const hasGoal = goalAmount > 0;
  const goalReached = hasGoal && goalProgressPercent >= 100;

  return {
    investmentType,
    currentValue: round2(currentValue),
    liquidValue: round2(netCurrentValue),
    effectiveAnnualRate,
    totalYield,
    goalAmount,
    goalProgressPercent,
    goalRemainingValue,
    hasGoal,
    goalReached,
  };
}

function getBoxIdentity(box) {
  if (box?._id) return String(box._id);
  if (box?.id) return String(box.id);
  return `${String(box?.name || "box")}::${toNumber(box?.currentValue, 0)}`;
}

function getBoxSortValue(box) {
  return Math.max(toNumber(box?.netCurrentValue, box?.currentValue), 0);
}

function getFeaturedDashboardBoxes(allBoxes) {
  const sorted = [...allBoxes].sort((a, b) => getBoxSortValue(b) - getBoxSortValue(a));
  const featured = [];

  const pushUnique = (box) => {
    if (!box) return;
    const identity = getBoxIdentity(box);
    if (featured.some((item) => getBoxIdentity(item) === identity)) return;
    featured.push(box);
  };

  if (!sorted.length) return featured;

  // 1) Caixinha de maior valor
  pushUnique(sorted[0]);

  // 2) Reserva de emergência de maior valor
  const emergency = sorted.find((box) => parseBoolean(box?.isEmergency, false));
  if (emergency) pushUnique(emergency);

  // Completa com as maiores restantes até o limite de 3
  for (const box of sorted) {
    if (featured.length >= 3) break;
    pushUnique(box);
  }

  return featured.slice(0, 3);
}

function getOrderedDashboardBoxes(allBoxes) {
  const sorted = [...allBoxes].sort((a, b) => getBoxSortValue(b) - getBoxSortValue(a));
  const ordered = [];
  const pushUnique = (box) => {
    if (!box) return;
    const identity = getBoxIdentity(box);
    if (ordered.some((item) => getBoxIdentity(item) === identity)) return;
    ordered.push(box);
  };

  getFeaturedDashboardBoxes(allBoxes).forEach(pushUnique);
  sorted.forEach(pushUnique);
  return ordered;
}

function renderDashboardBoxes(boxesData, formatMoney) {
  const boxes = document.getElementById("boxes");
  const boxesSection = boxes?.parentElement || null;
  const emptyBoxes = document.getElementById("emptyBoxes");
  const moreWrap = document.getElementById("boxesMoreWrap");
  const moreBtn = document.getElementById("seeMoreBoxesBtn");
  const newBoxBtn = document.getElementById("newBoxBtnDashboard");
  if (!boxes || !emptyBoxes) return;
  const list = Array.isArray(boxesData) ? boxesData : [];
  const orderedList = getOrderedDashboardBoxes(list);
  const featuredList = orderedList.slice(0, DASHBOARD_LAYOUT_LIMIT);
  boxes.innerHTML = "";
  boxes.classList.add("dashboard-limit-layout");
  boxes.dataset.layoutLimit = String(DASHBOARD_LAYOUT_LIMIT);
  boxes.dataset.sourceCount = String(orderedList.length);

  if (!featuredList.length) {
    if (boxesSection) boxesSection.classList.add("d-none");
    emptyBoxes.classList.add("d-none");
    if (moreWrap) moreWrap.classList.add("d-none");
    if (newBoxBtn) newBoxBtn.classList.add("d-none");
    setupDashboardSectionMobileCarousel("boxes", 0);
    return;
  }

  if (boxesSection) boxesSection.classList.remove("d-none");
  emptyBoxes.classList.add("d-none");
  if (newBoxBtn) newBoxBtn.classList.remove("d-none");

  orderedList.forEach((box) => {
    const snapshot = getBoxYieldSnapshot(box);
    const hasYield = snapshot.investmentType === "cdb_cdi" && snapshot.effectiveAnnualRate > 0;
    const isEmergency = parseBoolean(box?.isEmergency, false);
    const metricLabel = hasYield
      ? `${typeof formatPercentBR === "function" ? formatPercentBR(snapshot.effectiveAnnualRate) : `${snapshot.effectiveAnnualRate.toFixed(2).replace(".", ",")}%`} a.a.`
      : "Sem rendimento";
    const totalYieldClass =
      snapshot.totalYield > 0
        ? "yield-positive"
        : snapshot.totalYield < 0
          ? "yield-negative"
          : "yield-neutral";
    const chips = [];
    if (isEmergency) {
      chips.push('<span class="dashboard-box-chip is-emergency">Reserva de emergência</span>');
    }
    if (hasYield) {
      chips.push('<span class="dashboard-box-chip is-yield">Rendimento</span>');
    }
    if (snapshot.hasGoal) {
      chips.push(
        snapshot.goalReached
           ? '<span class="dashboard-box-chip is-goal-done">Meta atingida</span>'
 : '<span class="dashboard-box-chip is-goal">Meta ativa</span>'
      );
    }
    const chipsHtml = chips.length
      ? `<div class="d-flex align-items-center flex-wrap justify-content-end gap-1">${chips.join("")}</div>`
      : "";

    boxes.innerHTML += `
      <div class="col-12 col-sm-6 col-lg-4 dashboard-layout-item">
        <a href="boxes.html" class="text-decoration-none text-reset d-block h-100">
          <div class="card p-3 shadow-sm h-100 dashboard-box-card ${hasYield ? "is-yield" : ""} ${isEmergency ? "is-emergency" : ""}">
            <div class="d-flex align-items-start justify-content-between gap-2">
              <h6 class="mb-0 dashboard-box-title">${escapeHtml(box?.name || "Caixinha")}</h6>
              ${chipsHtml}
            </div>

            <div class="dashboard-box-balance mt-2">${formatMoney(snapshot.liquidValue)}</div>
            <div class="dashboard-box-subtitle">Saldo liquido</div>

            ${snapshot.hasGoal ? `
              <div class="dashboard-goal-wrap mt-3">
                <div class="dashboard-goal-head">
                  <span class="label">Meta</span>
                  <strong>${formatMoney(snapshot.goalAmount)}</strong>
                </div>
                <div class="progress dashboard-goal-progress" role="progressbar" aria-valuenow="${snapshot.goalProgressPercent}" aria-valuemin="0" aria-valuemax="100">
                  <div class="progress-bar ${snapshot.goalReached ? "bg-success" : ""}" style="width: ${snapshot.goalProgressPercent}%"></div>
                </div>
                <div class="dashboard-goal-foot">
                  <span>${snapshot.goalReached ? "Meta atingida" : `Faltam ${formatMoney(snapshot.goalRemainingValue)}`}</span>
                  <strong>${typeof formatPercentBR === "function" ? formatPercentBR(snapshot.goalProgressPercent) : `${snapshot.goalProgressPercent.toFixed(2).replace(".", ",")}%`}</strong>
                </div>
              </div>
            ` : ""}

            ${hasYield ? `
              <div class="dashboard-box-metrics mt-3">
                <div class="dashboard-box-metric">
                  <strong>${metricLabel}</strong>
                </div>
                <div class="dashboard-box-metric">
                  <strong class="${totalYieldClass}">${formatMoney(snapshot.totalYield)}</strong>
                </div>
              </div>
            ` : ""}
          </div>
        </a>
      </div>
    `;
  });

  const carouselEnabled = setupDashboardSectionMobileCarousel("boxes", orderedList.length);

  if (moreWrap && moreBtn) {
    if (!carouselEnabled && orderedList.length > 1) {
      moreWrap.classList.remove("d-none");
      const hiddenCount = Math.max(orderedList.length - DASHBOARD_LAYOUT_LIMIT, 0);
      moreBtn.innerHTML = hiddenCount > 0
         ? `<i class="fa-solid fa-layer-group me-1"></i> Ver outras caixinhas (${hiddenCount})`
 : `<i class="fa-solid fa-layer-group me-1"></i> Ver todas as caixinhas`;
    } else {
      moreWrap.classList.add("d-none");
    }
  }
}

function normalizeAccountInstallments(value) {
  const n = Math.floor(toNumber(value, 1));
  return Math.max(1, n);
}

const DASHBOARD_ACCOUNT_TYPE_INSTALLMENT = "installment";
const DASHBOARD_ACCOUNT_TYPE_SUBSCRIPTION = "subscription";
const DASHBOARD_ACCOUNT_TYPE_FIXED = "fixed";
const DASHBOARD_BILLING_MONTHLY = "monthly";
const DASHBOARD_BILLING_ANNUAL = "annual";

function normalizeDashboardAccountType(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === DASHBOARD_ACCOUNT_TYPE_SUBSCRIPTION) return DASHBOARD_ACCOUNT_TYPE_SUBSCRIPTION;
  if (raw === DASHBOARD_ACCOUNT_TYPE_FIXED) return DASHBOARD_ACCOUNT_TYPE_FIXED;
  return DASHBOARD_ACCOUNT_TYPE_INSTALLMENT;
}

function normalizeDashboardBillingCycle(value) {
  return String(value || "").trim().toLowerCase() === DASHBOARD_BILLING_ANNUAL
    ? DASHBOARD_BILLING_ANNUAL
    : DASHBOARD_BILLING_MONTHLY;
}

function isDashboardRecurringType(accountType) {
  return (
    accountType === DASHBOARD_ACCOUNT_TYPE_SUBSCRIPTION ||
    accountType === DASHBOARD_ACCOUNT_TYPE_FIXED
  );
}

function parseDashboardDate(value) {
  if (typeof parseDateLikeLocal === "function") {
    return parseDateLikeLocal(value, { middayHour: 12 });
  }
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dashboardTodayISO() {
  if (typeof toLocalISODate === "function") return toLocalISODate(new Date());
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeDashboardDateInput(value, fallback = "") {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    if (typeof toLocalISODate === "function") return toLocalISODate(value);
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const date = parseDashboardDate(raw);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return fallback;
  if (typeof toLocalISODate === "function") return toLocalISODate(date);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isSameYearMonthUTC(dateA, dateB) {
  if (!(dateA instanceof Date) || Number.isNaN(dateA.getTime())) return false;
  if (!(dateB instanceof Date) || Number.isNaN(dateB.getTime())) return false;
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth()
  );
}

function countElapsedDashboardCycles(firstDueDate, cycle, referenceDate = new Date()) {
  const first = parseDashboardDate(firstDueDate);
  if (!first) return 0;
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  if (Number.isNaN(ref.getTime()) || first > ref) return 0;

  if (cycle === DASHBOARD_BILLING_ANNUAL) {
    let yearsDiff = ref.getFullYear() - first.getFullYear();
    const anchor = new Date(first);
    anchor.setFullYear(anchor.getFullYear() + yearsDiff);
    if (anchor > ref) yearsDiff -= 1;
    return Math.max(yearsDiff + 1, 0);
  }

  let monthsDiff =
    (ref.getFullYear() - first.getFullYear()) * 12 +
    (ref.getMonth() - first.getMonth());
  const anchor = new Date(first);
  anchor.setMonth(anchor.getMonth() + monthsDiff);
  if (anchor > ref) monthsDiff -= 1;
  return Math.max(monthsDiff + 1, 0);
}

function getDashboardRecurringCyclesPaidBySchedule(firstPaymentDate, nextDueDate, billingCycle) {
  const first = normalizeDashboardDateInput(firstPaymentDate, "");
  const next = normalizeDashboardDateInput(nextDueDate, "");
  if (!first || !next) return 0;

  const firstDate = parseDashboardDate(first);
  const nextDate = parseDashboardDate(next);
  if (
    !(firstDate instanceof Date) ||
    Number.isNaN(firstDate.getTime()) ||
    !(nextDate instanceof Date) ||
    Number.isNaN(nextDate.getTime())
  ) return 0;

  if (firstDate > new Date()) return 0;
  return Math.max(countElapsedDashboardCycles(first, billingCycle, nextDate) - 1, 0);
}

function resolveDashboardRecurringValueOnDate(account, atDate) {
  const currentValue = Math.max(
    toNumber(account?.recurringValue ?? account?.installmentValue, 0),
    0
  );
  const history = Array.isArray(account?.adjustmentHistory)
    ? [...account.adjustmentHistory].sort((a, b) => {
      const da = parseDashboardDate(a?.changedAt)?.getTime() || 0;
      const db = parseDashboardDate(b?.changedAt)?.getTime() || 0;
      return da - db;
    })
    : [];

  if (!history.length) return round2(currentValue);

  let value = currentValue;
  const firstOldValue = Math.max(toNumber(history[0]?.oldValue, 0), 0);
  if (firstOldValue > 0) value = firstOldValue;

  history.forEach((item) => {
    const changedAtDate = parseDashboardDate(item?.changedAt);
    if (!(changedAtDate instanceof Date) || Number.isNaN(changedAtDate.getTime())) return;
    if (changedAtDate <= atDate) {
      const nextValue = Math.max(toNumber(item?.newValue, value), 0);
      value = round2(nextValue);
    }
  });

  return round2(value);
}

function calculateDashboardRecurringTotalSpent(account, paidCycles, billingCycle) {
  const cycles = Math.max(Math.floor(toNumber(paidCycles, 0)), 0);
  if (cycles <= 0) return 0;

  const firstPaymentDate = normalizeDashboardDateInput(
    account?.firstPaymentDate || account?.firstDueDate,
    ""
  );
  if (!firstPaymentDate) {
    const fallbackValue = Math.max(
      toNumber(account?.recurringValue ?? account?.installmentValue, 0),
      0
    );
    return round2(fallbackValue * cycles);
  }

  let cursorDate = parseDashboardDate(firstPaymentDate);
  if (!(cursorDate instanceof Date) || Number.isNaN(cursorDate.getTime())) return 0;

  let total = 0;
  for (let i = 0; i < cycles; i++) {
    total += resolveDashboardRecurringValueOnDate(account, cursorDate);

    const cursorIso = normalizeDashboardDateInput(cursorDate, firstPaymentDate);
    const nextCycleDate = addMonthsISO(
      cursorIso,
      billingCycle === DASHBOARD_BILLING_ANNUAL ? 12 : 1
    );
    if (!nextCycleDate) break;
    const parsedNext = parseDashboardDate(nextCycleDate);
    if (!(parsedNext instanceof Date) || Number.isNaN(parsedNext.getTime())) break;
    cursorDate = parsedNext;
  }

  return round2(total);
}

function normalizeDashboardAccount(raw) {
  const accountType = normalizeDashboardAccountType(raw?.accountType);
  const recurringType = isDashboardRecurringType(accountType);
  const billingCycle = accountType === DASHBOARD_ACCOUNT_TYPE_FIXED
    ? DASHBOARD_BILLING_MONTHLY
    : normalizeDashboardBillingCycle(raw?.billingCycle);
  const installments = recurringType
    ? 1
    : normalizeAccountInstallments(raw?.installments);
  const downPayment = recurringType
    ? 0
    : Math.max(round2(toNumber(raw?.downPayment, 0)), 0);
  const recurringValue = Math.max(
    round2(toNumber(raw?.recurringValue ?? raw?.installmentValue, 0)),
    0
  );
  const installmentValue = recurringType
    ? recurringValue
    : Math.max(round2(toNumber(raw?.installmentValue, 0)), 0);
  const paidInstallments = recurringType
    ? 0
    : Math.min(
      Math.max(Math.floor(toNumber(raw?.paidInstallments, 0)), 0),
      installments
    );
  const nextDueDateRaw = String(raw?.nextDueDate || "").trim();
  const firstDueDateRaw = String(raw?.firstPaymentDate || raw?.firstDueDate || "").trim();
  const fallbackFirstDue = normalizeDashboardDateInput(nextDueDateRaw, dashboardTodayISO());
  const firstDueDate = normalizeDashboardDateInput(firstDueDateRaw, fallbackFirstDue);
  const nextDueDate = normalizeDashboardDateInput(nextDueDateRaw, firstDueDate);
  const lastPaymentAt = String(raw?.lastPaymentAt || "").trim();
  const subscriptionPayments = Math.max(
    Math.floor(toNumber(raw?.subscriptionPayments, 0)),
    0
  );
  const adjustmentHistory = Array.isArray(raw?.adjustmentHistory)
    ? raw.adjustmentHistory
      .map((item) => ({
        changedAt: normalizeDashboardDateInput(item?.changedAt, ""),
        oldValue: round2(Math.max(toNumber(item?.oldValue, 0), 0)),
        newValue: round2(Math.max(toNumber(item?.newValue, 0), 0)),
      }))
      .filter((item) => item.changedAt && item.newValue > 0)
      .sort((a, b) => {
        const da = parseDashboardDate(a.changedAt)?.getTime() || 0;
        const db = parseDashboardDate(b.changedAt)?.getTime() || 0;
        return da - db;
      })
    : [];

  return {
    id: String(raw?._id || raw?.id || "").trim(),
    name: String(raw?.name || "").trim(),
    accountType,
    billingCycle,
    recurringValue,
    downPayment,
    installmentValue,
    installments,
    firstPaymentDate: firstDueDate,
    firstDueDate,
    nextDueDate,
    lastPaymentAt,
    subscriptionPayments,
    adjustmentHistory,
    category: String(raw?.category || "").trim(),
    paidInstallments,
  };
}

function addMonthsISO(baseIsoDate, monthsToAdd) {
 const base = parseDashboardDate(baseIsoDate);
  if (!(base instanceof Date) || Number.isNaN(base.getTime())) return "";
  const copy = new Date(base);
  copy.setMonth(copy.getMonth() + toNumber(monthsToAdd, 0));
  if (typeof toLocalISODate === "function") return toLocalISODate(copy);
  const y = copy.getFullYear();
  const m = String(copy.getMonth() + 1).padStart(2, "0");
  const d = String(copy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateBR(isoDate) {
  if (!isoDate) return "-";
  if (typeof formatDateUserLocal === "function") {
    return formatDateUserLocal(isoDate, { locale: "pt-BR", includeTime: false });
  }
 const date = new Date(`${String(isoDate).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

function calculateDashboardAccount(account) {
  if (isDashboardRecurringType(account.accountType)) {
    const recurringValue = Math.max(toNumber(account.recurringValue ?? account.installmentValue, 0), 0);
    const billingCycle = account.accountType === DASHBOARD_ACCOUNT_TYPE_FIXED
      ? DASHBOARD_BILLING_MONTHLY
      : normalizeDashboardBillingCycle(account.billingCycle);
    const firstPaymentDate = normalizeDashboardDateInput(
      account.firstPaymentDate || account.firstDueDate,
      dashboardTodayISO()
    );
    const nextDueDate = normalizeDashboardDateInput(
      account.nextDueDate || firstPaymentDate,
      firstPaymentDate
    );
    const elapsedCycles = getDashboardRecurringCyclesPaidBySchedule(
      firstPaymentDate,
      nextDueDate,
      billingCycle
    );
    const paidCycles = Math.max(
      Math.floor(toNumber(account.subscriptionPayments, 0)),
      elapsedCycles
    );
    const totalSpent = calculateDashboardRecurringTotalSpent(account, paidCycles, billingCycle);
    const paidThisMonth = isSameYearMonthUTC(parseDashboardDate(account.lastPaymentAt), new Date());
    const nowDate = new Date();
    const nextDueDateObj = parseDashboardDate(nextDueDate);
    const canPayNow = !!(
      nextDueDateObj instanceof Date &&
      !Number.isNaN(nextDueDateObj.getTime()) &&
      nextDueDateObj <= nowDate
    );

    return {
      accountType: account.accountType,
      billingCycle,
      installments: 1,
      installmentValue: round2(recurringValue),
      recurringValue: round2(recurringValue),
      totalAccountValue: round2(recurringValue),
      totalSpent,
      paidInstallments: 0,
      remainingInstallments: 1,
      remainingAmount: account.accountType === DASHBOARD_ACCOUNT_TYPE_FIXED
        ? round2(recurringValue)
        : 0,
      progressPercent: 0,
      nextDueDate,
      paidThisMonth,
      canPayNow,
      status: "active",
      sortAmount: round2(recurringValue),
    };
  }

  const installments = normalizeAccountInstallments(account.installments);
  const installmentValue = Math.max(toNumber(account.installmentValue, 0), 0);
  const downPayment = Math.max(toNumber(account.downPayment, 0), 0);
  const financedAmount = installmentValue * installments;
  const totalAccountValue = downPayment + financedAmount;
  const paidInstallments = Math.min(
    Math.max(Math.floor(toNumber(account.paidInstallments, 0)), 0),
    installments
  );
  const paidAmount = installmentValue * paidInstallments;
  const remainingInstallments = Math.max(installments - paidInstallments, 0);
  const remainingAmount = Math.max(financedAmount - paidAmount, 0);
  const status = remainingInstallments === 0 ? "paid" : "active";
  const totalSpent = round2(downPayment + paidAmount);
  const progressPercent = installments > 0
    ? Math.max(0, Math.min(round2((paidInstallments / installments) * 100), 100))
    : 0;
  const nextDueDate = status === "active"
    ? addMonthsISO(account.firstDueDate, paidInstallments)
    : "";

  return {
    accountType: DASHBOARD_ACCOUNT_TYPE_INSTALLMENT,
    installments,
    installmentValue: round2(installmentValue),
    totalAccountValue: round2(totalAccountValue),
    totalSpent,
    paidInstallments,
    remainingInstallments,
    remainingAmount: round2(remainingAmount),
    progressPercent,
    nextDueDate,
    status,
    canPayNow: status === "active",
    sortAmount: status === "active" ? round2(remainingAmount) : round2(totalAccountValue),
  };
}

function isDashboardAccountActiveForView(item) {
  const calc = item?.calc || {};
  return calc.status === "active";
}

function getAccountIdentity(account) {
  if (account?.id) return String(account.id);
  if (account?._id) return String(account._id);
  return `${String(account?.name || "account")}::${toNumber(account?.installmentValue, 0)}::${toNumber(account?.installments, 1)}`;
}

function getSortedDashboardAccounts(accountsData) {
  return accountsData
    .map((raw) => normalizeDashboardAccount(raw))
    .map((account) => ({ account, calc: calculateDashboardAccount(account) }))
    .sort((a, b) => {
      if (a.calc.status !== b.calc.status) return a.calc.status === "active" ? -1 : 1;
      if (a.calc.sortAmount !== b.calc.sortAmount) return b.calc.sortAmount - a.calc.sortAmount;
      if (!a.calc.nextDueDate && !b.calc.nextDueDate) return 0;
      if (!a.calc.nextDueDate) return 1;
      if (!b.calc.nextDueDate) return -1;
      return a.calc.nextDueDate.localeCompare(b.calc.nextDueDate);
    });
}

function collectUniqueDashboardAccounts(items, limit = Number.POSITIVE_INFINITY) {
  const collected = [];
  const maxItems = Number.isFinite(limit) ? Math.max(0, limit) : Number.POSITIVE_INFINITY;

  const pushUnique = (item) => {
    if (!item) return;
    const identity = getAccountIdentity(item.account);
    if (collected.some((x) => getAccountIdentity(x.account) === identity)) return;
    collected.push(item);
  };

  for (const item of items) {
    if (collected.length >= maxItems) break;
    pushUnique(item);
  }

  return collected;
}

function getFeaturedDashboardAccounts(accountsData) {
  const sorted = getSortedDashboardAccounts(accountsData);
  return collectUniqueDashboardAccounts(sorted, DASHBOARD_LAYOUT_LIMIT);
}

function getOrderedDashboardAccounts(accountsData) {
  const sorted = getSortedDashboardAccounts(accountsData);
  const featured = collectUniqueDashboardAccounts(sorted, DASHBOARD_LAYOUT_LIMIT);
  return collectUniqueDashboardAccounts([...featured, ...sorted], Number.POSITIVE_INFINITY);
}

function renderDashboardAccounts(accountsData, formatMoney) {
  const accounts = document.getElementById("accounts");
  const accountsSection = accounts?.parentElement || null;
  const emptyAccounts = document.getElementById("emptyAccounts");
  const newAccountBtn = document.getElementById("newAccountBtnDashboard");
  if (!accounts || !emptyAccounts) return;
  const rawList = Array.isArray(accountsData) ? accountsData : [];
  const orderedList = getOrderedDashboardAccounts(rawList);
  const activeOrderedList = orderedList.filter((item) => isDashboardAccountActiveForView(item));
  const hasActiveAccount = activeOrderedList.length > 0;
  accounts.innerHTML = "";
  accounts.classList.add("dashboard-limit-layout");
  accounts.dataset.layoutLimit = String(DASHBOARD_LAYOUT_LIMIT);
  accounts.dataset.sourceCount = String(activeOrderedList.length);

  if (!hasActiveAccount) {
    if (accountsSection) accountsSection.classList.add("d-none");
    emptyAccounts.classList.add("d-none");
    if (newAccountBtn) newAccountBtn.classList.add("d-none");
    setupDashboardSectionMobileCarousel("accounts", 0);
    return;
  }

  if (accountsSection) accountsSection.classList.remove("d-none");
  emptyAccounts.classList.add("d-none");
  if (newAccountBtn) newAccountBtn.classList.remove("d-none");
  activeOrderedList.forEach(({ account, calc }) => {
    const isActive = calc.status === "active";
    const isSubscription = account.accountType === DASHBOARD_ACCOUNT_TYPE_SUBSCRIPTION;
    const isFixed = account.accountType === DASHBOARD_ACCOUNT_TYPE_FIXED;
    const isInstallment = !isSubscription && !isFixed;

    const statusChip = isActive
      ? '<span class="dashboard-box-chip is-account-active">Ativa</span>'
      : '<span class="dashboard-box-chip is-account-paid">Concluída</span>';
    const typeChip = isSubscription
      ? '<span class="dashboard-box-chip is-account-subscription">Assinatura</span>'
      : (isFixed
        ? '<span class="dashboard-box-chip is-account-fixed">Fixa</span>'
        : '<span class="dashboard-box-chip is-account-installment">Parcelada</span>');

    const mainValue = isInstallment
      ? (isActive ? calc.remainingAmount : calc.totalAccountValue)
      : calc.recurringValue;
    const mainLabel = isInstallment
      ? (isActive ? "Saldo em aberto" : "Valor total da conta")
      : (isSubscription
        ? (calc.billingCycle === DASHBOARD_BILLING_ANNUAL ? "Assinatura anual" : "Assinatura mensal")
        : "Conta fixa mensal");
    const cycleValue = isInstallment
      ? `${calc.paidInstallments}/${calc.installments}`
      : (isSubscription
        ? (calc.billingCycle === DASHBOARD_BILLING_ANNUAL ? "Anual" : "Mensal")
        : "Mensal");
    const dueValue = isInstallment
      ? (isActive ? formatDateBR(calc.nextDueDate) : "Concluída")
      : formatDateBR(calc.nextDueDate);
    const cycleText = isInstallment
      ? `Parcelas ${cycleValue}`
      : `Ciclo ${cycleValue}`;
    const dueText = isInstallment
      ? (isActive ? `Venc. ${dueValue}` : "Conta concluída")
      : `Próx. cobrança ${dueValue}`;
    const totalSpentText = `Total gasto ${formatMoney(calc.totalSpent)}`;
    const progressMarkup = isInstallment
      ? `
        <div class="dashboard-account-progress mt-3">
          <div class="dashboard-account-progress-head">
            <span>Progresso</span>
            <strong>${Math.round(calc.progressPercent || 0)}%</strong>
          </div>
          <div class="progress dashboard-account-progress-track">
            <div class="progress-bar" role="progressbar" style="width: ${Math.max(0, Math.min(100, calc.progressPercent || 0))}%"></div>
          </div>
        </div>
      `
      : "";
    const categoryText = account.category || "Sem categoria";

    accounts.innerHTML += `
      <div class="col-12 col-sm-6 col-lg-4 dashboard-layout-item">
        <a href="contas.html" class="text-decoration-none text-reset d-block h-100">
          <div class="card p-3 shadow-sm h-100 dashboard-box-card dashboard-account-card ${isActive ? "is-account-active" : "is-account-paid"}">
            <div class="dashboard-account-head">
              <h6 class="mb-0 dashboard-box-title">${escapeHtml(account.name || "Conta")}</h6>
              <div class="dashboard-account-chips">
                ${statusChip}
                ${typeChip}
              </div>
            </div>

            <div class="dashboard-box-balance mt-2">${formatMoney(mainValue)}</div>
            <div class="dashboard-box-subtitle">${mainLabel}</div>

            <div class="dashboard-account-simple-list mt-3">
              <span class="dashboard-account-simple-item">
                <i class="fa-solid fa-tag"></i>
                ${escapeHtml(categoryText)}
              </span>
              <span class="dashboard-account-simple-item">
                <i class="fa-solid fa-layer-group"></i>
                ${escapeHtml(cycleText)}
              </span>
              <span class="dashboard-account-simple-item">
                <i class="fa-regular fa-calendar"></i>
                ${escapeHtml(dueText)}
              </span>
              <span class="dashboard-account-simple-item">
                <i class="fa-solid fa-wallet"></i>
                ${escapeHtml(totalSpentText)}
              </span>
            </div>

            ${progressMarkup}
          </div>
        </a>
      </div>
    `;
  });
  setupDashboardSectionMobileCarousel("accounts", activeOrderedList.length);
}

function renderMonthlyEconomy(monthlyBalance, monthExpense, formatMoney) {
  const valueEl = document.getElementById("monthlyEconomyValue");
  const rateEl = document.getElementById("monthlyEconomyRate");
  const expenseEl = document.getElementById("monthlyEconomyExpense");
  const messageEl = document.getElementById("monthlyEconomyMessage");
  const donutPercentEl = document.getElementById("monthlyEconomyDonutPercent");
  const chartCanvas = document.getElementById("monthlyEconomyChart");
  if (!valueEl || !rateEl || !expenseEl || !messageEl || !chartCanvas) return;

  const balance = round2(toNumber(monthlyBalance, 0));
  const expense = Math.max(round2(toNumber(monthExpense, 0)), 0);
  const incomeEstimate = Math.max(round2(balance + expense), 0);
  const rawSavingsRate = incomeEstimate > 0 ? (balance / incomeEstimate) * 100 : 0;
  const savingsRate = Math.max(0, Math.min(rawSavingsRate, 100));
  const formattedRate = typeof formatPercentBR === "function"
    ? formatPercentBR(savingsRate)
    : `${savingsRate.toFixed(2).replace(".", ",")}%`;

  valueEl.textContent = formatMoney(balance);
  expenseEl.textContent = formatMoney(expense);
  rateEl.textContent = formattedRate;
  if (donutPercentEl) donutPercentEl.textContent = formattedRate;

  valueEl.classList.remove("yield-positive", "yield-negative", "yield-neutral");
  rateEl.classList.remove("is-positive", "is-negative", "is-neutral");
  messageEl.classList.remove("is-great", "is-good", "is-ok", "is-warning", "is-neutral");

  let mainColor = "rgba(148, 163, 184, 0.85)";
  let message = "Sem movimentação no período.";

  if (incomeEstimate <= 0 && expense <= 0) {
    valueEl.classList.add("yield-neutral");
    rateEl.classList.add("is-neutral");
    messageEl.classList.add("is-neutral");
  } else if (savingsRate >= 35) {
    valueEl.classList.add("yield-positive");
    rateEl.classList.add("is-positive");
    messageEl.classList.add("is-great");
    mainColor = "rgba(34, 197, 94, 0.88)";
    message = "Você sabe mesmo economizar.";
  } else if (savingsRate >= 20) {
    valueEl.classList.add(balance >= 0 ? "yield-positive" : "yield-neutral");
    rateEl.classList.add("is-positive");
    messageEl.classList.add("is-good");
    mainColor = "rgba(59, 130, 246, 0.9)";
    message = "Você está no caminho certo.";
  } else if (savingsRate > 0) {
    valueEl.classList.add("yield-neutral");
    rateEl.classList.add("is-neutral");
    messageEl.classList.add("is-ok");
    mainColor = "rgba(245, 158, 11, 0.9)";
    message = "Dá para economizar mais no próximo mês.";
  } else if (balance < 0 || expense > 0) {
    valueEl.classList.add("yield-negative");
    rateEl.classList.add("is-negative");
    messageEl.classList.add("is-warning");
    mainColor = "rgba(239, 68, 68, 0.9)";
    message = "Atenção: suas saídas estão acima do ideal.";
  } else {
    valueEl.classList.add("yield-neutral");
    rateEl.classList.add("is-neutral");
    messageEl.classList.add("is-neutral");
  }

  messageEl.textContent = message;

  if (monthlyEconomyChart) {
    monthlyEconomyChart.destroy();
    monthlyEconomyChart = null;
  }

  if (typeof Chart !== "undefined") {
    monthlyEconomyChart = new Chart(chartCanvas, {
      type: "doughnut",
      data: {
        labels: ["Economia", "Consumo"],
        datasets: [
          {
            data: [savingsRate, Math.max(100 - savingsRate, 0)],
            backgroundColor: [mainColor, "rgba(148, 163, 184, 0.22)"],
            borderWidth: 0,
            cutout: "72%",
            hoverOffset: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                const value = Number(context.raw || 0);
                const formatted = typeof formatPercentBR === "function"
                  ? formatPercentBR(value)
                  : `${value.toFixed(2).replace(".", ",")}%`;
                return `${context.label}: ${formatted}`;
              }
            }
          }
        }
      }
    });
  }
}

function normalizeDashboardText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function getDashboardMonthTransactions(transactions, month, year) {
  const monthNumber = Math.max(1, Math.min(12, Math.floor(toNumber(month, 0))));
  const yearNumber = Math.floor(toNumber(year, 0));
  if (!monthNumber || !yearNumber) return [];

  const source = Array.isArray(transactions) ? transactions : [];
  return source.filter((tx) => {
    const parsed = parseDashboardTransactionDate(tx?.date || tx?.createdAt);
    if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) return false;
    return parsed.getFullYear() === yearNumber && parsed.getMonth() + 1 === monthNumber;
  });
}

function normalizeDashboardTransactionGroup(value) {
  const group = normalizeDashboardText(value);
  if (group === "fixed") return "fixed";
  if (group === "variable") return "variable";
  if (group === "planned") return "planned";
  if (group === "unexpected") return "unexpected";
  return "unexpected";
}

function createEmptySpendingProfileGroupMap() {
  return {
    fixed: [],
    variable: [],
    planned: [],
    unexpected: [],
  };
}

function getSpendingProfileGroupLabel(groupKey) {
  return SPENDING_PROFILE_GROUP_LABELS[groupKey] || SPENDING_PROFILE_GROUP_LABELS.unexpected;
}

function getSpendingProfileMoneyFormatter(formatMoney) {
  if (typeof formatMoney === "function") return formatMoney;
  if (typeof formatCurrency === "function") return formatCurrency;
  return (value) =>
    Number(value || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
}

function formatSpendingProfilePeriodLabel(month, year) {
  const monthNumber = Math.max(1, Math.min(12, Math.floor(toNumber(month, 0))));
  const yearNumber = Math.floor(toNumber(year, 0));
  if (!monthNumber || !yearNumber) return "Per\u00edodo selecionado";

  const periodDate = new Date(yearNumber, monthNumber - 1, 1);
  const rawLabel = periodDate.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return rawLabel ? rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1) : "Per\u00edodo selecionado";
}

function updateSpendingProfileGroupButtons(groups) {
  const grouped = groups && typeof groups === "object"
    ? groups
    : createEmptySpendingProfileGroupMap();

  const buttons = document.querySelectorAll("[data-spending-group-open]");
  if (!buttons.length) return;

  buttons.forEach((button) => {
    const groupKey = normalizeDashboardTransactionGroup(button.dataset.spendingGroupOpen);
    const hasTransactions = Array.isArray(grouped[groupKey]) && grouped[groupKey].length > 0;
    const groupLabel = getSpendingProfileGroupLabel(groupKey).toLowerCase();
    const row = button.closest(".spending-profile-group-row");

    button.classList.toggle("d-none", !hasTransactions);
    button.disabled = !hasTransactions;
    button.setAttribute("aria-hidden", hasTransactions ? "false" : "true");
    button.setAttribute(
      "aria-label",
      hasTransactions
        ? `Ver lan\u00e7amentos de ${groupLabel}`
        : `Sem lan\u00e7amentos em ${groupLabel}`
    );

    if (row) {
      row.classList.toggle("is-clickable", hasTransactions);
      row.tabIndex = hasTransactions ? 0 : -1;
      row.setAttribute("role", hasTransactions ? "button" : "group");
      row.setAttribute(
        "aria-label",
        hasTransactions
          ? `Abrir hist\u00f3rico de ${groupLabel}`
          : `Sem lan\u00e7amentos em ${groupLabel}`
      );
    }
  });
}

function getSpendingProfileGroupModalInstance() {
  const modalEl = document.getElementById("spendingProfileGroupModal");
  if (!modalEl || typeof bootstrap === "undefined" || !bootstrap?.Modal) return null;
  if (!spendingProfileGroupModal) {
    spendingProfileGroupModal = bootstrap.Modal.getOrCreateInstance(modalEl);
  }
  return spendingProfileGroupModal;
}

function renderSpendingProfileGroupModal(groupKey) {
  const normalizedGroup = normalizeDashboardTransactionGroup(groupKey);
  const modalEl = document.getElementById("spendingProfileGroupModal");
  const periodEl = document.getElementById("spendingProfileGroupPeriod");
  const nameEl = document.getElementById("spendingProfileGroupName");
  const countEl = document.getElementById("spendingProfileGroupCount");
  const listEl = document.getElementById("spendingProfileGroupList");
  const emptyEl = document.getElementById("spendingProfileGroupEmpty");
  if (!modalEl || !periodEl || !nameEl || !countEl || !listEl || !emptyEl) return;

  const items = Array.isArray(spendingProfileState.groups?.[normalizedGroup])
    ? spendingProfileState.groups[normalizedGroup]
    : [];
  const count = items.length;
  const money = getSpendingProfileMoneyFormatter(spendingProfileState.formatMoney);
  const groupLabel = getSpendingProfileGroupLabel(normalizedGroup);
  const periodLabel = formatSpendingProfilePeriodLabel(
    spendingProfileState.month,
    spendingProfileState.year
  );

  periodEl.textContent = periodLabel;
  nameEl.textContent = groupLabel;
  countEl.textContent = `${count} lan\u00e7amento${count === 1 ? "" : "s"}`;

  if (!count) {
    listEl.innerHTML = "";
    emptyEl.classList.remove("d-none");
  } else {
    emptyEl.classList.add("d-none");
    listEl.innerHTML = items
      .map((tx) => {
        const title = resolveDashboardTransactionTitle(tx, "Saida");
        const category = String(tx?.category || "Sem categoria").trim() || "Sem categoria";
        const actor = resolveDashboardTransactionActor(tx);
        const dateLabel = formatDateUserLocal(tx?.date || tx?.createdAt, {
          locale: "pt-BR",
          includeTime: true,
          dateStyle: "short",
          timeStyle: "short",
          fallback: "-",
        });
        const metaParts = [category];
        if (actor) metaParts.push(actor);
        if (dateLabel && dateLabel !== "-") metaParts.push(dateLabel);
        const safeTitle = escapeHtml(title);
        const safeMeta = escapeHtml(metaParts.join(" | "));
        const value = Math.max(toNumber(tx?.value, 0), 0);

        return `
          <li class="list-group-item spending-profile-history-item">
            <div class="spending-profile-history-head">
              <span class="spending-profile-history-title" title="${safeTitle}">${safeTitle}</span>
              <span class="spending-profile-history-value">${money(value)}</span>
            </div>
            <div class="spending-profile-history-meta">${safeMeta}</div>
          </li>
        `;
      })
      .join("");
  }

  const modal = getSpendingProfileGroupModalInstance();
  if (modal) modal.show();
}

function bindSpendingProfileGroupActions() {
  const buttons = document.querySelectorAll("[data-spending-group-open]");
  if (!buttons.length) return;

  buttons.forEach((button) => {
    if (button.dataset.spendingGroupBound === "1") return;
    button.dataset.spendingGroupBound = "1";

    button.addEventListener("click", (event) => {
      event.preventDefault();
      const groupKey = button.dataset.spendingGroupOpen || "";
      renderSpendingProfileGroupModal(groupKey);
    });

    const row = button.closest(".spending-profile-group-row");
    if (row && row.dataset.spendingGroupBound !== "1") {
      row.dataset.spendingGroupBound = "1";

      row.addEventListener("click", (event) => {
        if (button.classList.contains("d-none") || button.disabled) return;
        if (event.target && event.target.closest("button[data-spending-group-open]")) return;
        event.preventDefault();
        const groupKey = button.dataset.spendingGroupOpen || "";
        renderSpendingProfileGroupModal(groupKey);
      });

      row.addEventListener("keydown", (event) => {
        if (button.classList.contains("d-none") || button.disabled) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        const groupKey = button.dataset.spendingGroupOpen || "";
        renderSpendingProfileGroupModal(groupKey);
      });
    }
  });
}

function bindSpendingProfileGroupModalState() {
  const modalEl = document.getElementById("spendingProfileGroupModal");
  if (!modalEl) return;
  if (modalEl.dataset.spendingProfileModalStateBound === "1") return;
  modalEl.dataset.spendingProfileModalStateBound = "1";

  modalEl.addEventListener("shown.bs.modal", () => {
    document.body.classList.add("spending-profile-modal-open");
  });

  modalEl.addEventListener("hidden.bs.modal", () => {
    document.body.classList.remove("spending-profile-modal-open");
  });
}

function renderSpendingProfile(monthTransactions, formatMoney) {
  const totalEl = document.getElementById("spendingProfileTotal");
  const countEl = document.getElementById("spendingProfileCount");
  const topEl = document.getElementById("spendingProfileTop");
  const messageEl = document.getElementById("spendingProfileMessage");
  const fixedEl = document.getElementById("spendingProfileFixed");
  const variableEl = document.getElementById("spendingProfileVariable");
  const plannedEl = document.getElementById("spendingProfilePlanned");
  const unexpectedEl = document.getElementById("spendingProfileUnexpected");
  if (
    !totalEl || !countEl || !topEl || !messageEl ||
    !fixedEl || !variableEl || !plannedEl || !unexpectedEl
  ) {
    return;
  }

  const expenses = (Array.isArray(monthTransactions) ? monthTransactions : []).filter(
    (tx) => normalizeDashboardText(tx?.type) === "expense"
  );

  const groups = {
    fixed: 0,
    variable: 0,
    planned: 0,
    unexpected: 0,
  };
  const groupedTransactions = createEmptySpendingProfileGroupMap();

  expenses.forEach((tx) => {
    const value = Math.max(toNumber(tx?.value, 0), 0);
    const group = normalizeDashboardTransactionGroup(tx?.group);
    groups[group] += value;
    groupedTransactions[group].push(tx);
  });

  Object.keys(groupedTransactions).forEach((groupKey) => {
    groupedTransactions[groupKey].sort((a, b) => {
      const dateA = parseDashboardTransactionDate(a?.date || a?.createdAt)?.getTime() || 0;
      const dateB = parseDashboardTransactionDate(b?.date || b?.createdAt)?.getTime() || 0;
      return dateB - dateA;
    });
  });

  const total = round2(groups.fixed + groups.variable + groups.planned + groups.unexpected);
  const count = expenses.length;
  const ordered = Object.entries(groups).sort((a, b) => b[1] - a[1]);
  const topKey = ordered[0]?.[0] || "fixed";
  const topValue = Math.max(toNumber(ordered[0]?.[1], 0), 0);
  const topPct = total > 0 ? Math.max(0, Math.min((topValue / total) * 100, 100)) : 0;
  const topPctLabel = typeof formatPercentBR === "function"
    ? formatPercentBR(topPct)
    : `${topPct.toFixed(2).replace(".", ",")}%`;

  const month = Math.max(1, Math.min(12, Math.floor(toNumber(document.getElementById("month")?.value, 0))));
  const year = Math.floor(toNumber(document.getElementById("year")?.value, 0));
  spendingProfileState.month = month;
  spendingProfileState.year = year;
  spendingProfileState.groups = groupedTransactions;
  spendingProfileState.formatMoney = getSpendingProfileMoneyFormatter(formatMoney);

  updateSpendingProfileGroupButtons(groupedTransactions);
  bindSpendingProfileGroupActions();

  totalEl.textContent = formatMoney(total);
  countEl.textContent = String(count);
  fixedEl.textContent = formatMoney(groups.fixed);
  variableEl.textContent = formatMoney(groups.variable);
  plannedEl.textContent = formatMoney(groups.planned);
  unexpectedEl.textContent = formatMoney(groups.unexpected);

  topEl.classList.remove("is-positive", "is-negative", "is-neutral");
  messageEl.classList.remove("is-great", "is-good", "is-ok", "is-warning", "is-neutral");

  let message = "Sem sa\u00eddas no per\u00edodo selecionado.";
  if (count <= 0 || total <= 0) {
    topEl.classList.add("is-neutral");
    messageEl.classList.add("is-neutral");
    topEl.textContent = "Sem dados";
  } else {
    topEl.textContent = `${getSpendingProfileGroupLabel(topKey)} ${topPctLabel}`;
    if (topKey === "unexpected" && topPct >= 30) {
      topEl.classList.add("is-negative");
      messageEl.classList.add("is-warning");
      message = "Aten\u00e7\u00e3o: imprevistos representam parcela alta das sa\u00eddas.";
    } else if (topKey === "fixed" && topPct >= 50) {
      topEl.classList.add("is-positive");
      messageEl.classList.add("is-good");
      message = "Custos fixos s\u00e3o a maior parte das sa\u00eddas.";
    } else if (topKey === "planned" && topPct >= 35) {
      topEl.classList.add("is-positive");
      messageEl.classList.add("is-good");
      message = "Boa parte das sa\u00eddas foi prevista.";
    } else if (topKey === "variable" && topPct >= 45) {
      topEl.classList.add("is-neutral");
      messageEl.classList.add("is-ok");
      message = "Gastos vari\u00e1veis lideram neste m\u00eas.";
    } else {
      topEl.classList.add("is-neutral");
      messageEl.classList.add("is-neutral");
      message = "Distribui\u00e7\u00e3o de gastos equilibrada.";
    }
  }

  messageEl.textContent = message;
}

function parseDashboardTransactionDate(value) {
  if (typeof parseDateLikeLocal === "function") {
    return parseDateLikeLocal(value, { middayHour: 12 });
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDashboardLatestTransactions(transactions, limit = 3) {
  const list = Array.isArray(transactions) ? transactions : [];
  const maxItems = Math.max(0, Math.floor(toNumber(limit, 3)));

  return list
    .map((tx) => {
      const parsedDate = parseDashboardTransactionDate(tx?.date || tx?.createdAt);
      return {
        tx,
        dateMs: parsedDate ? parsedDate.getTime() : 0,
      };
    })
    .sort((a, b) => b.dateMs - a.dateMs)
    .slice(0, maxItems)
    .map((item) => item.tx);
}

function resolveDashboardTransactionTitle(tx, typeLabel) {
  const raw = [
    tx?.description,
    tx?.title,
    tx?.name,
    tx?.category,
    tx?.accountName,
    tx?.boxName,
  ].find((value) => String(value || "").trim());

  return raw ? String(raw).trim() : typeLabel;
}

function resolveDashboardTransactionActor(tx) {
  const candidates = [
    tx?.userName,
    tx?.createdByName,
    tx?.authorName,
    tx?.memberName,
    tx?.user?.name,
    tx?.createdBy?.name,
  ];

  const raw = candidates.find((value) => String(value || "").trim());
  return raw ? String(raw).trim() : "";
}

function renderLatestTransactions(transactions, formatMoney) {
  const section = document.getElementById("latestTransactionsSection");
  const list = document.getElementById("latestTransactionsList");
  if (!section || !list) return;

  const latest = getDashboardLatestTransactions(transactions, 3);
  if (!latest.length) {
    list.innerHTML = "";
    section.classList.add("d-none");
    return;
  }

  const money =
    typeof formatMoney === "function"
      ? formatMoney
      : (value) => {
        if (typeof formatCurrency === "function") return formatCurrency(value);
        return Number(value || 0).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
      };

  list.innerHTML = "";

  latest.forEach((tx) => {
    const type = String(tx?.type || "").trim().toLowerCase() === "income" ? "income" : "expense";
    const toneClass = type === "income" ? "is-income" : "is-expense";
    const icon = type === "income" ? "fa-arrow-down-long" : "fa-arrow-up-long";
    const typeLabel = type === "income" ? "Entrada" : "Saída";
    const title = resolveDashboardTransactionTitle(tx, typeLabel);
    const value = Number(tx?.value || 0);
    const actor = resolveDashboardTransactionActor(tx);
    const category = String(tx?.category || typeLabel).trim();
    const dateLabel = formatDateUserLocal(tx?.date || tx?.createdAt, {
      locale: "pt-BR",
      includeTime: true,
      dateStyle: "short",
      timeStyle: "short",
      fallback: "-",
    });
    const meta = actor ? `${category} · ${actor}` : category;

    list.innerHTML += `
      <li class="list-group-item latest-transaction-item ${toneClass}">
        <div class="latest-transaction-main">
          <div class="latest-transaction-title-wrap">
            <span class="latest-transaction-icon">
              <i class="fa-solid ${icon}"></i>
            </span>
            <span class="latest-transaction-title">${escapeHtml(title)}</span>
          </div>
          <div class="latest-transaction-meta">${escapeHtml(meta)} · ${escapeHtml(dateLabel)}</div>
        </div>
        <strong class="latest-transaction-value">${money(value)}</strong>
      </li>
    `;
  });
  section.classList.remove("d-none");
}

function normalizeDashboardTransactionType(value) {
  const normalized = normalizeDashboardText(value);
  if (["income", "entrada", "receita", "rendimento"].includes(normalized)) return "income";
  if (["expense", "saida", "despesa"].includes(normalized)) return "expense";
  return "";
}

function getDashboardTotalBalanceFromSummary(summary) {
  const source = summary && typeof summary === "object" ? summary : {};
  const directKeys = [
    "totalBalance",
    "currentBalance",
    "walletBalance",
    "availableBalance",
    "balanceTotal",
    "netBalance",
    "allTimeBalance",
  ];

  for (const key of directKeys) {
    const value = toNumber(source?.[key], Number.NaN);
    if (Number.isFinite(value)) return round2(value);
  }

  const nestedCandidates = [source?.totals, source?.wallet, source?.summary];
  for (const candidate of nestedCandidates) {
    if (!candidate || typeof candidate !== "object") continue;
    for (const key of directKeys) {
      const value = toNumber(candidate?.[key], Number.NaN);
      if (Number.isFinite(value)) return round2(value);
    }
  }

  return Number.NaN;
}

function calculateDashboardAllPeriodBalance(transactions) {
  const list = Array.isArray(transactions) ? transactions : [];
  let income = 0;
  let expense = 0;

  list.forEach((tx) => {
    const txType = normalizeDashboardTransactionType(tx?.type);
    const txValueRaw = toNumber(tx?.value, Number.NaN);
    const txValueAbs = Number.isFinite(txValueRaw) ? Math.abs(txValueRaw) : Number.NaN;

    const impactCandidates = [
      tx?.impactOnBalance,
      tx?.balanceImpact,
      tx?.amountSigned,
      tx?.signedValue,
    ];
    let signedImpact = Number.NaN;
    for (const candidate of impactCandidates) {
      const value = toNumber(candidate, Number.NaN);
      if (Number.isFinite(value)) {
        signedImpact = value;
        break;
      }
    }

    if (txType === "income") {
      const amount = Number.isFinite(txValueAbs)
        ? txValueAbs
        : (Number.isFinite(signedImpact) ? Math.abs(signedImpact) : 0);
      income += amount;
      return;
    }

    if (txType === "expense") {
      const amount = Number.isFinite(txValueAbs)
        ? txValueAbs
        : (Number.isFinite(signedImpact) ? Math.abs(signedImpact) : 0);
      expense += amount;
      return;
    }

    if (Number.isFinite(signedImpact)) {
      if (signedImpact >= 0) income += signedImpact;
      else expense += Math.abs(signedImpact);
      return;
    }

    if (Number.isFinite(txValueRaw)) {
      if (txValueRaw >= 0) income += txValueRaw;
      else expense += Math.abs(txValueRaw);
    }
  });

  return round2(income - expense);
}

/* ===============================
   RESUMO
================================ */

async function loadSummary(month, year) {
  try {
    const [summary, allTransactions, detailedBoxes, detailedAccounts] = await Promise.all([
      apiFetch(`/dashboard/summary?month=${month}&year=${year}`),
      apiFetch("/transactions"),
      apiFetch("/boxes").catch(() => null),
      apiFetch("/accounts").catch(() => null)
    ]);

    const formatMoney = (value) => {
      if (typeof formatCurrency === "function") return formatCurrency(value);
      return Number(value || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    };

    const allTransactionsList = Array.isArray(allTransactions?.transactions)
      ? allTransactions.transactions
      : Array.isArray(allTransactions)
        ? allTransactions
        : [];
    const monthTransactionsList = getDashboardMonthTransactions(
      allTransactionsList,
      month,
      year
    );

    renderLatestTransactions(allTransactionsList, formatMoney);

    const incomeMonth = round2(toNumber(summary?.income, 0));
    const expenseMonth = round2(toNumber(summary?.expense, 0));
    const monthlyBalance = round2(toNumber(summary?.balance, incomeMonth - expenseMonth));

    const summaryTotalBalance = getDashboardTotalBalanceFromSummary(summary);
    const txTotalBalance = calculateDashboardAllPeriodBalance(allTransactionsList);
    const dashboardBalance = Number.isFinite(summaryTotalBalance)
      ? summaryTotalBalance
      : txTotalBalance;

    document.getElementById("income").innerText = formatMoney(incomeMonth);
    document.getElementById("expense").innerText = formatMoney(expenseMonth);
    document.getElementById("balance").innerText = formatMoney(dashboardBalance);

    renderMonthlyEconomy(monthlyBalance, expenseMonth, formatMoney);
    renderSpendingProfile(monthTransactionsList, formatMoney);

    const boxesData = extractArrayFromPayloadStrict(detailedBoxes, ["boxes", "items"]);
    const summaryBoxes = extractArrayFromPayloadStrict(summary, ["boxes", "items"]);
    const finalBoxesData = boxesData.length ? boxesData : summaryBoxes;
    renderDashboardBoxes(finalBoxesData, formatMoney);

    const accountsData = extractArrayFromPayloadStrict(detailedAccounts, ["accounts", "items"]);
    const summaryAccounts = extractArrayFromPayloadStrict(summary, ["accounts", "items"]);
    const finalAccountsData = accountsData.length ? accountsData : summaryAccounts;
    renderDashboardAccounts(finalAccountsData, formatMoney);
  } catch (err) {
    console.error(err);
    renderLatestTransactions([], null);
    showAlert("Erro ao carregar resumo", "danger", "triangle-exclamation");
  }
}

/* ===============================
   GRÁFICOS
================================ */

async function loadCharts(month, year) {
  try {
    const rangeStart = "2000-01-01T00:00:00.000Z";
    const rangeEnd = new Date().toISOString();

    const [monthData, allData] = await Promise.all([
      apiFetch(`/transactions/month?month=${month}&year=${year}`),
      apiFetch(`/transactions/range?start=${encodeURIComponent(rangeStart)}&end=${encodeURIComponent(rangeEnd)}`)
        .catch(() => apiFetch("/transactions")),
    ]);

    const monthTransactions = Array.isArray(monthData?.transactions)
      ? monthData.transactions
      : [];
    const allTransactions = Array.isArray(allData?.transactions)
      ? allData.transactions
      : Array.isArray(allData)
        ? allData
        : [];

    // Importante: guarda as transações antes, para os seletores re-renderizarem.
    window.setDashboardTransactions(monthTransactions);
    if (typeof window.setDashboardAllTransactions === "function") {
      window.setDashboardAllTransactions(allTransactions);
    }
    if (typeof window.setDashboardFlowReference === "function") {
      window.setDashboardFlowReference(month, year);
    }

    renderIncomeExpenseChart(allTransactions, { month, year });
    renderExpenseCategoryChart(monthTransactions);
    if (typeof window.updateChartExpandersAvailability === "function") {
      window.updateChartExpandersAvailability();
    }
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



