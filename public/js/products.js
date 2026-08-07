function openAddProductModal() {

    const modal = document.getElementById("addProductModal");

    if (!modal) return;

    modal.classList.add("show");

    document.body.classList.add("modal-open");
}


function closeAddProductModal() {

    const modal = document.getElementById("addProductModal");

    if (!modal) return;

    modal.classList.remove("show");

    document.body.classList.remove("modal-open");
}


function openEditProductModal(product) {

    const modal = document.getElementById("editProductModal");

    if (!modal) return;


    document.getElementById("editProductId").value =
        product.id || "";

    document.getElementById("editProductName").value =
        product.name || "";

    document.getElementById("editProductIcon").value =
        product.icon || "";

    document.getElementById("editProductCategory").value =
        product.category || "Tradition";

    document.getElementById("editProductPrice").value =
        product.price || "";

    document.getElementById("editProductDescription").value =
        product.description || "";


    // Route Express de modification
    document.getElementById("editProductForm").action =
        `/admin/produits/${product.id}`;


    // Vider les previews précédentes
    document.getElementById("editImagesPreview").innerHTML = "";


    modal.classList.add("show");

    document.body.classList.add("modal-open");
}


function closeEditProductModal() {

    const modal = document.getElementById("editProductModal");

    if (!modal) return;

    modal.classList.remove("show");

    document.body.classList.remove("modal-open");
}


/* =============================================
   PREVIEW IMAGES
============================================= */

function previewProductImages(input, containerId) {

    const container =
        document.getElementById(containerId);

    if (!container) return;


    container.innerHTML = "";


    const files =
        Array.from(input.files || []);


    if (files.length > 6) {

        alert(
            "Vous pouvez sélectionner au maximum 6 images."
        );

        input.value = "";

        return;
    }


    files.forEach(file => {

        if (!file.type.startsWith("image/")) {
            return;
        }


        const reader = new FileReader();


        reader.onload = function(event) {

            const wrapper =
                document.createElement("div");

            wrapper.className =
                "product-preview-item";


            const img =
                document.createElement("img");

            img.src = event.target.result;

            img.alt = file.name;


            wrapper.appendChild(img);

            container.appendChild(wrapper);

        };


        reader.readAsDataURL(file);

    });
}


/* =============================================
   FERMETURE EN CLIQUANT SUR LE FOND
============================================= */

document.addEventListener("click", function(event) {

    if (
        event.target.id === "addProductModal"
    ) {
        closeAddProductModal();
    }


    if (
        event.target.id === "editProductModal"
    ) {
        closeEditProductModal();
    }

});


/* =============================================
   TOUCHE ESC
============================================= */

document.addEventListener("keydown", function(event) {

    if (event.key === "Escape") {

        closeAddProductModal();

        closeEditProductModal();

    }

});