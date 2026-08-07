function openCareerAddModal() {

    document
        .getElementById("careerAddModal")
        .classList.add("show");

    document.body.style.overflow = "hidden";
}


function closeCareerAddModal() {

    document
        .getElementById("careerAddModal")
        .classList.remove("show");

    document.body.style.overflow = "";
}



function openCareerEditModal(job) {

    document.getElementById("careerEditId").value =
        job.id || "";

    document.getElementById("careerEditTitle").value =
        job.title || "";

    document.getElementById("careerEditLocation").value =
        job.location || "";

    document.getElementById("careerEditType").value =
        job.type || "";

    document.getElementById("careerEditDepartment").value =
        job.department || "";

    document.getElementById("careerEditSalary").value =
        job.salary || "";

    document.getElementById("careerEditDescription").value =
        job.description || "";

    document.getElementById("careerEditRequirements").value =
        job.requirements || "";


    /* Route modification */

    document.getElementById("careerEditForm").action =
        `/admin/carrieres/${job.id}`;


    /* IMAGE EXISTANTE */

    const preview =
        document.getElementById("careerEditPreview");

    preview.innerHTML = "";


    if (job.image) {

        const img = document.createElement("img");

        img.src = job.image;
        img.alt = job.title || "Offre";

        preview.appendChild(img);

        preview.classList.add("has-image");

    } else {

        preview.classList.remove("has-image");

    }


    document
        .getElementById("careerEditModal")
        .classList.add("show");

    document.body.style.overflow = "hidden";
}


function closeCareerEditModal() {

    document
        .getElementById("careerEditModal")
        .classList.remove("show");

    document.body.style.overflow = "";
}



/* ========================================================
   PREVIEW IMAGE
======================================================== */

function previewCareerImage(input, previewId) {

    const preview =
        document.getElementById(previewId);


    if (!input.files || !input.files[0]) {
        return;
    }


    const file = input.files[0];


    if (!file.type.startsWith("image/")) {

        alert("Veuillez sélectionner une image.");

        input.value = "";

        return;
    }


    const reader = new FileReader();


    reader.onload = function(e) {

        preview.innerHTML = "";

        const img = document.createElement("img");

        img.src = e.target.result;

        preview.appendChild(img);

        preview.classList.add("has-image");
    };


    reader.readAsDataURL(file);
}



/* clic en dehors */

document.addEventListener("click", function(e) {

    if (e.target.id === "careerAddModal") {
        closeCareerAddModal();
    }

    if (e.target.id === "careerEditModal") {
        closeCareerEditModal();
    }

});


/* touche ESC */

document.addEventListener("keydown", function(e) {

    if (e.key === "Escape") {

        closeCareerAddModal();
        closeCareerEditModal();

    }

});