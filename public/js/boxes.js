let boxesCache = [];
let investmentPreviewBaseValue = 0;
const marketCdiState = {
  annualRatePercent: 0,
  dailyRatePercent: 0,
  referenceDate: "",
  stale: false,
  fallback: false,
  loaded: false,
  loading: false,
};

function moneyBR(value) {
  if (typeof formatCurrency === "function") return formatCurrency(Number(value || 0));
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function percentBR(value) {
  if (typeof formatPercentBR === "function") return formatPercentBR(Number(value || 0));
  return `${Number(value || 0).toFixed(2).replace(".", ",")}%`;
}

function getEl(id) {
  return document.getElementById(id);
}

function openModal(id) {
  const el = getEl(id);
  if (!el) return null;
  const modal = bootstrap.Modal.getOrCreateInstance(el);
  modal.show();
  return modal;
}

function closeModal(id) {
  const el = getEl(id);
  if (!el) return;
  const modal = bootstrap.Modal.getInstance(el);
  if (modal) modal.hide();
}

function toNumber(value, fallback = 0) {
  if (typeof toNumericValue === "function") return toNumericValue(value, fallback);
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value) {
  const n = toNumber(value, 0);
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function todayYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateBR(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("pt-BR");
}

function toYmd(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = String(value).trim().toLowerCase();
  if (["false", "0", "no", "off", "nao", "não"].includes(normalized)) return false;
  if (["true", "1", "yes", "on", "sim"].includes(normalized)) return true;
  return fallback;
}

function getApiBaseUrl() {
  return String(window.__API_URL__ || "").trim();
}

function getStoredToken() {
  try {
    return localStorage.getItem("token");
  } catch (_) {
    return null;
  }
}

function setCdiInfoText(message) {
  const info = getEl("boxCdiInfo");
  if (!info) return;
  info.textContent = message;
}

function updateManualCdiFieldState() {
  const autoCdiInput = getEl("boxAutoCdi");
  const cdiInput = getEl("boxCdiAnnualRate");
  if (!autoCdiInput || !cdiInput) return;

  cdiInput.disabled = !!autoCdiInput.checked;
}

async function fetchMarketCdiRate({ forceRefresh = false } = {}) {
  if (marketCdiState.loading && !forceRefresh) {
    return marketCdiState.annualRatePercent;
  }

  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return 0;

  const token = getStoredToken();
  const query = forceRefresh ? "?refresh=1" : "";
  const endpoint = `${baseUrl}/boxes/market/cdi${query}`;

  marketCdiState.loading = true;
  setCdiInfoText("Carregando CDI oficial...");

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        Accept: "application/json",
      },
    });

    if (response.status === 401) {
      if (typeof appLogout === "function") appLogout("401");
      throw new Error("Sessão expirada");
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const annualRate = Math.max(round2(toNumber(data?.annualRatePercent, 0)), 0);

    if (annualRate <= 0) {
      throw new Error("CDI oficial indisponível");
    }

    marketCdiState.annualRatePercent = annualRate;
    marketCdiState.dailyRatePercent = Math.max(round2(toNumber(data?.dailyRatePercent, 0)), 0);
    marketCdiState.referenceDate = String(data?.referenceDate || "").trim();
    marketCdiState.stale = !!data?.stale;
    marketCdiState.fallback = !!data?.fallback;
    marketCdiState.loaded = true;

    const tags = [];
    if (marketCdiState.stale) tags.push("cache");
    if (marketCdiState.fallback) tags.push("fallback");
    const suffix = tags.length ? ` (${tags.join(", ")})` : "";
    const dateLabel = marketCdiState.referenceDate ? ` em ${marketCdiState.referenceDate}` : "";

    setCdiInfoText(`CDI oficial: ${percentBR(annualRate)}${dateLabel}${suffix}`);
    return annualRate;
  } catch (_) {
    if (marketCdiState.loaded && marketCdiState.annualRatePercent > 0) {
      setCdiInfoText(`CDI oficial em cache: ${percentBR(marketCdiState.annualRatePercent)}`);
      return marketCdiState.annualRatePercent;
    }

    setCdiInfoText("Não foi possível carregar o CDI oficial. Informe manualmente.");
    return 0;
  } finally {
    marketCdiState.loading = false;
  }
}

function annualToDailyRate(annualRatePercent) {
  const annual = Math.max(toNumber(annualRatePercent, 0), 0);
  if (annual <= 0) return 0;
  return Math.pow(1 + annual / 100, 1 / 252) - 1;
}

function monthlyToAnnualPercent(monthlyRatePercent) {
  const monthly = Math.max(toNumber(monthlyRatePercent, 0), 0);
  if (monthly <= 0) return 0;
  return round2((Math.pow(1 + monthly / 100, 12) - 1) * 100);
}

function normalizeInvestment(raw = {}) {
  const typeRaw = String(raw.investmentType || "none").trim().toLowerCase();
  const autoCdi = toBoolean(raw.autoCdi, true);

  let cdiAnnualRate = Math.max(
    round2(toNumber(raw.cdiAnnualRate ?? raw.benchmarkAnnualRate, 0)),
    0
  );

  let cdiPercentage = Math.max(
    round2(toNumber(raw.cdiPercentage ?? raw.yieldPercentage, 100)),
    0
  );

  if (cdiPercentage <= 0) cdiPercentage = 100;

  if (cdiAnnualRate <= 0) {
    const monthlyFromLegacy = Math.max(round2(toNumber(raw.yieldMonthlyRate, 0)), 0);
    if (monthlyFromLegacy > 0) {
      const effectiveAnnual = monthlyToAnnualPercent(monthlyFromLegacy);
      cdiAnnualRate = cdiPercentage > 0
        ? round2(effectiveAnnual / (cdiPercentage / 100))
        : effectiveAnnual;
    }
  }

  const hasYieldData = cdiAnnualRate > 0 || toNumber(raw.yieldMonthlyRate, 0) > 0;
  const hasCdiSignal =
    autoCdi ||
    cdiAnnualRate > 0 ||
    cdiPercentage > 0 ||
    toNumber(raw.yieldMonthlyRate, 0) > 0 ||
    toNumber(raw.benchmarkAnnualRate, 0) > 0;

  let investmentType = "none";
  if (typeRaw === "cdb_cdi") investmentType = "cdb_cdi";
  if (["cdi", "custom", "fixed", "selic", "ipca"].includes(typeRaw) && hasYieldData) {
    investmentType = "cdb_cdi";
  }
  if (investmentType === "none" && hasCdiSignal) {
    investmentType = "cdb_cdi";
  }

  if (investmentType !== "none" && !hasYieldData && !autoCdi) {
    investmentType = "none";
  }

  if (investmentType === "none") {
    return {
      investmentType: "none",
      cdiAnnualRate: 0,
      cdiPercentage: 0,
      autoCdi: false,
    };
  }

  return {
    investmentType: "cdb_cdi",
    cdiAnnualRate,
    cdiPercentage,
    autoCdi,
  };
}

function getEffectiveAnnualRate(investment) {
  if (investment.investmentType !== "cdb_cdi") return 0;

  const annualRate = Math.max(round2(toNumber(investment.cdiAnnualRate, 0)), 0);
  return round2(annualRate * (investment.cdiPercentage / 100));
}

function getEstimatedDailyYield(currentValue, effectiveAnnualRate) {
  const base = Math.max(toNumber(currentValue, 0), 0);
  const dailyRate = annualToDailyRate(effectiveAnnualRate);
  return round2(base * dailyRate);
}

function getInvestmentDisplayName(box, investment) {
  if (investment.investmentType === "cdb_cdi") {
    return `CDB (${percentBR(investment.cdiPercentage)} do CDI)`;
  }

  if (box?.investmentDisplayName) return box.investmentDisplayName;
  return "Sem rendimento";
}

function getInvestmentPillClass(investmentType) {
  return investmentType === "none" ? "none" : "active";
}

function getFormAutoCdiEnabled() {
  const autoInput = getEl("boxAutoCdi");
  return autoInput ? !!autoInput.checked : true;
}

function getFormAutoYieldToWalletEnabled() {
  const autoInput = getEl("boxAutoYieldToWallet");
  return autoInput ? !!autoInput.checked : true;
}

function getFormManualCdiAnnualRate() {
  return Math.max(round2(toNumber(getEl("boxCdiAnnualRate")?.value, 0)), 0);
}

function getFormEffectiveCdiAnnualRate() {
  const manualRate = getFormManualCdiAnnualRate();
  if (!getFormAutoCdiEnabled()) return manualRate;

  if (marketCdiState.loaded && marketCdiState.annualRatePercent > 0) {
    return marketCdiState.annualRatePercent;
  }

  return manualRate;
}

function pickPositive(primary, fallback = 0) {
  const p = toNumber(primary, NaN);
  if (Number.isFinite(p) && p > 0) return p;
  const f = toNumber(fallback, 0);
  return f > 0 ? f : 0;
}

function buildBoxUpdatePayload(box, overrides = {}) {
  const current = box && typeof box === "object" ? box : {};
  const investment = normalizeInvestment(current);
  const isCdb = investment.investmentType === "cdb_cdi";

  const payload = {
    name: String(current.name || "").trim() || "Caixinha",
    isEmergency: !!current.isEmergency,
    goalAmount: Math.max(round2(toNumber(current.goalAmount, 0)), 0),
    investmentType: isCdb ? "cdb_cdi" : "none",
    autoCdi: isCdb ? !!investment.autoCdi : false,
    autoYieldToWallet: isCdb ? toBoolean(current.autoYieldToWallet, true) : false,
    cdiAnnualRate: 0,
    cdiPercentage: 0,
  };

  if (isCdb) {
    payload.cdiAnnualRate = pickPositive(current.cdiAnnualRate, investment.cdiAnnualRate);
    payload.cdiPercentage = Math.max(round2(toNumber(current.cdiPercentage, investment.cdiPercentage)), 0);

    if (payload.cdiPercentage <= 0) payload.cdiPercentage = 100;

    if (!payload.autoCdi && payload.cdiAnnualRate <= 0) {
      throw new Error("Não foi possível atualizar por configuração incompleta. Abra em Editar.");
    }
  }

  return {
    ...payload,
    ...overrides,
  };
}

async function toggleBoxAutoYieldToWallet(boxId, enabled, inputEl = null) {
  const box = boxesCache.find((item) => String(item?._id || "") === String(boxId || ""));
  if (!box) return;

  const previousValue = toBoolean(box.autoYieldToWallet, true);
  const nextValue = !!enabled;

  if (previousValue === nextValue) return;

  if (inputEl) inputEl.disabled = true;

  try {
    const payload = buildBoxUpdatePayload(box, {
      autoYieldToWallet: nextValue,
    });

    const updated = await apiFetch(`/boxes/${boxId}`, "PUT", payload);

    if (updated && typeof updated === "object") {
      boxesCache = boxesCache.map((item) => (item._id === boxId ? updated : item));
    } else {
      boxesCache = boxesCache.map((item) =>
        item._id === boxId ? { ...item, autoYieldToWallet: nextValue } : item
      );
    }

    renderBoxes();
    showAlert("Configuração de rendimento atualizada", "success", "check-circle");
  } catch (err) {
    if (inputEl) inputEl.checked = previousValue;
    if (!/configuração incompleta/i.test(String(err?.message || ""))) {
      console.error(err);
      return;
    }
    showAlert(err.message, "warning", "triangle-exclamation");
  } finally {
    if (inputEl && document.body.contains(inputEl)) {
      inputEl.disabled = false;
    }
  }
}

async function fetchBoxes() {
  const data = await apiFetch("/boxes");
  boxesCache = Array.isArray(data) ? data : [];
  renderBoxes();
}

function renderBoxes() {
  const grid = getEl("boxesGrid");
  const empty = getEl("emptyBoxes");
  const newBoxBtn = getEl("newBoxBtn");
  if (!grid || !empty) return;

  grid.innerHTML = "";

  if (!boxesCache.length) {
    empty.classList.remove("d-none");
    if (newBoxBtn) newBoxBtn.classList.add("d-none");
    return;
  }

  empty.classList.add("d-none");
  if (newBoxBtn) newBoxBtn.classList.remove("d-none");

  boxesCache.forEach((box) => {
    const isEmergency = !!box.isEmergency;
    const investment = normalizeInvestment(box);

    const investmentName = getInvestmentDisplayName(box, investment);
    const fallbackCdiAnnualRate =
      investment.autoCdi && marketCdiState.annualRatePercent > 0
        ? marketCdiState.annualRatePercent
        : investment.cdiAnnualRate;

    const cdiAnnualRate = pickPositive(box.cdiAnnualRate, fallbackCdiAnnualRate);
    const effectiveAnnualRate = pickPositive(
      box.effectiveAnnualRate,
      getEffectiveAnnualRate({ ...investment, cdiAnnualRate })
    );
    const cdiPercentage = toNumber(box.cdiPercentage, investment.cdiPercentage);

    const dailyGrossYield = toNumber(
      box.estimatedDailyGrossYield ?? box.dailyGrossYield,
      getEstimatedDailyYield(box.currentValue, effectiveAnnualRate)
    );

    const dailyNetYield = toNumber(
      box.estimatedDailyNetYield ?? box.dailyLiquidity,
      dailyGrossYield
    );
    const principalValue = Math.max(toNumber(box.principalValue, box.currentValue), 0);
    const netCurrentValue = Math.max(toNumber(box.netCurrentValue, box.currentValue), 0);
    const totalGrossYield = Math.max(
      toNumber(
        box.grossProfit,
        round2(toNumber(box.currentValue, 0) - principalValue)
      ),
      0
    );
    const totalNetYield = Math.max(
      toNumber(
        box.netProfit,
        round2(netCurrentValue - principalValue)
      ),
      0
    );
    const holdingDays = Math.max(toNumber(box.holdingDays, 0), 0);
    const applicationDateLabel = formatDateBR(box.firstContributionAt || box.createdAt);
    const goalAmount = Math.max(round2(toNumber(box.goalAmount, 0)), 0);
    const goalHasTarget = goalAmount > 0;
    const goalProgressPercent = goalHasTarget
      ? Math.max(Math.min(round2(toNumber(box.goalProgressPercent, (box.currentValue / goalAmount) * 100)), 100), 0)
      : 0;
    const goalRemainingValue = goalHasTarget
      ? Math.max(round2(toNumber(box.goalRemainingValue, goalAmount - box.currentValue)), 0)
      : 0;
    const goalReached = goalHasTarget && goalProgressPercent >= 100;
    const canToggleAutoYield = investment.investmentType === "cdb_cdi";
    const autoYieldToWalletEnabled = canToggleAutoYield
      ? toBoolean(box.autoYieldToWallet, true)
      : false;
    const autoYieldLabel = !canToggleAutoYield
      ? "Não aplicável"
      : autoYieldToWalletEnabled
        ? "Ativo"
        : "Desativado";

    const col = document.createElement("div");
    col.className = "col-12 col-md-6 col-lg-4";

    col.innerHTML = `
      <div class="card box-card shadow-sm h-100">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <div class="box-title d-flex align-items-center gap-2">
                <i class="fa-solid ${isEmergency ? "fa-shield-heart text-warning" : "fa-piggy-bank text-primary"}"></i>
                <span>${box.name || "Sem nome"}</span>
              </div>
              <div class="text-muted small mt-1">
                ${isEmergency ? "Reserva de emergência" : "Caixinha"}
              </div>
            </div>

            <div class="dropdown">
              <button class="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" type="button">
                Ações
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li>
                  <button class="dropdown-item" data-action="deposit" data-id="${box._id}">
                    <i class="fa-solid fa-circle-plus me-2 text-success"></i>Depositar
                  </button>
                </li>
                <li>
                  <button class="dropdown-item" data-action="withdraw" data-id="${box._id}">
                    <i class="fa-solid fa-circle-minus me-2 text-danger"></i>Retirar
                  </button>
                </li>
                <li><hr class="dropdown-divider"></li>
                <li>
                  <button class="dropdown-item" data-action="edit" data-id="${box._id}">
                    <i class="fa-solid fa-pen me-2"></i>Editar
                  </button>
                </li>
                <li>
                  <button class="dropdown-item text-danger" data-action="delete" data-id="${box._id}">
                    <i class="fa-solid fa-trash me-2"></i>Excluir
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div class="mt-3">
            <div class="text-muted small">Saldo bruto</div>
            <div class="box-value">${moneyBR(box.currentValue)}</div>
          </div>

          <div class="box-meta">
            <div class="box-meta-row">
              <span class="label">Investimento</span>
              <span class="investment-pill ${getInvestmentPillClass(investment.investmentType)}">${investmentName}</span>
            </div>

            <div class="box-meta-row">
              <span class="label">CDI anual</span>
              <span class="value">${investment.investmentType === "cdb_cdi" ? percentBR(cdiAnnualRate) : "-"}</span>
            </div>

            <div class="box-meta-row">
              <span class="label">% do CDI</span>
              <span class="value">${investment.investmentType === "cdb_cdi" ? percentBR(cdiPercentage) : "-"}</span>
            </div>

            <div class="box-meta-row">
              <span class="label">Origem CDI</span>
              <span class="value">${investment.investmentType === "cdb_cdi" ? (investment.autoCdi ? "Oficial (auto)" : "Manual") : "-"}</span>
            </div>

            <div class="box-meta-row box-meta-row-toggle ${canToggleAutoYield ? "" : "is-disabled"}">
              <span class="label">Lançamento na carteira</span>
              <label class="form-check form-switch box-inline-switch mb-0">
                <input
                  class="form-check-input js-box-auto-yield-toggle"
                  type="checkbox"
                  data-id="${box._id}"
                  ${canToggleAutoYield ? "" : "disabled"}
                  ${autoYieldToWalletEnabled ? "checked" : ""}
                />
                <span class="box-inline-switch-text">${autoYieldLabel}</span>
              </label>
            </div>

            <div class="box-meta-row">
              <span class="label">Taxa efetiva anual</span>
              <span class="value">${investment.investmentType === "cdb_cdi" ? percentBR(effectiveAnnualRate) : "-"}</span>
            </div>

            <div class="box-meta-row">
              <span class="label">Rendimento diário bruto</span>
              <span class="value ${dailyGrossYield > 0 ? "yield-positive" : "yield-neutral"}">${moneyBR(dailyGrossYield)}</span>
            </div>

            <div class="box-meta-row">
              <span class="label">Rendimento diário líquido est.</span>
              <span class="value ${dailyNetYield > 0 ? "yield-positive" : "yield-neutral"}">${moneyBR(dailyNetYield)}</span>
            </div>

            <div class="box-meta-row">
              <span class="label">Valor aplicado</span>
              <span class="value">${moneyBR(principalValue)}</span>
            </div>

            <div class="box-meta-row">
              <span class="label">Meta</span>
              <span class="value ${goalReached ? "yield-positive" : ""}">${goalHasTarget ? moneyBR(goalAmount) : "-"}</span>
            </div>

            ${goalHasTarget ? `
              <div class="box-goal-progress-wrap">
                <div class="box-goal-progress-label">
                  <span>Progresso</span>
                  <span>${percentBR(goalProgressPercent)}</span>
                </div>
                <div class="progress box-goal-progress" role="progressbar" aria-valuenow="${goalProgressPercent}" aria-valuemin="0" aria-valuemax="100">
                  <div class="progress-bar ${goalReached ? "bg-success" : ""}" style="width: ${goalProgressPercent}%"></div>
                </div>
                <div class="box-goal-progress-note">
                  ${goalReached ? "Meta atingida" : `Faltam ${moneyBR(goalRemainingValue)}`}
                </div>
              </div>
            ` : ""}

            <div class="box-meta-row">
              <span class="label">Rendimento total bruto</span>
              <span class="value ${totalGrossYield > 0 ? "yield-positive" : "yield-neutral"}">${moneyBR(totalGrossYield)}</span>
            </div>

            <div class="box-meta-row">
              <span class="label">Rendimento total líquido est.</span>
              <span class="value ${totalNetYield > 0 ? "yield-positive" : "yield-neutral"}">${moneyBR(totalNetYield)}</span>
            </div>

            <div class="box-meta-row">
              <span class="label">Data da aplicação</span>
              <span class="value">${applicationDateLabel}</span>
            </div>

            <div class="box-meta-row">
              <span class="label">Valor líquido estimado</span>
              <span class="value">${moneyBR(netCurrentValue)}</span>
            </div>

            <div class="box-meta-row">
              <span class="label">Prazo acumulado</span>
              <span class="value">${holdingDays} dia(s)</span>
            </div>
          </div>
        </div>
      </div>
    `;

    grid.appendChild(col);
  });

  grid.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (!id) return;

      if (action === "deposit") openMoveModal(id, "in");
      if (action === "withdraw") openMoveModal(id, "out");
      if (action === "edit") openEditModal(id);
      if (action === "delete") openDeleteModal(id);
    });
  });

  grid.querySelectorAll(".js-box-auto-yield-toggle").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", async () => {
      const id = String(input.dataset.id || "").trim();
      if (!id) return;
      await toggleBoxAutoYieldToWallet(id, !!input.checked, input);
    });
  });
}

/* ========= Criar / Editar ========= */

function syncApplicationDateFieldState() {
  const applicationInput = getEl("boxApplicationDate");
  const initialInput = getEl("boxInitialValue");

  const isEditing = String(getEl("boxId")?.value || "").trim().length > 0;
  if (applicationInput) {
    applicationInput.disabled = isEditing;
  }
  if (initialInput) {
    initialInput.disabled = isEditing;
    if (isEditing) initialInput.value = "";
  }

  if (applicationInput && !isEditing && !applicationInput.value) {
    applicationInput.value = todayYmd();
  }
}

function syncAutoYieldWarning() {
  const warningEl = getEl("boxAutoYieldWarning");
  const investmentType = String(getEl("boxInvestmentType")?.value || "none").toLowerCase();
  const autoYieldEnabled = !!getEl("boxAutoYieldToWallet")?.checked;
  const shouldShow = investmentType === "cdb_cdi" && autoYieldEnabled;
  if (warningEl) warningEl.classList.toggle("d-none", !shouldShow);
}

function syncInvestmentFields() {
  const type = String(getEl("boxInvestmentType")?.value || "none").toLowerCase();

  const cdbWrap = getEl("boxCdbWrap");
  const previewWrap = getEl("boxYieldPreviewWrap");

  const isCdb = type === "cdb_cdi";

  if (cdbWrap) cdbWrap.classList.toggle("d-none", !isCdb);
  if (previewWrap) previewWrap.classList.toggle("d-none", !isCdb);

  updateManualCdiFieldState();
  syncApplicationDateFieldState();

  if (isCdb) {
    fetchMarketCdiRate().then(() => {
      updateInvestmentPreview();
    });
  } else {
    setCdiInfoText("CDI oficial sera carregado automaticamente.");
  }

  syncAutoYieldWarning();
  updateInvestmentPreview();
}

function getInvestmentPayloadFromForm() {
  let investmentType = String(getEl("boxInvestmentType")?.value || "none").toLowerCase();
  const autoCdi = getFormAutoCdiEnabled();
  const manualCdiAnnualRate = getFormManualCdiAnnualRate();
  const effectiveCdiAnnualRate = getFormEffectiveCdiAnnualRate();

  if (!["none", "cdb_cdi"].includes(investmentType)) {
    investmentType = "none";
  }

  const payload = {
    investmentType,
    autoCdi: investmentType === "cdb_cdi" ? autoCdi : false,
    autoYieldToWallet:
      investmentType === "cdb_cdi" ? getFormAutoYieldToWalletEnabled() : false,
    cdiAnnualRate: investmentType === "cdb_cdi" ? effectiveCdiAnnualRate : 0,
    cdiPercentage: Math.max(round2(toNumber(getEl("boxCdiPercentage")?.value, 0)), 0),
    manualCdiAnnualRate,
  };

  if (payload.investmentType === "none") {
    payload.autoCdi = false;
    payload.autoYieldToWallet = false;
    payload.cdiAnnualRate = 0;
    payload.cdiPercentage = 0;
    payload.manualCdiAnnualRate = 0;
  }

  return payload;
}

function validateInvestmentPayload(payload) {
  if (payload.investmentType === "none") return null;

  if (!payload.cdiPercentage || payload.cdiPercentage <= 0) {
    return "Informe o percentual do CDI";
  }

  if (!payload.autoCdi && (!payload.manualCdiAnnualRate || payload.manualCdiAnnualRate <= 0)) {
    return "Informe a taxa CDI anual (%) no modo manual";
  }

  return null;
}

function updateInvestmentPreview() {
  const previewEl = getEl("boxYieldPreview");
  const annualEl = getEl("boxEffectiveAnnualPreview");

  if (!previewEl || !annualEl) return;

  const editingId = String(getEl("boxId")?.value || "").trim();
  if (!editingId) {
    investmentPreviewBaseValue = Math.max(toNumber(getEl("boxInitialValue")?.value, 0), 0);
  }

  const investment = getInvestmentPayloadFromForm();
  const effectiveAnnual = getEffectiveAnnualRate(investment);

  const estimatedDaily = getEstimatedDailyYield(investmentPreviewBaseValue, effectiveAnnual);

  previewEl.textContent = moneyBR(estimatedDaily);
  annualEl.textContent =
    investment.investmentType === "cdb_cdi" && effectiveAnnual > 0
      ? percentBR(effectiveAnnual)
      : percentBR(0);
}

function resetBoxForm() {
  getEl("boxId").value = "";
  getEl("boxName").value = "";
  getEl("boxInitialValue").value = "";
  getEl("boxGoalAmount").value = "";
  getEl("boxInitialValue").disabled = false;
  getEl("boxApplicationDate").value = todayYmd();
  getEl("boxApplicationDate").max = todayYmd();
  getEl("boxApplicationDate").disabled = false;
  getEl("boxIsEmergency").checked = false;

  getEl("boxInvestmentType").value = "none";
  getEl("boxAutoCdi").checked = true;
  getEl("boxAutoYieldToWallet").checked = true;
  getEl("boxCdiAnnualRate").value = "";
  getEl("boxCdiPercentage").value = "100";

  investmentPreviewBaseValue = 0;
  setCdiInfoText("CDI oficial sera carregado automaticamente.");
  syncInvestmentFields();
}

function openCreateModal() {
  resetBoxForm();
  getEl("boxModalTitle").innerHTML = `
    <i class="fa-solid fa-piggy-bank text-primary me-2"></i>Nova Caixinha
  `;
  openModal("boxModal");
}

function openEditModal(id) {
  const box = boxesCache.find((b) => b._id === id);
  if (!box) return;

  const investment = normalizeInvestment(box);

  resetBoxForm();
  getEl("boxId").value = box._id;
  getEl("boxName").value = box.name || "";
  getEl("boxIsEmergency").checked = !!box.isEmergency;
  getEl("boxInitialValue").value = "";
  const goalInput = getEl("boxGoalAmount");
  const normalizedGoal = Math.max(round2(toNumber(box.goalAmount, 0)), 0);
  if (typeof setMoneyInputValue === "function") {
    setMoneyInputValue(goalInput, normalizedGoal > 0 ? normalizedGoal : "", { allowEmpty: true });
  } else if (goalInput) {
    goalInput.value = normalizedGoal > 0 ? String(normalizedGoal) : "";
  }
  getEl("boxApplicationDate").value = toYmd(box.firstContributionAt || box.createdAt);
  getEl("boxApplicationDate").max = todayYmd();
  getEl("boxApplicationDate").disabled = true;

  getEl("boxInvestmentType").value = investment.investmentType;
  getEl("boxAutoCdi").checked = investment.investmentType === "cdb_cdi" ? !!investment.autoCdi : true;
  getEl("boxAutoYieldToWallet").checked =
    investment.investmentType === "cdb_cdi"
      ? toBoolean(box.autoYieldToWallet, true)
      : true;
  getEl("boxCdiAnnualRate").value =
    investment.investmentType === "cdb_cdi" && !investment.autoCdi && investment.cdiAnnualRate > 0
      ? String(investment.cdiAnnualRate)
      : "";
  getEl("boxCdiPercentage").value = investment.cdiPercentage > 0 ? String(investment.cdiPercentage) : "100";

  investmentPreviewBaseValue = Math.max(toNumber(box.currentValue, 0), 0);

  getEl("boxModalTitle").innerHTML = `
    <i class="fa-solid fa-pen text-primary me-2"></i>Editar Caixinha
  `;

  if (investment.investmentType === "cdb_cdi" && investment.autoCdi && investment.cdiAnnualRate > 0) {
    setCdiInfoText(`Taxa atual registrada: ${percentBR(investment.cdiAnnualRate)}`);
  }

  syncInvestmentFields();
  openModal("boxModal");
}

async function saveBox() {
  const id = getEl("boxId").value.trim();
  const name = getEl("boxName").value.trim();
  const isEmergency = getEl("boxIsEmergency").checked;
  const initialValue = toNumber(getEl("boxInitialValue").value, 0);
  const goalAmount = Math.max(round2(toNumber(getEl("boxGoalAmount")?.value, 0)), 0);
  const applicationDate = String(getEl("boxApplicationDate")?.value || "").trim();
  const investmentPayload = getInvestmentPayloadFromForm();
  const { manualCdiAnnualRate, ...apiInvestmentPayload } = investmentPayload;

  if (!name) {
    showAlert("Informe o nome da caixinha", "warning", "triangle-exclamation");
    return;
  }

  const investmentError = validateInvestmentPayload(investmentPayload);
  if (investmentError) {
    showAlert(investmentError, "warning", "triangle-exclamation");
    return;
  }

  if (initialValue < 0) {
    showAlert("Valor inicial não pode ser negativo", "warning", "triangle-exclamation");
    return;
  }

  const btn = getEl("saveBoxBtn");
  setLoading(btn, true);

  try {
    if (!id) {
      const newBoxPayload = {
        name,
        isEmergency,
        goalAmount,
        initialValue: Math.max(round2(toNumber(initialValue, 0)), 0),
        applicationDate: applicationDate || todayYmd(),
        ...apiInvestmentPayload,
      };

      await apiFetch("/boxes", "POST", newBoxPayload);
      showAlert("Caixinha criada com sucesso", "success", "check-circle");
    } else {
      await apiFetch(`/boxes/${id}`, "PUT", {
        name,
        isEmergency,
        goalAmount,
        ...apiInvestmentPayload,
      });
      showAlert("Caixinha atualizada", "success", "check-circle");
    }

    closeModal("boxModal");
    await fetchBoxes();
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(btn, false);
  }
}

/* ========= Movimentar ========= */

function openMoveModal(id, type) {
  const box = boxesCache.find((b) => b._id === id);
  if (!box) return;

  getEl("moveBoxId").value = id;
  getEl("moveType").value = type;
  getEl("moveValue").value = "";

  getEl("moveBoxName").textContent = box.name || "";

  getEl("moveModalTitle").innerHTML =
    type === "in"
      ? `<i class="fa-solid fa-circle-plus text-success me-2"></i>Depositar`
      : `<i class="fa-solid fa-circle-minus text-danger me-2"></i>Retirar`;

  openModal("moveModal");
}

async function confirmMove() {
  const id = getEl("moveBoxId").value.trim();
  const type = getEl("moveType").value.trim();
  const value = toNumber(getEl("moveValue").value, 0);

  if (!id || (type !== "in" && type !== "out")) return;

  if (!value || value <= 0) {
    showAlert("Informe um valor válido", "warning", "triangle-exclamation");
    return;
  }

  const btn = getEl("confirmMoveBtn");
  setLoading(btn, true);

  try {
    await apiFetch(`/boxes/${id}/move`, "POST", { type, value });
    showAlert(type === "in" ? "Depósito realizado" : "Retirada realizada", "success", "check-circle");

    closeModal("moveModal");
    await fetchBoxes();
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(btn, false);
  }
}

/* ========= Excluir ========= */

function openDeleteModal(id) {
  getEl("deleteBoxId").value = id;
  openModal("deleteConfirmModal");
}

async function confirmDelete() {
  const id = getEl("deleteBoxId").value.trim();
  if (!id) return;

  const btn = getEl("confirmDeleteBtn");
  setLoading(btn, true);

  try {
    await apiFetch(`/boxes/${id}`, "DELETE");
    showAlert("Caixinha excluída", "success", "check-circle");

    closeModal("deleteConfirmModal");
    await fetchBoxes();
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(btn, false);
  }
}

/* ========= Init ========= */

document.addEventListener("DOMContentLoaded", () => {
  const newBtn = getEl("newBoxBtn");
  if (newBtn) newBtn.addEventListener("click", openCreateModal);

  const emptyBtn = getEl("emptyCreateBtn");
  if (emptyBtn) emptyBtn.addEventListener("click", openCreateModal);

  const saveBtn = getEl("saveBoxBtn");
  if (saveBtn) saveBtn.addEventListener("click", saveBox);

  const moveBtn = getEl("confirmMoveBtn");
  if (moveBtn) moveBtn.addEventListener("click", confirmMove);

  const delBtn = getEl("confirmDeleteBtn");
  if (delBtn) delBtn.addEventListener("click", confirmDelete);

  const investmentTypeInput = getEl("boxInvestmentType");
  if (investmentTypeInput) investmentTypeInput.addEventListener("change", syncInvestmentFields);

  const autoCdiInput = getEl("boxAutoCdi");
  if (autoCdiInput) {
    autoCdiInput.addEventListener("change", () => {
      updateManualCdiFieldState();
      updateInvestmentPreview();
      if (autoCdiInput.checked) {
        fetchMarketCdiRate({ forceRefresh: false }).then(updateInvestmentPreview);
      }
    });
  }

  const autoYieldInput = getEl("boxAutoYieldToWallet");
  if (autoYieldInput) {
    autoYieldInput.addEventListener("change", syncAutoYieldWarning);
  }

  ["boxCdiAnnualRate", "boxCdiPercentage"].forEach((id) => {
    const el = getEl(id);
    if (!el) return;
    el.addEventListener("input", updateInvestmentPreview);
    el.addEventListener("change", updateInvestmentPreview);
  });

  const initialInput = getEl("boxInitialValue");
  if (initialInput) {
    initialInput.addEventListener("input", updateInvestmentPreview);
    initialInput.addEventListener("change", updateInvestmentPreview);
  }

  const refreshCdiBtn = getEl("boxRefreshCdiBtn");
  if (refreshCdiBtn) {
    refreshCdiBtn.addEventListener("click", async () => {
      const originalHtml = refreshCdiBtn.innerHTML;
      refreshCdiBtn.disabled = true;
      refreshCdiBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
      await fetchMarketCdiRate({ forceRefresh: true });
      updateInvestmentPreview();
      refreshCdiBtn.disabled = false;
      refreshCdiBtn.innerHTML = originalHtml;
    });
  }

  syncInvestmentFields();
  fetchMarketCdiRate({ forceRefresh: false }).then(updateInvestmentPreview);
  fetchBoxes();
});
