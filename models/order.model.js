const crypto = require("crypto");
const db = require("../config/database");
const Payment = require("./payment.model");
const Loyalty = require("./loyalty.model");
const LoyaltyCard = require("./loyalty-card.model");


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


async function getPosCustomerAddresses(userId) {
    const id = Number(userId);
    if (!Number.isInteger(id) || id <= 0) return [];

    const rows = await db.query(`
        SELECT id, label, recipient_name, phone,
               address_line1, address_line2, district, city, country_code,
               latitude, longitude, delivery_instructions, is_default
        FROM user_addresses
        WHERE user_id = ?
        ORDER BY is_default DESC, id DESC
    `, [id]);

    return Array.isArray(rows) ? rows : [];
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

            /* ================================
               RESTAURANT
            ================================= */

            r.name AS restaurant_name,
            r.address AS restaurant_address,
            r.district AS restaurant_district,
            r.city AS restaurant_city,
            r.phone AS restaurant_phone,

            r.latitude AS restaurant_latitude,
            r.longitude AS restaurant_longitude,


            /* ================================
               ADRESSE DE LIVRAISON
            ================================= */

            ua.label AS delivery_address_label,
            ua.recipient_name,
            ua.phone AS delivery_phone,
            ua.address_line1,
            ua.address_line2,
            ua.district AS delivery_district,
            ua.city AS delivery_city,
            ua.country_code AS delivery_country_code,

            /* GPS CLIENT */
            ua.latitude AS delivery_latitude,
            ua.longitude AS delivery_longitude,

            ua.delivery_instructions

        FROM orders o

        INNER JOIN restaurants r
            ON r.id = o.restaurant_id

        LEFT JOIN user_addresses ua
            ON ua.id = o.delivery_address_id

        WHERE o.reference = ?
    `;


    const params = [
        reference
    ];


    /* =========================================
       SECURITE CLIENT
    ========================================= */

    if (userId !== null) {

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
    cart,
    loyaltyRedemptionPublicId = null
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

        let discountAmount = 0;
        const taxAmount = 0;
        let loyaltyRedemption = null;
        let loyaltyLabel = null;

        if (loyaltyRedemptionPublicId) {
            loyaltyRedemption = await Loyalty.lockCheckoutRedemption(
                connection, userId, loyaltyRedemptionPublicId
            );

            const type = String(loyaltyRedemption.reward_type || '').toUpperCase();
            const value = Math.max(0, toNumber(loyaltyRedemption.reward_value));
            loyaltyLabel = loyaltyRedemption.name || 'Avantage Tiop+';

            if (type === 'DISCOUNT') {
                if (value <= 0 || value > 100) {
                    throw new Error('La réduction Tiop+ est mal configurée.');
                }
                discountAmount = Math.min(subtotal, Math.round(subtotal * value / 100));
            }
            else if (type === 'COUPON') {
                if (value <= 0) throw new Error('Le coupon Tiop+ est mal configuré.');
                discountAmount = Math.min(subtotal, value);
            }
            else if (type === 'FREE_DELIVERY') {
                if (orderType !== 'DELIVERY') {
                    throw new Error('La livraison offerte Tiop+ nécessite une commande en livraison.');
                }
                deliveryFee = 0;
            }
            else if (type === 'PRODUCT') {
                if (!loyaltyRedemption.reward_product_id || Number(loyaltyRedemption.reward_product_active) !== 1) {
                    throw new Error('Le produit offert Tiop+ n’est pas configuré ou n’est plus disponible.');
                }
            }
            else {
                throw new Error('Type d’avantage Tiop+ non supporté.');
            }
        }

        const totalAmount = subtotal - discountAmount + deliveryFee + taxAmount;
        if (totalAmount <= 0) {
            throw new Error('Cette récompense couvre 100 % de la commande. Le paiement à 0 XAF sera géré dans une prochaine évolution.');
        }


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
           16.6 — PRODUIT OFFERT TIOP+
        ================================================= */
        if (loyaltyRedemption && loyaltyRedemption.reward_type === 'PRODUCT') {
            await connection.execute(`
                INSERT INTO order_items
                (order_id, product_id, formula_id, product_name, unit_price, quantity, line_total, notes)
                VALUES (?, ?, NULL, ?, 0, 1, 0, ?)`, [
                orderId,
                loyaltyRedemption.reward_product_id,
                `${loyaltyRedemption.reward_product_name} — OFFERT TIOP+`,
                `Récompense Tiop+ : ${loyaltyLabel}`
            ]);
        }

        if (loyaltyRedemption) {
            await Loyalty.markRedemptionUsedInTransaction(
                connection, loyaltyRedemption.id, orderId
            );
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
           PAIEMENT INITIAL - 13.7.2

           Le paiement est créé DANS LA MEME TRANSACTION
           que la commande afin de conserver l'atomicité :

           orders
             -> order_items
             -> order_item_options
             -> order_status_history
             -> payments
             -> payment_events
             -> cart CONVERTED

           Aucun appel externe (MTN / carte) n'est effectué ici.
        ================================================= */

        const paymentPublicId =
            crypto.randomUUID();


        const paymentProvider =
            Payment.getDefaultProvider(
                paymentMethod
            );


        const payment =
            await Payment.createInTransaction(
                connection,
                {
                    publicId:
                        paymentPublicId,

                    orderId,

                    method:
                        paymentMethod,

                    provider:
                        paymentProvider,

                    status:
                        Payment.STATUSES.PENDING,

                    amount:
                        totalAmount,

                    currency:
                        "XAF",

                    providerReference:
                        null
                }
            );


        await Payment.addEventInTransaction(
            connection,
            {
                paymentId:
                    payment.id,

                eventType:
                    "PAYMENT_CREATED",

                description:
                    "Paiement initial créé avec la commande.",

                payload: {
                    orderReference:
                        reference,

                    method:
                        paymentMethod,

                    provider:
                        paymentProvider,

                    amount:
                        totalAmount,

                    currency:
                        "XAF",

                    status:
                        Payment.STATUSES.PENDING
                }
            }
        );


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
                payment.id,

            paymentPublicId:
                payment.publicId,

            paymentProvider:
                payment.provider,

            paymentStatus:
                payment.status,

            subtotal,
            deliveryFee,
            discountAmount,
            loyaltyRedemptionPublicId: loyaltyRedemption ? loyaltyRedemption.public_id : null,
            loyaltyRewardType: loyaltyRedemption ? loyaltyRedemption.reward_type : null,
            loyaltyRewardName: loyaltyLabel,
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
   13.9.6.7 — CREATION TRANSACTIONNELLE POS

   Une seule transaction contient :
   - orders
   - order_items
   - order_item_options
   - order_status_history
   - payments
   - payment_events
   - order_pos_context

   Aucun appel Stripe / MTN n'est effectué ici.
========================================================= */

async function findPosOrderByIdempotencyKey(idempotencyKey) {
    const key = String(idempotencyKey || "").trim();

    if (!key) return null;

    const rows = await db.query(
        `
        SELECT
            opc.idempotency_key,
            o.id AS order_id,
            o.public_id,
            o.reference,
            o.channel,
            o.order_type,
            o.status AS order_status,
            o.subtotal,
            o.discount_amount,
            o.delivery_fee,
            o.tax_amount,
            o.total_amount,
            o.currency,
            p.id AS payment_id,
            p.public_id AS payment_public_id,
            p.method AS payment_method,
            p.provider AS payment_provider,
            p.status AS payment_status
        FROM order_pos_context opc
        INNER JOIN orders o
            ON o.id = opc.order_id
        LEFT JOIN payments p
            ON p.id = (
                SELECT p2.id
                FROM payments p2
                WHERE p2.order_id = o.id
                ORDER BY p2.id DESC
                LIMIT 1
            )
        WHERE opc.idempotency_key = ?
        LIMIT 1
        `,
        [key]
    );

    return rows[0] || null;
}

function posExistingResult(row) {
    if (!row) return null;

    return {
        duplicate: true,
        orderId: Number(row.order_id),
        publicId: row.public_id,
        reference: row.reference,
        channel: row.channel,
        orderType: row.order_type,
        orderStatus: row.order_status,
        paymentId: row.payment_id ? Number(row.payment_id) : null,
        paymentPublicId: row.payment_public_id || null,
        paymentMethod: row.payment_method || null,
        paymentProvider: row.payment_provider || null,
        paymentStatus: row.payment_status || null,
        subtotal: toNumber(row.subtotal),
        discountAmount: toNumber(row.discount_amount),
        deliveryFee: toNumber(row.delivery_fee),
        taxAmount: toNumber(row.tax_amount),
        totalAmount: toNumber(row.total_amount),
        currency: row.currency || "XAF"
    };
}

async function createFromPos({
    idempotencyKey,
    adminUserId = null,
    clientMode,
    userId = null,
    guest = {},
    channel,
    restaurantId,
    deliveryAddressId = null,
    deliveryZoneId = null,
    orderType,
    paymentMethod,
    deliverySnapshot = {},
    cart,
    loyaltyRedemptionPublicId = null,
    loyaltyCardPublicId = null,
    loyaltyCardRewardId = null
}) {
    const key = String(idempotencyKey || "").trim().slice(0, 100);

    if (!key) {
        const error = new Error("Clé d'idempotence POS obligatoire.");
        error.code = "POS_IDEMPOTENCY_KEY_REQUIRED";
        throw error;
    }

    /*
     * Rejeu après succès :
     * retourne la commande déjà créée au lieu d'en créer une seconde.
     */
    const alreadyCreated =
        await findPosOrderByIdempotencyKey(key);

    if (alreadyCreated) {
        return posExistingResult(alreadyCreated);
    }

    const connection = await db.pool.getConnection();

    try {
        await connection.beginTransaction();

        // 16.10.5 — carte Tiop+ physique présentée au POS.
        let physicalLoyaltyCard = null;
        if (loyaltyCardPublicId) {
            const [cardRows] = await connection.execute(
                `SELECT * FROM loyalty_cards WHERE public_id=? LIMIT 1 FOR UPDATE`,
                [String(loyaltyCardPublicId)]
            );
            physicalLoyaltyCard = cardRows[0] || null;
            if (!physicalLoyaltyCard) {
                const error = new Error("Carte Tiop+ physique introuvable.");
                error.code = "POS_LOYALTY_CARD_NOT_FOUND";
                throw error;
            }
            const storedStatus = String(physicalLoyaltyCard.status || "ACTIVE").toUpperCase();
            const expired = Boolean(physicalLoyaltyCard.expires_at && new Date(physicalLoyaltyCard.expires_at).getTime() < Date.now());
            if (storedStatus !== "ACTIVE" || expired) {
                const error = new Error(expired ? "Cette carte Tiop+ est expirée." : `Cette carte Tiop+ est ${storedStatus.toLowerCase()}.`);
                error.code = expired ? "POS_LOYALTY_CARD_EXPIRED" : "POS_LOYALTY_CARD_NOT_ACTIVE";
                throw error;
            }
        }

        let physicalLoyaltyReward = null;
        if (loyaltyCardRewardId) {
            if (!physicalLoyaltyCard) {
                const error = new Error("Présentez une carte Tiop+ avant de choisir une récompense.");
                error.code = "POS_LOYALTY_CARD_REQUIRED";
                throw error;
            }
            if (loyaltyRedemptionPublicId) {
                const error = new Error("Une seule récompense Tiop+ peut être utilisée par commande.");
                error.code = "POS_LOYALTY_REWARD_CONFLICT";
                throw error;
            }
            physicalLoyaltyReward = await LoyaltyCard.lockRewardForOrder(connection, loyaltyCardPublicId, loyaltyCardRewardId);
        }

        const [existingRows] = await connection.execute(
            `
            SELECT
                opc.idempotency_key,
                o.id AS order_id,
                o.public_id,
                o.reference,
                o.channel,
                o.order_type,
                o.status AS order_status,
                o.subtotal,
                o.discount_amount,
                o.delivery_fee,
                o.tax_amount,
                o.total_amount,
                o.currency,
                p.id AS payment_id,
                p.public_id AS payment_public_id,
                p.method AS payment_method,
                p.provider AS payment_provider,
                p.status AS payment_status
            FROM order_pos_context opc
            INNER JOIN orders o
                ON o.id = opc.order_id
            LEFT JOIN payments p
                ON p.id = (
                    SELECT p2.id
                    FROM payments p2
                    WHERE p2.order_id = o.id
                    ORDER BY p2.id DESC
                    LIMIT 1
                )
            WHERE opc.idempotency_key = ?
            LIMIT 1
            FOR UPDATE
            `,
            [key]
        );

        if (existingRows.length) {
            await connection.commit();
            return posExistingResult(existingRows[0]);
        }

        const normalizedMode =
            String(clientMode || "").trim().toUpperCase();

        if (!["ACCOUNT", "GUEST", "ANONYMOUS"].includes(normalizedMode)) {
            const error = new Error("Type de client POS invalide.");
            error.code = "POS_CUSTOMER_MODE_INVALID";
            throw error;
        }

        const normalizedChannel =
            String(channel || "POS").trim().toUpperCase();

        if (!["POS", "PHONE", "WHATSAPP"].includes(normalizedChannel)) {
            const error = new Error("Canal POS invalide.");
            error.code = "POS_CHANNEL_INVALID";
            throw error;
        }

        const normalizedOrderType =
            String(orderType || "").trim().toUpperCase();

        if (!["DELIVERY", "PICKUP", "DINE_IN"].includes(normalizedOrderType)) {
            const error = new Error("Type de commande POS invalide.");
            error.code = "POS_ORDER_TYPE_INVALID";
            throw error;
        }

        const normalizedPaymentMethod =
            Payment.normalizeMethod(paymentMethod);

        if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
            const error = new Error("Le panier POS est vide.");
            error.code = "POS_CART_EMPTY";
            throw error;
        }

        /*
         * Le panier reçu ici provient exclusivement du recalcul serveur
         * buildPosPricedCart() exécuté juste avant l'entrée en transaction.
         */
        const subtotal =
            cart.items.reduce(
                (sum, item) =>
                    sum +
                    (
                        toNumber(item.unitPrice) *
                        Number(item.quantity || 0)
                    ),
                0
            );

        if (subtotal <= 0) {
            const error = new Error("Sous-total POS invalide.");
            error.code = "POS_SUBTOTAL_INVALID";
            throw error;
        }

        const [restaurantRows] = await connection.execute(
            `
            SELECT *
            FROM restaurants
            WHERE id = ?
              AND status = 'OPEN'
            LIMIT 1
            FOR UPDATE
            `,
            [restaurantId]
        );

        const restaurant = restaurantRows[0] || null;

        if (!restaurant) {
            const error = new Error("Restaurant indisponible.");
            error.code = "POS_RESTAURANT_UNAVAILABLE";
            throw error;
        }

        const supportColumn =
            normalizedOrderType === "DELIVERY"
                ? "supports_delivery"
                : normalizedOrderType === "PICKUP"
                    ? "supports_pickup"
                    : "supports_dine_in";

        if (Number(restaurant[supportColumn]) !== 1) {
            const error = new Error(
                "Ce restaurant ne prend pas en charge ce mode de réception."
            );
            error.code = "POS_ORDER_TYPE_UNSUPPORTED";
            throw error;
        }

        let finalUserId = null;
        let accountCustomer = null;

        if (normalizedMode === "ACCOUNT") {
            const accountId = Number(userId);

            if (!Number.isInteger(accountId) || accountId <= 0) {
                const error = new Error("Client avec compte invalide.");
                error.code = "POS_ACCOUNT_INVALID";
                throw error;
            }

            const [userRows] = await connection.execute(
                `
                SELECT
                    u.id,
                    u.email,
                    u.phone,
                    up.first_name,
                    up.last_name,
                    up.display_name
                FROM users u
                LEFT JOIN user_profiles up
                    ON up.user_id = u.id
                WHERE u.id = ?
                  AND u.status = 'ACTIVE'
                LIMIT 1
                FOR UPDATE
                `,
                [accountId]
            );

            accountCustomer = userRows[0] || null;

            if (!accountCustomer) {
                const error = new Error(
                    "Le compte client sélectionné n'est plus disponible."
                );
                error.code = "POS_ACCOUNT_UNAVAILABLE";
                throw error;
            }

            finalUserId = accountId;
        }

        let finalAddressId = null;
        let finalDelivery = {
            recipientName:
                String(deliverySnapshot.recipientName || "").trim().slice(0, 160),
            phone:
                String(deliverySnapshot.phone || "").trim().slice(0, 40),
            addressLine1:
                String(deliverySnapshot.addressLine1 || "").trim().slice(0, 255),
            addressLine2:
                String(deliverySnapshot.addressLine2 || "").trim().slice(0, 255),
            district:
                String(deliverySnapshot.district || "").trim().slice(0, 120),
            city:
                String(deliverySnapshot.city || "").trim().slice(0, 120),
            countryCode:
                String(deliverySnapshot.countryCode || "CG").trim().slice(0, 2) || "CG",
            instructions:
                String(deliverySnapshot.instructions || "").trim().slice(0, 2000)
        };

        let zone = null;
        let deliveryFee = 0;

        if (normalizedOrderType === "DELIVERY") {
            if (
                normalizedMode === "ACCOUNT" &&
                Number.isInteger(Number(deliveryAddressId)) &&
                Number(deliveryAddressId) > 0
            ) {
                const [addressRows] = await connection.execute(
                    `
                    SELECT *
                    FROM user_addresses
                    WHERE id = ?
                      AND user_id = ?
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        Number(deliveryAddressId),
                        finalUserId
                    ]
                );

                const address = addressRows[0] || null;

                if (!address) {
                    const error = new Error(
                        "L'adresse enregistrée n'appartient pas au client sélectionné."
                    );
                    error.code = "POS_ADDRESS_INVALID";
                    throw error;
                }

                finalAddressId = Number(address.id);

                /*
                 * Snapshot issu de MySQL, pas des champs modifiables du navigateur.
                 */
                finalDelivery = {
                    recipientName:
                        address.recipient_name ||
                        accountCustomer?.display_name ||
                        [
                            accountCustomer?.first_name,
                            accountCustomer?.last_name
                        ].filter(Boolean).join(" "),
                    phone:
                        address.phone ||
                        accountCustomer?.phone ||
                        "",
                    addressLine1: address.address_line1 || "",
                    addressLine2: address.address_line2 || "",
                    district: address.district || "",
                    city: address.city || "Brazzaville",
                    countryCode: address.country_code || "CG",
                    instructions:
                        String(deliverySnapshot.instructions || address.delivery_instructions || "")
                            .trim()
                            .slice(0, 2000)
                };
            }

            if (!finalDelivery.phone) {
                const error = new Error("Téléphone de livraison obligatoire.");
                error.code = "POS_DELIVERY_PHONE_REQUIRED";
                throw error;
            }

            if (!finalDelivery.addressLine1 || !finalDelivery.city) {
                const error = new Error("Adresse de livraison incomplète.");
                error.code = "POS_DELIVERY_ADDRESS_REQUIRED";
                throw error;
            }

            const zoneId = Number(deliveryZoneId);

            if (!Number.isInteger(zoneId) || zoneId <= 0) {
                const error = new Error("Zone de livraison obligatoire.");
                error.code = "POS_DELIVERY_ZONE_REQUIRED";
                throw error;
            }

            const [zoneRows] = await connection.execute(
                `
                SELECT *
                FROM delivery_zones
                WHERE id = ?
                  AND restaurant_id = ?
                  AND is_active = 1
                LIMIT 1
                FOR UPDATE
                `,
                [
                    zoneId,
                    restaurantId
                ]
            );

            zone = zoneRows[0] || null;

            if (!zone) {
                const error = new Error("Zone de livraison invalide.");
                error.code = "POS_DELIVERY_ZONE_INVALID";
                throw error;
            }

            const minOrder = toNumber(zone.min_order);

            if (subtotal < minOrder) {
                const error = new Error(
                    `Le minimum de commande pour ${zone.name} est de ${minOrder.toLocaleString("fr-FR")} XAF.`
                );
                error.code = "POS_MIN_ORDER_NOT_REACHED";
                throw error;
            }

            deliveryFee =
                calculateDeliveryFee(
                    subtotal,
                    normalizedOrderType,
                    zone
                );
        }

        let discountAmount = 0;
        const taxAmount = 0;
        let loyaltyRedemption = null;
        let loyaltyLabel = null;

        if (loyaltyRedemptionPublicId) {
            if (normalizedMode !== "ACCOUNT" || !finalUserId) {
                const error = new Error("Un avantage Tiop+ de compte nécessite un client avec compte.");
                error.code = "POS_LOYALTY_ACCOUNT_REQUIRED";
                throw error;
            }
            loyaltyRedemption = await Loyalty.lockCheckoutRedemption(connection, finalUserId, loyaltyRedemptionPublicId);
            const type = String(loyaltyRedemption.reward_type || "").toUpperCase();
            const value = Math.max(0, toNumber(loyaltyRedemption.reward_value));
            loyaltyLabel = loyaltyRedemption.name || "Avantage Tiop+";
            if (type === "DISCOUNT") {
                if (value <= 0 || value > 100) throw new Error("La réduction Tiop+ est mal configurée.");
                discountAmount = Math.min(subtotal, Math.round(subtotal * value / 100));
            } else if (type === "COUPON") {
                if (value <= 0) throw new Error("Le coupon Tiop+ est mal configuré.");
                discountAmount = Math.min(subtotal, value);
            } else if (type === "FREE_DELIVERY") {
                if (normalizedOrderType !== "DELIVERY") throw new Error("La livraison offerte Tiop+ nécessite une commande en livraison.");
                deliveryFee = 0;
            } else if (type === "PRODUCT") {
                if (!loyaltyRedemption.reward_product_id || Number(loyaltyRedemption.reward_product_active) !== 1) throw new Error("Le produit offert Tiop+ n’est pas configuré ou indisponible.");
            } else throw new Error("Type d’avantage Tiop+ non supporté.");
        }

        if (physicalLoyaltyReward) {
            const reward = physicalLoyaltyReward.reward;
            const type = String(reward.reward_type || "").toUpperCase();
            const value = Math.max(0, toNumber(reward.reward_value));
            loyaltyLabel = reward.name || "Avantage carte Tiop+";
            if (type === "DISCOUNT") {
                if (value <= 0 || value > 100) throw new Error("La réduction Tiop+ est mal configurée.");
                discountAmount = Math.min(subtotal, Math.round(subtotal * value / 100));
            } else if (type === "COUPON") {
                if (value <= 0) throw new Error("Le coupon Tiop+ est mal configuré.");
                discountAmount = Math.min(subtotal, value);
            } else if (type === "FREE_DELIVERY") {
                if (normalizedOrderType !== "DELIVERY") throw new Error("La livraison offerte Tiop+ nécessite une commande en livraison.");
                deliveryFee = 0;
            } else if (type === "PRODUCT") {
                if (!reward.reward_product_id || Number(reward.reward_product_active) !== 1) throw new Error("Le produit offert Tiop+ n’est pas configuré ou indisponible.");
            } else throw new Error("Type d’avantage Tiop+ non supporté.");
        }

        const totalAmount = subtotal - discountAmount + deliveryFee + taxAmount;
        if (totalAmount <= 0) throw new Error("Cet avantage couvre 100 % de la commande ; paiement 0 XAF non supporté.");

        const publicId = crypto.randomUUID();
        const reference = createReference();

        const [orderResult] = await connection.execute(
            `
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
                ?, ?, ?, ?, ?, ?, ?,
                'RECEIVED',
                ?, ?, ?, ?, ?,
                ?,
                ?
            )
            `,
            [
                publicId,
                reference,
                finalUserId,
                restaurantId,
                finalAddressId,
                normalizedOrderType,
                normalizedChannel,
                subtotal,
                discountAmount,
                deliveryFee,
                taxAmount,
                totalAmount,
                cart.currency || "XAF",
                normalizedOrderType === "DELIVERY"
                    ? (finalDelivery.instructions || null)
                    : null
            ]
        );

        const orderId = Number(orderResult.insertId);

        for (const item of cart.items) {
            const quantity = Number(item.quantity);

            if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 99) {
                const error = new Error("Quantité POS invalide.");
                error.code = "POS_ITEM_QUANTITY_INVALID";
                throw error;
            }

            const unitPrice = toNumber(item.unitPrice);
            const lineTotal = unitPrice * quantity;

            const [itemResult] = await connection.execute(
                `
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
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    orderId,
                    item.type === "PRODUCT"
                        ? Number(item.id)
                        : null,
                    item.type === "FORMULA"
                        ? Number(item.id)
                        : null,
                    item.name,
                    unitPrice,
                    quantity,
                    lineTotal,
                    item.instructions || null
                ]
            );

            const orderItemId = Number(itemResult.insertId);

            for (const option of (item.selectedOptions || [])) {
                await connection.execute(
                    `
                    INSERT INTO order_item_options
                    (
                        order_item_id,
                        option_name,
                        option_value,
                        price_delta
                    )
                    VALUES (?, ?, ?, ?)
                    `,
                    [
                        orderItemId,
                        option.groupName || "Option",
                        option.name || "Choix",
                        toNumber(option.priceDelta)
                    ]
                );
            }
        }

        if (loyaltyRedemption && loyaltyRedemption.reward_type === "PRODUCT") {
            await connection.execute(`
                INSERT INTO order_items
                (order_id, product_id, formula_id, product_name, unit_price, quantity, line_total, notes)
                VALUES (?, ?, NULL, ?, 0, 1, 0, ?)`, [
                orderId, loyaltyRedemption.reward_product_id,
                `${loyaltyRedemption.reward_product_name} — OFFERT TIOP+`,
                `Récompense Tiop+ : ${loyaltyLabel}`
            ]);
        }
        if (physicalLoyaltyReward && String(physicalLoyaltyReward.reward.reward_type).toUpperCase() === "PRODUCT") {
            const reward = physicalLoyaltyReward.reward;
            await connection.execute(`
                INSERT INTO order_items
                (order_id, product_id, formula_id, product_name, unit_price, quantity, line_total, notes)
                VALUES (?, ?, NULL, ?, 0, 1, 0, ?)`, [
                orderId, reward.reward_product_id,
                `${reward.reward_product_name} — OFFERT TIOP+`,
                `Récompense carte Tiop+ : ${loyaltyLabel}`
            ]);
        }
        if (physicalLoyaltyReward) {
            await LoyaltyCard.reserveRewardInTransaction(connection, {
                card: physicalLoyaltyReward.card,
                reward: physicalLoyaltyReward.reward,
                cost: physicalLoyaltyReward.cost,
                orderId,
                adminUserId
            });
        }
        if (loyaltyRedemption) {
            await Loyalty.reserveRedemptionInTransaction(connection, loyaltyRedemption.id, orderId);
        }

        await connection.execute(
            `
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
                ?,
                NULL,
                ?
            )
            `,
            [
                orderId,
                `Commande créée depuis le POS — canal ${normalizedChannel}.`,
                adminUserId || null
            ]
        );

        const paymentPublicId = crypto.randomUUID();
        const paymentProvider =
            Payment.getDefaultProvider(normalizedPaymentMethod);

        const payment =
            await Payment.createInTransaction(
                connection,
                {
                    publicId: paymentPublicId,
                    orderId,
                    method: normalizedPaymentMethod,
                    provider: paymentProvider,
                    status: Payment.STATUSES.PENDING,
                    amount: totalAmount,
                    currency: cart.currency || "XAF",
                    providerReference: null
                }
            );

        await Payment.addEventInTransaction(
            connection,
            {
                paymentId: payment.id,
                eventType: "PAYMENT_CREATED",
                description:
                    "Paiement initial créé avec la commande POS.",
                payload: {
                    source: "ADMIN_POS",
                    orderReference: reference,
                    channel: normalizedChannel,
                    method: normalizedPaymentMethod,
                    provider: paymentProvider,
                    amount: totalAmount,
                    currency: cart.currency || "XAF",
                    status: Payment.STATUSES.PENDING
                }
            }
        );

        /*
         * Snapshot POS + clé d'idempotence.
         * La contrainte UNIQUE sur idempotency_key est la dernière barrière
         * contre deux commandes concurrentes.
         */
        await connection.execute(
            `
            INSERT INTO order_pos_context
            (
                order_id,
                idempotency_key,
                client_mode,
                guest_first_name,
                guest_last_name,
                contact_phone,
                contact_email,
                delivery_zone_id,
                delivery_recipient_name,
                delivery_phone,
                delivery_address_line1,
                delivery_address_line2,
                delivery_district,
                delivery_city,
                delivery_country_code,
                delivery_instructions,
                created_by_admin_user_id
            )
            VALUES
            (
                ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?
            )
            `,
            [
                orderId,
                key,
                normalizedMode,

                normalizedMode === "GUEST"
                    ? String(guest.firstName || "").trim().slice(0, 100)
                    : null,

                normalizedMode === "GUEST"
                    ? String(guest.lastName || "").trim().slice(0, 100)
                    : null,

                normalizedMode === "ACCOUNT"
                    ? (accountCustomer?.phone || null)
                    : normalizedMode === "GUEST"
                        ? (String(guest.phone || "").trim().slice(0, 40) || null)
                        : null,

                normalizedMode === "ACCOUNT"
                    ? (accountCustomer?.email || null)
                    : normalizedMode === "GUEST"
                        ? (String(guest.email || "").trim().slice(0, 190) || null)
                        : null,

                zone ? Number(zone.id) : null,

                normalizedOrderType === "DELIVERY"
                    ? (finalDelivery.recipientName || null)
                    : null,

                normalizedOrderType === "DELIVERY"
                    ? (finalDelivery.phone || null)
                    : null,

                normalizedOrderType === "DELIVERY"
                    ? (finalDelivery.addressLine1 || null)
                    : null,

                normalizedOrderType === "DELIVERY"
                    ? (finalDelivery.addressLine2 || null)
                    : null,

                normalizedOrderType === "DELIVERY"
                    ? (finalDelivery.district || null)
                    : null,

                normalizedOrderType === "DELIVERY"
                    ? (finalDelivery.city || null)
                    : null,

                normalizedOrderType === "DELIVERY"
                    ? (finalDelivery.countryCode || "CG")
                    : null,

                normalizedOrderType === "DELIVERY"
                    ? (finalDelivery.instructions || null)
                    : null,

                adminUserId || null
            ]
        );

        if (physicalLoyaltyCard) {
            await connection.execute(
                `INSERT INTO loyalty_card_order_links (order_id,card_id,created_by_admin_user_id)
                 VALUES (?,?,?)
                 ON DUPLICATE KEY UPDATE card_id=VALUES(card_id)`,
                [orderId, Number(physicalLoyaltyCard.id), adminUserId || null]
            );
        }

        await connection.commit();

        return {
            duplicate: false,
            orderId,
            publicId,
            reference,
            channel: normalizedChannel,
            orderType: normalizedOrderType,
            orderStatus: "RECEIVED",
            paymentId: payment.id,
            paymentPublicId: payment.publicId,
            paymentMethod: payment.method,
            paymentProvider: payment.provider,
            paymentStatus: payment.status,
            subtotal,
            discountAmount,
            deliveryFee,
            taxAmount,
            totalAmount,
            currency: cart.currency || "XAF"
        };
    }
    catch (error) {
        try {
            await connection.rollback();
        }
        catch (rollbackError) {
            console.error(
                "Erreur rollback commande POS :",
                rollbackError
            );
        }

        /*
         * Deux requêtes strictement concurrentes peuvent toutes les deux
         * franchir le SELECT initial. L'index UNIQUE gagne :
         * la transaction perdante est rollbackée puis retrouve la gagnante.
         */
        if (
            error &&
            error.code === "ER_DUP_ENTRY"
        ) {
            const winner =
                await findPosOrderByIdempotencyKey(key);

            if (winner) {
                return posExistingResult(winner);
            }
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
   ADMIN - LISTE DES COMMANDES
========================================================= */

async function findAllForAdmin(
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


    const paymentMethod =
        String(
            filters.paymentMethod || ""
        )
            .trim()
            .toUpperCase();


    const channel =
        String(
            filters.channel || ""
        )
            .trim()
            .toUpperCase();


    const restaurantId =
        Number(
            filters.restaurantId || 0
        );


    const minAmount =
        Number(
            filters.minAmount || 0
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
            r.district AS restaurant_district,
            r.city AS restaurant_city,

            u.email AS customer_email,
            u.phone AS customer_phone,

            up.first_name AS customer_first_name,
            up.last_name AS customer_last_name,
            up.display_name AS customer_display_name,
            up.avatar_url AS customer_avatar_url,

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
                SELECT
                    COALESCE(
                        SUM(oi.quantity),
                        0
                    )
                FROM order_items oi
                WHERE oi.order_id = o.id
            ) AS total_quantity,

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

        LEFT JOIN users u
            ON u.id = o.user_id

        LEFT JOIN user_profiles up
            ON up.user_id = o.user_id

        WHERE 1 = 1
    `;


    const params = [];


    /* =====================================================
       RECHERCHE
    ===================================================== */

    if (search) {

        const value =
            `%${search}%`;


        sql += `
            AND
            (
                o.reference LIKE ?

                OR u.email LIKE ?

                OR u.phone LIKE ?

                OR up.display_name LIKE ?

                OR CONCAT_WS(
                    ' ',
                    up.first_name,
                    up.last_name
                ) LIKE ?

                OR r.name LIKE ?

                OR EXISTS
                (
                    SELECT 1
                    FROM order_items search_item
                    WHERE search_item.order_id = o.id
                      AND search_item.product_name LIKE ?
                )
            )
        `;


        params.push(
            value,
            value,
            value,
            value,
            value,
            value,
            value
        );
    }


    /* =====================================================
       STATUT COMMANDE
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
       MODE PAIEMENT
    ===================================================== */

    if (paymentMethod) {

        sql += `
            AND EXISTS
            (
                SELECT 1
                FROM payments payment_filter
                WHERE payment_filter.order_id = o.id
                  AND payment_filter.method = ?
            )
        `;

        params.push(
            paymentMethod
        );
    }


    /* =====================================================
       CANAL
    ===================================================== */

    if (channel) {

        sql += `
            AND o.channel = ?
        `;

        params.push(
            channel
        );
    }


    /* =====================================================
       RESTAURANT
    ===================================================== */

    if (
        Number.isInteger(
            restaurantId
        )
        &&
        restaurantId > 0
    ) {

        sql += `
            AND o.restaurant_id = ?
        `;

        params.push(
            restaurantId
        );
    }


    /* =====================================================
       MONTANT MINIMUM
    ===================================================== */

    if (
        Number.isFinite(
            minAmount
        )
        &&
        minAmount > 0
    ) {

        sql += `
            AND o.total_amount >= ?
        `;

        params.push(
            minAmount
        );
    }


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
   ADMIN - COMMANDE COMPLETE PAR REFERENCE
========================================================= */

async function findForAdminByReference(
    reference
) {

    const rows =
        await db.query(`
            SELECT
                o.*,

                r.code AS restaurant_code,
                r.name AS restaurant_name,
                r.address AS restaurant_address,
                r.district AS restaurant_district,
                r.city AS restaurant_city,
                r.phone AS restaurant_phone,

                u.id AS customer_id,
                u.email AS customer_email,
                u.phone AS customer_phone,
                u.status AS customer_status,

                up.first_name AS customer_first_name,
                up.last_name AS customer_last_name,
                up.display_name AS customer_display_name,
                up.avatar_url AS customer_avatar_url,

                ua.label AS delivery_address_label,
                ua.recipient_name,
                ua.phone AS delivery_phone,
                ua.address_line1,
                ua.address_line2,
                ua.district AS delivery_district,
                ua.city AS delivery_city,
                ua.country_code AS delivery_country_code,
                ua.latitude AS delivery_latitude,
                ua.longitude AS delivery_longitude,
                ua.delivery_instructions

            FROM orders o

            INNER JOIN restaurants r
                ON r.id = o.restaurant_id

            LEFT JOIN users u
                ON u.id = o.user_id

            LEFT JOIN user_profiles up
                ON up.user_id = o.user_id

            LEFT JOIN user_addresses ua
                ON ua.id = o.delivery_address_id

            WHERE o.reference = ?

            LIMIT 1
        `, [
            reference
        ]);


    return rows[0] || null;
}


/* =========================================================
   ADMIN - STATISTIQUES COMMANDES
========================================================= */

async function getAdminOrderStats() {

    const rows =
        await db.query(`
            SELECT
                COUNT(*) AS total_orders,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'RECEIVED'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS received_orders,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'PREPARING'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS preparing_orders,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'ON_THE_WAY'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS on_the_way_orders,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status NOT IN (
                                'CANCELLED',
                                'REFUNDED'
                            )
                            THEN total_amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS revenue

            FROM orders
        `);


    return rows[0] || {
        total_orders: 0,
        received_orders: 0,
        preparing_orders: 0,
        on_the_way_orders: 0,
        revenue: 0
    };
}


/* =========================================================
   WORKFLOW DES STATUTS
========================================================= */

const ORDER_STATUS_LABELS = {
    RECEIVED: "Commande reçue",
    CONFIRMED: "Confirmée",
    PREPARING: "En préparation",
    READY: "Prête",
    PICKED_UP: "Retirée",
    ON_THE_WAY: "En livraison",
    DELIVERED: "Livrée",
    CANCELLED: "Annulée",
    REFUNDED: "Remboursée"
};


const ORDER_WORKFLOWS = {

    DELIVERY: {
        RECEIVED: [
            "CONFIRMED",
            "CANCELLED"
        ],

        CONFIRMED: [
            "PREPARING",
            "CANCELLED"
        ],

        PREPARING: [
            "READY",
            "CANCELLED"
        ],

        READY: [
            "ON_THE_WAY",
            "CANCELLED"
        ],

        ON_THE_WAY: [
            "DELIVERED",
            "CANCELLED"
        ],

        DELIVERED: [
            "REFUNDED"
        ],

        CANCELLED: [
            "REFUNDED"
        ],

        REFUNDED: []
    },


    PICKUP: {
        RECEIVED: [
            "CONFIRMED",
            "CANCELLED"
        ],

        CONFIRMED: [
            "PREPARING",
            "CANCELLED"
        ],

        PREPARING: [
            "READY",
            "CANCELLED"
        ],

        READY: [
            "PICKED_UP",
            "CANCELLED"
        ],

        PICKED_UP: [
            "REFUNDED"
        ],

        CANCELLED: [
            "REFUNDED"
        ],

        REFUNDED: []
    },


    DINE_IN: {
        RECEIVED: [
            "CONFIRMED",
            "CANCELLED"
        ],

        CONFIRMED: [
            "PREPARING",
            "CANCELLED"
        ],

        PREPARING: [
            "READY",
            "CANCELLED"
        ],

        READY: [
            "DELIVERED",
            "CANCELLED"
        ],

        DELIVERED: [
            "REFUNDED"
        ],

        CANCELLED: [
            "REFUNDED"
        ],

        REFUNDED: []
    }
};


function getAllowedNextStatuses(
    orderType,
    currentStatus
) {

    const workflow =
        ORDER_WORKFLOWS[
            String(
                orderType || ""
            ).toUpperCase()
        ];


    if (!workflow) {
        return [];
    }


    return Array.isArray(
        workflow[currentStatus]
    )
        ? [...workflow[currentStatus]]
        : [];
}


function canTransitionOrderStatus(
    orderType,
    currentStatus,
    nextStatus
) {

    return getAllowedNextStatuses(
        orderType,
        currentStatus
    ).includes(
        nextStatus
    );
}




/* =========================================================
   13.9.5.1 — COHERENCE COMMANDE / PAIEMENT
========================================================= */

function evaluateOrderPaymentConsistency({
    orderStatus,
    paymentStatus,
    paymentMethod = null
}) {

    const order =
        String(
            orderStatus || ""
        )
            .trim()
            .toUpperCase();


    const payment =
        String(
            paymentStatus || ""
        )
            .trim()
            .toUpperCase();


    const method =
        String(
            paymentMethod || ""
        )
            .trim()
            .toUpperCase();


    const errors = [];
    const warnings = [];


    if (
        order === "REFUNDED"
        &&
        payment !== Payment.STATUSES.REFUNDED
    ) {

        errors.push(
            "Une commande REFUNDED doit avoir un paiement REFUNDED."
        );
    }


    if (
        payment === Payment.STATUSES.REFUNDED
        &&
        order !== "REFUNDED"
    ) {

        warnings.push(
            "Le paiement est REFUNDED mais la commande conserve encore son statut opérationnel."
        );
    }


    if (
        order === "DELIVERED"
        &&
        [
            Payment.STATUSES.FAILED,
            Payment.STATUSES.CANCELLED
        ].includes(payment)
        &&
        method !== Payment.METHODS.CASH
    ) {

        warnings.push(
            "Commande livrée avec un paiement électronique non payé."
        );
    }


    return {
        valid:
            errors.length === 0,

        errors,
        warnings
    };
}


function assertOrderPaymentConsistency(data) {

    const result =
        evaluateOrderPaymentConsistency(
            data
        );


    if (!result.valid) {

        const error =
            new Error(
                result.errors.join(" ")
            );

        error.code =
            "ORDER_PAYMENT_INCONSISTENT";

        error.details =
            result;

        throw error;
    }


    return result;
}


/* =========================================================
   ADMIN - MODIFIER LE STATUT D'UNE COMMANDE

   Transaction :
   1. verrouille la commande
   2. valide le workflow selon order_type
   3. UPDATE orders.status
   4. INSERT order_status_history
   5. COMMIT
========================================================= */

async function updateStatus({
    reference,
    nextStatus,
    comment = null,
    adminUserId = null
}) {

    const connection =
        await db.pool.getConnection();


    try {

        await connection.beginTransaction();


        const [
            rows
        ] =
            await connection.execute(`
                SELECT
                    id,
                    reference,
                    user_id,
                    order_type,
                    status,
                    updated_at

                FROM orders

                WHERE reference = ?

                LIMIT 1
                FOR UPDATE
            `, [
                reference
            ]);


        const order =
            rows[0];


        if (!order) {

            const error =
                new Error(
                    "Commande introuvable."
                );

            error.code =
                "ORDER_NOT_FOUND";

            throw error;
        }


        const currentStatus =
            String(
                order.status || ""
            ).toUpperCase();


        const normalizedNextStatus =
            String(
                nextStatus || ""
            ).toUpperCase();


        /*
         * Une commande ne peut être marquée REFUNDED que si
         * son dernier paiement est réellement REFUNDED.
         */
        if (
            normalizedNextStatus ===
            "REFUNDED"
        ) {

            const [
                paymentRows
            ] =
                await connection.execute(
                    `
                    SELECT
                        method,
                        status
                    FROM payments
                    WHERE order_id = ?
                    ORDER BY id DESC
                    LIMIT 1
                    `,
                    [
                        order.id
                    ]
                );


            const latestPayment =
                paymentRows[0]
                ||
                null;


            if (!latestPayment) {

                const error =
                    new Error(
                        "Impossible de rembourser la commande : aucun paiement associé."
                    );

                error.code =
                    "ORDER_REFUND_PAYMENT_MISSING";

                throw error;
            }


            assertOrderPaymentConsistency({
                orderStatus:
                    normalizedNextStatus,

                paymentStatus:
                    latestPayment.status,

                paymentMethod:
                    latestPayment.method
            });
        }


        if (
            currentStatus ===
            normalizedNextStatus
        ) {

            const error =
                new Error(
                    "La commande possède déjà ce statut."
                );

            error.code =
                "ORDER_STATUS_UNCHANGED";

            throw error;
        }


        if (
            !canTransitionOrderStatus(
                order.order_type,
                currentStatus,
                normalizedNextStatus
            )
        ) {

            const error =
                new Error(
                    `Transition interdite : ${currentStatus} → ${normalizedNextStatus}.`
                );

            error.code =
                "ORDER_STATUS_INVALID_TRANSITION";

            throw error;
        }


        const [
            updateResult
        ] =
            await connection.execute(`
                UPDATE orders
                SET
                    status = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND status = ?
            `, [
                normalizedNextStatus,
                order.id,
                currentStatus
            ]);


        if (
            updateResult.affectedRows !== 1
        ) {

            const error =
                new Error(
                    "La commande a été modifiée entre-temps. Rechargez la page."
                );

            error.code =
                "ORDER_STATUS_CONFLICT";

            throw error;
        }


        const finalComment =
            String(
                comment || ""
            )
                .trim()
                .slice(
                    0,
                    1000
                )
            ||
            `Statut modifié : ${ORDER_STATUS_LABELS[currentStatus] || currentStatus} → ${ORDER_STATUS_LABELS[normalizedNextStatus] || normalizedNextStatus}`;


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
                ?,
                ?,
                NULL,
                ?
            )
        `, [
            order.id,
            normalizedNextStatus,
            finalComment,
            adminUserId || null
        ]);



        /* =================================================
           SYNCHRONISATION LIVRAISON

           La commande reste la source principale du workflow.
           Pour les commandes DELIVERY, deliveries suit les
           étapes opérationnelles correspondantes.
        ================================================= */

        if (
            order.order_type ===
            "DELIVERY"
        ) {

            await connection.execute(`
                INSERT INTO deliveries
                (
                    order_id,
                    status
                )
                VALUES
                (
                    ?,
                    'WAITING'
                )

                ON DUPLICATE KEY UPDATE
                    order_id = VALUES(order_id)
            `, [
                order.id
            ]);


            if (
                normalizedNextStatus ===
                "ON_THE_WAY"
            ) {

                await connection.execute(`
                    UPDATE deliveries

                    SET
                        status = 'ON_THE_WAY',
                        picked_up_at =
                            COALESCE(
                                picked_up_at,
                                CURRENT_TIMESTAMP
                            )

                    WHERE order_id = ?
                `, [
                    order.id
                ]);
            }


            if (
                normalizedNextStatus ===
                "DELIVERED"
            ) {

                await connection.execute(`
                    UPDATE deliveries

                    SET
                        status = 'DELIVERED',
                        delivered_at =
                            COALESCE(
                                delivered_at,
                                CURRENT_TIMESTAMP
                            )

                    WHERE order_id = ?
                `, [
                    order.id
                ]);
            }


            if (
                normalizedNextStatus ===
                "CANCELLED"
            ) {

                await connection.execute(`
                    UPDATE deliveries

                    SET status = 'FAILED'

                    WHERE order_id = ?
                      AND status <> 'DELIVERED'
                `, [
                    order.id
                ]);
            }
        }


        /* =================================================
           16.7 — CYCLE DE VIE AVANTAGE TIOP+
           Une commande annulée libère uniquement un avantage encore RESERVED.
           Un avantage USED (paiement déjà confirmé) n'est jamais recrédité ici.
        ================================================= */
        if (normalizedNextStatus === 'CANCELLED') {
            const [redemptionRows] = await connection.execute(`
                SELECT id, status FROM loyalty_redemptions
                WHERE order_id=? LIMIT 1 FOR UPDATE`, [order.id]);
            const redemption = redemptionRows[0] || null;
            if (redemption && redemption.status === 'RESERVED') {
                await connection.execute(`
                    UPDATE loyalty_redemptions
                    SET status='AVAILABLE', used_at=NULL, order_id=NULL
                    WHERE id=? AND status='RESERVED'`, [redemption.id]);
                await connection.execute(`
                    INSERT INTO loyalty_redemption_events
                    (redemption_id, order_id, event_type, from_status, to_status, note, created_at)
                    VALUES (?, ?, 'RELEASED', 'RESERVED', 'AVAILABLE', ?, NOW())`,
                    [redemption.id, order.id, 'Commande annulée avant consommation définitive.']);
            }
        }

        if (normalizedNextStatus === 'CANCELLED') {
            const [cardRedemptionRows] = await connection.execute(`
                SELECT id, card_id, points_cost, status FROM loyalty_card_redemptions
                WHERE order_id=? LIMIT 1 FOR UPDATE`, [order.id]);
            const cardRedemption = cardRedemptionRows[0] || null;
            if (cardRedemption && cardRedemption.status === 'RESERVED') {
                await connection.execute(`UPDATE loyalty_cards SET points_balance=points_balance+?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
                    [cardRedemption.points_cost, cardRedemption.card_id]);
                await connection.execute(`UPDATE loyalty_card_redemptions SET status='RESTORED',restored_at=NOW() WHERE id=? AND status='RESERVED'`,
                    [cardRedemption.id]);
                await connection.execute(`
                    INSERT INTO loyalty_card_transactions(card_id,order_id,transaction_type,points,description,created_by_admin_user_id)
                    VALUES (?,?,'REVERSAL',?,?,NULL)`,
                    [cardRedemption.card_id,order.id,cardRedemption.points_cost,'Récompense Tiop+ restituée après annulation de commande.']);
            }
        }

        await connection.commit();


        return {
            id:
                order.id,

            reference:
                order.reference,

            userId:
                order.user_id,

            orderType:
                order.order_type,

            previousStatus:
                currentStatus,

            status:
                normalizedNextStatus,

            statusLabel:
                ORDER_STATUS_LABELS[
                    normalizedNextStatus
                ]
                ||
                normalizedNextStatus,

            comment:
                finalComment,

            changedByAdminUserId:
                adminUserId || null,

            changedAt:
                new Date().toISOString(),

            allowedNextStatuses:
                getAllowedNextStatuses(
                    order.order_type,
                    normalizedNextStatus
                )
        };

    }
    catch (error) {

        try {

            await connection.rollback();

        }
        catch (rollbackError) {

            console.error(
                "Erreur rollback statut commande :",
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
   EXPORTS
========================================================= */

module.exports = {

    getCustomer,

    getAddresses,
    getAddressById,
    getPosCustomerAddresses,

    getRestaurants,
    getRestaurantById,

    getDeliveryZones,
    getDeliveryZoneById,

    calculateDeliveryFee,

    findByReference,

    findAllByUserId,

    findAllForAdmin,
    findForAdminByReference,
    getAdminOrderStats,

    ORDER_STATUS_LABELS,
    getAllowedNextStatuses,
    canTransitionOrderStatus,
    evaluateOrderPaymentConsistency,
    assertOrderPaymentConsistency,
    updateStatus,

    getOrderItems,
    getPaymentByOrderId,
    getStatusHistory,

    createFromCart,
    createFromPos,
    findPosOrderByIdempotencyKey
};
