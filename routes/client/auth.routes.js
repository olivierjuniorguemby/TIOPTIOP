const router = require("express").Router();

const auth = require("../../controllers/client/auth.controller");

const {
    guestOnly,
    requireUser
} = require("../../middleware/auth");


/* =========================================================
   CONNEXION
========================================================= */

router.get(
    "/connexion",
    guestOnly,
    auth.loginPage
);

router.post(
    "/connexion",
    guestOnly,
    auth.login
);


/* =========================================================
   INSCRIPTION
========================================================= */

router.get(
    "/inscription",
    guestOnly,
    auth.registerPage
);

router.post(
    "/inscription",
    guestOnly,
    auth.register
);


/* =========================================================
   DECONNEXION
========================================================= */

router.post(
    "/deconnexion",
    requireUser,
    auth.logout
);


module.exports = router;