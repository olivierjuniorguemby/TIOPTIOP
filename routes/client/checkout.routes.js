const router =
    require("express").Router();


const checkout =
    require(
        "../../controllers/client/checkout.controller"
    );


const {
    requireUser
} =
    require(
        "../../middleware/auth"
    );


/* =========================================================
   GET /checkout
========================================================= */

router.get(
    "/",
    requireUser,
    checkout.index
);


/* =========================================================
   GET /checkout/zones/:restaurantId
========================================================= */

router.get(
    "/zones/:restaurantId",
    requireUser,
    checkout.deliveryZones
);


/* =========================================================
   STRIPE CARD — 13.8.4
========================================================= */

router.get(
    "/carte/:reference",
    requireUser,
    checkout.cardPayment
);


router.post(
    "/carte/:reference/sync",
    requireUser,
    checkout.syncCardPayment
);


router.get(
    "/carte/:reference/retour",
    requireUser,
    checkout.cardReturn
);


/* =========================================================
   POST /checkout
========================================================= */

router.post(
    "/",
    requireUser,
    checkout.create
);


module.exports =
    router;
