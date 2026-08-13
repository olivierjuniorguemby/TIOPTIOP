// ======================================================
// AJOUTER
// ======================================================

function openAddCategoryModal() {
    const modal = document.getElementById("addCategoryModal");

    modal.classList.add("show");
    document.body.classList.add("modal-open");
}

function closeAddCategoryModal() {
    const modal = document.getElementById("addCategoryModal");

    modal.classList.remove("show");
    document.body.classList.remove("modal-open");
}


// ======================================================
// MODIFIER
// ======================================================

function openEditCategoryModalFromButton(button) {

    const id = button.dataset.id;
    const name = button.dataset.name;
    const description = button.dataset.description;
    const position = button.dataset.position;

    openEditCategoryModal(
        id,
        name,
        description,
        position
    );
}


function openEditCategoryModal(
    id,
    name,
    description,
    position
) {

    const modal =
        document.getElementById("editCategoryModal");

    const form =
        document.getElementById("editCategoryForm");

    document.getElementById("editCategoryName").value =
        name || "";

    document.getElementById("editCategoryDescription").value =
        description || "";

    document.getElementById("editCategoryPosition").value =
        position || 0;

    form.action =
        `/admin/categories/${id}/update`;

    modal.classList.add("show");

    document.body.classList.add("modal-open");
}


function closeEditCategoryModal() {

    document
        .getElementById("editCategoryModal")
        .classList.remove("show");

    document.body.classList.remove("modal-open");
}


// ======================================================
// SUPPRIMER
// ======================================================

function deleteCategory(id, name) {

    const confirmation = confirm(
        `Voulez-vous vraiment supprimer la catégorie "${name}" ?`
    );

    if (!confirmation) {
        return;
    }

    const form =
        document.getElementById("deleteCategoryForm");

    form.action =
        `/admin/categories/${id}/delete`;

    form.submit();
}


// ======================================================
// FERMER MODAL EN CLIQUANT EN DEHORS
// ======================================================

document.addEventListener("click", function (event) {

    if (event.target.id === "addCategoryModal") {
        closeAddCategoryModal();
    }

    if (event.target.id === "editCategoryModal") {
        closeEditCategoryModal();
    }

});


// ======================================================
// TOUCHE ECHAP
// ======================================================

document.addEventListener("keydown", function (event) {

    if (event.key === "Escape") {
        closeAddCategoryModal();
        closeEditCategoryModal();
    }

});