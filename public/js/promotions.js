/* =====================================================
   AJOUTER
===================================================== */

function openAddPromotionModal() {

    const modal =
        document.getElementById("addPromotionModal");

    if (!modal) return;

    modal.classList.add("show");

    document.body.classList.add("modal-open");
}


function closeAddPromotionModal() {

    const modal =
        document.getElementById("addPromotionModal");

    if (!modal) return;

    modal.classList.remove("show");

    document.body.classList.remove("modal-open");
}


/* =====================================================
   MODIFIER
===================================================== */

function openEditPromotionModal(
    id,
    title,
    code,
    audience
) {

    const modal =
        document.getElementById("editPromotionModal");

    const form =
        document.getElementById("editPromotionForm");

    if (!modal || !form) {
        return;
    }


    document.getElementById(
        "editPromotionTitle"
    ).value = title || "";


    document.getElementById(
        "editPromotionCode"
    ).value = code || "";


    document.getElementById(
        "editPromotionAudience"
    ).value = audience || "Tous";


    form.action =
        `/admin/promotions/${id}`;


    modal.classList.add("show");

    document.body.classList.add("modal-open");
}


function closeEditPromotionModal() {

    const modal =
        document.getElementById("editPromotionModal");

    if (!modal) return;

    modal.classList.remove("show");

    document.body.classList.remove("modal-open");
}


/* =====================================================
   SUPPRESSION
===================================================== */

function deletePromotion(id, title) {

    const confirmation = confirm(
        `Voulez-vous vraiment supprimer la promotion "${title}" ?`
    );

    if (!confirmation) {
        return;
    }


    const form =
        document.getElementById("deletePromotionForm");

    form.action =
        `/admin/promotions/${id}/supprimer`;

    form.submit();
}


/* =====================================================
   FERMETURE CLIC ARRIERE-PLAN
===================================================== */

document.addEventListener(
    "click",
    function (event) {

        if (
            event.target.id ===
            "addPromotionModal"
        ) {
            closeAddPromotionModal();
        }


        if (
            event.target.id ===
            "editPromotionModal"
        ) {
            closeEditPromotionModal();
        }

    }
);


/* =====================================================
   TOUCHE ESC
===================================================== */

document.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Escape") {

            closeAddPromotionModal();

            closeEditPromotionModal();
        }

    }
);