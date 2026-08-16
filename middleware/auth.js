const User = require("../models/user.model");


/* =========================================================
   CLIENT CONNECTE OBLIGATOIRE
========================================================= */

async function requireUser(req, res, next) {

    try {

        /*
         * IMPORTANT :
         * ce middleware concerne UNIQUEMENT le client.
         */

        if (!req.session || !req.session.user) {

            return res.redirect("/connexion");
        }


        const userId = Number(req.session.user.id);


        if (!userId) {

            delete req.session.user;

            return req.session.save(error => {

                if (error) {
                    return next(error);
                }

                return res.redirect("/connexion");
            });
        }


        /* =================================================
           VERIFICATION DU CLIENT EN BASE
        ================================================= */

        const user = await User.findById(userId);


        /*
         * Compte :
         *
         * - inexistant
         * - BLOCKED
         * - DELETED
         * - PENDING
         *
         * On déconnecte UNIQUEMENT le client.
         */

        if (!user || user.status !== "ACTIVE") {

            delete req.session.user;


            return req.session.save(error => {

                if (error) {

                    console.error(
                        "Erreur sauvegarde session après invalidation client :",
                        error
                    );

                    return next(error);
                }


                return res.redirect("/connexion");
            });
        }


        /* =================================================
           SYNCHRONISATION SESSION CLIENT
        ================================================= */

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

async function guestOnly(req, res, next) {

    try {

        /*
         * Aucun client connecté.
         *
         * ATTENTION :
         * session.admin n'est volontairement
         * jamais vérifiée ici.
         */

        if (!req.session || !req.session.user) {

            return next();
        }


        const userId =
            Number(req.session.user.id);


        /*
         * Mauvaise session client.
         */

        if (!userId) {

            delete req.session.user;


            return req.session.save(error => {

                if (error) {
                    return next(error);
                }

                return next();
            });
        }


        const user =
            await User.findById(userId);


        /*
         * Client actif déjà connecté.
         */

        if (user && user.status === "ACTIVE") {

            return res.redirect("/compte");
        }


        /*
         * Client bloqué / supprimé / invalide.
         *
         * SUPPRESSION UNIQUEMENT DE user.
         *
         * admin reste connecté.
         */

        delete req.session.user;


        return req.session.save(error => {

            if (error) {

                console.error(
                    "Erreur nettoyage session client :",
                    error
                );

                return next(error);
            }


            return next();
        });

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

function requireAdmin(req, res, next) {

    /*
     * IMPORTANT :
     *
     * on regarde UNIQUEMENT :
     *
     * req.session.admin
     *
     * La connexion client n'intervient absolument pas.
     */

    if (!req.session || !req.session.admin) {

        return res.redirect(
            "/admin/connexion"
        );
    }


    return next();
}


/* =========================================================
   VISITEUR ADMIN UNIQUEMENT
========================================================= */

function adminGuestOnly(req, res, next) {

    /*
     * Un CLIENT connecté peut venir ici.
     *
     * On regarde uniquement la session ADMIN.
     */

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

function logoutUser(req, res, next) {

    if (!req.session) {

        return res.redirect("/");
    }


    /*
     * NE PAS FAIRE :
     *
     * req.session.destroy()
     *
     * car cela supprimerait également admin.
     */

    delete req.session.user;


    return req.session.save(error => {

        if (error) {
            return next(error);
        }

        return res.redirect("/");
    });
}


/* =========================================================
   DECONNEXION ADMIN
========================================================= */

function logoutAdmin(req, res, next) {

    if (!req.session) {

        return res.redirect(
            "/admin/connexion"
        );
    }


    /*
     * Suppression uniquement ADMIN.
     */

    delete req.session.admin;


    return req.session.save(error => {

        if (error) {
            return next(error);
        }

        return res.redirect(
            "/admin/connexion"
        );
    });
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

    requireUser,
    guestOnly,

    requireAdmin,
    adminGuestOnly,

    logoutUser,
    logoutAdmin
};