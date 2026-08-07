/* ============================================================
   AJOUTER CLIENT
============================================================ */

function openAddClientModal() {

    const modal =
        document.getElementById("addClientModal");

    if (!modal) return;

    modal.classList.add("show");

    document.body.classList.add("modal-open");
}


function closeAddClientModal() {

    const modal =
        document.getElementById("addClientModal");

    if (!modal) return;

    modal.classList.remove("show");

    document.body.classList.remove("modal-open");
}


/* ============================================================
   MODIFIER CLIENT
============================================================ */

function openEditClientModal(
    id,
    name,
    email,
    phone,
    avatar
) {

    const modal =
        document.getElementById("editClientModal");

    const form =
        document.getElementById("editClientForm");

    const nameInput =
        document.getElementById("editClientName");

    const emailInput =
        document.getElementById("editClientEmail");

    const phoneInput =
        document.getElementById("editClientPhone");

    const preview =
        document.getElementById("editClientPreview");

    const previewContainer =
        document.getElementById(
            "editClientPreviewContainer"
        );


    if (!modal || !form) return;


    nameInput.value =
        name || "";

    emailInput.value =
        email || "";

    phoneInput.value =
        phone || "";


    /* PHOTO ACTUELLE */

    if (avatar) {

        preview.src = avatar;

        preview.style.display =
            "block";

        previewContainer.style.display =
            "block";

    } else {

        preview.removeAttribute("src");

        preview.style.display =
            "none";

        previewContainer.style.display =
            "none";
    }


    /* ROUTE MODIFICATION */

    form.action =
        `/admin/clients/${id}`;


    modal.classList.add("show");

    document.body.classList.add(
        "modal-open"
    );
}


function closeEditClientModal() {

    const modal =
        document.getElementById("editClientModal");

    if (!modal) return;

    modal.classList.remove("show");

    document.body.classList.remove(
        "modal-open"
    );
}


/* ============================================================
   PREVIEW AJOUT PHOTO
============================================================ */

function previewAddClientImage(event) {

    const file =
        event.target.files[0];

    const preview =
        document.getElementById(
            "addClientPreview"
        );


    if (!file) {

        preview.removeAttribute("src");

        preview.style.display =
            "none";

        return;
    }


    const reader =
        new FileReader();


    reader.onload =
        function (e) {

            preview.src =
                e.target.result;

            preview.style.display =
                "block";
        };


    reader.readAsDataURL(file);
}


/* ============================================================
   PREVIEW MODIFICATION
============================================================ */

function previewEditClientImage(event) {

    const file =
        event.target.files[0];

    if (!file) return;


    const preview =
        document.getElementById(
            "editClientPreview"
        );

    const container =
        document.getElementById(
            "editClientPreviewContainer"
        );


    const reader =
        new FileReader();


    reader.onload =
        function (e) {

            preview.src =
                e.target.result;

            preview.style.display =
                "block";

            container.style.display =
                "block";
        };


    reader.readAsDataURL(file);
}


/* ============================================================
   SUPPRESSION
============================================================ */

function deleteClient(id, name) {

    const confirmation =
        confirm(
            `Voulez-vous vraiment supprimer le client "${name}" ?`
        );


    if (!confirmation) {
        return;
    }


    const form =
        document.getElementById(
            "deleteClientForm"
        );


    form.action =
        `/admin/clients/${id}/supprimer`;


    form.submit();
}


/* ============================================================
   CLIC SUR FOND MODAL
============================================================ */

document.addEventListener(
    "click",
    function (event) {

        if (
            event.target.id ===
            "addClientModal"
        ) {
            closeAddClientModal();
        }


        if (
            event.target.id ===
            "editClientModal"
        ) {
            closeEditClientModal();
        }

    }
);


/* ============================================================
   TOUCHE ESC
============================================================ */

document.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Escape") {

            closeAddClientModal();

            closeEditClientModal();
        }

    }
);