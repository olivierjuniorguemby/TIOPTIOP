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
   CHECKOUT

   Toutes les routes sont CLIENT protégées.
========================================================= */


/* =========================================================
   PAGE CHECKOUT

   GET /checkout
========================================================= */

router.get(
    "/",
    requireUser,
    checkout.index
);


/* =========================================================
   ZONES RESTAURANT

   GET /checkout/zones/:restaurantId
========================================================= */

router.get(
    "/zones/:restaurantId",
    requireUser,
    checkout.deliveryZones
);


/* =========================================================
   CREER COMMANDE

   POST /checkout
========================================================= */

router.post(
    "/",
    requireUser,
    checkout.create
);


/* =========================================================
   EXPORT
========================================================= */

module.exports =
    router;