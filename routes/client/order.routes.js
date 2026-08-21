const router =
    require("express").Router();


const order =
    require(
        "../../controllers/client/order.controller"
    );


const {
    requireUser
} =
    require(
        "../../middleware/auth"
    );

router.get(
    "/:reference/payment-status",
    requireUser,
    order.paymentStatus
);

/* =========================================================
   CONFIRMATION

   GET /commande/confirmation/:reference
========================================================= */

router.get(
    "/confirmation/:reference",
    requireUser,
    order.confirmation
);


/* =========================================================
   FACTURE

   GET /commande/:reference/facture
========================================================= */

router.get(
    "/:reference/facture",
    requireUser,
    order.invoice
);


/* =========================================================
   SUIVI

   GET /commande/:reference/suivi
========================================================= */

router.get(
    "/:reference/suivi",
    requireUser,
    order.tracking
);


module.exports =
    router;