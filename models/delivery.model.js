const db = require("../config/database");

function clean(value, maxLength = 500) {
    return String(value || "").trim().slice(0, maxLength);
}

async function findByOrderId(orderId) {
    const rows = await db.query(`
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
        INNER JOIN orders o ON o.id = d.order_id
        INNER JOIN restaurants r ON r.id = o.restaurant_id
        LEFT JOIN user_addresses ua ON ua.id = o.delivery_address_id
        LEFT JOIN delivery_drivers dd ON dd.id = d.driver_id
        WHERE d.order_id = ?
        LIMIT 1
    `, [orderId]);

    return rows[0] || null;
}

async function findByOrderReference(reference) {
    const rows = await db.query(`
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
        INNER JOIN orders o ON o.id = d.order_id
        INNER JOIN restaurants r ON r.id = o.restaurant_id
        LEFT JOIN user_addresses ua ON ua.id = o.delivery_address_id
        LEFT JOIN delivery_drivers dd ON dd.id = d.driver_id
        WHERE o.reference = ?
        LIMIT 1
    `, [reference]);

    return rows[0] || null;
}

async function ensureForOrder(reference) {
    const connection = await db.pool.getConnection();

    try {
        await connection.beginTransaction();

        const [orderRows] = await connection.execute(`
            SELECT id, reference, order_type, status
            FROM orders
            WHERE reference = ?
            LIMIT 1
            FOR UPDATE
        `, [reference]);

        const order = orderRows[0];

        if (!order) {
            const error = new Error("Commande introuvable.");
            error.code = "ORDER_NOT_FOUND";
            throw error;
        }

        if (order.order_type !== "DELIVERY") {
            const error = new Error("Cette commande n'est pas une livraison.");
            error.code = "ORDER_NOT_DELIVERY";
            throw error;
        }

        await connection.execute(`
            INSERT INTO deliveries
            (order_id, status, acceptance_status)
            VALUES (?, 'WAITING', 'PENDING')
            ON DUPLICATE KEY UPDATE order_id = VALUES(order_id)
        `, [order.id]);

        const [rows] = await connection.execute(`
            SELECT * FROM deliveries
            WHERE order_id = ?
            LIMIT 1
        `, [order.id]);

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

async function assignDriver({
    reference,
    driverId,
    estimatedArrival = null
}) {
    const connection = await db.pool.getConnection();

    try {
        await connection.beginTransaction();

        const [orderRows] = await connection.execute(`
            SELECT id, reference, order_type, status
            FROM orders
            WHERE reference = ?
            LIMIT 1
            FOR UPDATE
        `, [reference]);

        const order = orderRows[0];

        if (!order) {
            const error = new Error("Commande introuvable.");
            error.code = "ORDER_NOT_FOUND";
            throw error;
        }

        if (order.order_type !== "DELIVERY") {
            const error = new Error("Cette commande n'est pas une livraison.");
            error.code = "ORDER_NOT_DELIVERY";
            throw error;
        }

        if (["DELIVERED","CANCELLED","REFUNDED"].includes(order.status)) {
            const error = new Error("Impossible d'affecter un livreur à une commande terminée.");
            error.code = "DELIVERY_ORDER_TERMINAL";
            throw error;
        }

        const [driverRows] = await connection.execute(`
            SELECT
                id, first_name, last_name, display_name,
                phone, status, availability_status
            FROM delivery_drivers
            WHERE id = ?
            LIMIT 1
            FOR UPDATE
        `, [driverId]);

        const driver = driverRows[0];

        if (!driver || driver.status !== "ACTIVE") {
            const error = new Error("Livreur indisponible ou introuvable.");
            error.code = "DRIVER_UNAVAILABLE";
            throw error;
        }

        const driverName =
            driver.display_name
            ||
            [driver.first_name, driver.last_name]
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
            VALUES (?, ?, ?, ?, 'ASSIGNED', 'PENDING', NOW(), ?)
            ON DUPLICATE KEY UPDATE
                driver_name = VALUES(driver_name),
                driver_phone = VALUES(driver_phone),
                driver_id = VALUES(driver_id),
                status = 'ASSIGNED',
                acceptance_status = 'PENDING',
                assigned_at = NOW(),
                accepted_at = NULL,
                rejected_at = NULL,
                rejection_reason = NULL,
                estimated_arrival = VALUES(estimated_arrival)
        `, [
            order.id,
            driverName,
            driver.phone,
            driver.id,
            estimatedArrival || null
        ]);

        const [rows] = await connection.execute(`
            SELECT * FROM deliveries
            WHERE order_id = ?
            LIMIT 1
        `, [order.id]);

        await connection.commit();

        return {
            ...rows[0],
            order_reference: order.reference,
            order_status: order.status
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

async function findAllForAdmin(filters = {}) {
    const search = clean(filters.search, 160);
    const status = clean(filters.status, 30).toUpperCase();

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
                ORDER BY dtp.recorded_at DESC, dtp.id DESC
                LIMIT 1
            ) AS last_gps_at
        FROM deliveries d
        INNER JOIN orders o ON o.id = d.order_id
        INNER JOIN restaurants r ON r.id = o.restaurant_id
        LEFT JOIN user_addresses ua ON ua.id = o.delivery_address_id
        LEFT JOIN delivery_drivers dd ON dd.id = d.driver_id
        WHERE o.order_type = 'DELIVERY'
    `;

    const params = [];

    if (search) {
        const value = `%${search}%`;
        sql += `
            AND (
                o.reference LIKE ?
                OR d.driver_name LIKE ?
                OR d.driver_phone LIKE ?
                OR ua.recipient_name LIKE ?
                OR ua.address_line1 LIKE ?
                OR r.name LIKE ?
            )
        `;
        params.push(value, value, value, value, value, value);
    }

    if (status) {
        sql += ` AND d.status = ? `;
        params.push(status);
    }

    sql += ` ORDER BY d.created_at DESC, d.id DESC `;

    return await db.query(sql, params);
}

async function getAdminStats() {
    const rows = await db.query(`
        SELECT
            COUNT(*) AS total,
            COALESCE(SUM(status = 'WAITING'), 0) AS waiting,
            COALESCE(SUM(status = 'ASSIGNED'), 0) AS assigned,
            COALESCE(SUM(status = 'ON_THE_WAY'), 0) AS on_the_way,
            COALESCE(SUM(status = 'DELIVERED'), 0) AS delivered
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

async function findAllForDriver(driverId) {
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
            ua.recipient_name,
            ua.phone AS recipient_phone,
            ua.address_line1,
            ua.address_line2,
            ua.district AS delivery_district,
            ua.city AS delivery_city,
            ua.latitude AS delivery_latitude,
            ua.longitude AS delivery_longitude
        FROM deliveries d
        INNER JOIN orders o ON o.id = d.order_id
        INNER JOIN restaurants r ON r.id = o.restaurant_id
        LEFT JOIN user_addresses ua ON ua.id = o.delivery_address_id
        WHERE d.driver_id = ?
        ORDER BY
            d.status = 'ASSIGNED' DESC,
            d.status = 'ON_THE_WAY' DESC,
            d.id DESC
    `, [driverId]);
}

async function findForDriverByReference(driverId, reference) {
    const rows = await db.query(`
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
        INNER JOIN orders o ON o.id = d.order_id
        INNER JOIN restaurants r ON r.id = o.restaurant_id
        LEFT JOIN user_addresses ua ON ua.id = o.delivery_address_id
        WHERE d.driver_id = ?
          AND o.reference = ?
        LIMIT 1
    `, [driverId, reference]);

    return rows[0] || null;
}

async function acceptAssignment(driverId, reference) {
    const connection = await db.pool.getConnection();

    try {
        await connection.beginTransaction();

        const [rows] = await connection.execute(`
            SELECT d.id, d.status, d.acceptance_status, o.reference
            FROM deliveries d
            INNER JOIN orders o ON o.id = d.order_id
            WHERE d.driver_id = ?
              AND o.reference = ?
            LIMIT 1
            FOR UPDATE
        `, [driverId, reference]);

        const delivery = rows[0];

        if (!delivery) {
            const error = new Error("Livraison introuvable.");
            error.code = "DELIVERY_NOT_FOUND";
            throw error;
        }

        if (delivery.status !== "ASSIGNED") {
            const error = new Error("Cette livraison ne peut plus être acceptée.");
            error.code = "DELIVERY_NOT_ASSIGNABLE";
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
        `, [delivery.id]);

        await connection.execute(`
            UPDATE delivery_drivers
            SET availability_status = 'BUSY'
            WHERE id = ?
        `, [driverId]);

        await connection.commit();

        return {
            deliveryId: delivery.id,
            reference: delivery.reference,
            status: "ASSIGNED",
            acceptanceStatus: "ACCEPTED"
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

async function rejectAssignment(driverId, reference, reason) {
    const connection = await db.pool.getConnection();

    try {
        await connection.beginTransaction();

        const [rows] = await connection.execute(`
            SELECT d.id, d.status, o.reference
            FROM deliveries d
            INNER JOIN orders o ON o.id = d.order_id
            WHERE d.driver_id = ?
              AND o.reference = ?
            LIMIT 1
            FOR UPDATE
        `, [driverId, reference]);

        const delivery = rows[0];

        if (!delivery) {
            const error = new Error("Livraison introuvable.");
            error.code = "DELIVERY_NOT_FOUND";
            throw error;
        }

        if (delivery.status !== "ASSIGNED") {
            const error = new Error("Cette affectation ne peut plus être refusée.");
            error.code = "DELIVERY_NOT_ASSIGNABLE";
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
            clean(reason, 500) || "Aucun motif indiqué.",
            delivery.id
        ]);

        await connection.execute(`
            UPDATE delivery_drivers
            SET availability_status = 'AVAILABLE'
            WHERE id = ?
              AND status = 'ACTIVE'
        `, [driverId]);

        await connection.commit();

        return {
            deliveryId: delivery.id,
            reference: delivery.reference,
            status: "WAITING",
            acceptanceStatus: "REJECTED"
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

async function markPickedUp(driverId, reference) {
    const connection = await db.pool.getConnection();

    try {
        await connection.beginTransaction();

        const [rows] = await connection.execute(`
            SELECT
                d.id,
                d.status,
                d.acceptance_status,
                o.status AS order_status,
                o.reference
            FROM deliveries d
            INNER JOIN orders o ON o.id = d.order_id
            WHERE d.driver_id = ?
              AND o.reference = ?
            LIMIT 1
            FOR UPDATE
        `, [driverId, reference]);

        const delivery = rows[0];

        if (!delivery) throw new Error("Livraison introuvable.");
        if (delivery.acceptance_status !== "ACCEPTED") {
            throw new Error("Vous devez d'abord accepter cette livraison.");
        }
        if (delivery.order_status !== "READY") {
            throw new Error("La commande n'est pas encore prête.");
        }
        if (delivery.status !== "ASSIGNED") {
            throw new Error("Cette livraison a déjà été prise en charge.");
        }

        await connection.execute(`
            UPDATE deliveries
            SET status = 'PICKED_UP',
                picked_up_at = NOW()
            WHERE id = ?
        `, [delivery.id]);

        await connection.commit();

        return {
            deliveryId: delivery.id,
            reference: delivery.reference,
            status: "PICKED_UP"
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

async function markArrived(driverId, reference) {
    const result = await db.query(`
        UPDATE deliveries d
        INNER JOIN orders o ON o.id = d.order_id
        SET
            d.status = 'ARRIVED',
            d.arrived_at = NOW()
        WHERE d.driver_id = ?
          AND o.reference = ?
          AND d.status = 'ON_THE_WAY'
    `, [driverId, reference]);

    if (result.affectedRows !== 1) {
        throw new Error("La livraison ne peut pas être marquée comme arrivée.");
    }

    return {
        reference,
        status: "ARRIVED"
    };
}

async function releaseDriver(driverId) {
    await db.query(`
        UPDATE delivery_drivers
        SET availability_status = 'AVAILABLE'
        WHERE id = ?
          AND status = 'ACTIVE'
    `, [driverId]);
}

async function getLatestTrackingPoint(deliveryId) {
    const rows = await db.query(`
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
        ORDER BY recorded_at DESC, id DESC
        LIMIT 1
    `, [deliveryId]);

    return rows[0] || null;
}

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
    getLatestTrackingPoint
};
