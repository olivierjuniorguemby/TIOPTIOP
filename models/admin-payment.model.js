const db = require("../config/database");

/* =========================================================
   ADMIN PAYMENT MODEL
   TIOPTIOP — 13.9.2
========================================================= */

function cleanString(value, max = 180) {
    return String(value || "").trim().slice(0, max);
}

function normalizeEnum(value, allowed) {
    const normalized = cleanString(value, 50).toUpperCase();
    return allowed.includes(normalized) ? normalized : "";
}

async function list(filters = {}) {
    const search = cleanString(filters.search, 180);
    const method = normalizeEnum(filters.method, ["CARD", "MOBILE_MONEY", "CASH"]);
    const status = normalizeEnum(filters.status, [
        "PENDING", "AUTHORIZED", "PAID", "FAILED", "CANCELLED", "PARTIAL", "REFUNDED"
    ]);
    const provider = cleanString(filters.provider, 80).toUpperCase();

    let sql = `
        SELECT
            p.id,
            p.public_id,
            p.order_id,
            p.method,
            p.provider,
            p.status,
            p.amount,
            p.currency,
            p.provider_reference,
            p.collected_by_admin_user_id,
            p.paid_at,
            p.created_at,
            p.updated_at,

            o.reference AS order_reference,
            o.status AS order_status,
            o.order_type,
            o.total_amount AS order_total_amount,
            o.currency AS order_currency,

            u.id AS customer_id,
            u.email AS customer_email,
            u.phone AS customer_phone,

            up.first_name AS customer_first_name,
            up.last_name AS customer_last_name,
            up.display_name AS customer_display_name,
            up.avatar_url AS customer_avatar_url,

            au.name AS collector_name

        FROM payments p

        INNER JOIN orders o
            ON o.id = p.order_id

        LEFT JOIN users u
            ON u.id = o.user_id

        LEFT JOIN user_profiles up
            ON up.user_id = u.id

        LEFT JOIN admin_users au
            ON au.id = p.collected_by_admin_user_id

        WHERE 1 = 1
    `;

    const params = [];

    if (search) {
        const value = `%${search}%`;

        sql += `
            AND (
                o.reference LIKE ?
                OR p.public_id LIKE ?
                OR p.provider_reference LIKE ?
                OR u.email LIKE ?
                OR u.phone LIKE ?
                OR up.display_name LIKE ?
                OR CONCAT_WS(' ', up.first_name, up.last_name) LIKE ?
            )
        `;

        params.push(value, value, value, value, value, value, value);
    }

    if (method) {
        sql += ` AND p.method = ? `;
        params.push(method);
    }

    if (status) {
        sql += ` AND p.status = ? `;
        params.push(status);
    }

    if (provider) {
        sql += ` AND UPPER(COALESCE(p.provider, '')) = ? `;
        params.push(provider);
    }

    sql += ` ORDER BY p.created_at DESC, p.id DESC `;

    const rows = await db.query(sql, params);
    return Array.isArray(rows) ? rows : [];
}

async function getStats() {
    const rows = await db.query(`
        SELECT
            COUNT(*) AS total_count,

            COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END), 0) AS paid_amount,
            COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END), 0) AS pending_amount,
            COALESCE(SUM(CASE WHEN status = 'FAILED' THEN amount ELSE 0 END), 0) AS failed_amount,
            COALESCE(SUM(CASE WHEN status IN ('PARTIAL','REFUNDED') THEN amount ELSE 0 END), 0) AS refunded_related_amount,

            COALESCE(SUM(CASE WHEN method = 'CARD' AND status = 'PAID' THEN amount ELSE 0 END), 0) AS card_paid_amount,
            COALESCE(SUM(CASE WHEN method = 'MOBILE_MONEY' AND status = 'PAID' THEN amount ELSE 0 END), 0) AS momo_paid_amount,
            COALESCE(SUM(CASE WHEN method = 'CASH' AND status = 'PAID' THEN amount ELSE 0 END), 0) AS cash_paid_amount,

            COALESCE(SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END), 0) AS paid_count,
            COALESCE(SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END), 0) AS pending_count,
            COALESCE(SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END), 0) AS failed_count,
            COALESCE(SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END), 0) AS cancelled_count

        FROM payments
    `);

    return rows[0] || {
        total_count: 0,
        paid_amount: 0,
        pending_amount: 0,
        failed_amount: 0,
        refunded_related_amount: 0,
        card_paid_amount: 0,
        momo_paid_amount: 0,
        cash_paid_amount: 0,
        paid_count: 0,
        pending_count: 0,
        failed_count: 0,
        cancelled_count: 0
    };
}

async function getProviders() {
    const rows = await db.query(`
        SELECT DISTINCT provider
        FROM payments
        WHERE provider IS NOT NULL
          AND provider <> ''
        ORDER BY provider ASC
    `);

    return Array.isArray(rows)
        ? rows.map(row => row.provider).filter(Boolean)
        : [];
}


async function findDetailById(paymentId) {
    const id = Number(paymentId);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    const rows = await db.query(
        `
        SELECT
            p.*,

            o.reference AS order_reference,
            o.status AS order_status,
            o.order_type,
            o.subtotal AS order_subtotal_amount,
            o.delivery_fee AS order_delivery_fee,
            o.discount_amount AS order_discount_amount,
            o.total_amount AS order_total_amount,
            o.currency AS order_currency,
            o.created_at AS order_created_at,

            u.id AS customer_id,
            u.email AS customer_email,
            u.phone AS customer_phone,

            up.first_name AS customer_first_name,
            up.last_name AS customer_last_name,
            up.display_name AS customer_display_name,
            up.avatar_url AS customer_avatar_url,

            au.name AS collector_name

        FROM payments p

        INNER JOIN orders o
            ON o.id = p.order_id

        LEFT JOIN users u
            ON u.id = o.user_id

        LEFT JOIN user_profiles up
            ON up.user_id = u.id

        LEFT JOIN admin_users au
            ON au.id = p.collected_by_admin_user_id

        WHERE p.id = ?

        LIMIT 1
        `,
        [id]
    );

    return rows[0] || null;
}


async function getEventsByPaymentId(paymentId) {
    const id = Number(paymentId);

    if (!Number.isInteger(id) || id <= 0) {
        return [];
    }

    const rows = await db.query(
        `
        SELECT
            id,
            payment_id,
            event_type,
            description,
            payload,
            created_at
        FROM payment_events
        WHERE payment_id = ?
        ORDER BY created_at ASC, id ASC
        `,
        [id]
    );

    return Array.isArray(rows) ? rows : [];
}

module.exports = {
    list,
    getStats,
    getProviders,
    findDetailById,
    getEventsByPaymentId
};
