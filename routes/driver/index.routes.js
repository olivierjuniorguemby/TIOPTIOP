const router =
    require("express").Router();


const auth =
    require(
        "../../controllers/driver/auth.controller"
    );


const driver =
    require(
        "../../controllers/driver/driver.controller"
    );


const {
    requireDriver,
    driverGuestOnly
} =
    require(
        "../../middleware/driver-auth"
    );


/* =========================================================
   AUTH LIVREUR
========================================================= */

router.get(
    "/connexion",
    driverGuestOnly,
    auth.loginPage
);


router.post(
    "/connexion",
    driverGuestOnly,
    auth.login
);


router.post(
    "/deconnexion",
    requireDriver,
    auth.logout
);


/* =========================================================
   DASHBOARD
========================================================= */

router.get(
    "/",
    requireDriver,
    driver.dashboard
);


router.post(
    "/disponibilite",
    requireDriver,
    driver.availability
);


/* =========================================================
   DETAIL LIVRAISON
========================================================= */

router.get(
    "/livraisons/:reference",
    requireDriver,
    driver.detail
);


/* =========================================================
   ACTIONS LIVRAISON
========================================================= */

router.post(
    "/livraisons/:reference/accepter",
    requireDriver,
    driver.accept
);


router.post(
    "/livraisons/:reference/refuser",
    requireDriver,
    driver.reject
);


router.post(
    "/livraisons/:reference/recuperer",
    requireDriver,
    driver.pickup
);


router.post(
    "/livraisons/:reference/demarrer",
    requireDriver,
    driver.start
);


router.post(
    "/livraisons/:reference/arrive",
    requireDriver,
    driver.arrived
);


router.post(
    "/livraisons/:reference/livree",
    requireDriver,
    driver.delivered
);


/* =========================================================
   GPS REEL - 13.6
========================================================= */

router.post(
    "/livraisons/:reference/position",
    requireDriver,
    driver.position
);


module.exports =
    router;
