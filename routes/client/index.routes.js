const router = require("express").Router();


/* ======================================================
   CONTROLLER CLIENT
====================================================== */

const page =
    require("../../controllers/client/page.controller");


/* ======================================================
   AUTHENTIFICATION CLIENT
====================================================== */

const {
    requireUser
} =
    require("../../middleware/auth");

/* ======================================================
   ORDER COMMANDES
====================================================== */

const orderController =
require(
    "../../controllers/client/order.controller"
);

/* ======================================================
   ACCUEIL
   PUBLIC
====================================================== */

router.get(
    "/",
    page.home
);


/* ======================================================
   CATALOGUE
   PUBLIC
====================================================== */

router.get(
    "/menu",
    page.menu
);


router.get(
    "/produit/:id",
    page.product
);


/* ======================================================
   TRADITION
   PUBLIC
====================================================== */

router.get(
    "/tradition",
    page.staticPage(
        "client/catalog/tradition",
        "Tradition"
    )
);


/* ======================================================
   PETIT-DEJEUNER
   PUBLIC
====================================================== */

router.get(
    "/petit-dejeuner",
    page.staticPage(
        "client/catalog/breakfast",
        "Petit-déjeuner"
    )
);


/* ======================================================
   FORMULES
   PUBLIC
====================================================== */

router.get(
    "/formules",
    page.formulas
);


/* ======================================================
   DETAIL FORMULE
   PUBLIC

   IMPORTANT :
   votre controller s'appelle formulaDetail
====================================================== */

router.get(
    "/formule/:id",
    page.formulaDetail
);


/* ======================================================
   OFFRES
   PUBLIC
====================================================== */

router.get(
    "/offres",
    page.staticPage(
        "client/catalog/offers",
        "Offres"
    )
);


/* ======================================================
   PROMOTIONS
   PUBLIC
====================================================== */

router.get(
    "/promotions",
    page.staticPage(
        "client/catalog/offers",
        "Promotions"
    )
);


/* ======================================================
   TIOP+
   CLIENT CONNECTE OBLIGATOIRE
====================================================== */

router.get(
    "/tiopplus",
    requireUser,
    page.staticPage(
        "client/content/tiopplus",
        "Tiop+"
    )
);


/* ======================================================
   RESTAURANTS
   PUBLIC
====================================================== */

router.get(
    "/restaurants",
    page.staticPage(
        "client/content/restaurants",
        "Restaurants"
    )
);


/* ======================================================
   NOTRE HISTOIRE
   PUBLIC
====================================================== */

router.get(
    "/histoire",
    page.staticPage(
        "client/content/history",
        "Notre histoire"
    )
);


/* ======================================================
   FAQ
   PUBLIC
====================================================== */

router.get(
    "/faq",
    page.staticPage(
        "client/content/faq",
        "FAQ"
    )
);


/* ======================================================
   CONTACT
   PUBLIC
====================================================== */

router.get(
    "/contact",
    page.staticPage(
        "client/content/contact",
        "Contact"
    )
);


/* ======================================================
   CONDITIONS
   PUBLIC
====================================================== */

router.get(
    "/conditions",
    page.staticPage(
        "client/content/conditions",
        "Conditions"
    )
);




/* ======================================================
   MES COMMANDES
   CLIENT CONNECTE OBLIGATOIRE
====================================================== */

router.get(
    "/commandes",
    requireUser,
    orderController.list
);


/* ======================================================
   DETAIL COMMANDE
   CLIENT CONNECTE OBLIGATOIRE
====================================================== */

router.get(
    "/commande/:reference",
    requireUser,
    page.staticPage(
        "client/orders/detail",
        "Commande"
    )
);


/* ======================================================
   CHECKOUT
   CLIENT CONNECTE OBLIGATOIRE
====================================================== */

router.get(
    "/checkout",
    requireUser,
    page.staticPage(
        "client/orders/checkout",
        "Checkout"
    )
);


/* ======================================================
   CONFIRMATION
   CLIENT CONNECTE OBLIGATOIRE
====================================================== */

router.get(
    "/confirmation",
    requireUser,
    page.staticPage(
        "client/orders/confirmation",
        "Confirmation"
    )
);


/* ======================================================
   FACTURE
   CLIENT CONNECTE OBLIGATOIRE
====================================================== */

router.get(
    "/facture/:reference",
    requireUser,
    page.staticPage(
        "client/orders/invoice",
        "Facture"
    )
);


/* ======================================================
   SUIVI COMMANDE
   CLIENT CONNECTE OBLIGATOIRE
====================================================== */

router.get(
    "/suivi",
    requireUser,
    page.staticPage(
        "client/orders/tracking",
        "Suivi de commande"
    )
);


/* ======================================================
   EXPORT
====================================================== */

module.exports = router;