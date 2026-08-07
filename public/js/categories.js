function openAddCategoryModal() {
    const modal = document.getElementById("addCategoryModal");

    if (!modal) return;

    modal.classList.add("show");
    document.body.classList.add("modal-open");
}


function closeAddCategoryModal() {
    const modal = document.getElementById("addCategoryModal");

    if (!modal) return;

    modal.classList.remove("show");
    document.body.classList.remove("modal-open");
}


function openEditCategoryModal(
    id,
    name,
    description = "",
    sortOrder = 0
) {
    const modal =
        document.getElementById("editCategoryModal");

    const form =
        document.getElementById("editCategoryForm");

    if (!modal || !form) return;


    document.getElementById("editCategoryName").value =
        name || "";

    document.getElementById("editCategoryDescription").value =
        description || "";

    document.getElementById("editCategoryOrder").value =
        sortOrder ?? 0;


    form.action =
        `/admin/categories/${id}`;


    modal.classList.add("show");

    document.body.classList.add("modal-open");
}


function closeEditCategoryModal() {
    const modal =
        document.getElementById("editCategoryModal");

    if (!modal) return;

    modal.classList.remove("show");
    document.body.classList.remove("modal-open");
}


function deleteCategory(id, name) {

    const confirmation = confirm(
        `Voulez-vous vraiment supprimer la catégorie "${name}" ?`
    );

    if (!confirmation) return;


    const form =
        document.getElementById("deleteCategoryForm");

    form.action =
        `/admin/categories/${id}/supprimer`;

    form.submit();
}


/* Clic sur le fond */

document.addEventListener("click", function(event) {

    if (event.target.id === "addCategoryModal") {
        closeAddCategoryModal();
    }

    if (event.target.id === "editCategoryModal") {
        closeEditCategoryModal();
    }

});


/* ESC */

document.addEventListener("keydown", function(event) {

    if (event.key === "Escape") {
        closeAddCategoryModal();
        closeEditCategoryModal();
    }

});