/* ============================================================
   TIOPTIOP
   ADMINISTRATION CLIENTS
============================================================ */


/* ============================================================
   OUTILS
============================================================ */

async function requestJSON(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            {
                credentials: "same-origin",

                ...options,

                headers: {
                    "Accept":
                        "application/json",

                    ...(
                        options.headers
                        || {}
                    )
                }
            }
        );


    const contentType =
        response.headers.get(
            "content-type"
        ) || "";


    if (
        !contentType.includes(
            "application/json"
        )
    ) {

        throw new Error(
            "Le serveur n'a pas retourné une réponse JSON."
        );
    }


    const data =
        await response.json();


    if (!response.ok) {

        throw new Error(
            data.message
            ||
            "Une erreur est survenue."
        );
    }


    return data;
}


/* ============================================================
   MODAL
============================================================ */

function getClientModal() {

    return document.getElementById(
        "clientAdminModal"
    );
}


function openClientModal() {

    const modal =
        getClientModal();


    if (!modal) {
        return;
    }


    modal.classList.add(
        "show"
    );


    document.body.classList.add(
        "modal-open"
    );
}


function closeClientModal() {

    const modal =
        getClientModal();


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "show"
    );


    document.body.classList.remove(
        "modal-open"
    );
}


/* ============================================================
   CHARGER CLIENT
============================================================ */

async function loadClient(id) {

    const data =
        await requestJSON(
            `/admin/clients/${id}`
        );


    return data.client;
}


/* ============================================================
   FORMAT DATE
============================================================ */

function formatClientDate(value) {

    if (!value) {
        return "—";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "—";
    }


    return date.toLocaleDateString(
        "fr-FR"
    );
}


function formatClientDateTime(value) {

    if (!value) {
        return "Jamais";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "—";
    }


    return date.toLocaleString(
        "fr-FR"
    );
}


/* ============================================================
   CONSULTER CLIENT
============================================================ */

async function viewClient(id) {

    try {

        const client =
            await loadClient(id);


        const modal =
            getClientModal();


        if (!modal) {

            alert(
                "Le modal client est absent de la page."
            );

            return;
        }


        const fullName =
            client.display_name
            ||
            [
                client.first_name,
                client.last_name
            ]
                .filter(Boolean)
                .join(" ")
            ||
            client.email
            ||
            "Client";


        document.getElementById(
            "clientModalTitle"
        ).textContent =
            "👁 Fiche client";


        document.getElementById(
            "clientModalBody"
        ).innerHTML = `

            <div class="client-detail-header">

                <div class="client-detail-avatar">

                    ${
                        client.avatar_url

                        ? `
                            <img
                                src="${escapeHtml(client.avatar_url)}"
                                alt="${escapeHtml(fullName)}"
                            >
                        `

                        : `
                            <span>
                                ${escapeHtml(
                                    fullName
                                        .charAt(0)
                                        .toUpperCase()
                                )}
                            </span>
                        `
                    }

                </div>


                <div>

                    <h3>
                        ${escapeHtml(fullName)}
                    </h3>

                    <p>
                        Client #${client.id}
                    </p>

                </div>

            </div>


            <div class="client-detail-grid">

                ${detailItem(
                    "Email",
                    client.email || "—"
                )}

                ${detailItem(
                    "Téléphone",
                    client.phone || "—"
                )}

                ${detailItem(
                    "Prénom",
                    client.first_name || "—"
                )}

                ${detailItem(
                    "Nom",
                    client.last_name || "—"
                )}

                ${detailItem(
                    "Nom affiché",
                    client.display_name || "—"
                )}

                ${detailItem(
                    "Date de naissance",
                    formatClientDate(
                        client.birth_date
                    )
                )}

                ${detailItem(
                    "Langue",
                    client.preferred_language || "fr"
                )}

                ${detailItem(
                    "Statut",
                    client.status || "—"
                )}

                ${detailItem(
                    "Inscription",
                    formatClientDateTime(
                        client.created_at
                    )
                )}

                ${detailItem(
                    "Dernière connexion",
                    formatClientDateTime(
                        client.last_login_at
                    )
                )}

                ${detailItem(
                    "Email vérifié",
                    client.email_verified_at
                        ? "Oui"
                        : "Non"
                )}

                ${detailItem(
                    "Téléphone vérifié",
                    client.phone_verified_at
                        ? "Oui"
                        : "Non"
                )}

                ${detailItem(
                    "Marketing",
                    Number(
                        client.marketing_consent
                    ) === 1
                        ? "Autorisé"
                        : "Non autorisé"
                )}

                ${detailItem(
                    "Notifications push",
                    Number(
                        client.push_consent
                    ) === 1
                        ? "Activées"
                        : "Désactivées"
                )}

                ${detailItem(
                    "Emails",
                    Number(
                        client.email_consent
                    ) === 1
                        ? "Activés"
                        : "Désactivés"
                )}

                ${detailItem(
                    "Thème",
                    client.motif_theme
                    || "KONGO_AUTHENTIQUE"
                )}

            </div>


            <div class="client-modal-footer">

                <button
                    type="button"
                    class="client-secondary-button"
                    onclick="closeClientModal()"
                >
                    Fermer
                </button>


                <button
                    type="button"
                    class="client-primary-button"
                    onclick="editClient(${client.id})"
                >
                    ✏️ Modifier
                </button>

            </div>
        `;


        openClientModal();

    }
    catch (error) {

        console.error(
            error
        );


        alert(
            error.message
        );
    }
}


/* ============================================================
   DETAIL ITEM
============================================================ */

function detailItem(
    label,
    value
) {

    return `

        <div class="client-detail-item">

            <span>
                ${escapeHtml(label)}
            </span>

            <strong>
                ${escapeHtml(
                    String(value ?? "—")
                )}
            </strong>

        </div>
    `;
}


/* ============================================================
   MODIFIER CLIENT
============================================================ */

async function editClient(id) {

    try {

        const client =
            await loadClient(id);


        document.getElementById(
            "clientModalTitle"
        ).textContent =
            "✏️ Modifier le client";


        let birthDate = "";


        if (client.birth_date) {

            const date =
                new Date(
                    client.birth_date
                );


            if (
                !Number.isNaN(
                    date.getTime()
                )
            ) {

                birthDate =
                    date
                        .toISOString()
                        .slice(0, 10);
            }
        }


        document.getElementById(
            "clientModalBody"
        ).innerHTML = `

            <form
                id="clientEditForm"
                onsubmit="saveClient(event, ${client.id})"
            >

                <div class="client-form-grid">


                    <div class="client-form-group">

                        <label>
                            Prénom
                        </label>

                        <input
                            type="text"
                            name="first_name"
                            value="${escapeAttribute(
                                client.first_name || ""
                            )}"
                        >

                    </div>


                    <div class="client-form-group">

                        <label>
                            Nom
                        </label>

                        <input
                            type="text"
                            name="last_name"
                            value="${escapeAttribute(
                                client.last_name || ""
                            )}"
                        >

                    </div>


                    <div class="client-form-group client-form-full">

                        <label>
                            Nom affiché
                        </label>

                        <input
                            type="text"
                            name="display_name"
                            value="${escapeAttribute(
                                client.display_name || ""
                            )}"
                        >

                    </div>


                    <div class="client-form-group">

                        <label>
                            Email *
                        </label>

                        <input
                            type="email"
                            name="email"
                            required
                            value="${escapeAttribute(
                                client.email || ""
                            )}"
                        >

                    </div>


                    <div class="client-form-group">

                        <label>
                            Téléphone
                        </label>

                        <input
                            type="text"
                            name="phone"
                            value="${escapeAttribute(
                                client.phone || ""
                            )}"
                        >

                    </div>


                    <div class="client-form-group">

                        <label>
                            Date de naissance
                        </label>

                        <input
                            type="date"
                            name="birth_date"
                            value="${birthDate}"
                        >

                    </div>


                    <div class="client-form-group">

                        <label>
                            Langue
                        </label>

                        <select
                            name="preferred_language"
                        >

                            <option
                                value="fr"
                                ${
                                    client.preferred_language
                                    === "fr"
                                    ? "selected"
                                    : ""
                                }
                            >
                                Français
                            </option>

                            <option
                                value="en"
                                ${
                                    client.preferred_language
                                    === "en"
                                    ? "selected"
                                    : ""
                                }
                            >
                                Anglais
                            </option>

                        </select>

                    </div>

                </div>


                <div class="client-consents">

                    <label>

                        <input
                            type="checkbox"
                            name="marketing_consent"
                            value="1"

                            ${
                                Number(
                                    client.marketing_consent
                                ) === 1
                                ? "checked"
                                : ""
                            }
                        >

                        Marketing

                    </label>


                    <label>

                        <input
                            type="checkbox"
                            name="push_consent"
                            value="1"

                            ${
                                Number(
                                    client.push_consent
                                ) === 1
                                ? "checked"
                                : ""
                            }
                        >

                        Notifications push

                    </label>


                    <label>

                        <input
                            type="checkbox"
                            name="email_consent"
                            value="1"

                            ${
                                Number(
                                    client.email_consent
                                ) === 1
                                ? "checked"
                                : ""
                            }
                        >

                        Emails

                    </label>

                </div>


                <div
                    id="clientEditError"
                    class="client-form-error"
                    style="display:none;"
                ></div>


                <div class="client-modal-footer">

                    <button
                        type="button"
                        class="client-secondary-button"
                        onclick="closeClientModal()"
                    >
                        Annuler
                    </button>


                    <button
                        type="submit"
                        class="client-primary-button"
                    >
                        💾 Enregistrer
                    </button>

                </div>

            </form>
        `;


        openClientModal();

    }
    catch (error) {

        console.error(
            error
        );


        alert(
            error.message
        );
    }
}


/* ============================================================
   ENREGISTRER MODIFICATION
============================================================ */

async function saveClient(
    event,
    id
) {

    event.preventDefault();


    const form =
        event.currentTarget;


    const button =
        form.querySelector(
            'button[type="submit"]'
        );


    const errorBox =
        document.getElementById(
            "clientEditError"
        );


    try {

        button.disabled = true;

        button.textContent =
            "Enregistrement...";


        if (errorBox) {

            errorBox.style.display =
                "none";

            errorBox.textContent =
                "";
        }


        const formData =
            new FormData(form);


        const data =
            await requestJSON(
                `/admin/clients/${id}/update`,
                {
                    method:
                        "POST",

                    body:
                        new URLSearchParams(
                            formData
                        )
                }
            );


        alert(
            data.message
            ||
            "Client modifié."
        );


        window.location.reload();

    }
    catch (error) {

        console.error(
            error
        );


        if (errorBox) {

            errorBox.textContent =
                error.message;

            errorBox.style.display =
                "block";
        }
        else {

            alert(
                error.message
            );
        }

    }
    finally {

        button.disabled =
            false;

        button.textContent =
            "💾 Enregistrer";
    }
}


/* ============================================================
   BLOQUER
============================================================ */

async function blockClient(id) {

    const confirmation =
        confirm(
            "Voulez-vous vraiment bloquer ce client ? Il ne pourra plus accéder à son compte."
        );


    if (!confirmation) {
        return;
    }


    try {

        const data =
            await requestJSON(
                `/admin/clients/${id}/block`,
                {
                    method:
                        "POST"
                }
            );


        alert(
            data.message
        );


        window.location.reload();

    }
    catch (error) {

        console.error(
            error
        );


        alert(
            error.message
        );
    }
}


/* ============================================================
   DEBLOQUER
============================================================ */

async function unblockClient(id) {

    const confirmation =
        confirm(
            "Voulez-vous réactiver ce compte client ?"
        );


    if (!confirmation) {
        return;
    }


    try {

        const data =
            await requestJSON(
                `/admin/clients/${id}/unblock`,
                {
                    method:
                        "POST"
                }
            );


        alert(
            data.message
        );


        window.location.reload();

    }
    catch (error) {

        console.error(
            error
        );


        alert(
            error.message
        );
    }
}


/* ============================================================
   SUPPRIMER
============================================================ */

async function deleteClient(id) {

    const confirmation =
        confirm(
            "Voulez-vous vraiment supprimer ce compte client ? Cette action retirera le compte de l'administration."
        );


    if (!confirmation) {
        return;
    }


    try {

        const data =
            await requestJSON(
                `/admin/clients/${id}/delete`,
                {
                    method:
                        "POST"
                }
            );


        alert(
            data.message
        );


        window.location.reload();

    }
    catch (error) {

        console.error(
            error
        );


        alert(
            error.message
        );
    }
}


/* ============================================================
   SECURITE HTML
============================================================ */

function escapeHtml(value) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        value ?? "";


    return div.innerHTML;
}


function escapeAttribute(value) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        );
}


/* ============================================================
   FERMETURE MODAL
============================================================ */

document.addEventListener(
    "click",
    event => {

        if (
            event.target.id ===
            "clientAdminModal"
        ) {

            closeClientModal();
        }
    }
);


document.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Escape"
        ) {

            closeClientModal();
        }
    }
);