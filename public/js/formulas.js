function openAddFormulaModal() {

    const modal =
        document.getElementById("addFormulaModal");

    if (!modal) return;

    modal.classList.add("show");

    document.body.classList.add("modal-open");
}


function closeAddFormulaModal() {

    const modal =
        document.getElementById("addFormulaModal");

    if (!modal) return;

    modal.classList.remove("show");

    document.body.classList.remove("modal-open");
}


/* ============================================
   MODIFIER
============================================ */

function openEditFormulaModal(
    id,
    name,
    price,
    description,
    image
) {

    const modal =
        document.getElementById("editFormulaModal");

    const form =
        document.getElementById("editFormulaForm");

    if (!modal || !form) return;


    document.getElementById("editFormulaName").value =
        name || "";

    document.getElementById("editFormulaPrice").value =
        price || "";

    document.getElementById("editFormulaDescription").value =
        description || "";


    form.action =
        `/admin/formules/${id}`;


    /* IMAGE EXISTANTE */

    const imageContainer =
        document.getElementById("currentFormulaImages");

    imageContainer.innerHTML = "";


    if (image) {

        const img = document.createElement("img");

        img.src = image;

        img.alt = name;

        img.className = "formula-preview-image";

        imageContainer.appendChild(img);
    }


    document.getElementById(
        "editFormulaPreview"
    ).innerHTML = "";


    modal.classList.add("show");

    document.body.classList.add("modal-open");
}


function closeEditFormulaModal() {

    const modal =
        document.getElementById("editFormulaModal");

    if (!modal) return;

    modal.classList.remove("show");

    document.body.classList.remove("modal-open");
}


/* ============================================
   PREVIEW AJOUT
============================================ */

function previewAddFormulaImages(event) {

    const container =
        document.getElementById("addFormulaPreview");

    previewFormulaImages(
        event.target.files,
        container
    );
}


/* ============================================
   PREVIEW MODIFICATION
============================================ */

function previewEditFormulaImages(event) {

    const container =
        document.getElementById("editFormulaPreview");

    previewFormulaImages(
        event.target.files,
        container
    );
}


function previewFormulaImages(files, container) {

    container.innerHTML = "";

    const selectedFiles =
        Array.from(files).slice(0, 6);


    selectedFiles.forEach(file => {

        if (!file.type.startsWith("image/")) {
            return;
        }

        const reader = new FileReader();

        reader.onload = function(e) {

            const img =
                document.createElement("img");

            img.src = e.target.result;

            img.className =
                "formula-preview-image";

            container.appendChild(img);
        };

        reader.readAsDataURL(file);
    });
}


/* ============================================
   SUPPRIMER
============================================ */

function deleteFormula(id, name) {

    const confirmation = confirm(
        `Voulez-vous vraiment supprimer la formule "${name}" ?`
    );

    if (!confirmation) {
        return;
    }


    const form =
        document.getElementById("deleteFormulaForm");

    form.action =
        `/admin/formules/${id}/supprimer`;

    form.submit();
}


/* ============================================
   CLIC HORS MODAL
============================================ */

document.addEventListener(
    "click",
    function(event) {

        if (event.target.id === "addFormulaModal") {
            closeAddFormulaModal();
        }

        if (event.target.id === "editFormulaModal") {
            closeEditFormulaModal();
        }

    }
);


/* ESC */

document.addEventListener(
    "keydown",
    function(event) {

        if (event.key === "Escape") {

            closeAddFormulaModal();

            closeEditFormulaModal();
        }

    }
);