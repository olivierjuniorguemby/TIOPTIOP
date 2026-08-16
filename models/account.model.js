const db =
    require("../config/database");


/* =========================================================
   PROFIL COMPLET
========================================================= */

async function findAccountByUserId(userId) {

    const rows = await db.query(`
        SELECT
            u.id,
            u.public_id,
            u.email,
            u.phone,
            u.status,
            u.email_verified_at,
            u.phone_verified_at,
            u.last_login_at,
            u.created_at,

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
          AND u.account_type = 'CUSTOMER'
          AND u.status = 'ACTIVE'

        LIMIT 1
    `, [
        userId
    ]);


    return rows[0] || null;
}


/* =========================================================
   MODIFIER USERS
========================================================= */

async function updateUser(
    userId,
    data
) {

    return db.query(`
        UPDATE users

        SET
            email = ?,
            phone = ?

        WHERE id = ?
          AND account_type = 'CUSTOMER'
          AND status = 'ACTIVE'
    `, [
        data.email,
        data.phone || null,
        userId
    ]);
}


/* =========================================================
   MODIFIER PROFIL
========================================================= */

async function updateProfile(
    userId,
    data
) {

    return db.query(`
        UPDATE user_profiles

        SET
            first_name = ?,
            last_name = ?,
            display_name = ?,
            birth_date = ?

        WHERE user_id = ?
    `, [
        data.first_name || null,
        data.last_name || null,
        data.display_name || null,
        data.birth_date || null,
        userId
    ]);
}


/* =========================================================
   AVATAR
========================================================= */

async function updateAvatar(
    userId,
    avatarUrl
) {

    return db.query(`
        UPDATE user_profiles

        SET avatar_url = ?

        WHERE user_id = ?
    `, [
        avatarUrl,
        userId
    ]);
}


/* =========================================================
   EMAIL EXISTANT
========================================================= */

async function emailExistsForAnotherUser(
    email,
    userId
) {

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
   TELEPHONE EXISTANT
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
            created_at DESC,
            id DESC
    `, [
        userId
    ]);


    return Array.isArray(rows)
        ? rows
        : [];
}


async function findAddressById(
    userId,
    addressId
) {

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
   AJOUTER ADRESSE
========================================================= */

async function createAddress(
    userId,
    data
) {

    if (data.is_default) {

        await db.query(`
            UPDATE user_addresses
            SET is_default = 0
            WHERE user_id = ?
        `, [
            userId
        ]);
    }


    const result = await db.query(`
        INSERT INTO user_addresses
        (
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
        )

        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        userId,

        data.label || "Maison",
        data.recipient_name || null,
        data.phone || null,

        data.address_line1,

        data.address_line2 || null,
        data.district || null,

        data.city || "Brazzaville",
        data.country_code || "CG",

        data.latitude || null,
        data.longitude || null,

        data.delivery_instructions || null,

        data.is_default ? 1 : 0
    ]);


    return result.insertId;
}


/* =========================================================
   MODIFIER ADRESSE
========================================================= */

async function updateAddress(
    userId,
    addressId,
    data
) {

    if (data.is_default) {

        await db.query(`
            UPDATE user_addresses
            SET is_default = 0
            WHERE user_id = ?
        `, [
            userId
        ]);
    }


    return db.query(`
        UPDATE user_addresses

        SET
            label = ?,
            recipient_name = ?,
            phone = ?,
            address_line1 = ?,
            address_line2 = ?,
            district = ?,
            city = ?,
            country_code = ?,
            latitude = ?,
            longitude = ?,
            delivery_instructions = ?,
            is_default = ?

        WHERE id = ?
          AND user_id = ?
    `, [
        data.label || "Maison",
        data.recipient_name || null,
        data.phone || null,

        data.address_line1,
        data.address_line2 || null,
        data.district || null,

        data.city || "Brazzaville",
        data.country_code || "CG",

        data.latitude || null,
        data.longitude || null,

        data.delivery_instructions || null,
        data.is_default ? 1 : 0,

        addressId,
        userId
    ]);
}


/* =========================================================
   DEFINIR ADRESSE PAR DEFAUT
========================================================= */

async function setDefaultAddress(
    userId,
    addressId
) {

    await db.query(`
        UPDATE user_addresses

        SET is_default = 0

        WHERE user_id = ?
    `, [
        userId
    ]);


    return db.query(`
        UPDATE user_addresses

        SET is_default = 1

        WHERE id = ?
          AND user_id = ?
    `, [
        addressId,
        userId
    ]);
}


/* =========================================================
   SUPPRIMER ADRESSE
========================================================= */

async function deleteAddress(
    userId,
    addressId
) {

    return db.query(`
        DELETE FROM user_addresses

        WHERE id = ?
          AND user_id = ?
    `, [
        addressId,
        userId
    ]);
}


/* =========================================================
   PARAMETRES
========================================================= */

async function updateSettings(
    userId,
    data
) {

    return db.query(`
        UPDATE user_profiles

        SET
            preferred_language = ?,
            marketing_consent = ?,
            push_consent = ?,
            email_consent = ?,
            motif_theme = ?

        WHERE user_id = ?
    `, [
        data.preferred_language || "fr",

        data.marketing_consent ? 1 : 0,
        data.push_consent ? 1 : 0,
        data.email_consent ? 1 : 0,

        data.motif_theme || "KONGO_AUTHENTIQUE",

        userId
    ]);
}


/* =========================================================
   MOT DE PASSE
========================================================= */

async function updatePassword(
    userId,
    passwordHash
) {

    return db.query(`
        UPDATE users

        SET password_hash = ?

        WHERE id = ?
          AND account_type = 'CUSTOMER'
          AND status = 'ACTIVE'
    `, [
        passwordHash,
        userId
    ]);
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

    findAccountByUserId,

    updateUser,
    updateProfile,
    updateAvatar,

    emailExistsForAnotherUser,
    phoneExistsForAnotherUser,

    getAddresses,
    findAddressById,

    createAddress,
    updateAddress,
    setDefaultAddress,
    deleteAddress,

    updateSettings,

    updatePassword
};