const db = require("../config/database");


/* =========================================================
   RECHERCHER PAR EMAIL
========================================================= */

async function findByEmail(email) {

    const rows = await db.query(`
        SELECT
            u.id,
            u.public_id,
            u.email,
            u.phone,
            u.password_hash,
            u.account_type,
            u.status,
            u.email_verified_at,
            u.phone_verified_at,
            u.last_login_at,
            u.created_at,

            up.first_name,
            up.last_name,
            up.display_name,
            up.avatar_url,
            up.preferred_language,
            up.marketing_consent,
            up.push_consent,
            up.email_consent,
            up.motif_theme

        FROM users u

        LEFT JOIN user_profiles up
            ON up.user_id = u.id

        WHERE LOWER(u.email) = LOWER(?)
          AND u.account_type = 'CUSTOMER'

        LIMIT 1
    `, [
        email
    ]);

    return rows[0] || null;
}


/* =========================================================
   RECHERCHER PAR ID
========================================================= */

async function findById(id) {

    const rows = await db.query(`
        SELECT
            u.id,
            u.public_id,
            u.email,
            u.phone,
            u.account_type,
            u.status,
            u.email_verified_at,
            u.phone_verified_at,
            u.last_login_at,
            u.created_at,
            u.updated_at,

            up.first_name,
            up.last_name,
            up.display_name,
            up.avatar_url,
            up.birth_date,
            up.preferred_language,
            up.marketing_consent,
            up.push_consent,
            up.email_consent,
            up.motif_theme

        FROM users u

        LEFT JOIN user_profiles up
            ON up.user_id = u.id

        WHERE u.id = ?

        LIMIT 1
    `, [
        id
    ]);

    return rows[0] || null;
}


/* =========================================================
   EMAIL EXISTANT
========================================================= */

async function emailExists(email) {

    const rows = await db.query(`
        SELECT id
        FROM users
        WHERE LOWER(email) = LOWER(?)
        LIMIT 1
    `, [
        email
    ]);

    return rows.length > 0;
}


/* =========================================================
   TELEPHONE EXISTANT
========================================================= */

async function phoneExists(phone) {

    if (!phone) {
        return false;
    }

    const rows = await db.query(`
        SELECT id
        FROM users
        WHERE phone = ?
        LIMIT 1
    `, [
        phone
    ]);

    return rows.length > 0;
}


/* =========================================================
   CREATION UTILISATEUR
========================================================= */

async function createUser(data) {

    const result = await db.query(`
        INSERT INTO users
        (
            public_id,
            email,
            phone,
            password_hash,
            account_type,
            status
        )
        VALUES (?, ?, ?, ?, 'CUSTOMER', 'ACTIVE')
    `, [
        data.public_id,
        data.email,
        data.phone || null,
        data.password_hash
    ]);

    return result.insertId;
}


/* =========================================================
   CREATION PROFIL
========================================================= */

async function createProfile(userId, data) {

    return await db.query(`
        INSERT INTO user_profiles
        (
            user_id,
            first_name,
            last_name,
            display_name,
            preferred_language,
            marketing_consent,
            push_consent,
            email_consent,
            motif_theme
        )
        VALUES (?, ?, ?, ?, 'fr', ?, 1, 1, 'KONGO_AUTHENTIQUE')
    `, [
        userId,
        data.first_name,
        data.last_name,
        data.display_name,
        data.marketing_consent ? 1 : 0
    ]);
}


/* =========================================================
   DERNIERE CONNEXION
========================================================= */

async function updateLastLogin(userId) {

    return await db.query(`
        UPDATE users
        SET last_login_at = NOW()
        WHERE id = ?
    `, [
        userId
    ]);
}


/* =========================================================
   LISTE ADMIN
   Nous nous en servirons à la fin de l'étape 9.
========================================================= */

async function findAllForAdmin() {

    return await db.query(`
        SELECT
            u.id,
            u.public_id,
            u.email,
            u.phone,
            u.status,
            u.last_login_at,
            u.created_at,

            up.first_name,
            up.last_name,
            up.display_name,
            up.avatar_url,

            (
                SELECT COUNT(*)
                FROM orders o
                WHERE o.user_id = u.id
            ) AS orders_count,

            (
                SELECT COALESCE(SUM(o.total_amount), 0)
                FROM orders o
                WHERE o.user_id = u.id
                  AND o.status = 'DELIVERED'
            ) AS total_spent

        FROM users u

        LEFT JOIN user_profiles up
            ON up.user_id = u.id

        WHERE u.account_type = 'CUSTOMER'
          AND u.status <> 'DELETED'

        ORDER BY u.id DESC
    `);
}

/* =========================================================
   ADMINISTRATION CLIENTS
========================================================= */


/* =========================================================
   MODIFIER UN CLIENT
========================================================= */

async function updateForAdmin(userId, data) {

    /* -----------------------------------------------------
       UTILISATEUR
    ----------------------------------------------------- */

    await db.query(`
        UPDATE users
        SET
            email = ?,
            phone = ?
        WHERE id = ?
          AND account_type = 'CUSTOMER'
          AND status <> 'DELETED'
    `, [
        data.email || null,
        data.phone || null,
        userId
    ]);


    /* -----------------------------------------------------
       PROFIL
    ----------------------------------------------------- */

    const existingProfile = await db.query(`
        SELECT user_id
        FROM user_profiles
        WHERE user_id = ?
        LIMIT 1
    `, [
        userId
    ]);


    if (existingProfile.length > 0) {

        await db.query(`
            UPDATE user_profiles
            SET
                first_name = ?,
                last_name = ?,
                display_name = ?,
                birth_date = ?,
                preferred_language = ?,
                marketing_consent = ?,
                push_consent = ?,
                email_consent = ?
            WHERE user_id = ?
        `, [
            data.first_name || null,
            data.last_name || null,
            data.display_name || null,
            data.birth_date || null,

            data.preferred_language || "fr",

            data.marketing_consent ? 1 : 0,
            data.push_consent ? 1 : 0,
            data.email_consent ? 1 : 0,

            userId
        ]);

    }
    else {

        await db.query(`
            INSERT INTO user_profiles
            (
                user_id,
                first_name,
                last_name,
                display_name,
                birth_date,
                preferred_language,
                marketing_consent,
                push_consent,
                email_consent
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            userId,

            data.first_name || null,
            data.last_name || null,
            data.display_name || null,
            data.birth_date || null,

            data.preferred_language || "fr",

            data.marketing_consent ? 1 : 0,
            data.push_consent ? 1 : 0,
            data.email_consent ? 1 : 0
        ]);
    }
}


/* =========================================================
   CHANGER STATUT CLIENT
========================================================= */

async function updateStatus(
    userId,
    status
) {

    const allowedStatuses = [
        "ACTIVE",
        "BLOCKED",
        "PENDING",
        "DELETED"
    ];


    if (!allowedStatuses.includes(status)) {

        throw new Error(
            "Statut client invalide."
        );
    }


    return await db.query(`
        UPDATE users
        SET status = ?
        WHERE id = ?
          AND account_type = 'CUSTOMER'
    `, [
        status,
        userId
    ]);
}


/* =========================================================
   BLOQUER CLIENT
========================================================= */

async function block(userId) {

    return await updateStatus(
        userId,
        "BLOCKED"
    );
}


/* =========================================================
   DEBLOQUER CLIENT
========================================================= */

async function unblock(userId) {

    return await updateStatus(
        userId,
        "ACTIVE"
    );
}


/* =========================================================
   SUPPRESSION LOGIQUE
========================================================= */

async function softDelete(userId) {

    return await updateStatus(
        userId,
        "DELETED"
    );
}


/* =========================================================
   EMAIL EXISTANT SAUF CLIENT COURANT
========================================================= */

async function emailExistsForAnotherUser(
    email,
    userId
) {

    if (!email) {
        return false;
    }


    const rows = await db.query(`
        SELECT id
        FROM users

        WHERE LOWER(email) = LOWER(?)
          AND id <> ?
          AND status <> 'DELETED'

        LIMIT 1
    `, [
        email,
        userId
    ]);


    return rows.length > 0;
}


/* =========================================================
   TELEPHONE EXISTANT SAUF CLIENT COURANT
========================================================= */

async function phoneExistsForAnotherUser(
    phone,
    userId
) {

    if (!phone) {
        return false;
    }


    const rows = await db.query(`
        SELECT id
        FROM users

        WHERE phone = ?
          AND id <> ?
          AND status <> 'DELETED'

        LIMIT 1
    `, [
        phone,
        userId
    ]);


    return rows.length > 0;
}


/* =========================================================
   RECHERCHE CLIENT POUR POS
   13.9.6.3
========================================================= */

async function searchCustomersForPos(search, limit = 12) {

    const term = String(search || "").trim();

    if (term.length < 2) {
        return [];
    }

    const safeLimit =
        Math.min(
            Math.max(Number(limit) || 12, 1),
            20
        );

    const like = `%${term}%`;

    return await db.query(`
        SELECT
            u.id,
            u.public_id,
            u.email,
            u.phone,
            u.status,

            up.first_name,
            up.last_name,
            up.display_name,
            up.avatar_url

        FROM users u

        LEFT JOIN user_profiles up
            ON up.user_id = u.id

        WHERE u.account_type = 'CUSTOMER'
          AND u.status <> 'DELETED'
          AND (
                u.email LIKE ?
             OR u.phone LIKE ?
             OR up.first_name LIKE ?
             OR up.last_name LIKE ?
             OR up.display_name LIKE ?
             OR CONCAT_WS(
                    ' ',
                    up.first_name,
                    up.last_name
                ) LIKE ?
          )

        ORDER BY
            CASE WHEN u.status = 'ACTIVE' THEN 0 ELSE 1 END,
            up.first_name ASC,
            up.last_name ASC,
            u.id DESC

        LIMIT ${safeLimit}
    `, [
        like,
        like,
        like,
        like,
        like,
        like
    ]);
}


module.exports = {

    findByEmail,
    findById,

    emailExists,
    phoneExists,

    createUser,
    createProfile,

    updateLastLogin,

    findAllForAdmin,

    searchCustomersForPos,

    /* ADMIN CLIENTS */

    updateForAdmin,

    updateStatus,

    block,
    unblock,

    softDelete,

    emailExistsForAnotherUser,
    phoneExistsForAnotherUser
};