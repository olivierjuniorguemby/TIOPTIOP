const crypto = require("crypto");

const Cart = require("../../models/cart.model");


/* =========================================================
   HELPERS
========================================================= */

/**
 * Retourne l'ID de l'utilisateur connecté.
 *
 * Compatible avec plusieurs structures de session
 * afin d'éviter de dépendre inutilement du nom exact
 * utilisé dans l'authentification.
 */
function getUserId(req) {

    if (req.session?.user?.id) {
        return Number(req.session.user.id);
    }

    if (req.session?.userId) {
        return Number(req.session.userId);
    }

    if (req.user?.id) {
        return Number(req.user.id);
    }

    return null;
}


/**
 * Génère / récupère le token du panier invité.
 *
 * Ce token reste dans la session Express.
 */
function getGuestToken(req) {

    if (!req.session) {
        throw new Error(
            "La session Express n'est pas disponible."
        );
    }


    if (!req.session.cartGuestToken) {

        req.session.cartGuestToken =
            crypto.randomUUID();
    }


    return req.session.cartGuestToken;
}


/**
 * Supprime le token invité après fusion.
 */
function clearGuestToken(req) {

    if (req.session) {
        delete req.session.cartGuestToken;
    }
}


/* =========================================================
   PANIER COURANT
========================================================= */

/**
 * Récupère ou crée le panier correspondant
 * à la personne actuellement devant le site.
 *
 * CONNECTE :
 * carts.user_id
 *
 * INVITE :
 * carts.guest_token
 */
async function getCurrentCart(req) {

    const userId =
        getUserId(req);


    /* -----------------------------------------------------
       CLIENT CONNECTE
    ----------------------------------------------------- */

    if (userId) {

        return await Cart.getOrCreateForUser(
            userId
        );
    }


    /* -----------------------------------------------------
       VISITEUR
    ----------------------------------------------------- */

    const guestToken =
        getGuestToken(req);


    return await Cart.getOrCreateForGuest(
        guestToken
    );
}


/* =========================================================
   REPONSE PANIER
========================================================= */

async function buildCartResponse(cartId) {

    const cart =
        await Cart.getDetailedCart(
            cartId
        );


    if (!cart) {

        return {
            items: [],
            total_quantity: 0,
            subtotal: 0
        };
    }


    return cart;
}


/* =========================================================
   GET /panier
========================================================= */

exports.index =
async function (
    req,
    res,
    next
) {

    try {

        const cart =
            await getCurrentCart(req);


        const detailedCart =
            await buildCartResponse(
                cart.id
            );


        return res.render(
            "client/orders/cart",
            {
                title:
                    "Mon panier",

                layout:
                    "layouts/client",

                cart:
                    detailedCart,

                items:
                    detailedCart.items || []
            }
        );

    }
    catch (error) {

        console.error(
            "Erreur chargement panier :",
            error
        );

        next(error);
    }
};


/* =========================================================
   GET /panier/data

   Utilisé plus tard par JavaScript pour actualiser
   le compteur du header.
========================================================= */

exports.data =
async function (
    req,
    res
) {

    try {

        const cart =
            await getCurrentCart(req);


        const detailedCart =
            await buildCartResponse(
                cart.id
            );


        return res.json({
            success: true,
            cart: detailedCart
        });

    }
    catch (error) {

        console.error(
            "Erreur récupération panier :",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Impossible de récupérer le panier."
        });
    }
};


/* =========================================================
   POST /panier/produit

   AJOUT PRODUIT SIMPLE OU PERSONNALISE
========================================================= */

/* =========================================================
   POST /panier/produit
========================================================= */

exports.addProduct =
async function (
    req,
    res
) {

    try {

        /* =================================================
           PRODUIT
        ================================================= */

        const productId =
            Number(
                req.body.product_id
            );


        let quantity =
            Number(
                req.body.quantity || 1
            );


        const instructions =
            String(
                req.body.instructions || ""
            )
                .trim()
                .slice(0, 2000);


        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {

            return res.status(400).json({
                success: false,
                message: "Produit invalide."
            });
        }


        if (
            !Number.isInteger(quantity) ||
            quantity < 1
        ) {

            quantity = 1;
        }


        if (quantity > 99) {

            quantity = 99;
        }


        const product =
            await Cart.findProduct(
                productId
            );


        if (!product) {

            return res.status(404).json({
                success: false,
                message: "Produit introuvable."
            });
        }


        if (
            Number(product.is_active) !== 1
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Ce produit n'est pas disponible."
            });
        }


        /* =================================================
           OPTIONS RECUES
        ================================================= */

        let optionValueIds =
            req.body.option_value_ids || [];


        if (
            !Array.isArray(optionValueIds)
        ) {

            optionValueIds =
                [optionValueIds];
        }


        optionValueIds =
            optionValueIds
                .map(value =>
                    Number(value)
                )
                .filter(value =>
                    Number.isInteger(value) &&
                    value > 0
                );


        /*
         * Supprimer les doublons.
         */

        optionValueIds =
            [
                ...new Set(
                    optionValueIds
                )
            ];


        /* =================================================
   OPTIONS SELECTIONNEES

   IMPORTANT :
   - Home/Menu peuvent ajouter sans option.
   - /produit/:id peut envoyer les options choisies.
================================================= */

const validOptions = [];


for (
    const optionValueId
    of optionValueIds
) {

    const option =
        await Cart.findOptionValue(
            product.id,
            optionValueId
        );


    if (!option) {

        return res.status(400).json({
            success: false,
            message:
                "Une option sélectionnée est invalide."
        });
    }


    validOptions.push(
        option
    );
}


        /* =================================================
           PANIER
        ================================================= */

        const cart =
            await getCurrentCart(
                req
            );


        /* =================================================
           LIGNE PRODUIT
        ================================================= */

        const cartItemId =
            await Cart.createProductItem({

                cartId:
                    cart.id,

                productId:
                    product.id,

                quantity,

                unitPrice:
                    Number(
                        product.price
                    ),

                instructions:
                    instructions || null
            });


        /* =================================================
           OPTIONS
        ================================================= */

        for (
            const option
            of validOptions
        ) {

            await Cart.addItemOption({

                cartItemId,

                optionGroupId:
                    option.option_group_id,

                optionValueId:
                    option.id,

                priceDelta:
                    Number(
                        option.price_delta || 0
                    )
            });
        }


        /* =================================================
           PANIER ACTUALISE
        ================================================= */

        const detailedCart =
            await buildCartResponse(
                cart.id
            );


        return res.status(201).json({

            success: true,

            message:
                "Produit ajouté au panier.",

            cart:
                detailedCart,

            cart_count:
                detailedCart.total_quantity,

            subtotal:
                detailedCart.subtotal
        });

    }
    catch (error) {

        console.error(
            "Erreur ajout produit panier :",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Impossible d'ajouter le produit au panier."
        });
    }
};


/* =========================================================
   POST /panier/formule

   AJOUT FORMULE
========================================================= */

exports.addFormula =
async function (
    req,
    res
) {

    try {

        const formulaId =
            Number(
                req.body.formula_id
            );


        let quantity =
            Number(
                req.body.quantity || 1
            );


        if (
            !Number.isInteger(formulaId) ||
            formulaId <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Formule invalide."
            });
        }


        if (
            !Number.isInteger(quantity) ||
            quantity < 1
        ) {
            quantity = 1;
        }


        if (quantity > 99) {
            quantity = 99;
        }


        /* -------------------------------------------------
           FORMULE MYSQL
        ------------------------------------------------- */

        const formula =
            await Cart.findFormula(
                formulaId
            );


        if (!formula) {

            return res.status(404).json({
                success: false,
                message:
                    "Formule introuvable."
            });
        }


        if (
            Number(formula.is_active) !== 1
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Cette formule n'est pas disponible."
            });
        }


        /* -------------------------------------------------
           PANIER
        ------------------------------------------------- */

        const cart =
            await getCurrentCart(req);


        /* -------------------------------------------------
           CREATION
        ------------------------------------------------- */

        await Cart.createFormulaItem({

            cartId:
                cart.id,

            formulaId:
                formula.id,

            quantity,

            unitPrice:
                Number(formula.price)
        });


        /* -------------------------------------------------
           PANIER ACTUALISE
        ------------------------------------------------- */

        const detailedCart =
            await buildCartResponse(
                cart.id
            );


        return res.status(201).json({

            success: true,

            message:
                "Formule ajoutée au panier.",

            cart:
                detailedCart,

            cart_count:
                detailedCart.total_quantity,

            subtotal:
                detailedCart.subtotal
        });

    }
    catch (error) {

        console.error(
            "Erreur ajout formule panier :",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Impossible d'ajouter la formule au panier."
        });
    }
};


/* =========================================================
   POST /panier/:itemId/quantite
========================================================= */

exports.updateQuantity =
async function (
    req,
    res
) {

    try {

        const itemId =
            Number(
                req.params.itemId
            );


        const quantity =
            Number(
                req.body.quantity
            );


        if (
            !Number.isInteger(itemId) ||
            itemId <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Article invalide."
            });
        }


        if (
            !Number.isInteger(quantity) ||
            quantity < 1 ||
            quantity > 99
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "La quantité doit être comprise entre 1 et 99."
            });
        }


        const cart =
            await getCurrentCart(req);


        const item =
            await Cart.findItemById(
                cart.id,
                itemId
            );


        if (!item) {

            return res.status(404).json({
                success: false,
                message:
                    "Article introuvable dans le panier."
            });
        }


        await Cart.updateQuantity(
            cart.id,
            itemId,
            quantity
        );


        const detailedCart =
            await buildCartResponse(
                cart.id
            );


        return res.json({

            success: true,

            message:
                "Quantité mise à jour.",

            cart:
                detailedCart,

            cart_count:
                detailedCart.total_quantity,

            subtotal:
                detailedCart.subtotal
        });

    }
    catch (error) {

        console.error(
            "Erreur modification quantité :",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Impossible de modifier la quantité."
        });
    }
};


/* =========================================================
   DELETE /panier/:itemId
========================================================= */

exports.removeItem =
async function (
    req,
    res
) {

    try {

        const itemId =
            Number(
                req.params.itemId
            );


        if (
            !Number.isInteger(itemId) ||
            itemId <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Article invalide."
            });
        }


        const cart =
            await getCurrentCart(req);


        const item =
            await Cart.findItemById(
                cart.id,
                itemId
            );


        if (!item) {

            return res.status(404).json({
                success: false,
                message:
                    "Article introuvable."
            });
        }


        await Cart.removeItem(
            cart.id,
            itemId
        );


        const detailedCart =
            await buildCartResponse(
                cart.id
            );


        return res.json({

            success: true,

            message:
                "Article supprimé du panier.",

            cart:
                detailedCart,

            cart_count:
                detailedCart.total_quantity,

            subtotal:
                detailedCart.subtotal
        });

    }
    catch (error) {

        console.error(
            "Erreur suppression article panier :",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Impossible de supprimer l'article."
        });
    }
};


/* =========================================================
   DELETE /panier
========================================================= */

exports.clear =
async function (
    req,
    res
) {

    try {

        const cart =
            await getCurrentCart(req);


        await Cart.clearCart(
            cart.id
        );


        return res.json({

            success: true,

            message:
                "Le panier a été vidé.",

            cart_count: 0,

            subtotal: 0
        });

    }
    catch (error) {

        console.error(
            "Erreur vidage panier :",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Impossible de vider le panier."
        });
    }
};


/* =========================================================
   FUSION APRES CONNEXION

   Cette fonction ne sera PAS une route publique.

   Elle sera appelée par auth.controller.js
   après une authentification réussie.
========================================================= */

exports.mergeAfterLogin =
async function (
    req,
    userId
) {

    try {

        if (!userId) {
            return null;
        }


        const guestToken =
            req.session?.cartGuestToken;


        /*
            Aucun panier invité.
        */

        if (!guestToken) {

            return await Cart.getOrCreateForUser(
                userId
            );
        }


        const cart =
            await Cart.mergeGuestCartIntoUser(
                guestToken,
                userId
            );


        clearGuestToken(req);


        return cart;

    }
    catch (error) {

        console.error(
            "Erreur fusion panier après connexion :",
            error
        );

        throw error;
    }
};


/* =========================================================
   HELPERS EXPORTES

   Ils seront utiles pour middleware/header/auth.
========================================================= */

exports.getCurrentCart =
    getCurrentCart;

exports.getUserId =
    getUserId;

exports.getGuestToken =
    getGuestToken;