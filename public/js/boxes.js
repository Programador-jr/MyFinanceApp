// js/boxes.js

let boxesCache = [];

function moneyBR(value) {
  if (typeof formatCurrency === "function") return formatCurrency(Number(value || 0));
  return `R$ ${Number(value || 0).toFixed(2)}`;
}

function getEl(id) {
  return document.getElementById(id);
}

function openModal(id) {
  const el = getEl(id);
  if (!el) return null;
  const modal = new bootstrap.Modal(el);
  modal.show();
  return modal;
}

function closeModal(id) {
  const el = getEl(id);
  if (!el) return;
  const modal = bootstrap.Modal.getInstance(el);
  if (modal) modal.hide();
}

async function fetchBoxes() {
  const data = await apiFetch("/boxes");
  boxesCache = Array.isArray(data) ? data : [];
  renderBoxes();
}

function renderBoxes() {
  const grid = getEl("boxesGrid");
  const empty = getEl("emptyBoxes");
  if (!grid || !empty) return;

  grid.innerHTML = "";

  if (!boxesCache.length) {
    empty.classList.remove("d-none");
    return;
  }

  empty.classList.add("d-none");

  boxesCache.forEach((b) => {
    const isEmergency = !!b.isEmergency;

    const col = document.createElement("div");
    col.className = "col-12 col-md-6 col-lg-4";

    col.innerHTML = `
      <div class="card box-card shadow-sm h-100">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <div class="box-title d-flex align-items-center gap-2">
                <i class="fa-solid ${isEmergency ? "fa-shield-heart text-warning" : "fa-piggy-bank text-primary"}"></i>
                <span>${b.name || "Sem nome"}</span>
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
                  <button class="dropdown-item" data-action="deposit" data-id="${b._id}">
                    <i class="fa-solid fa-circle-plus me-2 text-success"></i>Depositar
                  </button>
                </li>
                <li>
                  <button class="dropdown-item" data-action="withdraw" data-id="${b._id}">
                    <i class="fa-solid fa-circle-minus me-2 text-danger"></i>Retirar
                  </button>
                </li>
                <li><hr class="dropdown-divider"></li>
                <li>
                  <button class="dropdown-item" data-action="edit" data-id="${b._id}">
                    <i class="fa-solid fa-pen me-2"></i>Editar
                  </button>
                </li>
                <li>
                  <button class="dropdown-item text-danger" data-action="delete" data-id="${b._id}">
                    <i class="fa-solid fa-trash me-2"></i>Excluir
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div class="mt-3">
            <div class="text-muted small">Saldo</div>
            <div class="box-value">${moneyBR(b.currentValue)}</div>
          </div>
        </div>
      </div>
    `;

    grid.appendChild(col);
  });

  // event delegation (um listener só)
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
}

/* ========= Criar / Editar ========= */

function resetBoxForm() {
  getEl("boxId").value = "";
  getEl("boxName").value = "";
  getEl("boxInitialValue").value = "";
  getEl("boxIsEmergency").checked = false;
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

  resetBoxForm();
  getEl("boxId").value = box._id;
  getEl("boxName").value = box.name || "";
  getEl("boxIsEmergency").checked = !!box.isEmergency;

  // ao editar, valor inicial não deve ser usado
  getEl("boxInitialValue").value = "";
  getEl("boxModalTitle").innerHTML = `
    <i class="fa-solid fa-pen text-primary me-2"></i>Editar Caixinha
  `;

  openModal("boxModal");
}

async function saveBox() {
  const id = getEl("boxId").value.trim();
  const name = getEl("boxName").value.trim();
  const isEmergency = getEl("boxIsEmergency").checked;
  const initialValue = Number(getEl("boxInitialValue").value || 0);

  if (!name) {
    showAlert("Informe o nome da caixinha", "warning", "triangle-exclamation");
    return;
  }

  const btn = getEl("saveBoxBtn");
  setLoading(btn, true);

  try {
    if (!id) {
      // CREATE (precisa existir no backend)
      const created = await apiFetch("/boxes", "POST", { name, isEmergency });

      // se usuário preencheu valor inicial, faz uma movimentação "in"
      if (initialValue > 0 && created && created._id) {
        await apiFetch(`/boxes/${created._id}/move`, "POST", { type: "in", value: initialValue });
      }

      showAlert("Caixinha criada com sucesso", "success", "check-circle");
    } else {
      // UPDATE (precisa existir no backend)
      await apiFetch(`/boxes/${id}`, "PUT", { name, isEmergency });
      showAlert("Caixinha atualizada", "success", "check-circle");
    }

    closeModal("boxModal");
    await fetchBoxes();
  } catch (err) {
    // apiFetch já mostra alert; aqui só garante fallback
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
  const type = getEl("moveType").value.trim(); // "in" | "out"
  const value = Number(getEl("moveValue").value || 0);

  if (!id || (type !== "in" && type !== "out")) return;

  if (!value || value <= 0) {
    showAlert("Informe um valor válido", "warning", "triangle-exclamation");
    return;
  }

  const btn = getEl("confirmMoveBtn");
  setLoading(btn, true);

  try {
    // já existe no backend [file:110]
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
    // DELETE (precisa existir no backend)
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
  // botões criar
  const newBtn = getEl("newBoxBtn");
  if (newBtn) newBtn.addEventListener("click", openCreateModal);

  const emptyBtn = getEl("emptyCreateBtn");
  if (emptyBtn) emptyBtn.addEventListener("click", openCreateModal);

  // salvar
  const saveBtn = getEl("saveBoxBtn");
  if (saveBtn) saveBtn.addEventListener("click", saveBox);

  // movimentar
  const moveBtn = getEl("confirmMoveBtn");
  if (moveBtn) moveBtn.addEventListener("click", confirmMove);

  // excluir
  const delBtn = getEl("confirmDeleteBtn");
  if (delBtn) delBtn.addEventListener("click", confirmDelete);

  fetchBoxes();
});
