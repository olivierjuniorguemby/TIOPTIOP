const router = require("express").Router();

const page =
    require("../../controllers/client/page.controller");


/* ======================================================
   ACCUEIL
====================================================== */

router.get("/", page.home);


/* ======================================================
   CATALOGUE
====================================================== */

router.get("/menu", page.menu);

router.get("/produit/:id", page.product);

router.get(
    "/tradition",
    page.staticPage(
        "client/catalog/tradition",
        "Tradition"
    )
);

router.get(
    "/petit-dejeuner",
    page.staticPage(
        "client/catalog/breakfast",
        "Petit-déjeuner"
    )
);

router.get(
    "/formules",
    page.staticPage(
        "client/catalog/formulas",
        "Formules"
    )
);

router.get(
    "/offres",
    page.staticPage(
        "client/catalog/offers",
        "Offres"
    )
);

router.get(
    "/promotions",
    page.staticPage(
        "client/catalog/offers",
        "Promotions"
    )
);


/* ======================================================
   CONTENU
====================================================== */

router.get(
    "/tiopplus",
    page.staticPage(
        "client/content/tiopplus",
        "Tiop+"
    )
);

router.get(
    "/restaurants",
    page.staticPage(
        "client/content/restaurants",
        "Restaurants"
    )
);

router.get(
    "/histoire",
    page.staticPage(
        "client/content/history",
        "Notre histoire"
    )
);

router.get(
    "/faq",
    page.staticPage(
        "client/content/faq",
        "FAQ"
    )
);

router.get(
    "/contact",
    page.staticPage(
        "client/content/contact",
        "Contact"
    )
);

router.get(
    "/conditions",
    page.staticPage(
        "client/content/conditions",
        "Conditions"
    )
);


/* ======================================================
   COMMANDES
====================================================== */

router.get(
    "/panier",
    page.staticPage(
        "client/orders/cart",
        "Panier"
    )
);

router.get(
    "/commandes",
    page.staticPage(
        "client/orders/list",
        "Mes commandes"
    )
);

router.get(
    "/commande/:reference",
    page.staticPage(
        "client/orders/detail",
        "Commande"
    )
);

router.get(
    "/checkout",
    page.staticPage(
        "client/orders/checkout",
        "Checkout"
    )
);

router.get(
    "/confirmation",
    page.staticPage(
        "client/orders/confirmation",
        "Confirmation"
    )
);

router.get(
    "/facture/:reference",
    page.staticPage(
        "client/orders/invoice",
        "Facture"
    )
);

router.get(
    "/suivi",
    page.staticPage(
        "client/orders/tracking",
        "Suivi de commande"
    )
);


module.exports = router;