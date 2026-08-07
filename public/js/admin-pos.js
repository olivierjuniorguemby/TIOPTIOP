let posCart = [];


/* =====================================================
   AJOUTER
===================================================== */

function addPosProduct(id, name, price, icon) {

    const existing =
        posCart.find(product => product.id === id);

    if (existing) {

        existing.quantity++;

    } else {

        posCart.push({
            id,
            name,
            price,
            icon,
            quantity: 1
        });

    }

    renderPosCart();
}


/* =====================================================
   QUANTITÉ
===================================================== */

function changePosQuantity(id, change) {

    const product =
        posCart.find(item => item.id === id);

    if (!product) {
        return;
    }

    product.quantity += change;

    if (product.quantity <= 0) {

        posCart =
            posCart.filter(item => item.id !== id);

    }

    renderPosCart();
}


/* =====================================================
   SUPPRIMER
===================================================== */

function removePosProduct(id) {

    posCart =
        posCart.filter(product => product.id !== id);

    renderPosCart();
}


/* =====================================================
   AFFICHER PANIER
===================================================== */

function renderPosCart() {

    const container =
        document.getElementById("posCartItems");

    const empty =
        document.getElementById("posCartEmpty");

    const summary =
        document.getElementById("posCartSummary");


    if (!posCart.length) {

        container.innerHTML = "";

        empty.style.display = "block";
        summary.style.display = "none";

        updatePosTotals();

        return;
    }


    empty.style.display = "none";
    summary.style.display = "block";


    container.innerHTML =
        posCart.map(product => {

            const lineTotal =
                product.price * product.quantity;

            return `

                <div class="pos-cart-item">

                    <div class="pos-cart-product">

                        <div class="pos-product-icon">
                            ${product.icon}
                        </div>

                        <div>

                            <strong>
                                ${product.name}
                            </strong>

                            <small>
                                ${formatPosMoney(product.price)}
                            </small>

                        </div>

                    </div>


                    <div class="pos-quantity">

                        <button
                            type="button"
                            onclick="changePosQuantity('${product.id}', -1)"
                        >
                            −
                        </button>

                        <strong>
                            ${product.quantity}
                        </strong>

                        <button
                            type="button"
                            onclick="changePosQuantity('${product.id}', 1)"
                        >
                            +
                        </button>

                    </div>


                    <div>

                        <strong>
                            ${formatPosMoney(lineTotal)}
                        </strong>

                        <button
                            type="button"
                            class="pos-remove"
                            onclick="removePosProduct('${product.id}')"
                        >
                            Supprimer
                        </button>

                    </div>

                </div>

            `;

        }).join("");


    updatePosTotals();
}


/* =====================================================
   TOTAL
===================================================== */

function updatePosTotals() {

    const subtotal =
        posCart.reduce(
            (total, product) =>
                total + product.price * product.quantity,
            0
        );


    document.getElementById(
        "posSubtotal"
    ).textContent =
        formatPosMoney(subtotal);


    document.getElementById(
        "posTotal"
    ).textContent =
        formatPosMoney(subtotal);
}


/* =====================================================
   FORMAT €
===================================================== */

function formatPosMoney(value) {

    return new Intl.NumberFormat(
        "fr-FR",
        {
            style: "currency",
            currency: "EUR"
        }
    ).format(value);

}


/* =====================================================
   RECHERCHE PRODUIT
===================================================== */

function filterPosProducts() {

    const search =
        document
            .getElementById("posProductSearch")
            .value
            .toLowerCase();


    document
        .querySelectorAll(".pos-product")
        .forEach(product => {

            const name =
                product.dataset.name.toLowerCase();

            product.style.display =
                name.includes(search)
                    ? ""
                    : "none";

        });

}


/* =====================================================
   PAIEMENT
===================================================== */

document
    .getElementById("posPayment")
    ?.addEventListener("change", function () {

        const information =
            document.getElementById(
                "posPaymentInformation"
            );


        switch (this.value) {

            case "cash":

                information.textContent =
                    "Espèces = EN ATTENTE jusqu'à confirmation de l'encaissement.";

                break;


            case "card":

                information.textContent =
                    "Carte bancaire : paiement à confirmer avant validation de la commande.";

                break;


            case "mobile":

                information.textContent =
                    "Mobile Money : paiement à confirmer avant validation de la commande.";

                break;

        }

    });


/* =====================================================
   CRÉER COMMANDE
===================================================== */

function createPosOrder() {

    if (!posCart.length) {

        alert(
            "Ajoutez au moins un produit au panier."
        );

        return;
    }


    const client =
        document.getElementById("posClient").value;

    const channel =
        document.getElementById("posChannel").value;

    const payment =
        document.getElementById("posPayment").value;


    const order = {

        client,
        channel,
        payment,

        items: posCart,

        total: posCart.reduce(
            (total, product) =>
                total +
                product.price *
                product.quantity,
            0
        )

    };


    console.log(
        "Commande POS :",
        order
    );


    /*
     * PROCHAINE ÉTAPE :
     *
     * fetch("/admin/commandes", {
     *
     *   method: "POST",
     *
     *   headers: {
     *      "Content-Type": "application/json"
     *   },
     *
     *   body: JSON.stringify(order)
     *
     * });
     */


    alert(
        "Commande POS créée avec succès."
    );


    posCart = [];

    renderPosCart();
}