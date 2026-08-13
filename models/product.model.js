const db = require("../config/database");


/* ======================================================
   LISTE ADMIN
====================================================== */

async function findAllForAdmin() {

    return await db.query(`
        SELECT
            p.id,
            p.public_id,
            p.category_id,
            p.sku,
            p.icon,
            p.name,
            p.slug,
            p.short_description,
            p.description,
            p.price,
            p.compare_at_price,
            p.currency,
            p.preparation_minutes,
            p.spice_level,
            p.allergens,
            p.ingredients,
            p.calories,
            p.is_halal,
            p.is_vegetarian,
            p.is_breakfast,
            p.breakfast_start,
            p.breakfast_end,
            p.is_featured,
            p.is_active,
            p.position,
            p.created_at,
            p.updated_at,

            c.name AS category_name,

            (
                SELECT COUNT(*)
                FROM product_images pi
                WHERE pi.product_id = p.id
            ) AS image_count,

            (
                SELECT pi.image_url
                FROM product_images pi
                WHERE pi.product_id = p.id
                ORDER BY pi.is_primary DESC, pi.position ASC, pi.id ASC
                LIMIT 1
            ) AS primary_image

        FROM products p

        INNER JOIN categories c
            ON c.id = p.category_id

        ORDER BY p.position ASC, p.id DESC
    `);
}


/* ======================================================
   PRODUIT PAR ID
====================================================== */

async function findById(id) {

    const rows = await db.query(`
        SELECT *
        FROM products
        WHERE id = ?
        LIMIT 1
    `, [id]);

    return rows[0] || null;
}


/* ======================================================
   IMAGES PRODUIT
====================================================== */

async function findImages(productId) {

    return await db.query(`
        SELECT
            id,
            product_id,
            image_url,
            alt_text,
            position,
            is_primary
        FROM product_images
        WHERE product_id = ?
        ORDER BY is_primary DESC, position ASC, id ASC
    `, [productId]);
}


/* ======================================================
   AJOUTER PRODUIT
====================================================== */

async function create(data) {

    const result = await db.query(`
        INSERT INTO products
        (
            public_id,
            category_id,
            sku,
            icon,
            name,
            slug,
            short_description,
            description,
            price,
            compare_at_price,
            currency,
            preparation_minutes,
            spice_level,
            allergens,
            ingredients,
            calories,
            is_halal,
            is_vegetarian,
            is_breakfast,
            breakfast_start,
            breakfast_end,
            is_featured,
            is_active,
            position
        )
        VALUES
        (
            UUID(),
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
    `, [
        data.category_id,
        data.sku || null,
        data.icon || null,

        data.name,
        data.slug,

        data.short_description || null,
        data.description || null,

        data.price,
        data.compare_at_price || null,

        data.currency || "XAF",

        data.preparation_minutes || 15,
        data.spice_level || 0,

        data.allergens || null,
        data.ingredients || null,

        data.calories || null,

        data.is_halal || 0,
        data.is_vegetarian || 0,
        data.is_breakfast || 0,

        data.breakfast_start || null,
        data.breakfast_end || null,

        data.is_featured || 0,
        data.is_active ?? 1,

        data.position || 0
    ]);

    return result;
}


/* ======================================================
   MODIFIER
====================================================== */

async function update(id, data) {

    return await db.query(`
        UPDATE products

        SET
            category_id = ?,
            sku = ?,
            icon = ?,
            name = ?,
            slug = ?,
            short_description = ?,
            description = ?,
            price = ?,
            compare_at_price = ?,
            currency = ?,
            preparation_minutes = ?,
            spice_level = ?,
            allergens = ?,
            ingredients = ?,
            calories = ?,
            is_halal = ?,
            is_vegetarian = ?,
            is_breakfast = ?,
            breakfast_start = ?,
            breakfast_end = ?,
            is_featured = ?,
            is_active = ?,
            position = ?

        WHERE id = ?
    `, [
        data.category_id,
        data.sku || null,
        data.icon || null,

        data.name,
        data.slug,

        data.short_description || null,
        data.description || null,

        data.price,
        data.compare_at_price || null,

        data.currency || "XAF",

        data.preparation_minutes || 15,
        data.spice_level || 0,

        data.allergens || null,
        data.ingredients || null,

        data.calories || null,

        data.is_halal || 0,
        data.is_vegetarian || 0,
        data.is_breakfast || 0,

        data.breakfast_start || null,
        data.breakfast_end || null,

        data.is_featured || 0,
        data.is_active ?? 1,

        data.position || 0,

        id
    ]);
}


/* ======================================================
   IMAGE
====================================================== */

async function addImage(productId, imageUrl, position, isPrimary = 0) {

    return await db.query(`
        INSERT INTO product_images
        (
            product_id,
            image_url,
            alt_text,
            position,
            is_primary
        )
        VALUES (?, ?, ?, ?, ?)
    `, [
        productId,
        imageUrl,
        null,
        position,
        isPrimary
    ]);
}


/* ======================================================
   SUPPRIMER IMAGE
====================================================== */

async function removeImage(imageId, productId) {

    return await db.query(`
        DELETE FROM product_images
        WHERE id = ?
        AND product_id = ?
    `, [
        imageId,
        productId
    ]);
}


/* ======================================================
   ACTIVER / DESACTIVER
====================================================== */

async function toggleActive(id) {

    return await db.query(`
        UPDATE products

        SET is_active =
            CASE
                WHEN is_active = 1 THEN 0
                ELSE 1
            END

        WHERE id = ?
    `, [id]);
}


/* ======================================================
   SUPPRIMER
====================================================== */

async function remove(id) {

    return await db.query(`
        DELETE FROM products
        WHERE id = ?
    `, [id]);
}


module.exports = {
    findAllForAdmin,
    findById,
    findImages,
    create,
    update,
    addImage,
    removeImage,
    toggleActive,
    remove
};