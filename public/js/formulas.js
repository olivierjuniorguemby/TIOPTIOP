let currentFormulaId = null;


/* =========================================================
   UTILITAIRES
========================================================= */

function getElement(id) {
    return document.getElementById(id);
}


function openModal(id) {

    const modal = getElement(id);

    if (!modal) {
        console.error(`Modal introuvable : ${id}`);
        return;
    }

    modal.classList.add("show");
    document.body.classList.add("modal-open");
}


function closeModal(id) {

    const modal = getElement(id);

    if (!modal) {
        return;
    }

    modal.classList.remove("show");

    const openedModal =
        document.querySelector(
            ".formula-modal-overlay.show"
        );

    if (!openedModal) {
        document.body.classList.remove(
            "modal-open"
        );
    }
}


/* =========================================================
   FETCH JSON SECURISE
========================================================= */

async function fetchJson(url, options = {}) {

    const response =
        await fetch(url, options);

    const contentType =
        response.headers.get(
            "content-type"
        ) || "";


    if (!contentType.includes(
        "application/json"
    )) {

        const text =
            await response.text();

        console.error(
            "Réponse serveur non JSON :",
            text
        );

        throw new Error(
            `Le serveur a retourné une réponse invalide (${response.status}).`
        );
    }


    const data =
        await response.json();


    if (!response.ok) {

        throw new Error(
            data.message ||
            data.error ||
            `Erreur HTTP ${response.status}`
        );
    }


    return data;
}


/* =========================================================
   AJOUT FORMULE
========================================================= */

function openAddFormulaModal() {

    openModal(
        "addFormulaModal"
    );
}


function closeAddFormulaModal() {

    closeModal(
        "addFormulaModal"
    );
}


/* =========================================================
   PREVIEW AJOUT
========================================================= */

function previewAddFormulaImages(event) {

    const container =
        getElement(
            "addFormulaPreview"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    const files =
        Array.from(
            event.target.files || []
        );


    if (files.length > 6) {

        alert(
            "Une formule ne peut pas contenir plus de 6 images."
        );

        event.target.value = "";

        return;
    }


    files.forEach(file => {

        const image =
            document.createElement(
                "img"
            );


        image.className =
            "formula-preview-image";


        image.src =
            URL.createObjectURL(
                file
            );


        image.onload = () => {

            URL.revokeObjectURL(
                image.src
            );
        };


        container.appendChild(
            image
        );
    });
}


/* =========================================================
   MODIFICATION FORMULE
========================================================= */

async function openEditFormulaModal(formula) {

    if (!formula || !formula.id) {

        alert(
            "Impossible d'identifier la formule."
        );

        return;
    }


    currentFormulaId =
        formula.id;


    const form =
        getElement(
            "editFormulaForm"
        );


    if (!form) {

        console.error(
            "editFormulaForm introuvable."
        );

        return;
    }


    form.action =
        `/admin/formules/${formula.id}/update`;


    getElement(
        "editFormulaName"
    ).value =
        formula.name || "";


    getElement(
        "editFormulaShortDescription"
    ).value =
        formula.short_description || "";


    getElement(
        "editFormulaDescription"
    ).value =
        formula.description || "";


    getElement(
        "editFormulaPrice"
    ).value =
        formula.price ?? "";


    getElement(
        "editFormulaComparePrice"
    ).value =
        formula.compare_at_price ?? "";


    getElement(
        "editFormulaCurrency"
    ).value =
        formula.currency || "XAF";


    getElement(
        "editFormulaPosition"
    ).value =
        formula.position ?? 0;


    getElement(
        "editFormulaFeatured"
    ).checked =
        Number(
            formula.is_featured
        ) === 1;


    getElement(
        "editFormulaActive"
    ).checked =
        Number(
            formula.is_active
        ) === 1;


    const preview =
        getElement(
            "editFormulaPreview"
        );


    if (preview) {
        preview.innerHTML = "";
    }


    openModal(
        "editFormulaModal"
    );


    await loadFormulaImages(
        formula.id
    );
}


function closeEditFormulaModal() {

    closeModal(
        "editFormulaModal"
    );
}


/* =========================================================
   PREVIEW MODIFICATION
========================================================= */

function previewEditFormulaImages(event) {

    const container =
        getElement(
            "editFormulaPreview"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    const files =
        Array.from(
            event.target.files || []
        );


    if (files.length > 6) {

        alert(
            "Vous ne pouvez pas sélectionner plus de 6 nouvelles images."
        );

        event.target.value = "";

        return;
    }


    files.forEach(file => {

        const image =
            document.createElement(
                "img"
            );


        image.className =
            "formula-preview-image";


        image.src =
            URL.createObjectURL(
                file
            );


        image.onload = () => {

            URL.revokeObjectURL(
                image.src
            );
        };


        container.appendChild(
            image
        );
    });
}


/* =========================================================
   IMAGES EXISTANTES
========================================================= */

async function loadFormulaImages(formulaId) {

    const container =
        getElement(
            "currentFormulaImages"
        );


    if (!container) {
        return;
    }


    container.innerHTML =
        "<p>Chargement des images...</p>";


    try {

        const images =
            await fetchJson(
                `/admin/formules/${formulaId}/images`
            );


        container.innerHTML = "";


        if (
            !Array.isArray(images) ||
            images.length === 0
        ) {

            container.innerHTML =
                "<p>Aucune image enregistrée.</p>";

            return;
        }


        images.forEach(image => {

            const block =
                document.createElement(
                    "div"
                );


            block.className =
                "formula-existing-image";


            const imageUrl =
                escapeHtml(
                    image.image_url || ""
                );


            let primaryButton = "";


            if (
                Number(
                    image.is_primary
                ) === 1
            ) {

                primaryButton = `
                    <strong>
                        ⭐ Image principale
                    </strong>
                `;

            } else {

                primaryButton = `
                    <button
                        type="button"
                        onclick="setFormulaPrimaryImage(
                            ${Number(formulaId)},
                            ${Number(image.id)}
                        )"
                    >
                        ⭐ Principale
                    </button>
                `;
            }


            block.innerHTML = `

                <img
                    src="${imageUrl}"
                    alt="Image formule"
                >

                <div class="formula-image-actions">

                    ${primaryButton}

                    <button
                        type="button"
                        onclick="deleteFormulaImage(
                            ${Number(formulaId)},
                            ${Number(image.id)}
                        )"
                    >
                        🗑 Supprimer
                    </button>

                </div>
            `;


            container.appendChild(
                block
            );
        });

    } catch (error) {

        console.error(
            "Erreur images formule :",
            error
        );


        container.innerHTML =
            `<p>${escapeHtml(error.message)}</p>`;
    }
}


/* =========================================================
   IMAGE PRINCIPALE
========================================================= */

async function setFormulaPrimaryImage(
    formulaId,
    imageId
) {

    try {

        await fetchJson(

            `/admin/formules/${formulaId}/images/${imageId}/primary`,

            {
                method: "POST",

                headers: {
                    "Accept":
                        "application/json"
                }
            }
        );


        await loadFormulaImages(
            formulaId
        );

    } catch (error) {

        console.error(error);

        alert(
            error.message
        );
    }
}


/* =========================================================
   SUPPRIMER IMAGE
========================================================= */

async function deleteFormulaImage(
    formulaId,
    imageId
) {

    const confirmation =
        confirm(
            "Voulez-vous vraiment supprimer cette image ?"
        );


    if (!confirmation) {
        return;
    }


    try {

        await fetchJson(

            `/admin/formules/${formulaId}/images/${imageId}/delete`,

            {
                method: "POST",

                headers: {
                    "Accept":
                        "application/json"
                }
            }
        );


        await loadFormulaImages(
            formulaId
        );

    } catch (error) {

        console.error(error);

        alert(
            error.message
        );
    }
}


/* =========================================================
   SUPPRIMER FORMULE
========================================================= */

function deleteFormula(
    formulaId,
    formulaName
) {

    const confirmation =
        confirm(
            `Voulez-vous vraiment supprimer la formule "${formulaName}" ?`
        );


    if (!confirmation) {
        return;
    }


    const form =
        getElement(
            "deleteFormulaForm"
        );


    if (!form) {

        alert(
            "Formulaire de suppression introuvable."
        );

        return;
    }


    form.action =
        `/admin/formules/${formulaId}/delete`;


    form.submit();
}


/* =========================================================
   MODAL PRODUITS
========================================================= */

async function openFormulaProductsModal(
    formulaId,
    formulaName
) {

    currentFormulaId =
        formulaId;


    const title =
        getElement(
            "formulaProductsTitle"
        );


    if (title) {

        title.textContent =
            `🍽 ${formulaName}`;
    }


    const form =
        getElement(
            "addFormulaProductForm"
        );


    if (form) {

        form.action =
            `/admin/formules/${formulaId}/products`;
    }


    openModal(
        "formulaProductsModal"
    );


    await loadFormulaProducts(
        formulaId
    );
}


function closeFormulaProductsModal() {

    closeModal(
        "formulaProductsModal"
    );
}


/* =========================================================
   CHARGER PRODUITS
========================================================= */

async function loadFormulaProducts(
    formulaId
) {

    const container =
        getElement(
            "formulaProductsList"
        );


    if (!container) {
        return;
    }


    container.innerHTML =
        "<p>Chargement des produits...</p>";


    try {

        const products =
            await fetchJson(
                `/admin/formules/${formulaId}/products`
            );


        container.innerHTML = "";


        if (
            !Array.isArray(products) ||
            products.length === 0
        ) {

            container.innerHTML = `

                <div class="formulas-empty">

                    <div class="formulas-empty-icon">
                        🍽
                    </div>

                    <strong>
                        Aucun produit
                    </strong>

                    <span>
                        Ajoutez un produit à cette formule.
                    </span>

                </div>
            `;

            return;
        }


        products.forEach(product => {

            const relationId =
                Number(
                    product.formula_product_id
                    || product.id
                );


            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "formula-product-admin-row";


            row.innerHTML = `

                <strong>
                    ${escapeHtml(
                        product.name
                    )}
                </strong>


                <input
                    type="number"
                    min="1"
                    value="${Number(
                        product.quantity || 1
                    )}"
                    id="quantity-${relationId}"
                    title="Quantité"
                >


                <input
                    type="number"
                    value="${Number(
                        product.position || 0
                    )}"
                    id="position-${relationId}"
                    title="Position"
                >


                <div>

                    <button
                        type="button"
                        class="btn-formula-edit"
                        onclick="updateFormulaProduct(
                            ${Number(formulaId)},
                            ${relationId}
                        )"
                        title="Enregistrer"
                    >
                        💾
                    </button>


                    <button
                        type="button"
                        class="btn-formula-delete"
                        onclick="removeFormulaProduct(
                            ${Number(formulaId)},
                            ${relationId}
                        )"
                        title="Retirer"
                    >
                        🗑
                    </button>

                </div>
            `;


            container.appendChild(
                row
            );
        });

    } catch (error) {

        console.error(
            "Erreur produits formule :",
            error
        );


        container.innerHTML =
            `<p>${escapeHtml(error.message)}</p>`;
    }
}


/* =========================================================
   MODIFIER PRODUIT FORMULE
========================================================= */

async function updateFormulaProduct(
    formulaId,
    relationId
) {

    const quantityElement =
        getElement(
            `quantity-${relationId}`
        );


    const positionElement =
        getElement(
            `position-${relationId}`
        );


    if (
        !quantityElement ||
        !positionElement
    ) {

        alert(
            "Impossible de récupérer les informations du produit."
        );

        return;
    }


    const quantity =
        quantityElement.value;


    const position =
        positionElement.value;


    const body =
        new URLSearchParams();


    body.set(
        "quantity",
        quantity
    );


    body.set(
        "position",
        position
    );


    try {

        await fetchJson(

            `/admin/formules/${formulaId}/products/${relationId}/update`,

            {
                method: "POST",

                headers: {

                    "Content-Type":
                        "application/x-www-form-urlencoded",

                    "Accept":
                        "application/json"
                },

                body:
                    body.toString()
            }
        );


        await loadFormulaProducts(
            formulaId
        );

    } catch (error) {

        console.error(error);

        alert(
            error.message
        );
    }
}


/* =========================================================
   RETIRER PRODUIT
========================================================= */

async function removeFormulaProduct(
    formulaId,
    relationId
) {

    const confirmation =
        confirm(
            "Retirer ce produit de la formule ?"
        );


    if (!confirmation) {
        return;
    }


    try {

        await fetchJson(

            `/admin/formules/${formulaId}/products/${relationId}/delete`,

            {
                method: "POST",

                headers: {
                    "Accept":
                        "application/json"
                }
            }
        );


        await loadFormulaProducts(
            formulaId
        );

    } catch (error) {

        console.error(error);

        alert(
            error.message
        );
    }
}


/* =========================================================
   AJOUT PRODUIT VIA AJAX
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const addProductForm =
            getElement(
                "addFormulaProductForm"
            );


        if (addProductForm) {

            addProductForm.addEventListener(
                "submit",
                async event => {

                    event.preventDefault();


                    if (!currentFormulaId) {

                        alert(
                            "Aucune formule sélectionnée."
                        );

                        return;
                    }


                    const formData =
                        new FormData(
                            addProductForm
                        );


                    const body =
                        new URLSearchParams();


                    for (
                        const [key, value]
                        of formData.entries()
                    ) {

                        body.append(
                            key,
                            value
                        );
                    }


                    try {

                        await fetchJson(

                            addProductForm.action,

                            {
                                method:
                                    "POST",

                                headers: {

                                    "Content-Type":
                                        "application/x-www-form-urlencoded",

                                    "Accept":
                                        "application/json"
                                },

                                body:
                                    body.toString()
                            }
                        );


                        addProductForm.reset();


                        const quantity =
                            addProductForm.querySelector(
                                '[name="quantity"]'
                            );


                        const position =
                            addProductForm.querySelector(
                                '[name="position"]'
                            );


                        if (quantity) {
                            quantity.value = 1;
                        }


                        if (position) {
                            position.value = 0;
                        }


                        await loadFormulaProducts(
                            currentFormulaId
                        );

                    } catch (error) {

                        console.error(error);

                        alert(
                            error.message
                        );
                    }
                }
            );
        }


        /* =================================================
           FERMETURE MODAL SUR OVERLAY
        ================================================= */

        document
            .querySelectorAll(
                ".formula-modal-overlay"
            )
            .forEach(modal => {

                modal.addEventListener(
                    "click",
                    event => {

                        if (
                            event.target === modal
                        ) {

                            modal.classList.remove(
                                "show"
                            );


                            document.body.classList.remove(
                                "modal-open"
                            );
                        }
                    }
                );
            });


        /* =================================================
           ESC
        ================================================= */

        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key !== "Escape"
                ) {
                    return;
                }


                document
                    .querySelectorAll(
                        ".formula-modal-overlay.show"
                    )
                    .forEach(modal => {

                        modal.classList.remove(
                            "show"
                        );
                    });


                document.body.classList.remove(
                    "modal-open"
                );
            }
        );
    }
);


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {

    return String(
        value ?? ""
    )

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );
}