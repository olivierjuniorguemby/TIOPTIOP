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