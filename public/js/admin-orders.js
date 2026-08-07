let currentOrderRow = null;


/* =========================================================
   OUVRIR COMMANDE
========================================================= */

function openOrderModal(button) {

    const row = button.closest(".order-row");

    if (!row) {
        return;
    }

    currentOrderRow = row;

    const reference =
        row.dataset.reference || "";

    const client =
        row.dataset.client || "";

    const products =
        row.dataset.products || "";

    const channel =
        row.dataset.channel || "";

    const payment =
        row.dataset.payment || "";

    const paymentStatus =
        row.dataset.paymentStatus || "";

    const status =
        row.dataset.status || "";

    const total =
        row.dataset.total || "";


    document.getElementById("modalOrderReference").textContent =
        reference;

    document.getElementById("modalOrderClient").textContent =
        client;

    document.getElementById("modalOrderProducts").textContent =
        products;

    document.getElementById("modalOrderChannel").textContent =
        channel;

    document.getElementById("modalOrderPayment").textContent =
        payment;

    document.getElementById("modalOrderPaymentStatus").textContent =
        paymentStatus;

    document.getElementById("modalOrderStatus").textContent =
        status;

    document.getElementById("modalOrderTotal").textContent =
        total;


    /* -----------------------------------------
       Bouton espèces
    ----------------------------------------- */

    const cashButton =
        document.getElementById("confirmCashButton");

    if (
        payment.toLowerCase() === "espèces" &&
        paymentStatus === "EN_ATTENTE"
    ) {

        cashButton.style.display = "inline-flex";

    } else {

        cashButton.style.display = "none";

    }


    /* -----------------------------------------
       Afficher modal
    ----------------------------------------- */

    const modal =
        document.getElementById("adminOrderModal");

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");

    document.body.style.overflow = "hidden";
}


/* =========================================================
   FERMER
========================================================= */

function closeOrderModal() {

    const modal =
        document.getElementById("adminOrderModal");

    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");

    document.body.style.overflow = "";

    currentOrderRow = null;
}


/* =========================================================
   CONFIRMER ESPÈCES
========================================================= */

function confirmCashPayment() {

    if (!currentOrderRow) {
        return;
    }

    const reference =
        currentOrderRow.dataset.reference;

    const confirmButton =
        document.getElementById("confirmCashButton");


    /*
     * Pour l'instant simulation.
     *
     * Ensuite nous remplacerons cette partie
     * par un POST /admin/commandes/:id/paiement
     */

    currentOrderRow.dataset.paymentStatus = "PAYÉ";


    /* Mise à jour tableau */

    const paymentBadge =
        currentOrderRow.querySelector(".payment-badge");

    if (paymentBadge) {

        paymentBadge.textContent = "PAYÉ";

        paymentBadge.classList.remove("waiting");

        paymentBadge.style.background = "#e7f6ec";
        paymentBadge.style.color = "#187344";
    }


    /* Mise à jour modal */

    document.getElementById(
        "modalOrderPaymentStatus"
    ).textContent = "PAYÉ";


    confirmButton.textContent =
        "✓ Espèces reçues";

    confirmButton.disabled = true;


    setTimeout(() => {

        confirmButton.style.display = "none";

    }, 900);

}


/* =========================================================
   FILTRES
========================================================= */

function filterAdminOrders() {

    const search =
        document
            .getElementById("orderSearch")
            .value
            .toLowerCase();

    const status =
        document
            .getElementById("statusFilter")
            .value
            .toLowerCase();

    const payment =
        document
            .getElementById("paymentFilter")
            .value
            .toLowerCase();

    const channel =
        document
            .getElementById("channelFilter")
            .value
            .toLowerCase();


    document
        .querySelectorAll(".order-row")
        .forEach(row => {

            const rowText =
                (
                    row.dataset.reference +
                    " " +
                    row.dataset.client +
                    " " +
                    row.dataset.products
                ).toLowerCase();


            const rowStatus =
                row.dataset.status.toLowerCase();

            const rowPayment =
                row.dataset.payment.toLowerCase();

            const rowChannel =
                row.dataset.channel.toLowerCase();


            const searchOK =
                !search ||
                rowText.includes(search);


            const statusOK =
                !status ||
                rowStatus.includes(status);


            const paymentOK =
                !payment ||
                rowPayment.includes(payment);


            const channelOK =
                !channel ||
                rowChannel.includes(channel);


            row.style.display =
                searchOK &&
                statusOK &&
                paymentOK &&
                channelOK

                    ? ""

                    : "none";

        });

}


/* =========================================================
   ESC POUR FERMER
========================================================= */

document.addEventListener("keydown", event => {

    if (event.key === "Escape") {

        closeOrderModal();

    }

});