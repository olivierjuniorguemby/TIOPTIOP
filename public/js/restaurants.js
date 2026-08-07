/* ==========================================================
   AJOUTER
========================================================== */

function openAddRestaurantModal() {

    const modal =
        document.getElementById("addRestaurantModal");

    modal.classList.add("show");

    document.body.style.overflow = "hidden";
}


function closeAddRestaurantModal() {

    const modal =
        document.getElementById("addRestaurantModal");

    modal.classList.remove("show");

    document.body.style.overflow = "";
}


/* ==========================================================
   MODIFIER
========================================================== */

function openEditRestaurantModal(restaurant) {

    const modal =
        document.getElementById("editRestaurantModal");


    document.getElementById(
        "editRestaurantId"
    ).value = restaurant.id;


    document.getElementById(
        "editRestaurantName"
    ).value = restaurant.name;


    document.getElementById(
        "editRestaurantCity"
    ).value = restaurant.city;


    document.getElementById(
        "editRestaurantStatus"
    ).value = restaurant.status;


    document.getElementById(
        "editRestaurantHours"
    ).value = restaurant.hours;


    /* ACTION DU FORMULAIRE */

    document.getElementById(
        "editRestaurantForm"
    ).action =
        `/admin/restaurants/${restaurant.id}`;


    /* IMAGE ACTUELLE */

    const preview =
        document.getElementById(
            "editRestaurantPreview"
        );

    preview.innerHTML = "";


    if (restaurant.image) {

        const image =
            document.createElement("img");

        image.src = restaurant.image;

        image.alt = restaurant.name;

        preview.appendChild(image);

        preview.classList.add(
            "has-image"
        );

    } else {

        preview.classList.remove(
            "has-image"
        );

    }


    modal.classList.add("show");

    document.body.style.overflow =
        "hidden";
}


function closeEditRestaurantModal() {

    const modal =
        document.getElementById(
            "editRestaurantModal"
        );

    modal.classList.remove("show");

    document.body.style.overflow = "";
}


/* ==========================================================
   PREVISUALISATION IMAGE
========================================================== */

function previewRestaurantImage(
    input,
    previewId
) {

    const preview =
        document.getElementById(
            previewId
        );

    if (
        !input.files ||
        !input.files[0]
    ) {
        return;
    }


    const file =
        input.files[0];


    /* Vérification image */

    if (!file.type.startsWith("image/")) {

        alert(
            "Veuillez sélectionner une image."
        );

        input.value = "";

        return;
    }


    const reader =
        new FileReader();


    reader.onload = function(event) {

        preview.innerHTML = "";


        const image =
            document.createElement("img");

        image.src =
            event.target.result;


        preview.appendChild(image);

        preview.classList.add(
            "has-image"
        );
    };


    reader.readAsDataURL(file);
}


/* ==========================================================
   FERMETURE CLIC SUR LE FOND
========================================================== */

document.addEventListener(
    "click",
    function(event) {

        if (
            event.target.id ===
            "addRestaurantModal"
        ) {
            closeAddRestaurantModal();
        }


        if (
            event.target.id ===
            "editRestaurantModal"
        ) {
            closeEditRestaurantModal();
        }

    }
);


/* ==========================================================
   ESC
========================================================== */

document.addEventListener(
    "keydown",
    function(event) {

        if (event.key === "Escape") {

            closeAddRestaurantModal();

            closeEditRestaurantModal();
        }

    }
);