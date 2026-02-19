document.addEventListener("DOMContentLoaded", () => {
  checkAuth();
  initTheme();
  bindInviteModal();

  const categoriesTable = document.getElementById("categoriesTable");
  const categoriesCardsWrap = document.getElementById("categoriesCardsWrap");
  const categoriesTableWrap = document.getElementById("categoriesTableWrap");
  const categoriesEmptyState = document.getElementById("categoriesEmptyState");
  const categoriesViewCardsBtn = document.getElementById("categoriesViewCardsBtn");
  const categoriesViewTableBtn = document.getElementById("categoriesViewTableBtn");
  const categoriesCountBadge = document.getElementById("categoriesCountBadge");
  const categoriesFilterSelect = document.getElementById("categoriesFilterSelect");

  const openCreateBtn = document.getElementById("openCreateCategoryBtn");

  // Editor modal
  const editorModalEl = document.getElementById("categoryEditorModal");
  const editorModal = editorModalEl ? new bootstrap.Modal(editorModalEl) : null;

  const editorTitle = document.getElementById("categoryEditorTitle");
  const editorHint = document.getElementById("categoryEditorHint");

  const nameInput = document.getElementById("categoryNameInput");
  const typeSelect = document.getElementById("categoryTypeSelect");
  const saveEditBtn = document.getElementById("saveCategoryEditBtn");

  // Delete modal
  const deleteModalEl = document.getElementById("deleteCategoryModal");
  const deleteModal = deleteModalEl ? new bootstrap.Modal(deleteModalEl) : null;
  const confirmDeleteBtn = document.getElementById("confirmDeleteCategoryBtn");

  // Estado
  let categories = [];
  let filteredCategories = [];
  let categoriesTypeFilter = "all";
  let editingCategoryId = null;
  let deletingCategoryId = null;
  let editorMode = "create"; // "create" | "edit"

  const CATEGORIES_VIEW_STORAGE_KEY = "myfinance_categories_view";
  let categoriesView = loadStoredCategoriesView();

  const typeLabels = { income: "Entrada", expense: "Saida" };

  function normalizeCategoriesView(value) {
    return value === "table" ? "table" : "cards";
  }

  function loadStoredCategoriesView() {
    try {
      return normalizeCategoriesView(localStorage.getItem(CATEGORIES_VIEW_STORAGE_KEY));
    } catch (_) {
      return "cards";
    }
  }

  function persistCategoriesView(value) {
    try {
      localStorage.setItem(CATEGORIES_VIEW_STORAGE_KEY, normalizeCategoriesView(value));
    } catch (_) {}
  }

  function syncCategoriesView() {
    const showingCards = categoriesView === "cards";
    const hasItems = filteredCategories.length > 0;

    if (hasItems) {
      categoriesCardsWrap?.classList.toggle("d-none", !showingCards);
      categoriesTableWrap?.classList.toggle("d-none", showingCards);
    }

    categoriesViewCardsBtn?.classList.toggle("is-active", showingCards);
    categoriesViewCardsBtn?.setAttribute("aria-pressed", showingCards ? "true" : "false");
    categoriesViewTableBtn?.classList.toggle("is-active", !showingCards);
    categoriesViewTableBtn?.setAttribute("aria-pressed", !showingCards ? "true" : "false");
  }

  function setCategoriesView(nextView) {
    categoriesView = normalizeCategoriesView(nextView);
    persistCategoriesView(categoriesView);
    syncCategoriesView();
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getCategoryId(category) {
    return String(category?._id || category?.id || "").trim();
  }

  function getTypeClass(type) {
    return type === "income" ? "is-income" : "is-expense";
  }

  function getOriginLabel(category) {
    if (category?.isFixed) {
      return '<span class="text-muted">Sistema</span><i class="fa-solid fa-lock ms-1 text-muted" title="Categoria do sistema"></i>';
    }

    return "Minha";
  }

  function getActionsHtml(category) {
    const canMutate = !category?.isFixed;
    const categoryId = escapeHtml(getCategoryId(category));

    if (!canMutate || !categoryId) {
      return `
        <span class="text-muted" title="Categoria do sistema">
          <i class="fa-solid fa-lock"></i>
        </span>
      `;
    }

    return `
      <button
        class="btn btn-sm btn-outline-primary me-1 category-action-btn"
        type="button"
        data-action="edit"
        data-id="${categoryId}"
        title="Editar"
      >
        <i class="fa-solid fa-pen"></i>
      </button>
      <button
        class="btn btn-sm btn-outline-danger category-action-btn"
        type="button"
        data-action="delete"
        data-id="${categoryId}"
        title="Excluir"
      >
        <i class="fa-solid fa-trash"></i>
      </button>
    `;
  }

  async function loadCategories() {
    const data = await apiFetch("/categories");
    const list = Array.isArray(data) ? data : (data?.categories || []);

    categories = [...list].sort((a, b) => {
      if (Boolean(a?.isFixed) !== Boolean(b?.isFixed)) {
        return a?.isFixed ? 1 : -1;
      }

      return String(a?.name || "").localeCompare(String(b?.name || ""), "pt-BR", {
        sensitivity: "base"
      });
    });

    applyCategoryFilter();
  }

  function renderTable() {
    if (!categoriesTable) return;

    categoriesTable.innerHTML = filteredCategories
      .map((category) => {
        const typeLabel = typeLabels[category.type] || category.type || "-";

        return `
          <tr>
            <td>${escapeHtml(category.name || "Sem nome")}</td>
            <td>${escapeHtml(typeLabel)}</td>
            <td>${getOriginLabel(category)}</td>
            <td class="text-end">${getActionsHtml(category)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderCards() {
    if (!categoriesCardsWrap) return;

    categoriesCardsWrap.innerHTML = filteredCategories
      .map((category) => {
        const typeLabel = typeLabels[category.type] || category.type || "-";
        const typeClass = getTypeClass(category.type);
        const originLabel = category?.isFixed
          ? '<span class="category-origin-pill is-system"><i class="fa-solid fa-lock me-1"></i>Sistema</span>'
          : '<span class="category-origin-pill is-custom"><i class="fa-solid fa-user me-1"></i>Minha</span>';

        return `
          <div class="col-12 col-md-6 col-xl-4">
            <article class="category-item-card ${category?.isFixed ? "is-fixed" : "is-custom"}">
              <div class="category-item-head">
                <span class="category-type-chip ${typeClass}">${escapeHtml(typeLabel)}</span>
                ${originLabel}
              </div>

              <h6 class="category-item-name" title="${escapeHtml(category.name || "Sem nome")}">${escapeHtml(category.name || "Sem nome")}</h6>

              <div class="category-item-footer">
                <div class="category-item-meta">
                  <i class="fa-solid fa-tag"></i>
                  <span>${escapeHtml(category.name || "Sem nome")}</span>
                </div>
                <div class="category-item-actions">${getActionsHtml(category)}</div>
              </div>
            </article>
          </div>
        `;
      })
      .join("");
  }

  function updateCategoriesBadge() {
    if (!categoriesCountBadge) return;
    const total = categories.length;
    const visible = filteredCategories.length;
    if (visible === total) {
      categoriesCountBadge.textContent = `${total} categorias`;
      return;
    }
    categoriesCountBadge.textContent = `${visible} de ${total} categorias`;
  }

  function matchesCategoryFilter(category) {
    if (categoriesTypeFilter === "all") return true;
    if (categoriesTypeFilter === "income") return category?.type === "income";
    if (categoriesTypeFilter === "expense") return category?.type === "expense";
    if (categoriesTypeFilter === "custom") return !category?.isFixed;
    if (categoriesTypeFilter === "system") return Boolean(category?.isFixed);
    return true;
  }

  function applyCategoryFilter() {
    categoriesTypeFilter = String(categoriesFilterSelect?.value || "all");
    filteredCategories = categories.filter(matchesCategoryFilter);
    updateCategoriesBadge();
    renderCategories();
  }

  function renderCategories() {
    renderTable();
    renderCards();

    const hasItems = filteredCategories.length > 0;
    categoriesEmptyState?.classList.toggle("d-none", hasItems);

    if (!hasItems) {
      categoriesCardsWrap?.classList.add("d-none");
      categoriesTableWrap?.classList.add("d-none");
      return;
    }

    syncCategoriesView();
  }

  function openCreateModal() {
    editorMode = "create";
    editingCategoryId = null;

    editorTitle.textContent = "Nova categoria";
    editorHint.style.display = "none";

    nameInput.value = "";
    typeSelect.value = "expense";

    saveEditBtn.disabled = false;
    editorModal?.show();
    nameInput.focus();
  }

  function openEditModal(categoryId) {
    const category = categories.find((item) => getCategoryId(item) === categoryId);
    if (!category) return;

    if (category.isFixed) {
      showAlert("Categorias do sistema nao podem ser editadas.", "warning", "triangle-exclamation");
      return;
    }

    editorMode = "edit";
    editingCategoryId = categoryId;

    editorTitle.textContent = "Editar categoria";
    editorHint.style.display = "none";

    nameInput.value = category.name || "";
    typeSelect.value = category.type || "expense";

    saveEditBtn.disabled = true;
    editorModal?.show();
    nameInput.focus();

    updateSaveStateForEdit();
  }

  function getEditorPayload() {
    return {
      name: (nameInput.value || "").trim(),
      type: (typeSelect.value || "").trim()
    };
  }

  function isEditorValid(payload) {
    if (!payload.name) return false;
    if (payload.type !== "income" && payload.type !== "expense") return false;
    return true;
  }

  function isEditorDirty(payload) {
    if (editorMode !== "edit") return true;

    const category = categories.find((item) => getCategoryId(item) === editingCategoryId);
    if (!category) return false;

    return payload.name !== (category.name || "") || payload.type !== (category.type || "");
  }

  function updateSaveStateForEdit() {
    const payload = getEditorPayload();
    const canSave = isEditorValid(payload) && isEditorDirty(payload);
    saveEditBtn.disabled = !canSave;
  }

  async function saveCategory() {
    const payload = getEditorPayload();

    if (!isEditorValid(payload)) {
      showAlert("Preencha nome e tipo corretamente.", "warning", "triangle-exclamation");
      updateSaveStateForEdit();
      return;
    }

    if (editorMode === "edit" && !isEditorDirty(payload)) {
      showAlert("Nenhuma alteracao detectada.", "warning", "triangle-exclamation");
      updateSaveStateForEdit();
      return;
    }

    setLoading(saveEditBtn, true);

    try {
      if (editorMode === "create") {
        await apiFetch("/categories", "POST", payload);
        showAlert("Categoria criada com sucesso!", "success", "check-circle");
      } else {
        await apiFetch(`/categories/${editingCategoryId}`, "PUT", payload);
        showAlert("Categoria atualizada com sucesso!", "success", "check-circle");
      }

      editorModal?.hide();
      await loadCategories();
    } catch (err) {
      showAlert(err.message || "Erro ao salvar categoria.", "danger", "triangle-exclamation");
    } finally {
      setLoading(saveEditBtn, false);
    }
  }

  function openDeleteModal(categoryId) {
    const category = categories.find((item) => getCategoryId(item) === categoryId);
    if (!category) return;

    if (category.isFixed) {
      showAlert("Categorias do sistema nao podem ser excluidas.", "warning", "triangle-exclamation");
      return;
    }

    deletingCategoryId = categoryId;
    deleteModal?.show();
  }

  async function confirmDelete() {
    if (!deletingCategoryId) return;

    setLoading(confirmDeleteBtn, true);

    try {
      await apiFetch(`/categories/${deletingCategoryId}`, "DELETE");
      deleteModal?.hide();
      showAlert("Categoria excluida com sucesso!", "success", "check-circle");
      deletingCategoryId = null;
      await loadCategories();
    } catch (err) {
      showAlert(err.message || "Erro ao excluir categoria.", "danger", "triangle-exclamation");
    } finally {
      setLoading(confirmDeleteBtn, false);
    }
  }

  function handleActionClick(event) {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = String(btn.dataset.id || "").trim();
    if (!id) return;

    if (action === "edit") openEditModal(id);
    if (action === "delete") openDeleteModal(id);
  }

  categoriesTable?.addEventListener("click", handleActionClick);
  categoriesCardsWrap?.addEventListener("click", handleActionClick);

  openCreateBtn?.addEventListener("click", openCreateModal);
  saveEditBtn?.addEventListener("click", saveCategory);
  confirmDeleteBtn?.addEventListener("click", confirmDelete);

  nameInput?.addEventListener("input", updateSaveStateForEdit);
  typeSelect?.addEventListener("change", updateSaveStateForEdit);

  categoriesViewCardsBtn?.addEventListener("click", () => {
    setCategoriesView("cards");
  });

  categoriesViewTableBtn?.addEventListener("click", () => {
    setCategoriesView("table");
  });

  categoriesFilterSelect?.addEventListener("change", applyCategoryFilter);

  setCategoriesView(categoriesView);
  updateCategoriesBadge();

  loadCategories().catch(() => {
    showAlert("Nao foi possivel carregar categorias.", "danger", "triangle-exclamation");
    categories = [];
    filteredCategories = [];
    renderCategories();
    updateCategoriesBadge();
  });
});
