const db =
    require("../config/database");


/* =========================================================
   HELPERS
========================================================= */

function normalizeText(
    value,
    maxLength
) {

    return String(
        value || ""
    )
        .trim()
        .slice(
            0,
            maxLength
        );
}


/* =========================================================
   LIVRAISON PAR COMMANDE
========================================================= */

async function findByOrderId(
    orderId
) {

    const rows =
        await db.query(`
            SELECT
                d.*,

                o.reference AS order_reference,
                o.order_type,
                o.status AS order_status,

                r.name AS restaurant_name,
                r.address AS restaurant_address,
                r.district AS restaurant_district,
                r.city AS restaurant_city,

                ua.recipient_name,
                ua.phone AS recipient_phone,
                ua.address_line1,
                ua.address_line2,
                ua.district AS delivery_district,
                ua.city AS delivery_city,
                ua.latitude AS delivery_latitude,
                ua.longitude AS delivery_longitude

            FROM deliveries d

            INNER JOIN orders o
                ON o.id = d.order_id

            INNER JOIN restaurants r
                ON r.id = o.restaurant_id

            LEFT JOIN user_addresses ua
                ON ua.id = o.delivery_address_id

            WHERE d.order_id = ?

            LIMIT 1
        `, [
            orderId
        ]);


    return rows[0] || null;
}


/* =========================================================
   LIVRAISON PAR REFERENCE COMMANDE
========================================================= */

async function findByOrderReference(
    reference
) {

    const rows =
        await db.query(`
            SELECT
                d.*,

                o.reference AS order_reference,
                o.order_type,
                o.status AS order_status,

                r.name AS restaurant_name,
                r.address AS restaurant_address,
                r.district AS restaurant_district,
                r.city AS restaurant_city,

                ua.recipient_name,
                ua.phone AS recipient_phone,
                ua.address_line1,
                ua.address_line2,
                ua.district AS delivery_district,
                ua.city AS delivery_city,
                ua.latitude AS delivery_latitude,
                ua.longitude AS delivery_longitude

            FROM deliveries d

            INNER JOIN orders o
                ON o.id = d.order_id

            INNER JOIN restaurants r
                ON r.id = o.restaurant_id

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
   CREER LA LIVRAISON SI ABSENTE
========================================================= */

async function ensureForOrder(
    reference
) {

    const connection =
        await db.pool.getConnection();


    try {

        await connection.beginTransaction();


        const [
            orderRows
        ] =
            await connection.execute(`
                SELECT
                    id,
                    reference,
                    order_type,
                    status

                FROM orders

                WHERE reference = ?

                LIMIT 1
                FOR UPDATE
            `, [
                reference
            ]);


        const order =
            orderRows[0];


        if (!order) {

            const error =
                new Error(
                    "Commande introuvable."
                );

            error.code =
                "ORDER_NOT_FOUND";

            throw error;
        }


        if (
            order.order_type !==
            "DELIVERY"
        ) {

            const error =
                new Error(
                    "Cette commande n'est pas une livraison."
                );

            error.code =
                "ORDER_NOT_DELIVERY";

            throw error;
        }


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


        const [
            rows
        ] =
            await connection.execute(`
                SELECT *
                FROM deliveries
                WHERE order_id = ?
                LIMIT 1
            `, [
                order.id
            ]);


        await connection.commit();


        return rows[0] || null;

    }
    catch (error) {

        try {

            await connection.rollback();

        }
        catch (rollbackError) {

            console.error(
                "Erreur rollback création livraison :",
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
   AFFECTER / MODIFIER LE LIVREUR

   13.4 :
   affectation opérationnelle par nom + téléphone.

   driver_user_id reste volontairement NULL tant que
   l'authentification dédiée du livreur n'est pas créée.
========================================================= */

async function assignDriver({
    reference,
    driverName,
    driverPhone,
    estimatedArrival = null
}) {

    const name =
        normalizeText(
            driverName,
            160
        );


    const phone =
        normalizeText(
            driverPhone,
            40
        );


    if (!name) {

        const error =
            new Error(
                "Le nom du livreur est obligatoire."
            );

        error.code =
            "DRIVER_NAME_REQUIRED";

        throw error;
    }


    if (!phone) {

        const error =
            new Error(
                "Le téléphone du livreur est obligatoire."
            );

        error.code =
            "DRIVER_PHONE_REQUIRED";

        throw error;
    }


    const connection =
        await db.pool.getConnection();


    try {

        await connection.beginTransaction();


        const [
            orderRows
        ] =
            await connection.execute(`
                SELECT
                    id,
                    reference,
                    order_type,
                    status

                FROM orders

                WHERE reference = ?

                LIMIT 1
                FOR UPDATE
            `, [
                reference
            ]);


        const order =
            orderRows[0];


        if (!order) {

            const error =
                new Error(
                    "Commande introuvable."
                );

            error.code =
                "ORDER_NOT_FOUND";

            throw error;
        }


        if (
            order.order_type !==
            "DELIVERY"
        ) {

            const error =
                new Error(
                    "Cette commande n'est pas une livraison."
                );

            error.code =
                "ORDER_NOT_DELIVERY";

            throw error;
        }


        if (
            [
                "DELIVERED",
                "CANCELLED",
                "REFUNDED"
            ].includes(
                order.status
            )
        ) {

            const error =
                new Error(
                    "Impossible d'affecter un livreur à une commande terminée."
                );

            error.code =
                "DELIVERY_ORDER_TERMINAL";

            throw error;
        }


        await connection.execute(`
            INSERT INTO deliveries
            (
                order_id,
                driver_name,
                driver_phone,
                driver_user_id,
                status,
                estimated_arrival
            )
            VALUES
            (
                ?,
                ?,
                ?,
                NULL,
                'ASSIGNED',
                ?
            )

            ON DUPLICATE KEY UPDATE
                driver_name = VALUES(driver_name),
                driver_phone = VALUES(driver_phone),
                driver_user_id = NULL,
                status =
                    CASE
                        WHEN status IN (
                            'WAITING',
                            'ASSIGNED'
                        )
                        THEN 'ASSIGNED'
                        ELSE status
                    END,
                estimated_arrival = VALUES(estimated_arrival)
        `, [
            order.id,
            name,
            phone,
            estimatedArrival || null
        ]);


        const [
            rows
        ] =
            await connection.execute(`
                SELECT *
                FROM deliveries
                WHERE order_id = ?
                LIMIT 1
            `, [
                order.id
            ]);


        await connection.commit();


        return {
            ...rows[0],

            order_reference:
                order.reference,

            order_status:
                order.status
        };

    }
    catch (error) {

        try {

            await connection.rollback();

        }
        catch (rollbackError) {

            console.error(
                "Erreur rollback affectation livreur :",
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
   LISTE ADMIN LIVRAISONS
========================================================= */

async function findAllForAdmin(
    filters = {}
) {

    const search =
        normalizeText(
            filters.search,
            160
        );


    const status =
        normalizeText(
            filters.status,
            30
        )
            .toUpperCase();


    let sql = `
        SELECT
            d.id,
            d.order_id,
            d.driver_name,
            d.driver_phone,
            d.driver_user_id,
            d.status,
            d.estimated_arrival,
            d.picked_up_at,
            d.arrived_at,
            d.delivered_at,
            d.created_at,

            o.reference AS order_reference,
            o.status AS order_status,
            o.total_amount,
            o.currency,

            r.name AS restaurant_name,

            ua.recipient_name,
            ua.address_line1,
            ua.district AS delivery_district,
            ua.city AS delivery_city,

            (
                SELECT dtp.recorded_at
                FROM delivery_tracking_points dtp
                WHERE dtp.delivery_id = d.id
                ORDER BY
                    dtp.recorded_at DESC,
                    dtp.id DESC
                LIMIT 1
            ) AS last_gps_at

        FROM deliveries d

        INNER JOIN orders o
            ON o.id = d.order_id

        INNER JOIN restaurants r
            ON r.id = o.restaurant_id

        LEFT JOIN user_addresses ua
            ON ua.id = o.delivery_address_id

        WHERE o.order_type = 'DELIVERY'
    `;


    const params = [];


    if (search) {

        const value =
            `%${search}%`;


        sql += `
            AND
            (
                o.reference LIKE ?
                OR d.driver_name LIKE ?
                OR d.driver_phone LIKE ?
                OR ua.recipient_name LIKE ?
                OR ua.address_line1 LIKE ?
                OR r.name LIKE ?
            )
        `;


        params.push(
            value,
            value,
            value,
            value,
            value,
            value
        );
    }


    if (status) {

        sql += `
            AND d.status = ?
        `;

        params.push(
            status
        );
    }


    sql += `
        ORDER BY
            d.created_at DESC,
            d.id DESC
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
   STATS ADMIN
========================================================= */

async function getAdminStats() {

    const rows =
        await db.query(`
            SELECT
                COUNT(*) AS total,

                COALESCE(
                    SUM(
                        status = 'WAITING'
                    ),
                    0
                ) AS waiting,

                COALESCE(
                    SUM(
                        status = 'ASSIGNED'
                    ),
                    0
                ) AS assigned,

                COALESCE(
                    SUM(
                        status = 'ON_THE_WAY'
                    ),
                    0
                ) AS on_the_way,

                COALESCE(
                    SUM(
                        status = 'DELIVERED'
                    ),
                    0
                ) AS delivered

            FROM deliveries
        `);


    return rows[0] || {
        total: 0,
        waiting: 0,
        assigned: 0,
        on_the_way: 0,
        delivered: 0
    };
}


/* =========================================================
   DERNIERE POSITION GPS
========================================================= */

async function getLatestTrackingPoint(
    deliveryId
) {

    const rows =
        await db.query(`
            SELECT
                id,
                delivery_id,
                latitude,
                longitude,
                heading,
                speed_kmh,
                accuracy_meters,
                recorded_at

            FROM delivery_tracking_points

            WHERE delivery_id = ?

            ORDER BY
                recorded_at DESC,
                id DESC

            LIMIT 1
        `, [
            deliveryId
        ]);


    return rows[0] || null;
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

    findByOrderId,
    findByOrderReference,

    ensureForOrder,
    assignDriver,

    findAllForAdmin,
    getAdminStats,

    getLatestTrackingPoint
};
