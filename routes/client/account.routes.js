const router =
    require("express").Router();


const account =
    require(
        "../../controllers/client/account.controller"
    );

const support = require("../../controllers/client/support.controller");
const { supportUpload } = require("../../config/uploads");


const {
    requireUser
} =
    require(
        "../../middleware/auth"
    );


const {
    profileUpload
} =
    require(
        "../../middleware/profile-upload"
    );


/* =========================================================
   TABLEAU DE BORD
========================================================= */

router.get(
    "/compte",
    requireUser,
    account.dashboard
);


/* =========================================================
   SUPPORT / MES DEMANDES — 18.3
========================================================= */

router.get(
    "/compte/demandes",
    requireUser,
    support.account
);

router.post(
    "/compte/demandes/:id/repondre",
    requireUser,
    supportUpload.single("attachment"),
    support.replyCustomer
);


/* =========================================================
   PROFIL
========================================================= */

router.get(
    "/profil",
    requireUser,
    account.profile
);


router.post(
    "/profil",
    requireUser,
    profileUpload.single(
        "profilePhoto"
    ),
    account.updateProfile
);


/* =========================================================
   ADRESSES
========================================================= */

router.post(
    "/profil/adresses",
    requireUser,
    account.createAddress
);


router.post(
    "/profil/adresses/:id/update",
    requireUser,
    account.updateAddress
);


router.post(
    "/profil/adresses/:id/default",
    requireUser,
    account.setDefaultAddress
);


router.post(
    "/profil/adresses/:id/delete",
    requireUser,
    account.deleteAddress
);


/* =========================================================
   PARAMETRES
========================================================= */

router.get(
    "/parametres",
    requireUser,
    account.settings
);


router.post(
    "/parametres",
    requireUser,
    account.updateSettings
);


/* =========================================================
   MOT DE PASSE
========================================================= */

router.post(
    "/parametres/mot-de-passe",
    requireUser,
    account.changePassword
);


/* =========================================================
   PAIEMENTS

   Dynamisation réservée étape 13.
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