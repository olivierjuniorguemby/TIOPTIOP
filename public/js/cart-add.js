document.addEventListener(
    "DOMContentLoaded",
    function () {

        /* =====================================================
           JSON
        ===================================================== */

        async function readJson(
            response
        ) {

            const contentType =
                response.headers.get(
                    "content-type"
                ) || "";


            if (
                !contentType.includes(
                    "application/json"
                )
            ) {

                const text =
                    await response.text();


                console.error(
                    "Réponse non JSON :",
                    text
                );


                throw new Error(
                    "Réponse serveur invalide."
                );
            }


            return await response.json();
        }


        /* =====================================================
           COMPTEUR
        ===================================================== */

        function updateCartCounter(
            count
        ) {

            document
                .querySelectorAll(
                    [
                        "#cartCount",
                        "#cart-count",
                        ".cart-count-badge",
                        "[data-cart-count]"
                    ].join(",")
                )
                .forEach(
                    counter => {

                        counter.textContent =
                            Number(
                                count || 0
                            );
                    }
                );
        }


        /* =====================================================
           NOTIFICATION
        ===================================================== */

        function notify(
            message,
            type = "success"
        ) {

            let box =
                document.getElementById(
                    "globalCartNotification"
                );


            if (!box) {

                box =
                    document.createElement(
                        "div"
                    );


                box.id =
                    "globalCartNotification";


                Object.assign(
                    box.style,
                    {
                        position:
                            "fixed",

                        right:
                            "22px",

                        bottom:
                            "22px",

                        zIndex:
                            "99999",

                        maxWidth:
                            "350px",

                        padding:
                            "14px 18px",

                        borderRadius:
                            "15px",

                        color:
                            "#fff",

                        fontSize:
                            "13px",

                        fontWeight:
                            "800",

                        boxShadow:
                            "0 15px 45px rgba(0,0,0,.18)",

                        transition:
                            ".2s ease"
                    }
                );


                document.body.appendChild(
                    box
                );
            }


            box.style.background =
                type === "error"
                    ? "#a52d2d"
                    : "#17130f";


            box.textContent =
                message;


            box.style.opacity =
                "1";


            clearTimeout(
                box._timer
            );


            box._timer =
                setTimeout(
                    function () {

                        box.style.opacity =
                            "0";
                    },
                    2800
                );
        }


        /* =====================================================
           SYNCHRONISATION COMPTEUR
        ===================================================== */

        async function loadCartCounter() {

            try {

                const response =
                    await fetch(
                        "/panier/data",
                        {
                            headers: {
                                "Accept":
                                    "application/json"
                            },

                            credentials:
                                "same-origin"
                        }
                    );


                const result =
                    await readJson(
                        response
                    );


                if (
                    response.ok &&
                    result.success
                ) {

                    updateCartCounter(
                        result.cart
                            ?.total_quantity
                        || 0
                    );
                }

            }
            catch (error) {

                console.error(
                    "Erreur compteur panier :",
                    error
                );
            }
        }


        /* =====================================================
           AJOUT PRODUIT
        ===================================================== */

        async function addProduct({
            productId,
            quantity = 1,
            optionValueIds = [],
            instructions = ""
        }) {

            const response =
                await fetch(
                    "/panier/produit",
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Accept":
                                "application/json"
                        },

                        credentials:
                            "same-origin",

                        body:
                            JSON.stringify({

                                product_id:
                                    productId,

                                quantity,

                                option_value_ids:
                                    optionValueIds,

                                instructions
                            })
                    }
                );


            const result =
                await readJson(
                    response
                );


            if (
                !response.ok ||
                !result.success
            ) {

                throw new Error(
                    result.message ||
                    "Impossible d'ajouter le produit."
                );
            }


            updateCartCounter(
                result.cart_count
            );


            return result;
        }


        /* =====================================================
           AJOUT FORMULE
        ===================================================== */

        async function addFormula({
            formulaId,
            quantity = 1
        }) {

            const response =
                await fetch(
                    "/panier/formule",
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Accept":
                                "application/json"
                        },

                        credentials:
                            "same-origin",

                        body:
                            JSON.stringify({

                                formula_id:
                                    formulaId,

                                quantity
                            })
                    }
                );


            const result =
                await readJson(
                    response
                );


            if (
                !response.ok ||
                !result.success
            ) {

                throw new Error(
                    result.message ||
                    "Impossible d'ajouter la formule."
                );
            }


            updateCartCounter(
                result.cart_count
            );


            return result;
        }


        /* =====================================================
           API GLOBALE

           product.ejs peut maintenant l'utiliser.
        ===================================================== */

        window.TiopCart = {

            addProduct,
            addFormula,

            updateCartCounter,

            notify,

            refresh:
                loadCartCounter
        };


        /* =====================================================
           PRODUITS RAPIDES HOME / MENU / SUGGESTIONS
        ===================================================== */

        document
            .querySelectorAll(
                ".add-product-to-cart"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        async function () {

                            const productId =
                                Number(
                                    this.dataset.productId
                                );


                            const original =
                                this.innerHTML;


                            try {

                                this.disabled =
                                    true;

                                this.innerHTML =
                                    "Ajout...";


                                await addProduct({

                                    productId,

                                    quantity:
                                        1,

                                    optionValueIds:
                                        []
                                });


                                this.innerHTML =
                                    "✓ Ajouté";


                                notify(
                                    "✓ Produit ajouté au panier"
                                );

                            }
                            catch (error) {

                                this.innerHTML =
                                    original;


                                notify(
                                    error.message,
                                    "error"
                                );
                            }
                            finally {

                                this.disabled =
                                    false;


                                setTimeout(
                                    () => {

                                        this.innerHTML =
                                            original;

                                    },
                                    1200
                                );
                            }
                        }
                    );
                }
            );


        /* =====================================================
           FORMULES RAPIDES
        ===================================================== */

        document
            .querySelectorAll(
                ".add-formula-to-cart"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        async function () {

                            const formulaId =
                                Number(
                                    this.dataset.formulaId
                                );


                            const original =
                                this.innerHTML;


                            try {

                                this.disabled =
                                    true;

                                this.innerHTML =
                                    "Ajout...";


                                await addFormula({

                                    formulaId,

                                    quantity:
                                        1
                                });


                                this.innerHTML =
                                    "✓ Ajoutée";


                                notify(
                                    "✓ Formule ajoutée au panier"
                                );

                            }
                            catch (error) {

                                this.innerHTML =
                                    original;


                                notify(
                                    error.message,
                                    "error"
                                );
                            }
                            finally {

                                this.disabled =
                                    false;


                                setTimeout(
                                    () => {

                                        this.innerHTML =
                                            original;

                                    },
                                    1200
                                );
                            }
                        }
                    );
                }
            );


        /* =====================================================
           INITIALISATION
        ===================================================== */

        loadCartCounter();

    }
);