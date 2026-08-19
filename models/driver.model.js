const crypto = require("crypto");
const db = require("../config/database");

function clean(value, maxLength = 190) {
    return String(value || "").trim().slice(0, maxLength);
}

async function findByEmail(email) {
    const rows = await db.query(`
        SELECT *
        FROM delivery_drivers
        WHERE LOWER(email) = LOWER(?)
        LIMIT 1
    `, [clean(email).toLowerCase()]);
    return rows[0] || null;
}

async function findById(id) {
    const rows = await db.query(`
        SELECT *
        FROM delivery_drivers
        WHERE id = ?
        LIMIT 1
    `, [id]);
    return rows[0] || null;
}

async function emailExists(email) {
    const rows = await db.query(`
        SELECT id FROM delivery_drivers
        WHERE LOWER(email) = LOWER(?)
        LIMIT 1
    `, [clean(email).toLowerCase()]);
    return rows.length > 0;
}

async function phoneExists(phone) {
    const rows = await db.query(`
        SELECT id FROM delivery_drivers
        WHERE phone = ?
        LIMIT 1
    `, [clean(phone, 40)]);
    return rows.length > 0;
}

async function create(data) {
    const result = await db.query(`
        INSERT INTO delivery_drivers
        (
            public_id, first_name, last_name, display_name,
            email, phone, password_hash,
            status, availability_status,
            vehicle_type, vehicle_plate
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'OFFLINE', ?, ?)
    `, [
        crypto.randomUUID(),
        clean(data.first_name, 100),
        clean(data.last_name, 100),
        clean(data.display_name, 160) || null,
        clean(data.email).toLowerCase(),
        clean(data.phone, 40),
        data.password_hash,
        data.vehicle_type || "MOTORBIKE",
        clean(data.vehicle_plate, 50) || null
    ]);
    return result.insertId;
}

async function findAllForAdmin() {
    return await db.query(`
        SELECT
            dd.*,
            (
                SELECT COUNT(*)
                FROM deliveries d
                WHERE d.driver_id = dd.id
                  AND d.status NOT IN ('DELIVERED','FAILED')
            ) AS active_deliveries,
            (
                SELECT COUNT(*)
                FROM deliveries d
                WHERE d.driver_id = dd.id
                  AND d.status = 'DELIVERED'
            ) AS completed_deliveries
        FROM delivery_drivers dd
        ORDER BY
            dd.status = 'ACTIVE' DESC,
            dd.availability_status = 'AVAILABLE' DESC,
            dd.id DESC
    `);
}

async function findAssignable() {
    return await db.query(`
        SELECT
            dd.id,
            dd.first_name,
            dd.last_name,
            dd.display_name,
            dd.email,
            dd.phone,
            dd.status,
            dd.availability_status,
            dd.vehicle_type,
            dd.vehicle_plate,
            (
                SELECT COUNT(*)
                FROM deliveries d
                WHERE d.driver_id = dd.id
                  AND d.status NOT IN ('DELIVERED','FAILED')
                  AND d.acceptance_status <> 'REJECTED'
            ) AS active_deliveries
        FROM delivery_drivers dd
        WHERE dd.status = 'ACTIVE'
        ORDER BY
            dd.availability_status = 'AVAILABLE' DESC,
            active_deliveries ASC,
            dd.display_name ASC,
            dd.first_name ASC
    `);
}

async function updateStatus(driverId, status) {
    const allowed = ["ACTIVE","BLOCKED","INACTIVE"];
    if (!allowed.includes(status)) throw new Error("Statut livreur invalide.");

    await db.query(`
        UPDATE delivery_drivers
        SET
            status = ?,
            availability_status =
                CASE
                    WHEN ? = 'ACTIVE' THEN availability_status
                    ELSE 'OFFLINE'
                END
        WHERE id = ?
    `, [status, status, driverId]);
}

async function updateAvailability(driverId, availability) {
    const allowed = ["OFFLINE","AVAILABLE","BUSY"];
    if (!allowed.includes(availability)) throw new Error("Disponibilité invalide.");

    await db.query(`
        UPDATE delivery_drivers
        SET availability_status = ?
        WHERE id = ?
          AND status = 'ACTIVE'
    `, [availability, driverId]);
}

async function updateLastLogin(driverId) {
    await db.query(`
        UPDATE delivery_drivers
        SET
            last_login_at = NOW(),
            availability_status =
                CASE
                    WHEN availability_status = 'OFFLINE' THEN 'AVAILABLE'
                    ELSE availability_status
                END
        WHERE id = ?
          AND status = 'ACTIVE'
    `, [driverId]);
}

async function getDashboardStats(driverId) {
    const rows = await db.query(`
        SELECT
            (
                SELECT COUNT(*)
                FROM deliveries
                WHERE driver_id = ?
                  AND status = 'ASSIGNED'
                  AND acceptance_status = 'PENDING'
            ) AS pending_assignments,
            (
                SELECT COUNT(*)
                FROM deliveries
                WHERE driver_id = ?
                  AND status NOT IN ('DELIVERED','FAILED')
                  AND acceptance_status = 'ACCEPTED'
            ) AS active_deliveries,
            (
                SELECT COUNT(*)
                FROM deliveries
                WHERE driver_id = ?
                  AND status = 'DELIVERED'
            ) AS delivered_count
    `, [driverId, driverId, driverId]);

    return rows[0] || {
        pending_assignments: 0,
        active_deliveries: 0,
        delivered_count: 0
    };
}

module.exports = {
    findByEmail,
    findById,
    emailExists,
    phoneExists,
    create,
    findAllForAdmin,
    findAssignable,
    updateStatus,
    updateAvailability,
    updateLastLogin,
    getDashboardStats
};
