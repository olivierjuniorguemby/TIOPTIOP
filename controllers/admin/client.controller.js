const User =
    require("../../models/user.model");


/* =========================================================
   LISTE CLIENTS
========================================================= */

exports.index = async (
    req,
    res,
    next
) => {

    try {

        const clients =
            await User.findAllForAdmin();


        return res.render(
            "admin/content/clients",
            {
                title: "Clients",

                layout:
                    "layouts/admin",

                clients
            }
        );

    }
    catch (error) {

        console.error(
            "Erreur chargement clients admin :",
            error
        );

        next(error);
    }
};


/* =========================================================
   DETAIL CLIENT JSON
========================================================= */

exports.getOne = async (
    req,
    res
) => {

    try {

        const userId =
            Number(req.params.id);


        if (!Number.isInteger(userId)) {

            return res.status(400).json({
                success: false,
                message:
                    "Identifiant client invalide."
            });
        }


        const client =
            await User.findById(userId);


        if (
            !client ||
            client.account_type !== "CUSTOMER" ||
            client.status === "DELETED"
        ) {

            return res.status(404).json({
                success: false,
                message:
                    "Client introuvable."
            });
        }


        return res.json({
            success: true,
            client
        });

    }
    catch (error) {

        console.error(
            "Erreur détail client :",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Impossible de charger le client."
        });
    }
};


/* =========================================================
   MODIFIER CLIENT
========================================================= */

exports.update = async (
    req,
    res
) => {

    try {

        const userId =
            Number(req.params.id);


        if (!Number.isInteger(userId)) {

            return res.status(400).json({
                success: false,
                message:
                    "Identifiant client invalide."
            });
        }


        const client =
            await User.findById(userId);


        if (
            !client ||
            client.account_type !== "CUSTOMER" ||
            client.status === "DELETED"
        ) {

            return res.status(404).json({
                success: false,
                message:
                    "Client introuvable."
            });
        }


        /* -------------------------------------------------
           NETTOYAGE
        ------------------------------------------------- */

        const email =
            String(
                req.body.email || ""
            )
                .trim()
                .toLowerCase();


        const phone =
            String(
                req.body.phone || ""
            ).trim();


        const firstName =
            String(
                req.body.first_name || ""
            ).trim();


        const lastName =
            String(
                req.body.last_name || ""
            ).trim();


        const displayName =
            String(
                req.body.display_name || ""
            ).trim();


        /* -------------------------------------------------
           VALIDATION
        ------------------------------------------------- */

        if (!email) {

            return res.status(400).json({
                success: false,
                message:
                    "L'adresse email est obligatoire."
            });
        }


        const emailUsed =
            await User.emailExistsForAnotherUser(
                email,
                userId
            );


        if (emailUsed) {

            return res.status(409).json({
                success: false,
                message:
                    "Cette adresse email est déjà utilisée."
            });
        }


        if (phone) {

            const phoneUsed =
                await User.phoneExistsForAnotherUser(
                    phone,
                    userId
                );


            if (phoneUsed) {

                return res.status(409).json({
                    success: false,
                    message:
                        "Ce numéro de téléphone est déjà utilisé."
                });
            }
        }


        /* -------------------------------------------------
           UPDATE
        ------------------------------------------------- */

        await User.updateForAdmin(
            userId,
            {
                email,

                phone:
                    phone || null,

                first_name:
                    firstName || null,

                last_name:
                    lastName || null,

                display_name:
                    displayName || null,

                birth_date:
                    req.body.birth_date || null,

                preferred_language:
                    req.body.preferred_language
                    || "fr",

                marketing_consent:
                    req.body.marketing_consent
                    === "1"
                    ||
                    req.body.marketing_consent
                    === true,

                push_consent:
                    req.body.push_consent
                    === "1"
                    ||
                    req.body.push_consent
                    === true,

                email_consent:
                    req.body.email_consent
                    === "1"
                    ||
                    req.body.email_consent
                    === true
            }
        );


        const updatedClient =
            await User.findById(userId);


        return res.json({
            success: true,

            message:
                "Client modifié avec succès.",

            client:
                updatedClient
        });

    }
    catch (error) {

        console.error(
            "Erreur modification client :",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Impossible de modifier le client."
        });
    }
};


/* =========================================================
   BLOQUER
========================================================= */

exports.block = async (
    req,
    res
) => {

    try {

        const userId =
            Number(req.params.id);


        const client =
            await User.findById(userId);


        if (
            !client ||
            client.account_type !== "CUSTOMER" ||
            client.status === "DELETED"
        ) {

            return res.status(404).json({
                success: false,
                message:
                    "Client introuvable."
            });
        }


        await User.block(userId);


        return res.json({
            success: true,

            message:
                "Le compte client a été bloqué."
        });

    }
    catch (error) {

        console.error(
            "Erreur blocage client :",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Impossible de bloquer le client."
        });
    }
};


/* =========================================================
   DEBLOQUER
========================================================= */

exports.unblock = async (
    req,
    res
) => {

    try {

        const userId =
            Number(req.params.id);


        const client =
            await User.findById(userId);


        if (
            !client ||
            client.account_type !== "CUSTOMER" ||
            client.status === "DELETED"
        ) {

            return res.status(404).json({
                success: false,
                message:
                    "Client introuvable."
            });
        }


        await User.unblock(userId);


        return res.json({
            success: true,

            message:
                "Le compte client a été débloqué."
        });

    }
    catch (error) {

        console.error(
            "Erreur déblocage client :",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Impossible de débloquer le client."
        });
    }
};


/* =========================================================
   SUPPRESSION LOGIQUE
========================================================= */

exports.remove = async (
    req,
    res
) => {

    try {

        const userId =
            Number(req.params.id);


        const client =
            await User.findById(userId);


        if (
            !client ||
            client.account_type !== "CUSTOMER" ||
            client.status === "DELETED"
        ) {

            return res.status(404).json({
                success: false,
                message:
                    "Client introuvable."
            });
        }


        await User.softDelete(userId);


        return res.json({
            success: true,

            message:
                "Le compte client a été supprimé."
        });

    }
    catch (error) {

        console.error(
            "Erreur suppression client :",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Impossible de supprimer le client."
        });
    }
};