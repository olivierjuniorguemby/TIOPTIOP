const bcrypt =
    require("bcryptjs");

const Account =
    require("../../models/account.model");

const User =
    require("../../models/user.model");


/* =========================================================
   DASHBOARD
========================================================= */

exports.dashboard = async (
    req,
    res,
    next
) => {

    try {

        const account =
            await Account.findAccountByUserId(
                req.session.user.id
            );


        if (!account) {

            return res.redirect(
                "/connexion"
            );
        }


        return res.render(
            "client/account/dashboard",
            {
                title:
                    "Mon compte",

                layout:
                    "layouts/client",

                account,

                /*
                 * Étapes futures :
                 * commandes = étape 12
                 * points = étape 16
                 * favoris = à connecter ultérieurement
                 */

                stats: {
                    points: 0,
                    orders: 0,
                    favorites: 0,
                    status: "Standard"
                }
            }
        );

    }
    catch (error) {

        console.error(
            "Erreur dashboard compte :",
            error
        );

        next(error);
    }
};


/* =========================================================
   PROFIL
========================================================= */

exports.profile = async (
    req,
    res,
    next
) => {

    try {

        const userId =
            req.session.user.id;


        const account =
            await Account.findAccountByUserId(
                userId
            );


        const addresses =
            await Account.getAddresses(
                userId
            );


        return res.render(
            "client/account/profile",
            {
                title:
                    "Mon profil",

                layout:
                    "layouts/client",

                account,
                addresses,

                success:
                    req.query.success || null,

                error:
                    req.query.error || null
            }
        );

    }
    catch (error) {

        console.error(
            "Erreur profil client :",
            error
        );

        next(error);
    }
};


/* =========================================================
   MODIFIER PROFIL
========================================================= */

exports.updateProfile = async (
    req,
    res,
    next
) => {

    try {

        const userId =
            req.session.user.id;


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


        if (
            !firstName ||
            !lastName ||
            !email
        ) {

            return res.redirect(
                "/profil?error=Champs obligatoires manquants"
            );
        }


        if (
            await Account.emailExistsForAnotherUser(
                email,
                userId
            )
        ) {

            return res.redirect(
                "/profil?error=Cette adresse email est déjà utilisée"
            );
        }


        if (
            phone &&
            await Account.phoneExistsForAnotherUser(
                phone,
                userId
            )
        ) {

            return res.redirect(
                "/profil?error=Ce numéro de téléphone est déjà utilisé"
            );
        }


        await Account.updateUser(
            userId,
            {
                email,
                phone
            }
        );


        await Account.updateProfile(
            userId,
            {
                first_name:
                    firstName,

                last_name:
                    lastName,

                display_name:
                    displayName
                    ||
                    `${firstName} ${lastName}`,

                birth_date:
                    req.body.birth_date
                    || null
            }
        );


        /* =================================================
           AVATAR
        ================================================= */

        if (req.file) {

            const avatarUrl =
                `/uploads/profiles/${req.file.filename}`;


            await Account.updateAvatar(
                userId,
                avatarUrl
            );
        }


        /* =================================================
           RECHARGER LES DONNEES
        ================================================= */

        const account =
            await Account.findAccountByUserId(
                userId
            );


        /* =================================================
           SYNCHRONISATION SESSION
        ================================================= */

        req.session.user.email =
            account.email;

        req.session.user.phone =
            account.phone;

        req.session.user.firstName =
            account.first_name;

        req.session.user.lastName =
            account.last_name;

        req.session.user.displayName =
            account.display_name
            ||
            `${account.first_name || ""} ${account.last_name || ""}`
                .trim();

        req.session.user.avatarUrl =
            account.avatar_url || null;


        return req.session.save(
            error => {

                if (error) {
                    return next(error);
                }


                return res.redirect(
                    "/profil?success=Profil mis à jour"
                );
            }
        );

    }
    catch (error) {

        console.error(
            "Erreur modification profil :",
            error
        );

        next(error);
    }
};


/* =========================================================
   AJOUTER ADRESSE
========================================================= */

exports.createAddress = async (
    req,
    res,
    next
) => {

    try {

        if (!req.body.address_line1) {

            return res.status(400).json({
                success: false,
                message:
                    "L'adresse est obligatoire."
            });
        }


        const addressId =
            await Account.createAddress(
                req.session.user.id,
                {
                    label:
                        req.body.label,

                    recipient_name:
                        req.body.recipient_name,

                    phone:
                        req.body.phone,

                    address_line1:
                        req.body.address_line1,

                    address_line2:
                        req.body.address_line2,

                    district:
                        req.body.district,

                    city:
                        req.body.city,

                    country_code:
                        req.body.country_code,

                    latitude:
                        req.body.latitude,

                    longitude:
                        req.body.longitude,

                    delivery_instructions:
                        req.body.delivery_instructions,

                    is_default:
                        req.body.is_default === "1"
                        ||
                        req.body.is_default === true
                }
            );


        return res.json({
            success: true,

            message:
                "Adresse ajoutée.",

            addressId
        });

    }
    catch (error) {

        console.error(
            "Erreur ajout adresse :",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Impossible d'ajouter l'adresse."
        });
    }
};


/* =========================================================
   MODIFIER ADRESSE
========================================================= */

exports.updateAddress = async (
    req,
    res
) => {

    try {

        const userId =
            req.session.user.id;

        const addressId =
            Number(req.params.id);


        const address =
            await Account.findAddressById(
                userId,
                addressId
            );


        if (!address) {

            return res.status(404).json({
                success: false,
                message:
                    "Adresse introuvable."
            });
        }


        await Account.updateAddress(
            userId,
            addressId,
            {
                ...req.body,

                is_default:
                    req.body.is_default === "1"
                    ||
                    req.body.is_default === true
            }
        );


        return res.json({
            success: true,
            message:
                "Adresse modifiée."
        });

    }
    catch (error) {

        console.error(
            "Erreur modification adresse :",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Impossible de modifier l'adresse."
        });
    }
};


/* =========================================================
   ADRESSE PAR DEFAUT
========================================================= */

exports.setDefaultAddress = async (
    req,
    res
) => {

    try {

        const userId =
            req.session.user.id;

        const addressId =
            Number(req.params.id);


        const address =
            await Account.findAddressById(
                userId,
                addressId
            );


        if (!address) {

            return res.status(404).json({
                success: false,
                message:
                    "Adresse introuvable."
            });
        }


        await Account.setDefaultAddress(
            userId,
            addressId
        );


        return res.json({
            success: true,
            message:
                "Adresse définie par défaut."
        });

    }
    catch (error) {

        console.error(
            "Erreur adresse par défaut :",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Impossible de modifier l'adresse par défaut."
        });
    }
};


/* =========================================================
   SUPPRIMER ADRESSE
========================================================= */

exports.deleteAddress = async (
    req,
    res
) => {

    try {

        const userId =
            req.session.user.id;

        const addressId =
            Number(req.params.id);


        const address =
            await Account.findAddressById(
                userId,
                addressId
            );


        if (!address) {

            return res.status(404).json({
                success: false,
                message:
                    "Adresse introuvable."
            });
        }


        await Account.deleteAddress(
            userId,
            addressId
        );


        return res.json({
            success: true,
            message:
                "Adresse supprimée."
        });

    }
    catch (error) {

        console.error(
            "Erreur suppression adresse :",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Impossible de supprimer l'adresse."
        });
    }
};


/* =========================================================
   PARAMETRES
========================================================= */

exports.settings = async (
    req,
    res,
    next
) => {

    try {

        const account =
            await Account.findAccountByUserId(
                req.session.user.id
            );


        return res.render(
            "client/account/settings",
            {
                title:
                    "Paramètres",

                layout:
                    "layouts/client",

                account,

                success:
                    req.query.success || null,

                error:
                    req.query.error || null
            }
        );

    }
    catch (error) {

        console.error(
            "Erreur paramètres :",
            error
        );

        next(error);
    }
};


/* =========================================================
   MODIFIER PARAMETRES
========================================================= */

exports.updateSettings = async (
    req,
    res,
    next
) => {

    try {

        await Account.updateSettings(
            req.session.user.id,
            {
                preferred_language:
                    req.body.preferred_language,

                marketing_consent:
                    req.body.marketing_consent
                    === "1",

                push_consent:
                    req.body.push_consent
                    === "1",

                email_consent:
                    req.body.email_consent
                    === "1",

                motif_theme:
                    req.body.motif_theme
            }
        );


        return res.redirect(
            "/parametres?success=Paramètres enregistrés"
        );

    }
    catch (error) {

        console.error(
            "Erreur modification paramètres :",
            error
        );

        next(error);
    }
};


/* =========================================================
   MOT DE PASSE
========================================================= */

exports.changePassword = async (
    req,
    res,
    next
) => {

    try {

        const userId =
            req.session.user.id;


        const currentPassword =
            String(
                req.body.current_password || ""
            );


        const newPassword =
            String(
                req.body.new_password || ""
            );


        const confirmation =
            String(
                req.body.password_confirmation || ""
            );


        if (
            !currentPassword ||
            !newPassword ||
            !confirmation
        ) {

            return res.redirect(
                "/parametres?error=Veuillez remplir tous les champs du mot de passe"
            );
        }


        if (newPassword.length < 8) {

            return res.redirect(
                "/parametres?error=Le nouveau mot de passe doit contenir au moins 8 caractères"
            );
        }


        if (
            newPassword !==
            confirmation
        ) {

            return res.redirect(
                "/parametres?error=Les nouveaux mots de passe ne correspondent pas"
            );
        }


        const user =
            await User.findById(
                userId
            );


        /*
         * findById doit retourner password_hash.
         * Si votre findById ne le sélectionne pas,
         * utilisez findByEmail ici.
         */

        const authUser =
            await User.findByEmail(
                user.email
            );


        const valid =
            await bcrypt.compare(
                currentPassword,
                authUser.password_hash
            );


        if (!valid) {

            return res.redirect(
                "/parametres?error=Mot de passe actuel incorrect"
            );
        }


        const passwordHash =
            await bcrypt.hash(
                newPassword,
                12
            );


        await Account.updatePassword(
            userId,
            passwordHash
        );


        return res.redirect(
            "/parametres?success=Mot de passe modifié"
        );

    }
    catch (error) {

        console.error(
            "Erreur changement mot de passe :",
            error
        );

        next(error);
    }
};