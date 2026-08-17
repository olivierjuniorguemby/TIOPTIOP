const crypto =
    require("crypto");

const db =
    require("../config/database");


/* =========================================================
   HELPERS
========================================================= */

function number(value) {

    const n =
        Number(value);

    return Number.isFinite(n)
        ? n
        : 0;
}


/* =========================================================
   CLIENT
========================================================= */

async function getCustomer(
    userId
) {

    const rows =
        await db.query(`
            SELECT
                u.id,
                u.email,
                u.phone,

                up.first_name,
                up.last_name,
                up.display_name,
                up.avatar_url

            FROM users u

            LEFT JOIN user_profiles up
                ON up.user_id = u.id

            WHERE u.id = ?
              AND u.status = 'ACTIVE'

            LIMIT 1
        `, [
            userId
        ]);


    return rows[0] || null;
}


/* =========================================================
   ADRESSES CLIENT
========================================================= */

async function getAddresses(
    userId
) {

    const rows =
        await db.query(`
            SELECT
                id,
                user_id,
                label,
                recipient_name,
                phone,
                address_line1,
                address_line2,
                district,
                city,
                country_code,
                latitude,
                longitude,
                delivery_instructions,
                is_default

            FROM user_addresses

            WHERE user_id = ?

            ORDER BY
                is_default DESC,
                id DESC
        `, [
            userId
        ]);


    return Array.isArray(rows)
        ? rows
        : [];
}


/* =========================================================
   ADRESSE CLIENT PAR ID
========================================================= */

async function getAddressById(
    userId,
    addressId
) {

    const rows =
        await db.query(`
            SELECT *
            FROM user_addresses

            WHERE id = ?
              AND user_id = ?

            LIMIT 1
        `, [
            addressId,
            userId
        ]);


    return rows[0] || null;
}


/* =========================================================
   RESTAURANTS OUVERTS
========================================================= */

async function getRestaurants() {

    const rows =
        await db.query(`
            SELECT
                id,
                code,
                name,
                address,
                district,
                city,

                supports_delivery,
                supports_pickup,
                supports_dine_in,

                status

            FROM restaurants

            WHERE status = 'OPEN'

            ORDER BY id ASC
        `);


    return Array.isArray(rows)
        ? rows
        : [];
}


/* =========================================================
   RESTAURANT
========================================================= */

async function getRestaurantById(
    restaurantId
) {

    const rows =
        await db.query(`
            SELECT *

            FROM restaurants

            WHERE id = ?
              AND status = 'OPEN'

            LIMIT 1
        `, [
            restaurantId
        ]);


    return rows[0] || null;
}


/* =========================================================
   ZONES DE LIVRAISON
========================================================= */

async function getDeliveryZones(
    restaurantId
) {

    const rows =
        await db.query(`
            SELECT
                id,
                restaurant_id,
                name,
                min_order,
                delivery_fee,
                free_delivery_from,
                estimated_min_minutes,
                estimated_max_minutes

            FROM delivery_zones

            WHERE restaurant_id = ?
              AND is_active = 1

            ORDER BY
                delivery_fee ASC,
                id ASC
        `, [
            restaurantId
        ]);


    return Array.isArray(rows)
        ? rows
        : [];
}


/* =========================================================
   ZONE
========================================================= */

async function getDeliveryZoneById(
    restaurantId,
    zoneId
) {

    const rows =
        await db.query(`
            SELECT *

            FROM delivery_zones

            WHERE id = ?
              AND restaurant_id = ?
              AND is_active = 1

            LIMIT 1
        `, [
            zoneId,
            restaurantId
        ]);


    return rows[0] || null;
}


/* =========================================================
   CALCUL FRAIS LIVRAISON
========================================================= */

function calculateDeliveryFee(
    subtotal,
    orderType,
    zone
) {

    if (
        orderType !== "DELIVERY"
    ) {
        return 0;
    }


    if (!zone) {
        return 0;
    }


    const freeFrom =
        zone.free_delivery_from !== null
        &&
        zone.free_delivery_from !== undefined

            ? number(
                zone.free_delivery_from
            )

            : null;


    if (
        freeFrom !== null
        &&
        subtotal >= freeFrom
    ) {

        return 0;
    }


    return number(
        zone.delivery_fee
    );
}


/* =========================================================
   REFERENCE COMMANDE
========================================================= */

async function generateUniqueReference() {

    while (true) {

        const now =
            Date.now()
                .toString()
                .slice(-8);


        const random =
            Math.floor(
                100 +
                Math.random() * 900
            );


        const reference =
            `TIOP-${now}${random}`;


        const rows =
            await db.query(`
                SELECT id
                FROM orders
                WHERE reference = ?
                LIMIT 1
            `, [
                reference
            ]);


        if (!rows.length) {

            return reference;
        }
    }
}


/* =========================================================
   COMMANDE PAR REFERENCE
========================================================= */

async function findByReference(
    reference,
    userId = null
) {

    let sql = `
        SELECT
            o.*,

            r.name AS restaurant_name,
            r.address AS restaurant_address,

            ua.label AS delivery_address_label,
            ua.recipient_name,
            ua.phone AS delivery_phone,
            ua.address_line1,
            ua.address_line2,
            ua.district,
            ua.city

        FROM orders o

        INNER JOIN restaurants r
            ON r.id = o.restaurant_id

        LEFT JOIN user_addresses ua
            ON ua.id = o.delivery_address_id

        WHERE o.reference = ?
    `;


    const params =
        [reference];


    if (userId) {

        sql += `
            AND o.user_id = ?
        `;

        params.push(
            userId
        );
    }


    sql += `
        LIMIT 1
    `;


    const rows =
        await db.query(
            sql,
            params
        );


    return rows[0] || null;
}


/* =========================================================
   ARTICLES COMMANDE
========================================================= */

async function getOrderItems(
    orderId
) {

    const items =
        await db.query(`
            SELECT *
            FROM order_items
            WHERE order_id = ?
            ORDER BY id ASC
        `, [
            orderId
        ]);


    for (
        const item
        of items
    ) {

        const options =
            await db.query(`
                SELECT *
                FROM order_item_options
                WHERE order_item_id = ?
                ORDER BY id ASC
            `, [
                item.id
            ]);


        item.options =
            options;
    }


    return items;
}


/* =========================================================
   CREATION COMMANDE TRANSACTIONNELLE

   cart doit être le panier détaillé
   provenant de Cart.getDetailedCart().
========================================================= */

async function createFromCart({
    userId,
    restaurantId,
    deliveryAddressId,
    deliveryZoneId,
    orderType,
    paymentMethod,
    customerNote,
    cart
}) {

    const connection =
        await db.pool.getConnection();


    try {

        await connection.beginTransaction();


        /* =================================================
           VALIDATION PANIER
        ================================================= */

        if (
            !cart ||
            !Array.isArray(cart.items) ||
            cart.items.length === 0
        ) {

            throw new Error(
                "Le panier est vide."
            );
        }


        /* =================================================
           RESTAURANT
        ================================================= */

        const [
            restaurantRows
        ] =
            await connection.execute(`
                SELECT *
                FROM restaurants

                WHERE id = ?
                  AND status = 'OPEN'

                LIMIT 1
            `, [
                restaurantId
            ]);


        const restaurant =
            restaurantRows[0];


        if (!restaurant) {

            throw new Error(
                "Restaurant indisponible."
            );
        }


        /* =================================================
           TYPE DE COMMANDE
        ================================================= */

        const allowedTypes =
            [
                "DELIVERY",
                "PICKUP",
                "DINE_IN"
            ];


        if (
            !allowedTypes.includes(
                orderType
            )
        ) {

            throw new Error(
                "Type de commande invalide."
            );
        }


        if (
            orderType === "DELIVERY"
            &&
            Number(
                restaurant.supports_delivery
            ) !== 1
        ) {

            throw new Error(
                "Ce restaurant ne propose pas la livraison."
            );
        }


        if (
            orderType === "PICKUP"
            &&
            Number(
                restaurant.supports_pickup
            ) !== 1
        ) {

            throw new Error(
                "Ce restaurant ne propose pas le retrait."
            );
        }


        if (
            orderType === "DINE_IN"
            &&
            Number(
                restaurant.supports_dine_in
            ) !== 1
        ) {

            throw new Error(
                "Ce restaurant ne propose pas le service sur place."
            );
        }


        /* =================================================
           ADRESSE
        ================================================= */

        let finalAddressId =
            null;


        if (
            orderType === "DELIVERY"
        ) {

            if (!deliveryAddressId) {

                throw new Error(
                    "Une adresse de livraison est obligatoire."
                );
            }


            const [
                addressRows
            ] =
                await connection.execute(`
                    SELECT id

                    FROM user_addresses

                    WHERE id = ?
                      AND user_id = ?

                    LIMIT 1
                `, [
                    deliveryAddressId,
                    userId
                ]);


            if (
                !addressRows.length
            ) {

                throw new Error(
                    "Adresse de livraison invalide."
                );
            }


            finalAddressId =
                Number(
                    deliveryAddressId
                );
        }


        /* =================================================
           SOUS-TOTAL

           SOURCE :
           panier recalculé côté serveur.
        ================================================= */

        const subtotal =
            number(
                cart.subtotal
            );


        /* =================================================
           ZONE
        ================================================= */

        let deliveryFee =
            0;


        if (
            orderType === "DELIVERY"
        ) {

            if (!deliveryZoneId) {

                throw new Error(
                    "Veuillez sélectionner une zone de livraison."
                );
            }


            const [
                zoneRows
            ] =
                await connection.execute(`
                    SELECT *

                    FROM delivery_zones

                    WHERE id = ?
                      AND restaurant_id = ?
                      AND is_active = 1

                    LIMIT 1
                `, [
                    deliveryZoneId,
                    restaurantId
                ]);


            const zone =
                zoneRows[0];


            if (!zone) {

                throw new Error(
                    "Zone de livraison invalide."
                );
            }


            const minOrder =
                number(
                    zone.min_order
                );


            if (
                subtotal <
                minOrder
            ) {

                throw new Error(
                    `Le minimum de commande pour cette zone est de ${minOrder} XAF.`
                );
            }


            deliveryFee =
                calculateDeliveryFee(
                    subtotal,
                    orderType,
                    zone
                );
        }


        /* =================================================
           TOTAL
        ================================================= */

        const discountAmount =
            0;


        const taxAmount =
            0;


        const totalAmount =
            subtotal
            -
            discountAmount
            +
            deliveryFee
            +
            taxAmount;


        /* =================================================
           REFERENCE
        ================================================= */

        const reference =
            await generateUniqueReference();


        const publicId =
            crypto.randomUUID();


        /* =================================================
           ORDER
        ================================================= */

        const [
            orderResult
        ] =
            await connection.execute(`
                INSERT INTO orders
                (
                    public_id,
                    reference,
                    user_id,
                    restaurant_id,
                    delivery_address_id,
                    order_type,
                    channel,
                    status,
                    subtotal,
                    discount_amount,
                    delivery_fee,
                    tax_amount,
                    total_amount,
                    currency,
                    customer_note
                )
                VALUES
                (
                    ?, ?, ?, ?, ?, ?,
                    'WEB',
                    'RECEIVED',
                    ?, ?, ?, ?, ?,
                    'XAF',
                    ?
                )
            `, [
                publicId,
                reference,
                userId,
                restaurantId,
                finalAddressId,
                orderType,

                subtotal,
                discountAmount,
                deliveryFee,
                taxAmount,
                totalAmount,

                customerNote || null
            ]);


        const orderId =
            orderResult.insertId;


        /* =================================================
           ARTICLES
        ================================================= */

        for (
            const item
            of cart.items
        ) {

            const productId =
                item.item_type === "PRODUCT"
                    ? item.product_id
                    : null;


            const formulaId =
                item.item_type === "FORMULA"
                    ? item.formula_id
                    : null;


            const unitPrice =
                number(
                    item.final_unit_price
                );


            const quantity =
                Number(
                    item.quantity
                );


            const lineTotal =
                unitPrice *
                quantity;


            const [
                itemResult
            ] =
                await connection.execute(`
                    INSERT INTO order_items
                    (
                        order_id,
                        product_id,
                        formula_id,
                        product_name,
                        unit_price,
                        quantity,
                        line_total,
                        notes
                    )
                    VALUES
                    (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    orderId,
                    productId,
                    formulaId,
                    item.item_name,
                    unitPrice,
                    quantity,
                    lineTotal,
                    item.instructions || null
                ]);


            const orderItemId =
                itemResult.insertId;


            /* =============================================
               OPTIONS
            ============================================= */

            for (
                const option
                of (
                    item.options || []
                )
            ) {

                await connection.execute(`
                    INSERT INTO order_item_options
                    (
                        order_item_id,
                        option_name,
                        option_value,
                        price_delta
                    )
                    VALUES (?, ?, ?, ?)
                `, [
                    orderItemId,

                    option.group_name
                    ||
                    "Option",

                    option.value_name
                    ||
                    "Choix",

                    number(
                        option.price_delta
                    )
                ]);
            }
        }


        /* =================================================
           HISTORIQUE
        ================================================= */

        await connection.execute(`
            INSERT INTO order_status_history
            (
                order_id,
                status,
                comment,
                changed_by_user_id
            )
            VALUES
            (
                ?,
                'RECEIVED',
                'Commande reçue depuis le site web',
                ?
            )
        `, [
            orderId,
            userId
        ]);


        /* =================================================
           PAIEMENT

           Aucun paiement réel à cette étape :
           tout commence en PENDING.
        ================================================= */

        const allowedPayments =
            [
                "CARD",
                "MOBILE_MONEY",
                "CASH"
            ];


        if (
            !allowedPayments.includes(
                paymentMethod
            )
        ) {

            throw new Error(
                "Moyen de paiement invalide."
            );
        }


        await connection.execute(`
            INSERT INTO payments
            (
                public_id,
                order_id,
                method,
                provider,
                status,
                amount,
                currency
            )
            VALUES
            (
                ?,
                ?,
                ?,
                NULL,
                'PENDING',
                ?,
                'XAF'
            )
        `, [
            crypto.randomUUID(),
            orderId,
            paymentMethod,
            totalAmount
        ]);


        /* =================================================
           PANIER CONVERTI

           On ne supprime PAS cart_items ici.
           Le panier passe simplement à CONVERTED.
           Le prochain ajout créera un nouveau panier actif.
        ================================================= */

        await connection.execute(`
            UPDATE carts

            SET status = 'CONVERTED'

            WHERE id = ?
        `, [
            cart.id
        ]);


        await connection.commit();


        return {
            orderId,
            publicId,
            reference,

            subtotal,
            deliveryFee,
            totalAmount
        };

    }
    catch (error) {

        await connection.rollback();

        throw error;
    }
    finally {

        connection.release();
    }
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

    getCustomer,

    getAddresses,
    getAddressById,

    getRestaurants,
    getRestaurantById,

    getDeliveryZones,
    getDeliveryZoneById,

    calculateDeliveryFee,

    findByReference,
    getOrderItems,

    createFromCart
};