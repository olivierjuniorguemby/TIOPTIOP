const db =
    require("../config/database");


/* =========================================================
   HELPERS
========================================================= */

function clean(
    value,
    maxLength = 500
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


function toFiniteNumber(
    value
) {

    const number =
        Number(
            value
        );


    return Number.isFinite(
        number
    )
        ? number
        : null;
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
                r.latitude AS restaurant_latitude,
                r.longitude AS restaurant_longitude,

                ua.recipient_name,
                ua.phone AS recipient_phone,
                ua.address_line1,
                ua.address_line2,
                ua.district AS delivery_district,
                ua.city AS delivery_city,
                ua.latitude AS delivery_latitude,
                ua.longitude AS delivery_longitude,

                dd.public_id AS driver_public_id,
                dd.first_name AS driver_first_name,
                dd.last_name AS driver_last_name,
                dd.display_name AS driver_display_name,
                dd.email AS driver_email,
                dd.availability_status AS driver_availability,
                dd.vehicle_type,
                dd.vehicle_plate

            FROM deliveries d

            INNER JOIN orders o
                ON o.id = d.order_id

            INNER JOIN restaurants r
                ON r.id = o.restaurant_id

            LEFT JOIN user_addresses ua
                ON ua.id = o.delivery_address_id

            LEFT JOIN delivery_drivers dd
                ON dd.id = d.driver_id

            WHERE d.order_id = ?

            LIMIT 1
        `, [
            orderId
        ]);


    return rows[0] || null;
}


/* =========================================================
   LIVRAISON PAR REFERENCE
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
                r.latitude AS restaurant_latitude,
                r.longitude AS restaurant_longitude,

                ua.recipient_name,
                ua.phone AS recipient_phone,
                ua.address_line1,
                ua.address_line2,
                ua.district AS delivery_district,
                ua.city AS delivery_city,
                ua.latitude AS delivery_latitude,
                ua.longitude AS delivery_longitude,

                dd.public_id AS driver_public_id,
                dd.first_name AS driver_first_name,
                dd.last_name AS driver_last_name,
                dd.display_name AS driver_display_name,
                dd.email AS driver_email,
                dd.availability_status AS driver_availability,
                dd.vehicle_type,
                dd.vehicle_plate

            FROM deliveries d

            INNER JOIN orders o
                ON o.id = d.order_id

            INNER JOIN restaurants r
                ON r.id = o.restaurant_id

            LEFT JOIN user_addresses ua
                ON ua.id = o.delivery_address_id

            LEFT JOIN delivery_drivers dd
                ON dd.id = d.driver_id

            WHERE o.reference = ?

            LIMIT 1
        `, [
            reference
        ]);


    return rows[0] || null;
}


/* =========================================================
   CREER SI ABSENTE
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
                status,
                acceptance_status
            )
            VALUES
            (
                ?,
                'WAITING',
                'PENDING'
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

        await connection.rollback();

        throw error;

    }
    finally {

        connection.release();
    }
}


/* =========================================================
   AFFECTATION LIVREUR
========================================================= */

async function assignDriver({
    reference,
    driverId,
    estimatedArrival = null
}) {

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


        const [
            driverRows
        ] =
            await connection.execute(`
                SELECT
                    id,
                    first_name,
                    last_name,
                    display_name,
                    phone,
                    status,
                    availability_status

                FROM delivery_drivers

                WHERE id = ?

                LIMIT 1
                FOR UPDATE
            `, [
                driverId
            ]);


        const driver =
            driverRows[0];


        if (
            !driver ||
            driver.status !== "ACTIVE"
        ) {

            const error =
                new Error(
                    "Livreur indisponible ou introuvable."
                );

            error.code =
                "DRIVER_UNAVAILABLE";

            throw error;
        }


        const driverName =
            driver.display_name
            ||
            [
                driver.first_name,
                driver.last_name
            ]
                .filter(Boolean)
                .join(" ");


        await connection.execute(`
            INSERT INTO deliveries
            (
                order_id,

                driver_name,
                driver_phone,

                driver_id,

                status,
                acceptance_status,

                assigned_at,
                estimated_arrival
            )
            VALUES
            (
                ?,
                ?,
                ?,
                ?,
                'ASSIGNED',
                'PENDING',
                NOW(),
                ?
            )

            ON DUPLICATE KEY UPDATE

                driver_name =
                    VALUES(driver_name),

                driver_phone =
                    VALUES(driver_phone),

                driver_id =
                    VALUES(driver_id),

                status =
                    'ASSIGNED',

                acceptance_status =
                    'PENDING',

                assigned_at =
                    NOW(),

                accepted_at =
                    NULL,

                rejected_at =
                    NULL,

                rejection_reason =
                    NULL,

                estimated_arrival =
                    VALUES(estimated_arrival)
        `, [
            order.id,

            driverName,
            driver.phone,

            driver.id,

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

        await connection.rollback();

        throw error;

    }
    finally {

        connection.release();
    }
}


/* =========================================================
   LISTE ADMIN
========================================================= */

async function findAllForAdmin(
    filters = {}
) {

    const search =
        clean(
            filters.search,
            160
        );


    const status =
        clean(
            filters.status,
            30
        )
            .toUpperCase();


    let sql = `
        SELECT
            d.id,
            d.order_id,

            d.driver_id,
            d.driver_name,
            d.driver_phone,

            d.status,
            d.acceptance_status,

            d.estimated_arrival,

            d.assigned_at,
            d.accepted_at,
            d.rejected_at,

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

            dd.availability_status AS driver_availability,
            dd.vehicle_type,
            dd.vehicle_plate,

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

        LEFT JOIN delivery_drivers dd
            ON dd.id = d.driver_id

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


    return await db.query(
        sql,
        params
    );
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
   LIVRAISONS D'UN LIVREUR
========================================================= */

async function findAllForDriver(
    driverId
) {

    return await db.query(`
        SELECT
            d.*,

            o.reference AS order_reference,
            o.status AS order_status,
            o.total_amount,
            o.currency,

            r.name AS restaurant_name,
            r.address AS restaurant_address,
            r.district AS restaurant_district,
            r.city AS restaurant_city,
            r.latitude AS restaurant_latitude,
            r.longitude AS restaurant_longitude,

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

        WHERE d.driver_id = ?

        ORDER BY
            d.status = 'ASSIGNED' DESC,
            d.status = 'ON_THE_WAY' DESC,
            d.id DESC
    `, [
        driverId
    ]);
}


/* =========================================================
   DETAIL LIVREUR
========================================================= */

async function findForDriverByReference(
    driverId,
    reference
) {

    const rows =
        await db.query(`
            SELECT
                d.*,

                o.reference AS order_reference,
                o.status AS order_status,
                o.total_amount,
                o.currency,
                o.customer_note,

                r.name AS restaurant_name,
                r.address AS restaurant_address,
                r.district AS restaurant_district,
                r.city AS restaurant_city,
                r.phone AS restaurant_phone,
                r.latitude AS restaurant_latitude,
                r.longitude AS restaurant_longitude,

                ua.recipient_name,
                ua.phone AS recipient_phone,
                ua.address_line1,
                ua.address_line2,
                ua.district AS delivery_district,
                ua.city AS delivery_city,
                ua.latitude AS delivery_latitude,
                ua.longitude AS delivery_longitude,
                ua.delivery_instructions

            FROM deliveries d

            INNER JOIN orders o
                ON o.id = d.order_id

            INNER JOIN restaurants r
                ON r.id = o.restaurant_id

            LEFT JOIN user_addresses ua
                ON ua.id = o.delivery_address_id

            WHERE d.driver_id = ?
              AND o.reference = ?

            LIMIT 1
        `, [
            driverId,
            reference
        ]);


    return rows[0] || null;
}


/* =========================================================
   ACCEPTER
========================================================= */

async function acceptAssignment(
    driverId,
    reference
) {

    const connection =
        await db.pool.getConnection();


    try {

        await connection.beginTransaction();


        const [
            rows
        ] =
            await connection.execute(`
                SELECT
                    d.id,
                    d.status,
                    d.acceptance_status,
                    o.reference

                FROM deliveries d

                INNER JOIN orders o
                    ON o.id = d.order_id

                WHERE d.driver_id = ?
                  AND o.reference = ?

                LIMIT 1
                FOR UPDATE
            `, [
                driverId,
                reference
            ]);


        const delivery =
            rows[0];


        if (!delivery) {

            const error =
                new Error(
                    "Livraison introuvable."
                );

            error.code =
                "DELIVERY_NOT_FOUND";

            throw error;
        }


        if (
            delivery.status !==
            "ASSIGNED"
        ) {

            const error =
                new Error(
                    "Cette livraison ne peut plus être acceptée."
                );

            error.code =
                "DELIVERY_NOT_ASSIGNABLE";

            throw error;
        }


        await connection.execute(`
            UPDATE deliveries

            SET
                acceptance_status = 'ACCEPTED',
                accepted_at = NOW(),
                rejected_at = NULL,
                rejection_reason = NULL

            WHERE id = ?
        `, [
            delivery.id
        ]);


        await connection.execute(`
            UPDATE delivery_drivers

            SET availability_status = 'BUSY'

            WHERE id = ?
        `, [
            driverId
        ]);


        await connection.commit();


        return {
            deliveryId:
                delivery.id,

            reference:
                delivery.reference,

            status:
                "ASSIGNED",

            acceptanceStatus:
                "ACCEPTED"
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
   REFUSER

   13.6 :
   on ne force plus AVAILABLE s'il existe une autre
   livraison active pour le même livreur.
========================================================= */

async function rejectAssignment(
    driverId,
    reference,
    reason
) {

    const connection =
        await db.pool.getConnection();


    try {

        await connection.beginTransaction();


        const [
            rows
        ] =
            await connection.execute(`
                SELECT
                    d.id,
                    d.status,
                    o.reference

                FROM deliveries d

                INNER JOIN orders o
                    ON o.id = d.order_id

                WHERE d.driver_id = ?
                  AND o.reference = ?

                LIMIT 1
                FOR UPDATE
            `, [
                driverId,
                reference
            ]);


        const delivery =
            rows[0];


        if (!delivery) {

            const error =
                new Error(
                    "Livraison introuvable."
                );

            error.code =
                "DELIVERY_NOT_FOUND";

            throw error;
        }


        if (
            delivery.status !==
            "ASSIGNED"
        ) {

            const error =
                new Error(
                    "Cette affectation ne peut plus être refusée."
                );

            error.code =
                "DELIVERY_NOT_ASSIGNABLE";

            throw error;
        }


        await connection.execute(`
            UPDATE deliveries

            SET
                status = 'WAITING',
                acceptance_status = 'REJECTED',
                rejected_at = NOW(),
                rejection_reason = ?,
                driver_id = NULL,
                estimated_arrival = NULL

            WHERE id = ?
        `, [
            clean(
                reason,
                500
            )
            ||
            "Aucun motif indiqué.",

            delivery.id
        ]);


        const [
            activeRows
        ] =
            await connection.execute(`
                SELECT COUNT(*) AS total

                FROM deliveries

                WHERE driver_id = ?
                  AND status NOT IN (
                      'DELIVERED',
                      'FAILED',
                      'WAITING'
                  )
                  AND acceptance_status <> 'REJECTED'
            `, [
                driverId
            ]);


        const hasOtherActive =
            Number(
                activeRows[0]?.total || 0
            ) > 0;


        await connection.execute(`
            UPDATE delivery_drivers

            SET availability_status = ?

            WHERE id = ?
              AND status = 'ACTIVE'
        `, [
            hasOtherActive
                ? "BUSY"
                : "AVAILABLE",

            driverId
        ]);


        await connection.commit();


        return {
            deliveryId:
                delivery.id,

            reference:
                delivery.reference,

            status:
                "WAITING",

            acceptanceStatus:
                "REJECTED"
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
   RECUPERER
========================================================= */

async function markPickedUp(
    driverId,
    reference
) {

    const connection =
        await db.pool.getConnection();


    try {

        await connection.beginTransaction();


        const [
            rows
        ] =
            await connection.execute(`
                SELECT
                    d.id,
                    d.status,
                    d.acceptance_status,

                    o.status AS order_status,
                    o.reference

                FROM deliveries d

                INNER JOIN orders o
                    ON o.id = d.order_id

                WHERE d.driver_id = ?
                  AND o.reference = ?

                LIMIT 1
                FOR UPDATE
            `, [
                driverId,
                reference
            ]);


        const delivery =
            rows[0];


        if (!delivery) {
            throw new Error(
                "Livraison introuvable."
            );
        }


        if (
            delivery.acceptance_status !==
            "ACCEPTED"
        ) {

            throw new Error(
                "Vous devez d'abord accepter cette livraison."
            );
        }


        if (
            delivery.order_status !==
            "READY"
        ) {

            throw new Error(
                "La commande n'est pas encore prête."
            );
        }


        if (
            delivery.status !==
            "ASSIGNED"
        ) {

            throw new Error(
                "Cette livraison a déjà été prise en charge."
            );
        }


        await connection.execute(`
            UPDATE deliveries

            SET
                status = 'PICKED_UP',
                picked_up_at = NOW()

            WHERE id = ?
        `, [
            delivery.id
        ]);


        await connection.commit();


        return {
            deliveryId:
                delivery.id,

            reference:
                delivery.reference,

            status:
                "PICKED_UP"
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
   ARRIVE
========================================================= */

async function markArrived(
    driverId,
    reference
) {

    const result =
        await db.query(`
            UPDATE deliveries d

            INNER JOIN orders o
                ON o.id = d.order_id

            SET
                d.status = 'ARRIVED',
                d.arrived_at = NOW()

            WHERE d.driver_id = ?
              AND o.reference = ?
              AND d.status = 'ON_THE_WAY'
        `, [
            driverId,
            reference
        ]);


    if (
        result.affectedRows !== 1
    ) {

        throw new Error(
            "La livraison ne peut pas être marquée comme arrivée."
        );
    }


    return {
        reference,

        status:
            "ARRIVED"
    };
}


/* =========================================================
   LIBERER LIVREUR

   IMPORTANT :
   si le livreur possède encore une autre livraison active,
   il reste BUSY.
========================================================= */

async function releaseDriver(
    driverId
) {

    const rows =
        await db.query(`
            SELECT COUNT(*) AS total

            FROM deliveries

            WHERE driver_id = ?
              AND status NOT IN (
                  'DELIVERED',
                  'FAILED',
                  'WAITING'
              )
              AND acceptance_status <> 'REJECTED'
        `, [
            driverId
        ]);


    const activeCount =
        Number(
            rows[0]?.total || 0
        );


    await db.query(`
        UPDATE delivery_drivers

        SET availability_status = ?

        WHERE id = ?
          AND status = 'ACTIVE'
    `, [
        activeCount > 0
            ? "BUSY"
            : "AVAILABLE",

        driverId
    ]);


    return {
        activeCount,

        availability:
            activeCount > 0
                ? "BUSY"
                : "AVAILABLE"
    };
}


/* =========================================================
   GPS - ENREGISTRER UNE POSITION REELLE

   Sécurité :
   - la livraison doit appartenir au livreur connecté ;
   - affectation acceptée ;
   - livraison ON_THE_WAY ;
   - coordonnées valides ;
   - limite serveur : pas plus d'un point toutes les 2 sec.
========================================================= */

async function recordTrackingPoint({
    driverId,
    reference,
    latitude,
    longitude,
    heading = null,
    speedMps = null,
    accuracyMeters = null
}) {

    const lat =
        toFiniteNumber(
            latitude
        );


    const lng =
        toFiniteNumber(
            longitude
        );


    if (
        lat === null ||
        lng === null ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
    ) {

        const error =
            new Error(
                "Coordonnées GPS invalides."
            );

        error.code =
            "GPS_INVALID_COORDINATES";

        throw error;
    }


    const normalizedHeading =
        toFiniteNumber(
            heading
        );


    const normalizedSpeedMps =
        toFiniteNumber(
            speedMps
        );


    const normalizedAccuracy =
        toFiniteNumber(
            accuracyMeters
        );


    const speedKmh =
        normalizedSpeedMps !== null &&
        normalizedSpeedMps >= 0

            ? Math.min(
                normalizedSpeedMps * 3.6,
                300
            )

            : null;


    const finalHeading =
        normalizedHeading !== null &&
        normalizedHeading >= 0 &&
        normalizedHeading <= 360

            ? normalizedHeading

            : null;


    const finalAccuracy =
        normalizedAccuracy !== null &&
        normalizedAccuracy >= 0

            ? Math.min(
                normalizedAccuracy,
                10000
            )

            : null;


    const connection =
        await db.pool.getConnection();


    try {

        await connection.beginTransaction();


        const [
            rows
        ] =
            await connection.execute(`
                SELECT
                    d.id,
                    d.driver_id,
                    d.status,
                    d.acceptance_status,

                    o.reference

                FROM deliveries d

                INNER JOIN orders o
                    ON o.id = d.order_id

                WHERE d.driver_id = ?
                  AND o.reference = ?

                LIMIT 1
                FOR UPDATE
            `, [
                driverId,
                reference
            ]);


        const delivery =
            rows[0];


        if (!delivery) {

            const error =
                new Error(
                    "Livraison GPS introuvable ou non autorisée."
                );

            error.code =
                "GPS_DELIVERY_NOT_FOUND";

            throw error;
        }


        if (
            delivery.acceptance_status !==
            "ACCEPTED"
        ) {

            const error =
                new Error(
                    "Cette livraison n'a pas été acceptée."
                );

            error.code =
                "GPS_DELIVERY_NOT_ACCEPTED";

            throw error;
        }


        if (
            delivery.status !==
            "ON_THE_WAY"
        ) {

            const error =
                new Error(
                    "Le suivi GPS est autorisé uniquement pendant la livraison."
                );

            error.code =
                "GPS_DELIVERY_NOT_ACTIVE";

            throw error;
        }


        const [
            lastRows
        ] =
            await connection.execute(`
                SELECT
                    id,
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
                delivery.id
            ]);


        const lastPoint =
            lastRows[0] || null;


        if (
            lastPoint
            &&
            (
                Date.now()
                -
                new Date(
                    lastPoint.recorded_at
                ).getTime()
            ) < 2000
        ) {

            await connection.commit();


            return {
                inserted:
                    false,

                rateLimited:
                    true,

                deliveryId:
                    delivery.id,

                reference,

                latitude:
                    Number(
                        lastPoint.latitude
                    ),

                longitude:
                    Number(
                        lastPoint.longitude
                    ),

                heading:
                    lastPoint.heading !== null
                        ? Number(lastPoint.heading)
                        : null,

                speedKmh:
                    lastPoint.speed_kmh !== null
                        ? Number(lastPoint.speed_kmh)
                        : null,

                accuracyMeters:
                    lastPoint.accuracy_meters !== null
                        ? Number(lastPoint.accuracy_meters)
                        : null,

                recordedAt:
                    lastPoint.recorded_at
            };
        }


        const [
            result
        ] =
            await connection.execute(`
                INSERT INTO delivery_tracking_points
                (
                    delivery_id,
                    latitude,
                    longitude,
                    heading,
                    speed_kmh,
                    accuracy_meters
                )
                VALUES
                (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?
                )
            `, [
                delivery.id,
                lat,
                lng,
                finalHeading,
                speedKmh,
                finalAccuracy
            ]);


        const [
            insertedRows
        ] =
            await connection.execute(`
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

                WHERE id = ?

                LIMIT 1
            `, [
                result.insertId
            ]);


        const point =
            insertedRows[0];


        await connection.commit();


        return {
            inserted:
                true,

            rateLimited:
                false,

            id:
                point.id,

            deliveryId:
                point.delivery_id,

            reference,

            latitude:
                Number(
                    point.latitude
                ),

            longitude:
                Number(
                    point.longitude
                ),

            heading:
                point.heading !== null
                    ? Number(point.heading)
                    : null,

            speedKmh:
                point.speed_kmh !== null
                    ? Number(point.speed_kmh)
                    : null,

            accuracyMeters:
                point.accuracy_meters !== null
                    ? Number(point.accuracy_meters)
                    : null,

            recordedAt:
                point.recorded_at
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

    findAllForDriver,
    findForDriverByReference,

    acceptAssignment,
    rejectAssignment,

    markPickedUp,
    markArrived,

    releaseDriver,

    recordTrackingPoint,
    getLatestTrackingPoint
};
