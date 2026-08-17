document.addEventListener(
    "DOMContentLoaded",
    function () {

        /* =====================================================
           ELEMENTS
        ===================================================== */

        const messageBox =
            document.getElementById(
                "cartMessage"
            );


        /* =====================================================
           MESSAGE
        ===================================================== */

        function showMessage(
            message,
            type = "success"
        ) {

            if (!messageBox) {
                return;
            }


            messageBox.textContent =
                message;


            messageBox.className =
                "cart-message show " + type;


            window.setTimeout(
                function () {

                    messageBox.classList.remove(
                        "show"
                    );

                },
                3500
            );
        }


        /* =====================================================
           LECTURE JSON SECURISEE
        ===================================================== */

        async function readJson(response) {

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
                    "Réponse serveur non JSON :",
                    text
                );


                throw new Error(
                    "Le serveur n'a pas retourné une réponse JSON."
                );
            }


            return await response.json();
        }


        /* =====================================================
           MODIFICATION QUANTITE
        ===================================================== */

        async function updateQuantity(
            itemId,
            quantity
        ) {

            try {

                const response =
                    await fetch(
                        `/panier/${itemId}/quantite`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",

                                "Accept":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({
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
                        "Impossible de modifier la quantité."
                    );
                }


                /*
                    Pour cette première version robuste,
                    on recharge la page.

                    Plus tard nous pourrons mettre à jour
                    chaque montant sans reload.
                */

                window.location.reload();

            }
            catch (error) {

                console.error(error);

                showMessage(
                    error.message,
                    "error"
                );
            }
        }


        /* =====================================================
           BOUTON -
        ===================================================== */

        document
            .querySelectorAll(
                ".cart-quantity-minus"
            )
            .forEach(function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        const itemId =
                            Number(
                                this.dataset.itemId
                            );


                        const article =
                            this.closest(
                                ".cart-item"
                            );


                        const quantityElement =
                            article?.querySelector(
                                ".quantity-value"
                            );


                        const currentQuantity =
                            Number(
                                quantityElement?.dataset.quantity ||
                                quantityElement?.textContent ||
                                1
                            );


                        /*
                            À 1 on ne descend pas à 0.

                            La suppression possède son
                            propre bouton.
                        */

                        if (
                            currentQuantity <= 1
                        ) {

                            showMessage(
                                "La quantité minimale est 1.",
                                "error"
                            );

                            return;
                        }


                        updateQuantity(
                            itemId,
                            currentQuantity - 1
                        );
                    }
                );
            });


        /* =====================================================
           BOUTON +
        ===================================================== */

        document
            .querySelectorAll(
                ".cart-quantity-plus"
            )
            .forEach(function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        const itemId =
                            Number(
                                this.dataset.itemId
                            );


                        const article =
                            this.closest(
                                ".cart-item"
                            );


                        const quantityElement =
                            article?.querySelector(
                                ".quantity-value"
                            );


                        const currentQuantity =
                            Number(
                                quantityElement?.dataset.quantity ||
                                quantityElement?.textContent ||
                                1
                            );


                        if (
                            currentQuantity >= 99
                        ) {

                            showMessage(
                                "La quantité maximale est 99.",
                                "error"
                            );

                            return;
                        }


                        updateQuantity(
                            itemId,
                            currentQuantity + 1
                        );
                    }
                );
            });


        /* =====================================================
           SUPPRIMER ARTICLE
        ===================================================== */

        document
            .querySelectorAll(
                ".cart-remove"
            )
            .forEach(function (button) {

                button.addEventListener(
                    "click",
                    async function () {

                        const itemId =
                            Number(
                                this.dataset.itemId
                            );


                        if (
                            !window.confirm(
                                "Supprimer cet article du panier ?"
                            )
                        ) {
                            return;
                        }


                        try {

                            const response =
                                await fetch(
                                    `/panier/${itemId}`,
                                    {
                                        method:
                                            "DELETE",

                                        headers: {
                                            "Accept":
                                                "application/json"
                                        }
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
                                    "Suppression impossible."
                                );
                            }


                            window.location.reload();

                        }
                        catch (error) {

                            console.error(error);

                            showMessage(
                                error.message,
                                "error"
                            );
                        }
                    }
                );
            });


        /* =====================================================
           VIDER LE PANIER
        ===================================================== */

        const clearButton =
            document.getElementById(
                "clearCartButton"
            );


        if (clearButton) {

            clearButton.addEventListener(
                "click",
                async function () {

                    if (
                        !window.confirm(
                            "Voulez-vous vraiment vider tout le panier ?"
                        )
                    ) {
                        return;
                    }


                    try {

                        const response =
                            await fetch(
                                "/panier",
                                {
                                    method:
                                        "DELETE",

                                    headers: {
                                        "Accept":
                                            "application/json"
                                    }
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
                                "Impossible de vider le panier."
                            );
                        }


                        window.location.reload();

                    }
                    catch (error) {

                        console.error(error);

                        showMessage(
                            error.message,
                            "error"
                        );
                    }
                }
            );
        }

    }
);