/* =========================================================
   AJOUTER FAQ
========================================================= */

function openFaqAddModal() {

    const modal =
        document.getElementById("faqAddModal");

    modal.classList.add("show");

    document.body.style.overflow = "hidden";
}


function closeFaqAddModal() {

    const modal =
        document.getElementById("faqAddModal");

    modal.classList.remove("show");

    document.body.style.overflow = "";
}


/* =========================================================
   MODIFIER FAQ
========================================================= */

function openFaqEditModal(faq) {

    document.getElementById("faqEditId").value =
        faq.id || "";

    document.getElementById("faqEditQuestion").value =
        faq.question || "";

    document.getElementById("faqEditAnswer").value =
        faq.answer || "";


    /* URL formulaire */

    document.getElementById("faqEditForm").action =
        `/admin/faq/${faq.id}`;


    document
        .getElementById("faqEditModal")
        .classList.add("show");


    document.body.style.overflow = "hidden";
}


function closeFaqEditModal() {

    document
        .getElementById("faqEditModal")
        .classList.remove("show");

    document.body.style.overflow = "";
}


/* =========================================================
   SUPPRIMER
========================================================= */

function deleteFaq(id) {

    const confirmation =
        confirm(
            "Voulez-vous vraiment supprimer cette FAQ ?"
        );


    if (!confirmation) {
        return;
    }


    /*
     * Pour l'instant redirection.
     * Nous pourrons ensuite remplacer ça
     * par fetch() ou un formulaire POST.
     */

    window.location.href =
        `/admin/faq/${id}/delete`;
}


/* =========================================================
   CLIC EN DEHORS DU MODAL
========================================================= */

document.addEventListener("click", function (event) {

    if (event.target.id === "faqAddModal") {

        closeFaqAddModal();

    }


    if (event.target.id === "faqEditModal") {

        closeFaqEditModal();

    }

});


/* =========================================================
   ESC
========================================================= */

document.addEventListener("keydown", function (event) {

    if (event.key === "Escape") {

        closeFaqAddModal();

        closeFaqEditModal();

    }

});