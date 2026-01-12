// public/js/categories.js

/**
 * =========================================================
 * CATEGORIES (Gestão)
 * - checkAuth + initTheme + bindInviteModal (padrão das páginas internas)
 * - Lista categorias (GET /categories)
 * - Cria categoria (POST /categories)
 * - Edita categoria (PUT /categories/:id)  -> se o backend não tiver, vai falhar e avisar
 * - Exclui categoria (DELETE /categories/:id)
 * - Sem onclick: event delegation e binds por addEventListener
 * =========================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  checkAuth();
  initTheme();
  bindInviteModal();

  const categoriesTable = document.getElementById("categoriesTable");

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
  let editingCategoryId = null;
  let deletingCategoryId = null;
  let editorMode = "create"; // "create" | "edit"

  const typeLabels = { income: "Entrada", expense: "Saída" };

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function loadCategories() {
    const data = await apiFetch("/categories");
    categories = Array.isArray(data) ? data : (data?.categories || []);
    renderTable();
  }

function renderTable() {
  categoriesTable.innerHTML = "";

  categories.forEach((c) => {
    const typeLabel = typeLabels[c.type] || c.type;

    // Categorias fixas: bloqueia editar/excluir (na UI)
    const canMutate = !c.isFixed;

    // Origem com cadeado quando for do sistema
    const originCell = c.isFixed
      ? `<span class="text-muted">Sistema</span>
         <i class="fa-solid fa-lock ms-1 text-muted" title="Categoria do sistema"></i>`
      : `${escapeHtml("Minha")}`;

    categoriesTable.innerHTML += `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(typeLabel)}</td>
        <td>${originCell}</td>
<td class="text-end">
  ${
    canMutate
      ? `
        <button
          class="btn btn-sm btn-outline-primary me-1"
          type="button"
          data-action="edit"
          data-id="${c._id}"
          title="Editar"
        >
          <i class="fa-solid fa-pen"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-danger"
          type="button"
          data-action="delete"
          data-id="${c._id}"
          title="Excluir"
        >
          <i class="fa-solid fa-trash"></i>
        </button>
      `
      : `
        <span class="text-muted" title="Categoria do sistema">
          <i class="fa-solid fa-lock"></i>
        </span>
      `
  }
</td>

      </tr>
    `;
  });
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
    const c = categories.find((x) => x._id === categoryId);
    if (!c) return;

    if (c.isFixed) {
      showAlert("Categorias do sistema não podem ser editadas.", "warning", "triangle-exclamation");
      return;
    }

    editorMode = "edit";
    editingCategoryId = categoryId;

    editorTitle.textContent = "Editar categoria";
    editorHint.style.display = "none";

    nameInput.value = c.name || "";
    typeSelect.value = c.type || "expense";

    saveEditBtn.disabled = true; // só habilita quando houver mudança + válido
    editorModal?.show();
    nameInput.focus();

    // revalida conforme usuário digita
    updateSaveStateForEdit();
  }

  function getEditorPayload() {
    return {
      name: (nameInput.value || "").trim(),
      type: (typeSelect.value || "").trim()
    };
  }

  function isEditorValid(p) {
    if (!p.name) return false;
    if (p.type !== "income" && p.type !== "expense") return false;
    return true;
  }

  function isEditorDirty(p) {
    if (editorMode !== "edit") return true;
    const c = categories.find((x) => x._id === editingCategoryId);
    if (!c) return false;
    return p.name !== (c.name || "") || p.type !== (c.type || "");
  }

  function updateSaveStateForEdit() {
    const p = getEditorPayload();
    const canSave = isEditorValid(p) && isEditorDirty(p);
    saveEditBtn.disabled = !canSave;
  }

  async function saveCategory() {
    const p = getEditorPayload();

    if (!isEditorValid(p)) {
      showAlert("Preencha nome e tipo corretamente.", "warning", "triangle-exclamation");
      updateSaveStateForEdit();
      return;
    }

    // Edit mode: bloqueia se não mudou nada
    if (editorMode === "edit" && !isEditorDirty(p)) {
      showAlert("Nenhuma alteração detectada.", "warning", "triangle-exclamation");
      updateSaveStateForEdit();
      return;
    }

    setLoading(saveEditBtn, true);

    try {
      if (editorMode === "create") {
        await apiFetch("/categories", "POST", p);
        showAlert("Categoria criada com sucesso!", "success", "check-circle");
      } else {
        // OBS: se o seu backend ainda não tiver PUT /categories/:id, vai cair no catch com erro.
        await apiFetch(`/categories/${editingCategoryId}`, "PUT", p);
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
    const c = categories.find((x) => x._id === categoryId);
    if (!c) return;

    if (c.isFixed) {
      showAlert("Categorias do sistema não podem ser excluídas.", "warning", "triangle-exclamation");
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
      showAlert("Categoria excluída com sucesso!", "success", "check-circle");
      deletingCategoryId = null;
      await loadCategories();
    } catch (err) {
      showAlert(err.message || "Erro ao excluir categoria.", "danger", "triangle-exclamation");
    } finally {
      setLoading(confirmDeleteBtn, false);
    }
  }

  // Event delegation da tabela
  categoriesTable.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "edit") openEditModal(id);
    if (action === "delete") openDeleteModal(id);
  });

  // Binds
  openCreateBtn.addEventListener("click", openCreateModal);
  saveEditBtn.addEventListener("click", saveCategory);
  confirmDeleteBtn.addEventListener("click", confirmDelete);

  nameInput.addEventListener("input", updateSaveStateForEdit);
  typeSelect.addEventListener("change", updateSaveStateForEdit);

  // Init
  loadCategories().catch(() => {
    showAlert("Não foi possível carregar categorias.", "danger", "triangle-exclamation");
  });
});
