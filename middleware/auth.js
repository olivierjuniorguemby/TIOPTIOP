const User =
    require("../models/user.model");


/* =========================================================
   URL CLIENT DE RETOUR SECURISEE
========================================================= */

function safeReturnTo(value) {

    if (
        typeof value !== "string" ||
        !value.startsWith("/") ||
        value.startsWith("//")
    ) {
        return null;
    }


    /*
     * Une authentification CLIENT
     * ne doit jamais rediriger vers l'admin.
     */

    if (
        value === "/admin" ||
        value.startsWith("/admin/")
    ) {
        return null;
    }


    return value;
}


/* =========================================================
   CLIENT CONNECTE OBLIGATOIRE
========================================================= */

async function requireUser(
    req,
    res,
    next
) {

    try {

        /*
         * Aucun client connecté.
         */

        if (
            !req.session ||
            !req.session.user
        ) {

            if (req.session) {

                const returnTo =
                    safeReturnTo(
                        req.originalUrl
                    );


                if (returnTo) {

                    req.session.returnTo =
                        returnTo;
                }
            }


            return res.redirect(
                "/connexion"
            );
        }


        const userId =
            Number(
                req.session.user.id
            );


        /*
         * ID session incorrect.
         */

        if (
            !Number.isInteger(userId) ||
            userId <= 0
        ) {

            delete req.session.user;


            const returnTo =
                safeReturnTo(
                    req.originalUrl
                );


            if (returnTo) {

                req.session.returnTo =
                    returnTo;
            }


            return req.session.save(
                error => {

                    if (error) {

                        return next(error);
                    }


                    return res.redirect(
                        "/connexion"
                    );
                }
            );
        }


        /*
         * Vérification réelle du compte
         * dans MySQL.
         */

        const user =
            await User.findById(
                userId
            );


        /*
         * Compte supprimé / bloqué /
         * inexistant.
         */

        if (
            !user ||
            user.status !== "ACTIVE"
        ) {

            delete req.session.user;


            const returnTo =
                safeReturnTo(
                    req.originalUrl
                );


            if (returnTo) {

                req.session.returnTo =
                    returnTo;
            }


            return req.session.save(
                error => {

                    if (error) {

                        return next(error);
                    }


                    return res.redirect(
                        "/connexion"
                    );
                }
            );
        }


        /*
         * Synchronisation légère
         * de la session client.
         */

        req.session.user.email =
            user.email || null;


        req.session.user.phone =
            user.phone || null;


        req.session.user.firstName =
            user.first_name || null;


        req.session.user.lastName =
            user.last_name || null;


        req.session.user.displayName =
            user.display_name
            ||
            [
                user.first_name,
                user.last_name
            ]
                .filter(Boolean)
                .join(" ");


        req.session.user.avatarUrl =
            user.avatar_url || null;


        return next();

    }
    catch (error) {

        console.error(
            "Erreur requireUser :",
            error
        );


        return next(error);
    }
}


/* =========================================================
   VISITEUR CLIENT UNIQUEMENT
========================================================= */

async function guestOnly(
    req,
    res,
    next
) {

    try {

        /*
         * Pas de client connecté.
         */

        if (
            !req.session ||
            !req.session.user
        ) {

            return next();
        }


        const userId =
            Number(
                req.session.user.id
            );


        /*
         * Mauvaise session :
         * on nettoie seulement user.
         */

        if (
            !Number.isInteger(userId) ||
            userId <= 0
        ) {

            delete req.session.user;


            return req.session.save(
                error => {

                    if (error) {

                        return next(error);
                    }


                    return next();
                }
            );
        }


        const user =
            await User.findById(
                userId
            );


        /*
         * Client valide déjà connecté.
         */

        if (
            user &&
            user.status === "ACTIVE"
        ) {

            const returnTo =
                safeReturnTo(
                    req.session.returnTo
                );


            /*
             * Exemple :
             *
             * /checkout
             * → /connexion
             *
             * mais client déjà connecté
             * → retour /checkout
             */

            if (returnTo) {

                delete req.session.returnTo;


                return req.session.save(
                    error => {

                        if (error) {

                            return next(error);
                        }


                        return res.redirect(
                            returnTo
                        );
                    }
                );
            }


            return res.redirect(
                "/compte"
            );
        }


        /*
         * Le compte n'est plus valide.
         *
         * ATTENTION :
         * on ne supprime jamais
         * req.session.admin ici.
         */

        delete req.session.user;


        return req.session.save(
            error => {

                if (error) {

                    return next(error);
                }


                return next();
            }
        );

    }
    catch (error) {

        console.error(
            "Erreur guestOnly :",
            error
        );


        return next(error);
    }
}


/* =========================================================
   ADMIN CONNECTE OBLIGATOIRE
========================================================= */

function requireAdmin(
    req,
    res,
    next
) {

    if (
        !req.session ||
        !req.session.admin
    ) {

        return res.redirect(
            "/admin/connexion"
        );
    }


    return next();
}


/* =========================================================
   VISITEUR ADMIN UNIQUEMENT
========================================================= */

function adminGuestOnly(
    req,
    res,
    next
) {

    if (
        req.session &&
        req.session.admin
    ) {

        return res.redirect(
            "/admin/dashboard"
        );
    }


    return next();
}


/* =========================================================
   DECONNEXION CLIENT
========================================================= */

function logoutUser(
    req,
    res,
    next
) {

    if (!req.session) {

        return res.redirect(
            "/"
        );
    }


    /*
     * On ne fait surtout PAS :
     *
     * req.session.destroy()
     *
     * car la session admin doit rester
     * indépendante.
     */

    delete req.session.user;
    delete req.session.returnTo;


    return req.session.save(
        error => {

            if (error) {

                return next(error);
            }


            return res.redirect(
                "/"
            );
        }
    );
}


/* =========================================================
   DECONNEXION ADMIN
========================================================= */

function logoutAdmin(
    req,
    res,
    next
) {

    if (!req.session) {

        return res.redirect(
            "/admin/connexion"
        );
    }


    /*
     * On supprime uniquement
     * la session ADMIN.
     */

    delete req.session.admin;


    return req.session.save(
        error => {

            if (error) {

                return next(error);
            }


            return res.redirect(
                "/admin/connexion"
            );
        }
    );
}


/* =========================================================
   EXPORTS

   IMPORTANT :
   auth.routes.js fait :

   const {
       guestOnly,
       requireUser
   } = require("../../middleware/auth");

   Ces fonctions doivent donc absolument
   être exportées ici.
========================================================= */

module.exports = {

    requireUser,
    guestOnly,

    requireAdmin,
    adminGuestOnly,

    logoutUser,
    logoutAdmin,

    safeReturnTo
};