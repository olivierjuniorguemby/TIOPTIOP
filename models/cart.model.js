const db = require("../config/database");


/* =========================================================
   HELPERS
========================================================= */

function normalizeRows(result) {
    return Array.isArray(result)
        ? result
        : [];
}


function toNumber(value) {

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
}


/* =========================================================
   TROUVER LE PANIER ACTIF D'UN UTILISATEUR
========================================================= */

async function findActiveByUserId(userId) {

    const rows = await db.query(`
        SELECT *
        FROM carts
        WHERE user_id = ?
          AND status = 'ACTIVE'
        ORDER BY id DESC
        LIMIT 1
    `, [
        userId
    ]);

    return rows[0] || null;
}


/* =========================================================
   TROUVER LE PANIER ACTIF D'UN VISITEUR
========================================================= */

async function findActiveByGuestToken(guestToken) {

    if (!guestToken) {
        return null;
    }

    const rows = await db.query(`
        SELECT *
        FROM carts
        WHERE guest_token = ?
          AND status = 'ACTIVE'
        ORDER BY id DESC
        LIMIT 1
    `, [
        guestToken
    ]);

    return rows[0] || null;
}


/* =========================================================
   CREER PANIER CLIENT
========================================================= */

async function createForUser(userId) {

    const result = await db.query(`
        INSERT INTO carts
        (
            user_id,
            guest_token,
            status
        )
        VALUES (?, NULL, 'ACTIVE')
    `, [
        userId
    ]);

    return result.insertId;
}


/* =========================================================
   CREER PANIER INVITE
========================================================= */

async function createForGuest(guestToken) {

    const result = await db.query(`
        INSERT INTO carts
        (
            user_id,
            guest_token,
            status
        )
        VALUES (NULL, ?, 'ACTIVE')
    `, [
        guestToken
    ]);

    return result.insertId;
}


/* =========================================================
   RECUPERER / CREER PANIER UTILISATEUR
========================================================= */

async function getOrCreateForUser(userId) {

    let cart =
        await findActiveByUserId(userId);

    if (cart) {
        return cart;
    }

    const cartId =
        await createForUser(userId);

    return await findById(cartId);
}


/* =========================================================
   RECUPERER / CREER PANIER INVITE
========================================================= */

async function getOrCreateForGuest(guestToken) {

    let cart =
        await findActiveByGuestToken(
            guestToken
        );

    if (cart) {
        return cart;
    }

    const cartId =
        await createForGuest(
            guestToken
        );

    return await findById(cartId);
}


/* =========================================================
   PANIER PAR ID
========================================================= */

async function findById(cartId) {

    const rows = await db.query(`
        SELECT *
        FROM carts
        WHERE id = ?
        LIMIT 1
    `, [
        cartId
    ]);

    return rows[0] || null;
}


/* =========================================================
   PRODUIT
========================================================= */

async function findProduct(productId) {

    const rows = await db.query(`
        SELECT
            id,
            name,
            slug,
            price,
            compare_at_price,
            currency,
            is_active
        FROM products
        WHERE id = ?
        LIMIT 1
    `, [
        productId
    ]);

    return rows[0] || null;
}


/* =========================================================
   FORMULE
========================================================= */

async function findFormula(formulaId) {

    const rows = await db.query(`
        SELECT
            id,
            name,
            slug,
            price,
            compare_at_price,
            currency,
            is_active
        FROM formulas
        WHERE id = ?
        LIMIT 1
    `, [
        formulaId
    ]);

    return rows[0] || null;
}


/* =========================================================
   VALEUR OPTION PRODUIT

   IMPORTANT :
   Le prix vient de MySQL.
========================================================= */

/* =========================================================
   TROUVER UNE OPTION POUR UN PRODUIT

   IMPORTANT :
   L'étape 7 admin utilise product_options.
   Le panier utilise donc exactement la même table.
========================================================= */

async function findOptionValue(
    productId,
    optionValueId
) {

    const rows = await db.query(`
        SELECT
            pov.id,
            pov.option_group_id,
            pov.name,
            pov.price_delta,
            pov.is_default,
            pov.is_active,
            pov.position,

            pog.product_id,
            pog.name AS group_name,
            pog.selection_type,
            pog.is_required,
            pog.min_choices,
            pog.max_choices

        FROM product_options pov

        INNER JOIN product_option_groups pog
            ON pog.id = pov.option_group_id

        WHERE pov.id = ?
          AND pog.product_id = ?
          AND pov.is_active = 1
          AND pog.is_active = 1

        LIMIT 1
    `, [
        optionValueId,
        productId
    ]);

    return rows[0] || null;
}


/* =========================================================
   CREER UNE LIGNE PRODUIT
========================================================= */

async function createProductItem({
    cartId,
    productId,
    quantity,
    unitPrice,
    instructions
}) {

    const result = await db.query(`
        INSERT INTO cart_items
        (
            cart_id,
            item_type,
            product_id,
            formula_id,
            quantity,
            unit_price,
            instructions
        )
        VALUES (
            ?,
            'PRODUCT',
            ?,
            NULL,
            ?,
            ?,
            ?
        )
    `, [
        cartId,
        productId,
        quantity,
        unitPrice,
        instructions || null
    ]);

    return result.insertId;
}


/* =========================================================
   CREER UNE LIGNE FORMULE
========================================================= */

async function createFormulaItem({
    cartId,
    formulaId,
    quantity,
    unitPrice,
    instructions = null
}) {

    const result = await db.query(`
        INSERT INTO cart_items
        (
            cart_id,
            item_type,
            product_id,
            formula_id,
            quantity,
            unit_price,
            instructions
        )
        VALUES (
            ?,
            'FORMULA',
            NULL,
            ?,
            ?,
            ?,
            ?
        )
    `, [
        cartId,
        formulaId,
        quantity,
        unitPrice,
        instructions
    ]);

    return result.insertId;
}


/* =========================================================
   AJOUTER UNE OPTION A UNE LIGNE PANIER
========================================================= */

async function addItemOption({
    cartItemId,
    optionGroupId,
    optionValueId,
    priceDelta = 0
}) {

    const result = await db.query(`
        INSERT INTO cart_item_options
        (
            cart_item_id,
            option_group_id,
            option_value_id,
            price_delta
        )
        VALUES (?, ?, ?, ?)
    `, [
        cartItemId,
        optionGroupId,
        optionValueId,
        Number(priceDelta || 0)
    ]);

    return result.insertId;
}


/* =========================================================
   LIGNES DU PANIER

   Produit et formule dans la même requête.
========================================================= */

async function getItems(cartId) {

    const rows = await db.query(`
        SELECT

            ci.id,
            ci.cart_id,
            ci.item_type,
            ci.product_id,
            ci.formula_id,
            ci.quantity,
            ci.unit_price,
            ci.instructions,
            ci.created_at,
            ci.updated_at,

            CASE
                WHEN ci.item_type = 'PRODUCT'
                    THEN p.name
                WHEN ci.item_type = 'FORMULA'
                    THEN f.name
            END AS item_name,

            CASE
                WHEN ci.item_type = 'PRODUCT'
                    THEN p.currency
                WHEN ci.item_type = 'FORMULA'
                    THEN f.currency
            END AS currency,

            CASE
                WHEN ci.item_type = 'PRODUCT'
                THEN (
                    SELECT pi.image_url
                    FROM product_images pi
                    WHERE pi.product_id = p.id
                    ORDER BY
                        pi.is_primary DESC,
                        pi.position ASC,
                        pi.id ASC
                    LIMIT 1
                )

                WHEN ci.item_type = 'FORMULA'
                THEN (
                    SELECT fi.image_url
                    FROM formula_images fi
                    WHERE fi.formula_id = f.id
                    ORDER BY
                        fi.is_primary DESC,
                        fi.position ASC,
                        fi.id ASC
                    LIMIT 1
                )
            END AS image_url

        FROM cart_items ci

        LEFT JOIN products p
            ON p.id = ci.product_id

        LEFT JOIN formulas f
            ON f.id = ci.formula_id

        WHERE ci.cart_id = ?

        ORDER BY
            ci.created_at ASC,
            ci.id ASC
    `, [
        cartId
    ]);

    return normalizeRows(rows);
}


/* =========================================================
   OPTIONS D'UNE LIGNE PANIER
========================================================= */

async function getItemOptions(
    cartItemId
) {

    const rows = await db.query(`
        SELECT
            cio.id,
            cio.cart_item_id,
            cio.option_group_id,
            cio.option_value_id,
            cio.price_delta,

            pog.name AS group_name,

            pov.name AS value_name

        FROM cart_item_options cio

        LEFT JOIN product_option_groups pog
            ON pog.id = cio.option_group_id

        LEFT JOIN product_options pov
            ON pov.id = cio.option_value_id

        WHERE cio.cart_item_id = ?

        ORDER BY
            pog.position ASC,
            pov.position ASC,
            cio.id ASC
    `, [
        cartItemId
    ]);

    return Array.isArray(rows)
        ? rows
        : [];
}


/* =========================================================
   PANIER COMPLET
========================================================= */

async function getDetailedCart(cartId) {

    const cart =
        await findById(cartId);

    if (!cart) {
        return null;
    }


    const items =
        await getItems(cartId);


    let subtotal = 0;
    let totalQuantity = 0;


    for (const item of items) {

        const options =
            await getItemOptions(item.id);

        item.options = options;


        const optionsTotal =
            options.reduce(
                (
                    total,
                    option
                ) => {

                    return (
                        total +
                        toNumber(
                            option.price_delta
                        )
                    );

                },
                0
            );


        item.options_total =
            optionsTotal;


        item.final_unit_price =
            toNumber(item.unit_price) +
            optionsTotal;


        item.line_total =
            item.final_unit_price *
            Number(item.quantity);


        subtotal +=
            item.line_total;


        totalQuantity +=
            Number(item.quantity);
    }


    return {

        ...cart,

        items,

        total_quantity:
            totalQuantity,

        subtotal:
            subtotal
    };
}


/* =========================================================
   LIGNE PAR ID
========================================================= */

async function findItemById(
    cartId,
    itemId
) {

    const rows = await db.query(`
        SELECT *
        FROM cart_items
        WHERE id = ?
          AND cart_id = ?
        LIMIT 1
    `, [
        itemId,
        cartId
    ]);

    return rows[0] || null;
}


/* =========================================================
   QUANTITE
========================================================= */

async function updateQuantity(
    cartId,
    itemId,
    quantity
) {

    return await db.query(`
        UPDATE cart_items
        SET quantity = ?
        WHERE id = ?
          AND cart_id = ?
    `, [
        quantity,
        itemId,
        cartId
    ]);
}


/* =========================================================
   SUPPRIMER UNE LIGNE
========================================================= */

async function removeItem(
    cartId,
    itemId
) {

    /*
        cart_item_options sera supprimé automatiquement
        grâce au ON DELETE CASCADE.
    */

    return await db.query(`
        DELETE FROM cart_items
        WHERE id = ?
          AND cart_id = ?
    `, [
        itemId,
        cartId
    ]);
}


/* =========================================================
   VIDER PANIER
========================================================= */

async function clearCart(cartId) {

    return await db.query(`
        DELETE FROM cart_items
        WHERE cart_id = ?
    `, [
        cartId
    ]);
}


/* =========================================================
   COMPTEUR PANIER
========================================================= */

async function countItems(cartId) {

    const rows = await db.query(`
        SELECT
            COALESCE(
                SUM(quantity),
                0
            ) AS total

        FROM cart_items

        WHERE cart_id = ?
    `, [
        cartId
    ]);

    return Number(
        rows[0]?.total || 0
    );
}


/* =========================================================
   TRANSFERER PANIER GUEST VERS USER

   Utilisé après connexion.
========================================================= */

async function attachGuestCartToUser(
    cartId,
    userId
) {

    return await db.query(`
        UPDATE carts

        SET
            user_id = ?,
            guest_token = NULL

        WHERE id = ?
          AND status = 'ACTIVE'
    `, [
        userId,
        cartId
    ]);
}


/* =========================================================
   DEPLACER LES ARTICLES D'UN PANIER VERS UN AUTRE
========================================================= */

async function moveItems(
    sourceCartId,
    destinationCartId
) {

    return await db.query(`
        UPDATE cart_items

        SET cart_id = ?

        WHERE cart_id = ?
    `, [
        destinationCartId,
        sourceCartId
    ]);
}


/* =========================================================
   MARQUER PANIER ABANDONNE
========================================================= */

async function markAbandoned(cartId) {

    return await db.query(`
        UPDATE carts

        SET status = 'ABANDONED'

        WHERE id = ?
    `, [
        cartId
    ]);
}


/* =========================================================
   MARQUER PANIER CONVERTI
========================================================= */

async function markConverted(cartId) {

    return await db.query(`
        UPDATE carts

        SET status = 'CONVERTED'

        WHERE id = ?
    `, [
        cartId
    ]);
}


/* =========================================================
   FUSION PANIER GUEST -> CLIENT
========================================================= */

async function mergeGuestCartIntoUser(
    guestToken,
    userId
) {

    if (
        !guestToken ||
        !userId
    ) {
        return null;
    }


    const guestCart =
        await findActiveByGuestToken(
            guestToken
        );


    /*
        Aucun panier invité.
    */
    if (!guestCart) {

        return await getOrCreateForUser(
            userId
        );
    }


    const userCart =
        await findActiveByUserId(
            userId
        );


    /*
        L'utilisateur ne possède encore
        aucun panier.

        Le panier invité devient directement
        son panier.
    */
    if (!userCart) {

        await attachGuestCartToUser(
            guestCart.id,
            userId
        );

        return await findById(
            guestCart.id
        );
    }


    /*
        Le client possède déjà un panier.

        On déplace les lignes du panier invité
        dans son panier existant.
    */

    await moveItems(
        guestCart.id,
        userCart.id
    );


    await markAbandoned(
        guestCart.id
    );


    return await findById(
        userCart.id
    );
}

/* =========================================================
   REGLES DES GROUPES D'OPTIONS D'UN PRODUIT
========================================================= */

async function getProductOptionRules(productId) {

    const rows = await db.query(`
        SELECT
            id,
            product_id,
            name,
            selection_type,
            is_required,
            min_choices,
            max_choices,
            position,
            is_active

        FROM product_option_groups

        WHERE product_id = ?
          AND is_active = 1

        ORDER BY
            position ASC,
            id ASC
    `, [
        productId
    ]);

    return Array.isArray(rows)
        ? rows
        : [];
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

    findById,

    findActiveByUserId,
    findActiveByGuestToken,

    createForUser,
    createForGuest,

    getOrCreateForUser,
    getOrCreateForGuest,

    findProduct,
    findFormula,
    findOptionValue,

    createProductItem,
    createFormulaItem,
    addItemOption,

    getItems,
    getItemOptions,
    getDetailedCart,

    findItemById,

    updateQuantity,
    removeItem,
    clearCart,

    countItems,

    attachGuestCartToUser,
    moveItems,
    markAbandoned,
    markConverted,

    mergeGuestCartIntoUser,

    getProductOptionRules,
};