// public/js/transactions.js

/**
 * =========================================================
 * TRANSACTIONS
 * - Remove onclick do HTML e de linhas geradas via JS
 * - Usa event delegation para Editar/Excluir
 * - Centraliza init em DOMContentLoaded
 *
 * MELHORIA (EDIÇÃO):
 * - Não permite salvar se não houver mudanças (dirty = false)
 * - Não permite salvar se algum campo obrigatório estiver vazio/inválido
 * - Botão "Salvar" do modal fica desabilitado até ficar válido + dirty
 * =========================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  // Segurança: não deixa executar sem token
  checkAuth();

  // Navbar/tema (utils.js)
  initTheme();
  bindInviteModal();

  // Elementos
  const tableBody = document.getElementById("transactionsTable");
  const form = document.getElementById("transactionForm");

  const monthFilter = document.getElementById("monthFilter");
  const monthIncome = document.getElementById("monthIncome");
  const monthExpense = document.getElementById("monthExpense");
  const monthBalance = document.getElementById("monthBalance");

  // Modal editar
  const editType = document.getElementById("editType");
  const editValue = document.getElementById("editValue");
  const editCategory = document.getElementById("editCategory");
  const editGroup = document.getElementById("editGroup");
  const editDate = document.getElementById("editDate");
  const saveEditBtn = document.getElementById("saveEditBtn");

  // Modal excluir
  const confirmDeleteBtn = document.getElementById("confirmDelete");

  // Modal categoria
  const openCategoryBtn = document.getElementById("openCategoryBtn");
  const saveCategoryBtn = document.getElementById("saveCategoryBtn");

  // Modals bootstrap (instâncias)
  const editModalEl = document.getElementById("editTransactionModal");
  const deleteModalEl = document.getElementById("deleteConfirmModal");
  const categoryModalEl = document.getElementById("categoryModal");

  const editModal = editModalEl ? new bootstrap.Modal(editModalEl) : null;
  const deleteModal = deleteModalEl ? new bootstrap.Modal(deleteModalEl) : null;
  const categoryModal = categoryModalEl ? new bootstrap.Modal(categoryModalEl) : null;

  // Estado
  let editingTransactionId = null;
  let transactionToDelete = null;

  // Snapshot do original (para detectar se houve alteração)
  let editOriginal = null;

  const groupLabels = {
    fixed: "Fixo",
    variable: "Variável",
    planned: "Previsto",
    unexpected: "Imprevisto"
  };

  /* ===============================
   * Helpers
   * =============================== */

  function fmtBRL(n) {
    return `R$ ${(Number(n) || 0).toFixed(2)}`;
  }

  function getSelectedYearMonth() {
    const [y, m] = (monthFilter.value || "").split("-");
    return { y, m };
  }

  /**
   * Retorna um objeto com os valores atuais do modal de edição, normalizados
   * (isso ajuda a comparar com o original e a validar).
   */
  function getEditPayload() {
    return {
      type: (editType?.value || "").trim(),
      value: Number(editValue?.value),
      category: (editCategory?.value || "").trim(),
      group: (editGroup?.value || "").trim(),
      date: (editDate?.value || "").trim() // YYYY-MM-DD
    };
  }

  /**
   * Validação do modal de edição (campos obrigatórios).
   * Regra do usuário: "categoria e qualquer outra opção vazia" => bloqueia.
   */
  function isEditValid(p) {
    if (!p.type) return false;
    if (!p.category) return false;
    if (!p.group) return false;
    if (!p.date) return false;

    // value precisa ser número e > 0
    if (!Number.isFinite(p.value) || p.value <= 0) return false;

    // validações opcionais (ajuda a evitar lixo)
    if (p.type !== "income" && p.type !== "expense") return false;
    if (!Object.prototype.hasOwnProperty.call(groupLabels, p.group)) return false;

    return true;
  }

  /**
   * Retorna true se houve mudança em qualquer campo do modal vs snapshot original.
   */
  function isEditDirty(p) {
    if (!editOriginal) return false;
    return (
      p.type !== editOriginal.type ||
      Number(p.value) !== Number(editOriginal.value) ||
      p.category !== editOriginal.category ||
      p.group !== editOriginal.group ||
      p.date !== editOriginal.date
    );
  }

  /**
   * Atualiza o estado do botão "Salvar" do modal:
   * - habilita apenas se (valid && dirty)
   */
  function updateEditSaveState() {
    if (!saveEditBtn) return;

    const p = getEditPayload();
    const valid = isEditValid(p);
    const dirty = isEditDirty(p);

    const canSave = valid && dirty;

    saveEditBtn.disabled = !canSave;
    saveEditBtn.style.opacity = canSave ? "1" : "0.6";
    saveEditBtn.style.cursor = canSave ? "pointer" : "not-allowed";
  }

  /**
   * Ao abrir modal, começa travado para evitar salvar sem mudança.
   */
  function disableEditSaveBtn() {
    if (!saveEditBtn) return;
    saveEditBtn.disabled = true;
    saveEditBtn.style.opacity = "0.6";
    saveEditBtn.style.cursor = "not-allowed";
  }

  /* ===============================
   * Carregar mês e render tabela
   * =============================== */

  async function loadMonthSummary(year, month) {
    try {
      const data = await apiFetch(`/transactions/month?year=${year}&month=${month}`);

      let income = 0;
      let expense = 0;

      (data.transactions || []).forEach((t) => {
        if (t.type === "income") income += Number(t.value);
        if (t.type === "expense") expense += Number(t.value);
      });

      monthIncome.textContent = fmtBRL(income);
      monthExpense.textContent = fmtBRL(expense);
      monthBalance.textContent = fmtBRL(income - expense);

      tableBody.innerHTML = "";

      (data.transactions || []).forEach((t) => {
        const dateStr = (t.date || "").slice(0, 10).split("-").reverse().join("/");
        const typeLabel = t.type === "income" ? "Entrada" : "Saída";

        tableBody.innerHTML += `
          <tr>
            <td>${dateStr}</td>
            <td>${typeLabel}</td>
            <td>${t.category}</td>
            <td>${groupLabels[t.group] || t.group}</td>
            <td>${fmtBRL(t.value)}</td>
            <td>
              <button class="btn btn-sm btn-warning me-1" type="button" data-action="edit" data-id="${t._id}">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="btn btn-sm btn-danger" type="button" data-action="delete" data-id="${t._id}">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      });
    } catch (error) {
      showAlert("Erro ao carregar transações", "danger", "triangle-exclamation");
    }
  }

  /* ===============================
   * CRUD Transação (criar)
   * =============================== */

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    setLoading(submitBtn, true);

    try {
      const payload = {
        type: document.getElementById("type").value,
        value: Number(document.getElementById("value").value),
        category: document.getElementById("category").value,
        group: document.getElementById("group").value,
        date: document.getElementById("date").value + "T12:00:00"
      };

      await apiFetch("/transactions", "POST", payload);

      form.reset();

      // Define data atual novamente
      const today = new Date().toISOString().split("T")[0];
      document.getElementById("date").value = today;

      showAlert("Transação criada com sucesso!", "success", "check-circle");

      const { y, m } = getSelectedYearMonth();
      await loadMonthSummary(y, m);
    } catch (error) {
      showAlert(error.message || "Erro ao criar transação", "danger", "triangle-exclamation");
    } finally {
      setLoading(submitBtn, false);
    }
  });

  /* ===============================
   * Editar / Atualizar (modal)
   * =============================== */

  async function editTransaction(id) {
    try {
      // Ao iniciar edição, trava o botão até carregar tudo e validar/dirty
      disableEditSaveBtn();

      const t = await apiFetch(`/transactions/${id}`);
      editingTransactionId = id;

      editType.value = t.type;
      editValue.value = t.value;
      editGroup.value = t.group;
      editDate.value = (t.date || "").slice(0, 10);

      // Carrega categorias do tipo e seleciona a categoria atual
      await loadEditCategories(t.type, t.category);

      // Snapshot original (normalizado) para detectar mudanças
      editOriginal = {
        type: (editType.value || "").trim(),
        value: Number(editValue.value),
        category: (editCategory.value || "").trim(),
        group: (editGroup.value || "").trim(),
        date: (editDate.value || "").trim()
      };

      // Atualiza estado do botão com base em (valid && dirty)
      updateEditSaveState();

      editModal?.show();
    } catch (error) {
      showAlert("Erro ao carregar transação para edição", "danger", "triangle-exclamation");
    }
  }

  async function updateTransaction() {
    if (!editingTransactionId) return;

    const p = getEditPayload();

    // Blindagem: não salva se estiver inválido
    if (!isEditValid(p)) {
      showAlert("Preencha todos os campos antes de salvar.", "warning", "triangle-exclamation");
      updateEditSaveState();
      return;
    }

    // Blindagem: não salva se não houve alteração
    if (!isEditDirty(p)) {
      showAlert("Nenhuma alteração detectada.", "warning", "triangle-exclamation");
      updateEditSaveState();
      return;
    }

    setLoading(saveEditBtn, true);

    try {
      await apiFetch(`/transactions/${editingTransactionId}`, "PUT", {
        type: p.type,
        value: p.value,
        category: p.category,
        group: p.group,
        date: p.date + "T12:00:00"
      });

      editModal?.hide();
      showAlert("Transação atualizada com sucesso!", "success", "check-circle");

      const { y, m } = getSelectedYearMonth();
      await loadMonthSummary(y, m);
    } catch (error) {
      showAlert(error.message || "Erro ao atualizar transação", "danger", "triangle-exclamation");
    } finally {
      setLoading(saveEditBtn, false);
      // Depois do save, ainda vale recalcular (se o modal permanecer aberto por algum motivo)
      updateEditSaveState();
    }
  }

  /* ===============================
   * Excluir (modal)
   * =============================== */

  function openDeleteModal(id) {
    transactionToDelete = id;
    deleteModal?.show();
  }

  async function deleteTransactionConfirmed() {
    if (!transactionToDelete) return;

    setLoading(confirmDeleteBtn, true);

    try {
      await apiFetch(`/transactions/${transactionToDelete}`, "DELETE");

      deleteModal?.hide();
      showAlert("Transação excluída com sucesso!", "success", "check-circle");

      const { y, m } = getSelectedYearMonth();
      await loadMonthSummary(y, m);
    } catch (error) {
      showAlert(error.message || "Erro ao excluir transação", "danger", "triangle-exclamation");
    } finally {
      setLoading(confirmDeleteBtn, false);
      transactionToDelete = null;
    }
  }

  /* ===============================
   * Categorias
   * =============================== */

  async function loadCategories(type) {
    try {
      const categories = await apiFetch("/categories");
      const categorySelect = document.getElementById("category");

      categorySelect.innerHTML = "";

      (categories || [])
        .filter((c) => c.type === type)
        .forEach((c) => {
          categorySelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
        });
    } catch (error) {
      showAlert("Erro ao carregar categorias", "danger", "triangle-exclamation");
    }
  }

  async function loadEditCategories(type, selected) {
    try {
      const categories = await apiFetch("/categories");

      editCategory.innerHTML = "";

      (categories || [])
        .filter((c) => c.type === type)
        .forEach((c) => {
          editCategory.innerHTML += `<option value="${c.name}">${c.name}</option>`;
        });

      // Pode acontecer de não existir nenhuma categoria => select fica vazio
      // Nesse caso, editCategory.value vira "" e a validação vai bloquear o salvar.
      editCategory.value = selected || "";

      // Como o select mudou, recalcula o estado do botão
      updateEditSaveState();
    } catch (error) {
      showAlert("Erro ao carregar categorias", "danger", "triangle-exclamation");
    }
  }

  function openCategoryModal() {
    categoryModal?.show();
  }

  async function createCategoryFromModal() {
    const name = (document.getElementById("newCategoryName").value || "").trim();
    const type = document.getElementById("newCategoryType").value;

    if (!name) {
      showAlert("Por favor, insira um nome para a categoria.", "warning", "exclamation-circle");
      return;
    }

    setLoading(saveCategoryBtn, true);

    try {
      await apiFetch("/categories", "POST", { name, type });

      categoryModal?.hide();
      showAlert("Categoria criada com sucesso!", "success", "check-circle");

      // Recarrega categorias do select principal conforme tipo atual do form
      const currentType = document.getElementById("type").value;
      await loadCategories(currentType);

      // Se a categoria criada for do mesmo tipo selecionado, já marca
      if (currentType === type) {
        document.getElementById("category").value = name;
      }

      // Se o modal de edição estiver aberto e o tipo bater, recarrega também o select do modal
      if (editModalEl?.classList.contains("show") && editType?.value === type) {
        await loadEditCategories(type, editCategory.value || "");
      }

      document.getElementById("newCategoryName").value = "";
    } catch (error) {
      showAlert(error.message || "Erro ao criar categoria", "danger", "triangle-exclamation");
    } finally {
      setLoading(saveCategoryBtn, false);
    }
  }

  /* ===============================
   * Event delegation (tabela)
   * =============================== */

  tableBody.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "edit") editTransaction(id);
    if (action === "delete") openDeleteModal(id);
  });

  /* ===============================
   * Binds de botões do HTML (sem onclick)
   * =============================== */

  saveEditBtn?.addEventListener("click", updateTransaction);
  confirmDeleteBtn?.addEventListener("click", deleteTransactionConfirmed);
  openCategoryBtn?.addEventListener("click", openCategoryModal);
  saveCategoryBtn?.addEventListener("click", createCategoryFromModal);

  // Sempre que o usuário mexer nos campos do modal de edição, recalcula botão salvar
  [editType, editValue, editCategory, editGroup, editDate].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", updateEditSaveState);
    el.addEventListener("change", updateEditSaveState);
  });

  // Tipo no form principal muda as categorias
  document.getElementById("type").addEventListener("change", function () {
    loadCategories(this.value);
  });

  // Tipo no modal de edição muda as categorias do modal (e recalcula estado do salvar)
  editType.addEventListener("change", async function () {
    await loadEditCategories(this.value, editCategory.value);
    updateEditSaveState();
  });

  /* ===============================
   * INIT
   * =============================== */

  // Define mês atual no filtro
  const now = new Date();
  monthFilter.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Define data atual no input do formulário
  document.getElementById("date").value = now.toISOString().split("T")[0];

  // Carrega categorias iniciais e lista do mês atual
  loadCategories(document.getElementById("type").value);

  const { y, m } = getSelectedYearMonth();
  loadMonthSummary(y, m);

  // Troca de mês
  monthFilter.addEventListener("change", () => {
    const { y, m } = getSelectedYearMonth();
    loadMonthSummary(y, m);
  });
});
