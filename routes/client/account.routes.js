const router =
    require("express").Router();


const account =
    require(
        "../../controllers/client/account.controller"
    );


const {
    requireUser
} =
    require(
        "../../middleware/auth"
    );


/* =========================================================
   TABLEAU DE BORD CLIENT
   GET /compte
========================================================= */

router.get(
    "/compte",
    requireUser,
    account.dashboard
);


/* =========================================================
   PROFIL CLIENT
   GET /profil
========================================================= */

router.get(
    "/profil",
    requireUser,
    account.profile
);


/* =========================================================
   PARAMETRES CLIENT
   GET /parametres
========================================================= */

router.get(
    "/parametres",
    requireUser,
    account.settings
);


/* =========================================================
   MOYENS DE PAIEMENT CLIENT
   GET /paiements-client
========================================================= */

router.get(
    "/paiements-client",
    requireUser,
    (
        req,
        res
    ) => {

        return res.render(
            "client/account/payments",
            {
                title:
                    "Moyens de paiement",

                layout:
                    "layouts/client"
            }
        );
    }
);


/* =========================================================
   EXPORT
========================================================= */

module.exports = router;