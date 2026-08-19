const bcrypt =
    require("bcryptjs");

const crypto =
    require("crypto");

const User =
    require("../../models/user.model");

const CartController =
    require("./cart.controller");


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
   URL DE RETOUR SECURISEE

   Exemple :
   /checkout        => OK
   /panier          => OK
   /admin           => NON
   //google.com      => NON
========================================================= */

function getSafeReturnTo(
    req,
    fallback = "/compte"
) {

    const target =
        req.session?.returnTo;


    if (
        typeof target !== "string" ||
        !target.startsWith("/") ||
        target.startsWith("//") ||
        target === "/admin" ||
        target.startsWith("/admin/")
    ) {

        return fallback;
    }


    return target;
}


/* =========================================================
   HASH BCRYPT UTILISABLE
========================================================= */

function isUsableBcryptHash(hash) {
    return typeof hash === "string"
        && hash.length === 60
        && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash);
}


/* =========================================================
   CONNEXION - PAGE

   GET /connexion

   C'EST CETTE FONCTION QUI MANQUAIT.
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
            error:
                null,

            email:
                "",

            returnTo:
                req.session?.returnTo
                ||
                null
        }
    );
};


/* =========================================================
   CONNEXION CLIENT

   POST /connexion
========================================================= */

exports.login =
async function (
    req,
    res,
    next
) {

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

                    email,

                    returnTo:
                        req.session?.returnTo
                        ||
                        null
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

                    email,

                    returnTo:
                        req.session?.returnTo
                        ||
                        null
                }
            );
        }


        /* =================================================
           STATUT DU COMPTE
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

                    email,

                    returnTo:
                        req.session?.returnTo
                        ||
                        null
                }
            );
        }


        /* =================================================
           COMPTE CLIENT + HASH VALIDE
        ================================================= */

        if (
            user.account_type !== "CUSTOMER"
        ) {
            return render(
                res,
                "client/auth/login",
                "Connexion",
                {
                    error: "Email ou mot de passe incorrect.",
                    email,
                    returnTo: req.session?.returnTo || null
                }
            );
        }

        if (!isUsableBcryptHash(user.password_hash)) {
            console.warn("[AUTH] Hash invalide/non initialisé pour userId=", user.id);
            return render(
                res,
                "client/auth/login",
                "Connexion",
                {
                    error: "Ce compte de test n'a pas encore de mot de passe valide. Réinitialisez son mot de passe.",
                    email,
                    returnTo: req.session?.returnTo || null
                }
            );
        }

        /* =================================================
           VERIFICATION MOT DE PASSE
        ================================================= */

        let passwordValid = false;

        try {
            passwordValid = await bcrypt.compare(
                password,
                user.password_hash
            );
        }
        catch (bcryptError) {
            console.error("[AUTH] Erreur bcrypt :", bcryptError);
            passwordValid = false;
        }


        if (!passwordValid) {

            return render(
                res,
                "client/auth/login",
                "Connexion",
                {
                    error:
                        "Email ou mot de passe incorrect.",

                    email,

                    returnTo:
                        req.session?.returnTo
                        ||
                        null
                }
            );
        }


        /* =================================================
           DESTINATION APRES CONNEXION

           IMPORTANT :
           on récupère returnTo AVANT de le supprimer.
        ================================================= */

        const target =
            getSafeReturnTo(
                req,
                "/compte"
            );


        /* =================================================
           OPERATIONS SECONDAIRES AVANT SESSION

           IMPORTANT 13.4.1 :
           aucune demi-session client n'est créée avant la
           fin des opérations secondaires.
        ================================================= */

        try {
            await User.updateLastLogin(user.id);
        }
        catch (lastLoginError) {
            console.error("[AUTH] updateLastLogin non bloquant :", lastLoginError);
        }

        if (
            CartController &&
            typeof CartController.mergeAfterLogin === "function"
        ) {
            try {
                await CartController.mergeAfterLogin(req, user.id);
            }
            catch (cartError) {
                console.error("[AUTH] Fusion panier non bloquante :", cartError);
                req.session.cartMergeWarning = true;
            }
        }

        /* =================================================
           SESSION CLIENT - CREEE EN DERNIER
        ================================================= */

        req.session.user = {
            id: user.id,
            publicId: user.public_id,
            email: user.email,
            phone: user.phone,
            firstName: user.first_name,
            lastName: user.last_name,
            displayName: user.display_name || [user.first_name,user.last_name].filter(Boolean).join(" "),
            avatarUrl: user.avatar_url || null
        };

        /* =================================================
           SUPPRESSION DESTINATION TEMPORAIRE
        ================================================= */

        delete req.session.returnTo;


        /* =================================================
           SAUVEGARDE SESSION
        ================================================= */

        return req.session.save(
            error => {

                if (error) {

                    return next(error);
                }


                /* =========================================
                   REDIRECTION

                   Si le client venait de /checkout :
                   → /checkout

                   Sinon :
                   → /compte
                ========================================= */

                return res.redirect(
                    target
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

   GET /inscription
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
            error:
                null,

            values:
                {},

            returnTo:
                req.session?.returnTo
                ||
                null
        }
    );
};


/* =========================================================
   INSCRIPTION

   POST /inscription
========================================================= */

exports.register =
async function (
    req,
    res,
    next
) {

    try {

        /* =================================================
           DONNEES
        ================================================= */

        const firstName =
            String(
                req.body.first_name || ""
            )
                .trim();


        const lastName =
            String(
                req.body.last_name || ""
            )
                .trim();


        const email =
            String(
                req.body.email || ""
            )
                .trim()
                .toLowerCase();


        const phone =
            String(
                req.body.phone || ""
            )
                .trim();


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

                    values,

                    returnTo:
                        req.session?.returnTo
                        ||
                        null
                }
            );
        }


        /* =================================================
           LONGUEUR MOT DE PASSE
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

                    values,

                    returnTo:
                        req.session?.returnTo
                        ||
                        null
                }
            );
        }


        /* =================================================
           CONFIRMATION MOT DE PASSE
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

                    values,

                    returnTo:
                        req.session?.returnTo
                        ||
                        null
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

                    values,

                    returnTo:
                        req.session?.returnTo
                        ||
                        null
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

                    values,

                    returnTo:
                        req.session?.returnTo
                        ||
                        null
                }
            );
        }


        /* =================================================
           HASH MOT DE PASSE
        ================================================= */

        const passwordHash =
            await bcrypt.hash(
                password,
                12
            );


        /* =================================================
           UUID PUBLIC
        ================================================= */

        const publicId =
            crypto.randomUUID();


        /* =================================================
           CREATION UTILISATEUR
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
           CREATION PROFIL
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
           DESTINATION

           Si inscription déclenchée depuis checkout,
           on reviendra au checkout.
        ================================================= */

        const target =
            getSafeReturnTo(
                req,
                "/compte"
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
         * session.admin n'est pas modifiée.
         */


        /* =================================================
           FUSION PANIER INVITE

           Cela permet aussi :
           
           panier
           → checkout
           → inscription
           → checkout
           
           sans perdre les articles.
        ================================================= */

        if (
            CartController &&
            typeof CartController.mergeAfterLogin
                === "function"
        ) {

            await CartController.mergeAfterLogin(
                req,
                userId
            );
        }


        /* =================================================
           NETTOYAGE RETURN TO
        ================================================= */

        delete req.session.returnTo;


        /* =================================================
           SAVE
        ================================================= */

        return req.session.save(
            error => {

                if (error) {

                    return next(error);
                }


                return res.redirect(
                    target
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
                        req.body,

                    returnTo:
                        req.session?.returnTo
                        ||
                        null
                }
            );
        }


        return next(error);
    }
};



/* =========================================================
   MOT DE PASSE OUBLIE - PAGE
========================================================= */

exports.forgotPasswordPage = (req, res) => {
    return render(
        res,
        "client/auth/forgot-password",
        "Mot de passe oublié",
        { info: null }
    );
};


/* =========================================================
   DECONNEXION CLIENT

   POST /deconnexion
========================================================= */

exports.logout = (
    req,
    res,
    next
) => {

    if (!req.session) {

        return res.redirect(
            "/"
        );
    }


    /*
     * IMPORTANT :
     *
     * On supprime uniquement la connexion CLIENT.
     *
     * On ne fait PAS :
     *
     * req.session.destroy()
     *
     * sinon cela détruirait aussi la session admin.
     */

    delete req.session.user;
    delete req.session.returnTo;
    delete req.session.cartMergeWarning;


    return req.session.save(
        error => {

            if (error) {

                console.error(
                    "Erreur déconnexion client :",
                    error
                );


                return next(error);
            }


            return res.redirect(
                "/connexion"
            );
        }
    );
};