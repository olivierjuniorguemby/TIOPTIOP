const crypto = require("crypto");
const db = require("../config/database");


/* =========================================================
   HELPERS
========================================================= */

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}


function createReference() {
    /*
     * Référence lisible + suffixe aléatoire.
     * La contrainte UNIQUE de orders.reference reste
     * la dernière protection contre une collision.
     */
    const date = new Date();

    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");

    const random =
        crypto
            .randomBytes(4)
            .toString("hex")
            .toUpperCase();

    return `TIOP-${yyyy}${mm}${dd}-${random}`;
}


/* =========================================================
   CLIENT
========================================================= */

async function getCustomer(userId) {

    const rows = await db.query(`
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
    `, [userId]);

    return rows[0] || null;
}


/* =========================================================
   ADRESSES
========================================================= */

async function getAddresses(userId) {

    const rows = await db.query(`
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
            is_default,
            created_at

        FROM user_addresses

        WHERE user_id = ?

        ORDER BY
            is_default DESC,
            id DESC
    `, [userId]);

    return Array.isArray(rows)
        ? rows
        : [];
}


async function getAddressById(userId, addressId) {

    const rows = await db.query(`
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
   RESTAURANTS
========================================================= */

async function getRestaurants() {

    const rows = await db.query(`
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


async function getRestaurantById(restaurantId) {

    const rows = await db.query(`
        SELECT *
        FROM restaurants
        WHERE id = ?
          AND status = 'OPEN'
        LIMIT 1
    `, [restaurantId]);

    return rows[0] || null;
}


/* =========================================================
   ZONES DE LIVRAISON
========================================================= */

async function getDeliveryZones(restaurantId) {

    const rows = await db.query(`
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
    `, [restaurantId]);

    return Array.isArray(rows)
        ? rows
        : [];
}


async function getDeliveryZoneById(
    restaurantId,
    zoneId
) {

    const rows = await db.query(`
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
   CALCUL LIVRAISON
========================================================= */

function calculateDeliveryFee(
    subtotal,
    orderType,
    zone
) {

    if (orderType !== "DELIVERY") {
        return 0;
    }

    if (!zone) {
        return 0;
    }

    const freeFrom =
        zone.free_delivery_from !== null &&
        zone.free_delivery_from !== undefined
            ? toNumber(zone.free_delivery_from)
            : null;

    if (
        freeFrom !== null &&
        subtotal >= freeFrom
    ) {
        return 0;
    }

    return toNumber(
        zone.delivery_fee
    );
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
            r.district AS restaurant_district,
            r.city AS restaurant_city,
            r.phone AS restaurant_phone,

            ua.label AS delivery_address_label,
            ua.recipient_name,
            ua.phone AS delivery_phone,
            ua.address_line1,
            ua.address_line2,
            ua.district AS delivery_district,
            ua.city AS delivery_city,
            ua.country_code AS delivery_country_code,
            ua.delivery_instructions

        FROM orders o

        INNER JOIN restaurants r
            ON r.id = o.restaurant_id

        LEFT JOIN user_addresses ua
            ON ua.id = o.delivery_address_id

        WHERE o.reference = ?
    `;

    const params = [reference];

    if (userId !== null) {

        sql += `
            AND o.user_id = ?
        `;

        params.push(userId);
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

async function getOrderItems(orderId) {

    const items = await db.query(`
        SELECT
            oi.id,
            oi.order_id,
            oi.product_id,
            oi.formula_id,
            oi.product_name,
            oi.unit_price,
            oi.quantity,
            oi.line_total,
            oi.notes,

            CASE
                WHEN oi.product_id IS NOT NULL
                THEN (
                    SELECT pi.image_url
                    FROM product_images pi
                    WHERE pi.product_id = oi.product_id
                    ORDER BY
                        pi.is_primary DESC,
                        pi.position ASC,
                        pi.id ASC
                    LIMIT 1
                )

                WHEN oi.formula_id IS NOT NULL
                THEN (
                    SELECT fi.image_url
                    FROM formula_images fi
                    WHERE fi.formula_id = oi.formula_id
                    ORDER BY
                        fi.is_primary DESC,
                        fi.position ASC,
                        fi.id ASC
                    LIMIT 1
                )
            END AS image_url

        FROM order_items oi

        WHERE oi.order_id = ?

        ORDER BY oi.id ASC
    `, [orderId]);


    for (const item of items) {

        item.options = await db.query(`
            SELECT
                id,
                order_item_id,
                option_name,
                option_value,
                price_delta

            FROM order_item_options

            WHERE order_item_id = ?

            ORDER BY id ASC
        `, [item.id]);
    }

    return items;
}


/* =========================================================
   PAIEMENT
========================================================= */

async function getPaymentByOrderId(orderId) {

    const rows = await db.query(`
        SELECT
            id,
            public_id,
            order_id,
            method,
            provider,
            status,
            amount,
            currency,
            provider_reference,
            paid_at,
            created_at,
            updated_at

        FROM payments

        WHERE order_id = ?

        ORDER BY id DESC
        LIMIT 1
    `, [orderId]);

    return rows[0] || null;
}


/* =========================================================
   HISTORIQUE
========================================================= */

async function getStatusHistory(orderId) {

    const rows = await db.query(`
        SELECT
            id,
            order_id,
            status,
            comment,
            changed_by_user_id,
            changed_by_admin_user_id,
            created_at

        FROM order_status_history

        WHERE order_id = ?

        ORDER BY
            created_at ASC,
            id ASC
    `, [orderId]);

    return Array.isArray(rows)
        ? rows
        : [];
}


/* =========================================================
   CREATION TRANSACTIONNELLE
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
           PANIER : VERROU + ANTI DOUBLE-COMMANDE
        ================================================= */

        if (
            !cart ||
            !cart.id ||
            !Array.isArray(cart.items) ||
            cart.items.length === 0
        ) {

            throw new Error(
                "Le panier est vide."
            );
        }


        const [
            lockedCartRows
        ] = await connection.execute(`
            SELECT
                id,
                user_id,
                status
            FROM carts
            WHERE id = ?
              AND user_id = ?
            LIMIT 1
            FOR UPDATE
        `, [
            cart.id,
            userId
        ]);


        const lockedCart =
            lockedCartRows[0];


        if (!lockedCart) {

            throw new Error(
                "Panier introuvable."
            );
        }


        if (
            lockedCart.status !== "ACTIVE"
        ) {

            throw new Error(
                "Ce panier a déjà été utilisé pour une commande."
            );
        }


        /* =================================================
           RESTAURANT
        ================================================= */

        const [
            restaurantRows
        ] = await connection.execute(`
            SELECT *
            FROM restaurants
            WHERE id = ?
              AND status = 'OPEN'
            LIMIT 1
        `, [restaurantId]);


        const restaurant =
            restaurantRows[0];


        if (!restaurant) {

            throw new Error(
                "Restaurant indisponible."
            );
        }


        /* =================================================
           TYPE COMMANDE
        ================================================= */

        const allowedTypes = [
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
            orderType === "DELIVERY" &&
            Number(
                restaurant.supports_delivery
            ) !== 1
        ) {

            throw new Error(
                "Ce restaurant ne propose pas la livraison."
            );
        }


        if (
            orderType === "PICKUP" &&
            Number(
                restaurant.supports_pickup
            ) !== 1
        ) {

            throw new Error(
                "Ce restaurant ne propose pas le retrait."
            );
        }


        if (
            orderType === "DINE_IN" &&
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
            ] = await connection.execute(`
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
        ================================================= */

        const subtotal =
            toNumber(
                cart.subtotal
            );


        if (
            subtotal <= 0
        ) {

            throw new Error(
                "Le montant du panier est invalide."
            );
        }


        /* =================================================
           ZONE + FRAIS
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
            ] = await connection.execute(`
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
                toNumber(
                    zone.min_order
                );


            if (
                subtotal < minOrder
            ) {

                throw new Error(
                    `Le minimum de commande pour cette zone est de ${minOrder.toLocaleString("fr-FR")} XAF.`
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
           TOTALS
        ================================================= */

        const discountAmount = 0;
        const taxAmount = 0;

        const totalAmount =
            subtotal
            -
            discountAmount
            +
            deliveryFee
            +
            taxAmount;


        /* =================================================
           PAIEMENT
        ================================================= */

        const allowedPayments = [
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


        /* =================================================
           ORDER
        ================================================= */

        const publicId =
            crypto.randomUUID();

        const reference =
            createReference();


        const [
            orderResult
        ] = await connection.execute(`
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
           ORDER ITEMS + OPTIONS SNAPSHOT
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


            const quantity =
                Number(
                    item.quantity
                );


            if (
                !Number.isInteger(quantity) ||
                quantity <= 0
            ) {

                throw new Error(
                    "Quantité d'article invalide."
                );
            }


            const unitPrice =
                toNumber(
                    item.final_unit_price
                );


            const lineTotal =
                unitPrice *
                quantity;


            const [
                itemResult
            ] = await connection.execute(`
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

                    toNumber(
                        option.price_delta
                    )
                ]);
            }
        }


        /* =================================================
           HISTORIQUE INITIAL
        ================================================= */

        await connection.execute(`
            INSERT INTO order_status_history
            (
                order_id,
                status,
                comment,
                changed_by_user_id,
                changed_by_admin_user_id
            )
            VALUES
            (
                ?,
                'RECEIVED',
                'Commande reçue depuis le site web',
                ?,
                NULL
            )
        `, [
            orderId,
            userId
        ]);


        /* =================================================
           PAIEMENT INITIAL
        ================================================= */

        const paymentPublicId =
            crypto.randomUUID();


        const [
            paymentResult
        ] = await connection.execute(`
            INSERT INTO payments
            (
                public_id,
                order_id,
                method,
                provider,
                status,
                amount,
                currency,
                provider_reference,
                paid_at
            )
            VALUES
            (
                ?,
                ?,
                ?,
                NULL,
                'PENDING',
                ?,
                'XAF',
                NULL,
                NULL
            )
        `, [
            paymentPublicId,
            orderId,
            paymentMethod,
            totalAmount
        ]);


        /* =================================================
           PANIER CONVERTI
        ================================================= */

        const [
            convertResult
        ] = await connection.execute(`
            UPDATE carts
            SET status = 'CONVERTED'
            WHERE id = ?
              AND user_id = ?
              AND status = 'ACTIVE'
        `, [
            cart.id,
            userId
        ]);


        if (
            convertResult.affectedRows !== 1
        ) {

            throw new Error(
                "Impossible de convertir le panier."
            );
        }


        await connection.commit();


        return {
            orderId,
            publicId,
            reference,

            paymentId:
                paymentResult.insertId,

            paymentPublicId,

            paymentStatus:
                "PENDING",

            subtotal,
            deliveryFee,
            discountAmount,
            taxAmount,
            totalAmount,
            currency:
                "XAF"
        };

    }
    catch (error) {

        try {
            await connection.rollback();
        }
        catch (rollbackError) {

            console.error(
                "Erreur rollback commande :",
                rollbackError
            );
        }

        throw error;
    }
    finally {

        connection.release();
    }
}

/* =========================================================
   LISTE DES COMMANDES D'UN CLIENT
========================================================= */

async function findAllByUserId(
    userId,
    filters = {}
) {

    const search =
        String(
            filters.search || ""
        ).trim();


    const status =
        String(
            filters.status || ""
        )
            .trim()
            .toUpperCase();


    const maxPrice =
        Number(
            filters.maxPrice || 0
        );


    let sql = `
        SELECT
            o.id,
            o.public_id,
            o.reference,
            o.user_id,
            o.restaurant_id,
            o.delivery_address_id,
            o.order_type,
            o.channel,
            o.status,

            o.subtotal,
            o.discount_amount,
            o.delivery_fee,
            o.tax_amount,
            o.total_amount,
            o.currency,

            o.customer_note,

            o.created_at,
            o.updated_at,

            r.name AS restaurant_name,
            r.address AS restaurant_address,
            r.district AS restaurant_district,
            r.city AS restaurant_city,

            (
                SELECT COUNT(*)
                FROM order_items oi
                WHERE oi.order_id = o.id
            ) AS item_lines,

            (
                SELECT
                    COALESCE(
                        SUM(oi.quantity),
                        0
                    )
                FROM order_items oi
                WHERE oi.order_id = o.id
            ) AS total_quantity,

            (
                SELECT
                    GROUP_CONCAT(
                        CONCAT(
                            oi.quantity,
                            '× ',
                            oi.product_name
                        )
                        ORDER BY oi.id ASC
                        SEPARATOR ', '
                    )
                FROM order_items oi
                WHERE oi.order_id = o.id
            ) AS items_summary,

            (
                SELECT p.method
                FROM payments p
                WHERE p.order_id = o.id
                ORDER BY p.id DESC
                LIMIT 1
            ) AS payment_method,

            (
                SELECT p.status
                FROM payments p
                WHERE p.order_id = o.id
                ORDER BY p.id DESC
                LIMIT 1
            ) AS payment_status

        FROM orders o

        INNER JOIN restaurants r
            ON r.id = o.restaurant_id

        WHERE o.user_id = ?
    `;


    const params = [
        userId
    ];


    /* =====================================================
       RECHERCHE
    ===================================================== */

    if (search) {

        sql += `
            AND
            (
                o.reference LIKE ?

                OR EXISTS
                (
                    SELECT 1
                    FROM order_items search_item
                    WHERE search_item.order_id = o.id
                      AND search_item.product_name LIKE ?
                )

                OR r.name LIKE ?
            )
        `;


        const searchValue =
            `%${search}%`;


        params.push(
            searchValue,
            searchValue,
            searchValue
        );
    }


    /* =====================================================
       STATUT
    ===================================================== */

    if (status) {

        sql += `
            AND o.status = ?
        `;

        params.push(
            status
        );
    }


    /* =====================================================
       PRIX MAXIMUM
    ===================================================== */

    if (
        Number.isFinite(maxPrice) &&
        maxPrice > 0
    ) {

        sql += `
            AND o.total_amount <= ?
        `;

        params.push(
            maxPrice
        );
    }


    /* =====================================================
       TRI
    ===================================================== */

    sql += `
        ORDER BY
            o.created_at DESC,
            o.id DESC
    `;


    const rows =
        await db.query(
            sql,
            params
        );


    return Array.isArray(rows)
        ? rows
        : [];
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

    findAllByUserId,

    getOrderItems,
    getPaymentByOrderId,
    getStatusHistory,

    createFromCart
};
