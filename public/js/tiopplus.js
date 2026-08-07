/* ============================================================
   AJOUTER UNE RÉCOMPENSE
============================================================ */

function openAddRewardModal() {

    const modal =
        document.getElementById("addRewardModal");

    if (!modal) return;

    modal.classList.add("show");

    document.body.classList.add("modal-open");
}


function closeAddRewardModal() {

    const modal =
        document.getElementById("addRewardModal");

    if (!modal) return;

    modal.classList.remove("show");

    document.body.classList.remove("modal-open");
}


/* ============================================================
   MODIFIER
============================================================ */

function openEditRewardModal(
    id,
    name,
    points,
    image
) {

    const modal =
        document.getElementById("editRewardModal");

    const form =
        document.getElementById("editRewardForm");

    const nameInput =
        document.getElementById("editRewardName");

    const pointsInput =
        document.getElementById("editRewardPoints");

    const preview =
        document.getElementById("editRewardPreview");

    const previewContainer =
        document.getElementById(
            "editRewardPreviewContainer"
        );


    if (!modal || !form) {
        return;
    }


    nameInput.value = name || "";

    pointsInput.value = points || 0;


    /* IMAGE ACTUELLE */

    if (image) {

        preview.src = image;

        preview.style.display = "block";

        previewContainer.style.display = "block";

    } else {

        preview.removeAttribute("src");

        preview.style.display = "none";

        previewContainer.style.display = "none";
    }


    /* ROUTE UPDATE */

    form.action =
        `/admin/tiopplus/${id}`;


    modal.classList.add("show");

    document.body.classList.add("modal-open");
}


function closeEditRewardModal() {

    const modal =
        document.getElementById("editRewardModal");

    if (!modal) return;

    modal.classList.remove("show");

    document.body.classList.remove("modal-open");
}


/* ============================================================
   APERÇU IMAGE AJOUT
============================================================ */

function previewAddRewardImage(event) {

    const file =
        event.target.files[0];

    const preview =
        document.getElementById(
            "addRewardPreview"
        );


    if (!file) {

        preview.style.display = "none";

        preview.removeAttribute("src");

        return;
    }


    const reader =
        new FileReader();


    reader.onload = function (e) {

        preview.src =
            e.target.result;

        preview.style.display =
            "block";
    };


    reader.readAsDataURL(file);
}


/* ============================================================
   APERÇU IMAGE MODIFICATION
============================================================ */

function previewEditRewardImage(event) {

    const file =
        event.target.files[0];

    if (!file) {
        return;
    }


    const preview =
        document.getElementById(
            "editRewardPreview"
        );

    const container =
        document.getElementById(
            "editRewardPreviewContainer"
        );


    const reader =
        new FileReader();


    reader.onload = function (e) {

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

function deleteReward(id, name) {

    const confirmation =
        confirm(
            `Voulez-vous vraiment supprimer la récompense "${name}" ?`
        );


    if (!confirmation) {
        return;
    }


    const form =
        document.getElementById(
            "deleteRewardForm"
        );


    form.action =
        `/admin/tiopplus/${id}/supprimer`;


    form.submit();
}


/* ============================================================
   FERMETURE EN CLIQUANT SUR LE FOND
============================================================ */

document.addEventListener(
    "click",
    function (event) {

        if (
            event.target.id ===
            "addRewardModal"
        ) {
            closeAddRewardModal();
        }


        if (
            event.target.id ===
            "editRewardModal"
        ) {
            closeEditRewardModal();
        }

    }
);


/* ============================================================
   ESC
============================================================ */

document.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Escape") {

            closeAddRewardModal();

            closeEditRewardModal();
        }

    }
);