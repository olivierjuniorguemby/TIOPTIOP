const bcrypt =
    require("bcryptjs");

const crypto =
    require("crypto");

const User =
    require("../../models/user.model");


/* =========================================================
   OUTIL RENDER
========================================================= */

function render(
    res,
    view,
    title,
    data = {}
) {

    return res.render(
        view,
        {
            title,

            layout:
                "layouts/client",

            ...data
        }
    );
}


/* =========================================================
   CONNEXION - PAGE
========================================================= */

exports.loginPage = (
    req,
    res
) => {

    return render(
        res,
        "client/auth/login",
        "Connexion",
        {
            error: null,
            email: ""
        }
    );
};


/* =========================================================
   CONNEXION CLIENT
========================================================= */

exports.login = async (
    req,
    res,
    next
) => {

    try {

        /* =================================================
           DONNEES
        ================================================= */

        const email =
            String(
                req.body.email || ""
            )
                .trim()
                .toLowerCase();


        const password =
            String(
                req.body.password || ""
            );


        /* =================================================
           VALIDATION
        ================================================= */

        if (
            !email ||
            !password
        ) {

            return render(
                res,
                "client/auth/login",
                "Connexion",
                {
                    error:
                        "Veuillez renseigner votre email et votre mot de passe.",

                    email
                }
            );
        }


        /* =================================================
           UTILISATEUR
        ================================================= */

        const user =
            await User.findByEmail(
                email
            );


        if (
            !user ||
            !user.password_hash
        ) {

            return render(
                res,
                "client/auth/login",
                "Connexion",
                {
                    error:
                        "Email ou mot de passe incorrect.",

                    email
                }
            );
        }


        /* =================================================
           STATUT
        ================================================= */

        if (
            user.status !== "ACTIVE"
        ) {

            return render(
                res,
                "client/auth/login",
                "Connexion",
                {
                    error:
                        "Ce compte n'est actuellement pas disponible.",

                    email
                }
            );
        }


        /* =================================================
           MOT DE PASSE
        ================================================= */

        const passwordValid =
            await bcrypt.compare(
                password,
                user.password_hash
            );


        if (!passwordValid) {

            return render(
                res,
                "client/auth/login",
                "Connexion",
                {
                    error:
                        "Email ou mot de passe incorrect.",

                    email
                }
            );
        }


        /* =================================================
           SESSION CLIENT
        ================================================= */

        req.session.user = {

            id:
                user.id,

            publicId:
                user.public_id,

            email:
                user.email,

            phone:
                user.phone,

            firstName:
                user.first_name,

            lastName:
                user.last_name,

            displayName:
                user.display_name
                ||
                [
                    user.first_name,
                    user.last_name
                ]
                    .filter(Boolean)
                    .join(" "),

            avatarUrl:
                user.avatar_url || null
        };


        /* =================================================
           IMPORTANT
           
           On ne touche PAS à :
           
           req.session.admin
           
           Si l'utilisateur est également connecté
           à l'administration dans ce navigateur,
           sa session admin reste active.
        ================================================= */


        /* =================================================
           DERNIERE CONNEXION
        ================================================= */

        await User.updateLastLogin(
            user.id
        );


        /* =================================================
           SAVE
        ================================================= */

        return req.session.save(
            error => {

                if (error) {

                    return next(error);
                }


                return res.redirect(
                    "/compte"
                );
            }
        );

    }
    catch (error) {

        console.error(
            "Erreur connexion client :",
            error
        );


        return next(error);
    }
};


/* =========================================================
   INSCRIPTION - PAGE
========================================================= */

exports.registerPage = (
    req,
    res
) => {

    return render(
        res,
        "client/auth/register",
        "Inscription",
        {
            error: null,

            values: {}
        }
    );
};


/* =========================================================
   INSCRIPTION
========================================================= */

exports.register = async (
    req,
    res,
    next
) => {

    try {

        /* =================================================
           DONNEES
        ================================================= */

        const firstName =
            String(
                req.body.first_name || ""
            ).trim();


        const lastName =
            String(
                req.body.last_name || ""
            ).trim();


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


        const password =
            String(
                req.body.password || ""
            );


        const passwordConfirm =
            String(
                req.body.password_confirm || ""
            );


        const values = {

            first_name:
                firstName,

            last_name:
                lastName,

            email,

            phone
        };


        /* =================================================
           CHAMPS OBLIGATOIRES
        ================================================= */

        if (
            !firstName ||
            !lastName ||
            !email ||
            !password
        ) {

            return render(
                res,
                "client/auth/register",
                "Inscription",
                {
                    error:
                        "Veuillez remplir tous les champs obligatoires.",

                    values
                }
            );
        }


        /* =================================================
           MOT DE PASSE
        ================================================= */

        if (
            password.length < 8
        ) {

            return render(
                res,
                "client/auth/register",
                "Inscription",
                {
                    error:
                        "Le mot de passe doit contenir au moins 8 caractères.",

                    values
                }
            );
        }


        /* =================================================
           CONFIRMATION
        ================================================= */

        if (
            password !==
            passwordConfirm
        ) {

            return render(
                res,
                "client/auth/register",
                "Inscription",
                {
                    error:
                        "Les deux mots de passe ne correspondent pas.",

                    values
                }
            );
        }


        /* =================================================
           EMAIL EXISTANT
        ================================================= */

        if (
            await User.emailExists(
                email
            )
        ) {

            return render(
                res,
                "client/auth/register",
                "Inscription",
                {
                    error:
                        "Un compte existe déjà avec cette adresse email.",

                    values
                }
            );
        }


        /* =================================================
           TELEPHONE EXISTANT
        ================================================= */

        if (
            phone &&
            await User.phoneExists(
                phone
            )
        ) {

            return render(
                res,
                "client/auth/register",
                "Inscription",
                {
                    error:
                        "Ce numéro de téléphone est déjà associé à un compte.",

                    values
                }
            );
        }


        /* =================================================
           HASH
        ================================================= */

        const passwordHash =
            await bcrypt.hash(
                password,
                12
            );


        /* =================================================
           UUID
        ================================================= */

        const publicId =
            crypto.randomUUID();


        /* =================================================
           CREATION USER
        ================================================= */

        const userId =
            await User.createUser({

                public_id:
                    publicId,

                email,

                phone:
                    phone || null,

                password_hash:
                    passwordHash
            });


        /* =================================================
           PROFIL
        ================================================= */

        const displayName =
            `${firstName} ${lastName}`
                .trim();


        await User.createProfile(
            userId,
            {
                first_name:
                    firstName,

                last_name:
                    lastName,

                display_name:
                    displayName,

                marketing_consent:
                    req.body.marketing_consent
                    ? 1
                    : 0
            }
        );


        /* =================================================
           SESSION CLIENT
        ================================================= */

        req.session.user = {

            id:
                userId,

            publicId,

            email,

            phone:
                phone || null,

            firstName,

            lastName,

            displayName,

            avatarUrl:
                null
        };


        /*
         * Encore une fois :
         *
         * req.session.admin
         * n'est jamais modifié ici.
         */


        return req.session.save(
            error => {

                if (error) {

                    return next(error);
                }


                return res.redirect(
                    "/compte"
                );
            }
        );

    }
    catch (error) {

        console.error(
            "Erreur inscription client :",
            error
        );


        if (
            error.code ===
            "ER_DUP_ENTRY"
        ) {

            return render(
                res,
                "client/auth/register",
                "Inscription",
                {
                    error:
                        "Un compte utilisant ces informations existe déjà.",

                    values:
                        req.body
                }
            );
        }


        return next(error);
    }
};


/* =========================================================
   DECONNEXION CLIENT
========================================================= */

exports.logout = (
    req,
    res,
    next
) => {

    if (!req.session) {

        return res.redirect("/");
    }


    delete req.session.user;


    return req.session.save(
        error => {

            if (error) {

                console.error(
                    "Erreur déconnexion client :",
                    error
                );

                return next(error);
            }


            return res.redirect("/");
        }
    );
};