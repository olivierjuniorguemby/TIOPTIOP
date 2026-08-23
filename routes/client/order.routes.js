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


/* =========================================================
   STATUT PAIEMENT

   GET /commande/:reference/payment-status
========================================================= */

router.get(
    "/:reference/payment-status",
    requireUser,
    order.paymentStatus
);


/* =========================================================
   RETRY PAIEMENT MTN MOMO

   POST /commande/:reference/payment/retry

   IMPORTANT :
   Cette route doit exister car confirmation.ejs
   l'appelle avec fetch().
========================================================= */

router.post(
    "/:reference/payment/retry",
    requireUser,
    order.retryPayment
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