let currentProductImages = [];

/* ======================================================
   AJOUT
====================================================== */

function openAddProductModal() {

    document
        .getElementById("addProductModal")
        .classList.add("show");

    document.body.classList.add("modal-open");
}


function closeAddProductModal() {

    document
        .getElementById("addProductModal")
        .classList.remove("show");

    document.body.classList.remove("modal-open");
}


/* ======================================================
   MODIFIER
====================================================== */

function openEditProductModalFromButton(button) {

    const product = {

        id: button.dataset.id,

        name: button.dataset.name,
        sku: button.dataset.sku,
        icon: button.dataset.icon,

        category_id:
            button.dataset.categoryId,

        short_description:
            button.dataset.shortDescription,

        description:
            button.dataset.description,

        price:
            button.dataset.price,

        compare_at_price:
            button.dataset.compareAtPrice,

        preparation_minutes:
            button.dataset.preparationMinutes,

        spice_level:
            button.dataset.spiceLevel,

        allergens:
            button.dataset.allergens,

        ingredients:
            button.dataset.ingredients,

        calories:
            button.dataset.calories,

        is_halal:
            button.dataset.halal === "1",

        is_vegetarian:
            button.dataset.vegetarian === "1",

        is_breakfast:
            button.dataset.breakfast === "1",

        breakfast_start:
            button.dataset.breakfastStart,

        breakfast_end:
            button.dataset.breakfastEnd,

        is_featured:
            button.dataset.featured === "1",

        position:
            button.dataset.position
    };


    openEditProductModal(product);

    loadProductImages(product.id);
}


function openEditProductModal(product) {

    document.getElementById("editProductId").value =
        product.id;

    document.getElementById("editProductName").value =
        product.name || "";

    document.getElementById("editProductSku").value =
        product.sku || "";

    document.getElementById("editProductIcon").value =
        product.icon || "";

    document.getElementById("editProductCategory").value =
        product.category_id;

    document.getElementById("editProductShortDescription").value =
        product.short_description || "";

    document.getElementById("editProductDescription").value =
        product.description || "";

    document.getElementById("editProductPrice").value =
        product.price || "";

    document.getElementById("editProductCompareAtPrice").value =
        product.compare_at_price || "";

    document.getElementById("editProductPreparationMinutes").value =
        product.preparation_minutes || 15;

    document.getElementById("editProductSpiceLevel").value =
        product.spice_level || 0;

    document.getElementById("editProductAllergens").value =
        product.allergens || "";

    document.getElementById("editProductIngredients").value =
        product.ingredients || "";

    document.getElementById("editProductCalories").value =
        product.calories || "";

    document.getElementById("editProductPosition").value =
        product.position || 0;


    /* CHECKBOX */

    document.getElementById("editProductHalal").checked =
        product.is_halal;

    document.getElementById("editProductVegetarian").checked =
        product.is_vegetarian;

    document.getElementById("editProductFeatured").checked =
        product.is_featured;

    document.getElementById("editProductBreakfast").checked =
        product.is_breakfast;


    /* PETIT DEJEUNER */

    document.getElementById("editProductBreakfastStart").value =
        product.breakfast_start || "";

    document.getElementById("editProductBreakfastEnd").value =
        product.breakfast_end || "";


    const breakfastFields =
        document.getElementById("editBreakfastFields");

    breakfastFields.style.display =
        product.is_breakfast
            ? "grid"
            : "none";


    /* ACTION */

    document.getElementById("editProductForm").action =
        `/admin/produits/${product.id}/update`;


    document
        .getElementById("editProductModal")
        .classList.add("show");


    document.body.classList.add("modal-open");
}

// Automatically load images when clicking Edit
async function loadProductImages(productId) {

    const container =
        document.getElementById("editExistingImages");

    container.innerHTML =
        "<p>Chargement des images...</p>";


    try {

        const response =
            await fetch(
                `/admin/produits/${productId}/images`
            );


        const data =
            await response.json();


        if (!data.success) {

            throw new Error(
                data.message ||
                "Impossible de charger les images."
            );

        }


        currentProductImages =
            data.images || [];


        renderExistingProductImages(productId);

    }
    catch (error) {

        console.error(error);

        container.innerHTML =
            "<p>Impossible de charger les images.</p>";

    }
}

// Show the 6 existing images
function renderExistingProductImages(productId) {

    const container =
        document.getElementById("editExistingImages");

    const counter =
        document.getElementById("editImagesCounter");


    container.innerHTML = "";


    if (currentProductImages.length === 0) {

        container.innerHTML =
            "<p>Aucune image pour ce produit.</p>";

        counter.textContent = "0 / 6 images";

        return;
    }


    currentProductImages.forEach(image => {

        const item =
            document.createElement("div");

        item.className =
            "existing-product-image";


        item.innerHTML = `

            <div class="existing-product-image-photo">

                <img
                    src="${image.image_url}"
                    alt="${image.alt_text || "Produit"}"
                >

                ${
                    Number(image.is_primary) === 1

                    ? `
                        <span class="primary-image-badge">
                            ★ Principale
                        </span>
                    `

                    : ""
                }

            </div>


            <div class="existing-product-image-actions">

                ${
                    Number(image.is_primary) !== 1

                    ? `
                        <button
                            type="button"
                            class="btn-image-primary"
                            onclick="setPrimaryProductImage(
                                ${productId},
                                ${image.id}
                            )"
                        >
                            ☆ Principale
                        </button>
                    `

                    : `
                        <span class="current-primary-text">
                            Image principale
                        </span>
                    `
                }


                <button
                    type="button"
                    class="btn-image-delete"
                    onclick="deleteProductImage(
                        ${productId},
                        ${image.id}
                    )"
                >
                    🗑 Supprimer
                </button>

            </div>
        `;


        container.appendChild(item);

    });


    counter.textContent =
        `${currentProductImages.length} / 6 images`;
}

// Delete without reloading the entire page
async function deleteProductImage(
    productId,
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

        const response =
            await fetch(
                `/admin/produits/${productId}/images/${imageId}`,
                {
                    method: "DELETE"
                }
            );


        const data =
            await response.json();


        if (!data.success) {

            throw new Error(
                data.message ||
                "Suppression impossible."
            );

        }


        // Recharge uniquement les images
        await loadProductImages(productId);

    }
    catch (error) {

        console.error(error);

        alert(error.message);

    }
}

// Select the main image without reloading the page
async function setPrimaryProductImage(
    productId,
    imageId
) {

    try {

        const response =
            await fetch(
                `/admin/produits/${productId}/images/${imageId}/primary`,
                {
                    method: "PATCH"
                }
            );


        const data =
            await response.json();


        if (!data.success) {

            throw new Error(
                data.message ||
                "Modification impossible."
            );

        }


        await loadProductImages(productId);

    }
    catch (error) {

        console.error(error);

        alert(error.message);

    }
}

// Properly manage the limit of 6
function previewEditProductImages(input) {

    const preview =
        document.getElementById(
            "editNewImagesPreview"
        );


    preview.innerHTML = "";


    const files =
        Array.from(input.files);


    const existingCount =
        currentProductImages.length;


    const availableSlots =
        6 - existingCount;


    if (files.length > availableSlots) {

        alert(
            `Ce produit possède déjà ${existingCount} image(s).\n` +
            `Vous pouvez encore ajouter ${availableSlots} image(s).`
        );

        input.value = "";

        return;
    }


    files.forEach(file => {

        const reader =
            new FileReader();


        reader.onload = function(event) {

            const img =
                document.createElement("img");

            img.src =
                event.target.result;

            img.className =
                "product-preview-image";


            preview.appendChild(img);

        };


        reader.readAsDataURL(file);

    });
}

function closeEditProductModal() {

    document
        .getElementById("editProductModal")
        .classList.remove("show");

    document.body.classList.remove("modal-open");
}


/* ======================================================
   SUPPRIMER
====================================================== */

function deleteProduct(id, name) {

    const confirmed = confirm(
        `Voulez-vous vraiment supprimer "${name}" ?`
    );


    if (!confirmed) {
        return;
    }


    const form =
        document.getElementById(
            "deleteProductForm"
        );


    form.action =
        `/admin/produits/${id}/delete`;


    form.submit();
}


function toggleBreakfastFields(checkbox, containerId) {

    const container =
        document.getElementById(containerId);


    if (!container) {
        return;
    }


    container.style.display =
        checkbox.checked
            ? "grid"
            : "none";


    if (!checkbox.checked) {

        const times =
            container.querySelectorAll(
                'input[type="time"]'
            );

        times.forEach(input => {
            input.value = "";
        });
    }
}


/* ======================================================
   PREVIEW IMAGES
====================================================== */

function previewProductImages(
    input,
    previewId
) {

    const preview =
        document.getElementById(previewId);


    preview.innerHTML = "";


    if (!input.files) {
        return;
    }


    const files =
        Array.from(input.files).slice(0, 6);


    files.forEach(file => {

        if (!file.type.startsWith("image/")) {
            return;
        }


        const reader =
            new FileReader();


        reader.onload = function (event) {

            const item =
                document.createElement("div");


            item.className =
                "product-preview-item";


            const image =
                document.createElement("img");


            image.src =
                event.target.result;


            item.appendChild(image);

            preview.appendChild(item);
        };


        reader.readAsDataURL(file);

    });

}


/* ======================================================
   CLIC EXTERIEUR
====================================================== */

document.addEventListener(
    "click",
    function (event) {

        if (
            event.target.id ===
            "addProductModal"
        ) {
            closeAddProductModal();
        }


        if (
            event.target.id ===
            "editProductModal"
        ) {
            closeEditProductModal();
        }

    }
);


/* ======================================================
   ESCAPE
====================================================== */

document.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Escape") {

            closeAddProductModal();

            closeEditProductModal();
        }

    }
);

/* =========================================================
   OPTIONS / SUPPLEMENTS PRODUITS
========================================================= */

let currentOptionsProductId = null;
let currentOptionsProductName = "";

let currentProductOptionGroups = [];


/* =========================================================
   OUTIL FETCH POST
========================================================= */

async function optionPost(url, data = {}) {

    const response = await fetch(url, {
        method: "POST",

        headers: {
            "Content-Type":
                "application/x-www-form-urlencoded;charset=UTF-8"
        },

        body: new URLSearchParams(data)
    });


    const contentType =
        response.headers.get("content-type") || "";


    if (!contentType.includes("application/json")) {

        const text = await response.text();

        console.error(
            "Réponse serveur non JSON :",
            text
        );

        throw new Error(
            "Le serveur n'a pas retourné du JSON."
        );
    }


    const result = await response.json();


    if (!response.ok || result.success === false) {

        throw new Error(
            result.message ||
            "Une erreur est survenue."
        );
    }


    return result;
}


/* =========================================================
   OUVERTURE MODALE PRINCIPALE
========================================================= */

async function openProductOptions(
    productId,
    productName
) {

    currentOptionsProductId =
        Number(productId);

    currentOptionsProductName =
        productName || "Produit";


    const modal =
        document.getElementById(
            "productOptionsModal"
        );


    document.getElementById(
        "productOptionsTitle"
    ).textContent =
        "⚙️ Options & suppléments";


    document.getElementById(
        "productOptionsSubtitle"
    ).textContent =
        currentOptionsProductName;


    modal.classList.add("open");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.style.overflow =
        "hidden";


    closeGroupForm();


    await loadProductOptions();
}


/* =========================================================
   FERMETURE
========================================================= */

function closeProductOptions() {

    const modal =
        document.getElementById(
            "productOptionsModal"
        );


    modal.classList.remove("open");

    modal.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.style.overflow =
        "";


    currentOptionsProductId = null;

    currentProductOptionGroups = [];
}


/* =========================================================
   CHARGEMENT
========================================================= */

async function loadProductOptions() {

    const loading =
        document.getElementById(
            "productOptionsLoading"
        );

    const empty =
        document.getElementById(
            "productOptionsEmpty"
        );

    const container =
        document.getElementById(
            "productOptionsGroups"
        );


    loading.style.display =
        "block";

    empty.style.display =
        "none";

    container.innerHTML =
        "";


    try {

        const response =
            await fetch(
                "/admin/produits/"
                + currentOptionsProductId
                + "/options"
            );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.message ||
                "Erreur de chargement."
            );
        }


        currentProductOptionGroups =
            result.groups || [];


        loading.style.display =
            "none";


        if (
            currentProductOptionGroups.length === 0
        ) {

            empty.style.display =
                "block";

            return;
        }


        renderProductOptions();

    }
    catch (error) {

        loading.style.display =
            "none";


        container.innerHTML = `
            <div
                style="
                    padding:25px;
                    text-align:center;
                    color:#b33d34;
                "
            >
                ${escapeOptionHtml(
                    error.message
                )}
            </div>
        `;

    }
}


/* =========================================================
   RENDER
========================================================= */

function renderProductOptions() {

    const container =
        document.getElementById(
            "productOptionsGroups"
        );


    container.innerHTML =
        currentProductOptionGroups
            .map(group =>
                renderOptionGroup(group)
            )
            .join("");
}


/* =========================================================
   RENDER GROUPE
========================================================= */

function renderOptionGroup(group) {

    const typeLabel =
        group.selection_type === "multiple"
            ? "Choix multiples"
            : "Choix unique";


    const requiredLabel =
        Number(group.is_required) === 1
            ? "Obligatoire"
            : "Facultatif";


    const activeClass =
        Number(group.is_active) === 1
            ? "active"
            : "inactive";


    const activeLabel =
        Number(group.is_active) === 1
            ? "Actif"
            : "Inactif";


    const options =
        Array.isArray(group.options)
            ? group.options
            : [];


    return `
        <section class="product-option-group">

            <div class="product-option-group-header">

                <div>

                    <h3>
                        ${escapeOptionHtml(group.name)}
                    </h3>

                    <div class="product-option-group-meta">

                        <span>
                            ${typeLabel}
                        </span>

                        <span>
                            ${requiredLabel}
                        </span>

                        <span>
                            Position ${group.position}
                        </span>

                        <span class="${activeClass}">
                            ${activeLabel}
                        </span>

                    </div>

                </div>


                <div class="product-option-group-actions">

                    <button
                        type="button"
                        class="product-option-mini-btn"
                        onclick="editOptionGroup(
                            ${group.id}
                        )"
                    >
                        ✏️ Modifier
                    </button>

                    <button
                        type="button"
                        class="product-option-mini-btn danger"
                        onclick="deleteOptionGroup(
                            ${group.id}
                        )"
                    >
                        🗑 Supprimer
                    </button>

                </div>

            </div>


            <div class="product-option-list">

                ${
                    options.length
                        ? options
                            .map(option =>
                                renderProductOption(
                                    option
                                )
                            )
                            .join("")
                        : `
                            <div
                                style="
                                    padding:18px 0;
                                    color:#746d66;
                                    font-size:13px;
                                "
                            >
                                Aucune option dans ce groupe.
                            </div>
                        `
                }

            </div>


            <div class="product-option-add-row">

                <button
                    type="button"
                    class="product-option-mini-btn primary"
                    onclick="openOptionForm(
                        ${group.id}
                    )"
                >
                    + Ajouter une option
                </button>

            </div>

        </section>
    `;
}


/* =========================================================
   RENDER OPTION
========================================================= */

function renderProductOption(option) {

    const price =
        Number(option.price_delta || 0);


    const priceLabel =
        price === 0
            ? "Inclus"
            : "+"
                + price.toLocaleString("fr-FR")
                + " FCFA";


    const defaultLabel =
        Number(option.is_default) === 1
            ? `<span class="default">★ Défaut</span>`
            : "";


    const activeLabel =
        Number(option.is_active) === 1
            ? "Actif"
            : "Inactif";


    return `
        <div class="product-option-item">

            <div class="product-option-name">
                ${escapeOptionHtml(option.name)}
            </div>


            <div class="product-option-price">
                ${priceLabel}
            </div>


            <div class="product-option-status">

                ${defaultLabel}

                <span>
                    ${activeLabel}
                </span>

            </div>


            <div class="product-option-item-actions">

                <button
                    type="button"
                    class="product-option-mini-btn"
                    onclick="editProductOption(
                        ${option.id}
                    )"
                >
                    ✏️ Modifier
                </button>

                <button
                    type="button"
                    class="product-option-mini-btn danger"
                    onclick="deleteProductOption(
                        ${option.id}
                    )"
                >
                    🗑
                </button>

            </div>

        </div>
    `;
}


/* =========================================================
   FORMULAIRE GROUPE
========================================================= */

function openGroupForm() {

    document.getElementById(
        "optionGroupForm"
    ).style.display =
        "block";


    document.getElementById(
        "optionGroupFormTitle"
    ).textContent =
        "Nouveau groupe";


    document.getElementById(
        "optionGroupId"
    ).value = "";


    document.getElementById(
        "optionGroupName"
    ).value = "";


    document.getElementById(
        "optionGroupType"
    ).value =
        "single";


    document.getElementById(
        "optionGroupMin"
    ).value =
        "1";


    document.getElementById(
        "optionGroupMax"
    ).value =
        "1";


    document.getElementById(
        "optionGroupPosition"
    ).value =
        currentProductOptionGroups.length;


    document.getElementById(
        "optionGroupRequired"
    ).checked =
        false;


    document.getElementById(
        "optionGroupActive"
    ).checked =
        true;


    document.getElementById(
        "optionGroupName"
    ).focus();
}


function closeGroupForm() {

    const form =
        document.getElementById(
            "optionGroupForm"
        );


    if (form) {

        form.style.display =
            "none";

    }
}


/* =========================================================
   MODIFIER GROUPE
========================================================= */

function editOptionGroup(groupId) {

    const group =
        currentProductOptionGroups.find(
            item =>
                Number(item.id) ===
                Number(groupId)
        );


    if (!group) {
        return;
    }


    document.getElementById(
        "optionGroupForm"
    ).style.display =
        "block";


    document.getElementById(
        "optionGroupFormTitle"
    ).textContent =
        "Modifier le groupe";


    document.getElementById(
        "optionGroupId"
    ).value =
        group.id;


    document.getElementById(
        "optionGroupName"
    ).value =
        group.name;


    document.getElementById(
        "optionGroupType"
    ).value =
        group.selection_type;


    document.getElementById(
        "optionGroupMin"
    ).value =
        group.min_choices ?? 0;


    document.getElementById(
        "optionGroupMax"
    ).value =
        group.max_choices ?? "";


    document.getElementById(
        "optionGroupPosition"
    ).value =
        group.position ?? 0;


    document.getElementById(
        "optionGroupRequired"
    ).checked =
        Number(group.is_required) === 1;


    document.getElementById(
        "optionGroupActive"
    ).checked =
        Number(group.is_active) === 1;


    document.getElementById(
        "optionGroupForm"
    ).scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


/* =========================================================
   SUBMIT GROUPE
========================================================= */

document
    .getElementById("optionGroupForm")
    ?.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const groupId =
                document.getElementById(
                    "optionGroupId"
                ).value;


            const data = {

                name:
                    document.getElementById(
                        "optionGroupName"
                    ).value,

                selection_type:
                    document.getElementById(
                        "optionGroupType"
                    ).value,

                min_choices:
                    document.getElementById(
                        "optionGroupMin"
                    ).value,

                max_choices:
                    document.getElementById(
                        "optionGroupMax"
                    ).value,

                position:
                    document.getElementById(
                        "optionGroupPosition"
                    ).value,

                is_required:
                    document.getElementById(
                        "optionGroupRequired"
                    ).checked
                        ? 1
                        : 0,

                is_active:
                    document.getElementById(
                        "optionGroupActive"
                    ).checked
                        ? 1
                        : 0
            };


            try {

                if (groupId) {

                    await optionPost(
                        "/admin/produits/options/groupes/"
                        + groupId
                        + "/update",
                        data
                    );

                }
                else {

                    await optionPost(
                        "/admin/produits/"
                        + currentOptionsProductId
                        + "/options/groupes",
                        data
                    );

                }


                closeGroupForm();

                await loadProductOptions();

            }
            catch (error) {

                alert(error.message);

            }

        }
    );


/* =========================================================
   SUPPRIMER GROUPE
========================================================= */

async function deleteOptionGroup(groupId) {

    const group =
        currentProductOptionGroups.find(
            item =>
                Number(item.id) ===
                Number(groupId)
        );


    if (!group) {
        return;
    }


    const ok =
        confirm(
            'Supprimer le groupe "'
            + group.name
            + '" et toutes ses options ?'
        );


    if (!ok) {
        return;
    }


    try {

        await optionPost(
            "/admin/produits/options/groupes/"
            + groupId
            + "/delete"
        );


        await loadProductOptions();

    }
    catch (error) {

        alert(error.message);

    }
}


/* =========================================================
   OUVRIR FORMULAIRE OPTION
========================================================= */

function openOptionForm(groupId) {

    const modal =
        document.getElementById(
            "productOptionFormModal"
        );


    document.getElementById(
        "productOptionFormTitle"
    ).textContent =
        "Ajouter une option";


    document.getElementById(
        "productOptionId"
    ).value =
        "";


    document.getElementById(
        "productOptionGroupId"
    ).value =
        groupId;


    document.getElementById(
        "productOptionName"
    ).value =
        "";


    document.getElementById(
        "productOptionPrice"
    ).value =
        "0";


    document.getElementById(
        "productOptionPosition"
    ).value =
        "0";


    document.getElementById(
        "productOptionDefault"
    ).checked =
        false;


    document.getElementById(
        "productOptionActive"
    ).checked =
        true;


    modal.classList.add("open");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.getElementById(
        "productOptionName"
    ).focus();
}


/* =========================================================
   MODIFIER OPTION
========================================================= */

function editProductOption(optionId) {

    let selectedOption = null;


    for (
        const group
        of currentProductOptionGroups
    ) {

        const option =
            (group.options || []).find(
                item =>
                    Number(item.id) ===
                    Number(optionId)
            );


        if (option) {

            selectedOption = option;

            break;

        }

    }


    if (!selectedOption) {
        return;
    }


    const modal =
        document.getElementById(
            "productOptionFormModal"
        );


    document.getElementById(
        "productOptionFormTitle"
    ).textContent =
        "Modifier l'option";


    document.getElementById(
        "productOptionId"
    ).value =
        selectedOption.id;


    document.getElementById(
        "productOptionGroupId"
    ).value =
        selectedOption.option_group_id;


    document.getElementById(
        "productOptionName"
    ).value =
        selectedOption.name;


    document.getElementById(
        "productOptionPrice"
    ).value =
        selectedOption.price_delta || 0;


    document.getElementById(
        "productOptionPosition"
    ).value =
        selectedOption.position || 0;


    document.getElementById(
        "productOptionDefault"
    ).checked =
        Number(
            selectedOption.is_default
        ) === 1;


    document.getElementById(
        "productOptionActive"
    ).checked =
        Number(
            selectedOption.is_active
        ) === 1;


    modal.classList.add("open");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );
}


/* =========================================================
   FERMER FORM OPTION
========================================================= */

function closeOptionForm() {

    const modal =
        document.getElementById(
            "productOptionFormModal"
        );


    modal.classList.remove("open");

    modal.setAttribute(
        "aria-hidden",
        "true"
    );
}


/* =========================================================
   SUBMIT OPTION
========================================================= */

document
    .getElementById("productOptionForm")
    ?.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const optionId =
                document.getElementById(
                    "productOptionId"
                ).value;


            const groupId =
                document.getElementById(
                    "productOptionGroupId"
                ).value;


            const data = {

                name:
                    document.getElementById(
                        "productOptionName"
                    ).value,

                price_delta:
                    document.getElementById(
                        "productOptionPrice"
                    ).value,

                position:
                    document.getElementById(
                        "productOptionPosition"
                    ).value,

                is_default:
                    document.getElementById(
                        "productOptionDefault"
                    ).checked
                        ? 1
                        : 0,

                is_active:
                    document.getElementById(
                        "productOptionActive"
                    ).checked
                        ? 1
                        : 0
            };


            try {

                if (optionId) {

                    await optionPost(
                        "/admin/produits/options/"
                        + optionId
                        + "/update",
                        data
                    );

                }
                else {

                    await optionPost(
                        "/admin/produits/options/groupes/"
                        + groupId
                        + "/options",
                        data
                    );

                }


                closeOptionForm();

                await loadProductOptions();

            }
            catch (error) {

                alert(error.message);

            }

        }
    );


/* =========================================================
   SUPPRESSION OPTION
========================================================= */

async function deleteProductOption(optionId) {

    const ok =
        confirm(
            "Voulez-vous supprimer cette option ?"
        );


    if (!ok) {
        return;
    }


    try {

        await optionPost(
            "/admin/produits/options/"
            + optionId
            + "/delete"
        );


        await loadProductOptions();

    }
    catch (error) {

        alert(error.message);

    }
}


/* =========================================================
   ADAPTATION TYPE SINGLE / MULTIPLE
========================================================= */

document
    .getElementById("optionGroupType")
    ?.addEventListener(
        "change",
        function () {

            const min =
                document.getElementById(
                    "optionGroupMin"
                );

            const max =
                document.getElementById(
                    "optionGroupMax"
                );


            if (this.value === "single") {

                max.value = 1;

                if (
                    Number(min.value) > 1
                ) {
                    min.value = 1;
                }

            }

        }
    );


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeOptionHtml(value) {

    return String(
        value ?? ""
    )
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}