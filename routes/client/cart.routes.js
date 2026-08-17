const router =
    require("express").Router();


const cart =
    require(
        "../../controllers/client/cart.controller"
    );


/* =========================================================
   AFFICHER PANIER

   GET /panier
========================================================= */

router.get(
    "/",
    cart.index
);


/* =========================================================
   DONNEES PANIER

   GET /panier/data
========================================================= */

router.get(
    "/data",
    cart.data
);


/* =========================================================
   AJOUTER PRODUIT

   POST /panier/produit
========================================================= */

router.post(
    "/produit",
    cart.addProduct
);


/* =========================================================
   AJOUTER FORMULE

   POST /panier/formule
========================================================= */

router.post(
    "/formule",
    cart.addFormula
);


/* =========================================================
   MODIFIER QUANTITE

   POST /panier/:itemId/quantite
========================================================= */

router.post(
    "/:itemId/quantite",
    cart.updateQuantity
);


/* =========================================================
   SUPPRIMER ARTICLE

   DELETE /panier/:itemId
========================================================= */

router.delete(
    "/:itemId",
    cart.removeItem
);


/* =========================================================
   VIDER PANIER

   DELETE /panier
========================================================= */

router.delete(
    "/",
    cart.clear
);


/* =========================================================
   EXPORT
========================================================= */

module.exports =
    router;