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
   LISTE PRODUITS - MENU CLIENT
====================================================== */

async function findAllForMenu(filters = {}) {

    const params = [];

    let sql = `
        SELECT
            p.id,
            p.public_id,
            p.category_id,
            p.sku,
            p.name,
            p.slug,
            p.short_description,
            p.description,
            p.price,
            p.compare_at_price,
            p.currency,
            p.preparation_minutes,
            p.spice_level,
            p.calories,
            p.is_halal,
            p.is_vegetarian,
            p.is_breakfast,
            p.breakfast_start,
            p.breakfast_end,
            p.is_featured,
            p.position,

            c.name AS category_name,
            c.slug AS category_slug,

            (
                SELECT pi.image_url
                FROM product_images pi
                WHERE pi.product_id = p.id
                ORDER BY
                    pi.is_primary DESC,
                    pi.position ASC,
                    pi.id ASC
                LIMIT 1
            ) AS image_url

        FROM products p

        INNER JOIN categories c
            ON c.id = p.category_id

        WHERE p.is_active = 1
          AND c.is_active = 1
    `;


    /* =========================================
       RECHERCHE
    ========================================= */

    if (filters.q && filters.q.trim() !== "") {

        const search = `%${filters.q.trim()}%`;

        sql += `
            AND (
                p.name LIKE ?
                OR p.short_description LIKE ?
                OR p.description LIKE ?
                OR c.name LIKE ?
            )
        `;

        params.push(
            search,
            search,
            search,
            search
        );
    }


    /* =========================================
       CATEGORIE
    ========================================= */

    if (filters.category) {

        sql += `
            AND p.category_id = ?
        `;

        params.push(filters.category);
    }


    /* =========================================
       PRIX MAXIMUM
    ========================================= */

    if (
        filters.maxPrice &&
        !isNaN(filters.maxPrice)
    ) {

        sql += `
            AND p.price <= ?
        `;

        params.push(filters.maxPrice);
    }


    /* =========================================
       TRI
    ========================================= */

    sql += `
        ORDER BY
            p.is_featured DESC,
            p.position ASC,
            p.name ASC
    `;


    return await db.query(sql, params);
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

    const params = [
        data.category_id ?? null,
        data.sku || null,
        data.icon || null,

        data.name ?? null,
        data.slug ?? null,

        data.short_description || null,
        data.description || null,

        data.price ?? null,
        data.compare_at_price || null,

        data.currency || "XAF",

        data.preparation_minutes || 15,
        data.spice_level || 0,

        data.allergens || null,
        data.ingredients || null,

        data.calories || null,

        data.is_halal ? 1 : 0,
        data.is_vegetarian ? 1 : 0,
        data.is_breakfast ? 1 : 0,

        data.breakfast_start || null,
        data.breakfast_end || null,

        data.is_featured ? 1 : 0,
        data.is_active ?? 1,

        data.position || 0,

        id
    ];


    // Sécurité : permet de voir immédiatement
    // si une valeur undefined arrive encore ici
    console.log("PARAMETRES SQL UPDATE =", params);

    params.forEach((value, index) => {
        if (value === undefined) {
            console.error(
                `PARAMETRE SQL UNDEFINED à l'index ${index}`
            );
        }
    });


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
    `, params);
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

// ======================================================
// IMAGES D'UN PRODUIT
// ======================================================

async function getImages(productId) {

    const rows = await db.query(`
        SELECT
            id,
            product_id,
            image_url,
            source_url,
            alt_text,
            position,
            is_primary,
            created_at
        FROM product_images
        WHERE product_id = ?
        ORDER BY is_primary DESC, position ASC, id ASC
    `, [productId]);

    return rows;
}


// ======================================================
// UNE IMAGE
// ======================================================

async function getImageById(imageId) {

    const rows = await db.query(`
        SELECT *
        FROM product_images
        WHERE id = ?
        LIMIT 1
    `, [imageId]);

    return rows[0] || null;
}


// ======================================================
// COMPTER LES IMAGES
// ======================================================

async function countImages(productId) {

    const rows = await db.query(`
        SELECT COUNT(*) AS total
        FROM product_images
        WHERE product_id = ?
    `, [productId]);

    return Number(rows[0].total);
}


// ======================================================
// SUPPRIMER UNE IMAGE
// ======================================================

async function deleteImage(imageId) {

    return await db.query(`
        DELETE FROM product_images
        WHERE id = ?
    `, [imageId]);
}


// ======================================================
// DEFINIR IMAGE PRINCIPALE
// ======================================================

/* ======================================================
   DEFINIR IMAGE PRINCIPALE
====================================================== */

async function setPrimaryImage(productId, imageId) {

    // Retirer l'image principale actuelle
    await db.query(`
        UPDATE product_images
        SET is_primary = 0
        WHERE product_id = ?
    `, [productId]);


    // Définir la nouvelle image principale
    const result = await db.query(`
        UPDATE product_images
        SET is_primary = 1
        WHERE id = ?
        AND product_id = ?
    `, [
        imageId,
        productId
    ]);


    return result;
}

async function findByIdForClient(productId) {

    const rows = await db.query(`
        SELECT
            p.id,
            p.public_id,
            p.category_id,
            p.sku,
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
            p.position,
            p.created_at,
            p.updated_at,

            c.name AS category_name,
            c.slug AS category_slug,
            c.icon AS category_icon

        FROM products p

        INNER JOIN categories c
            ON c.id = p.category_id

        WHERE p.id = ?
          AND p.is_active = 1
          AND c.is_active = 1

        LIMIT 1
    `, [productId]);

    return rows.length > 0
        ? rows[0]
        : null;
}

// Retrieving the 6 images
async function findImagesForClient(productId) {

    return await db.query(`
        SELECT
            id,
            product_id,
            image_url,
            source_url,
            alt_text,
            position,
            is_primary
        FROM product_images

        WHERE product_id = ?

        ORDER BY
            is_primary DESC,
            position ASC,
            id ASC

        LIMIT 6
    `, [productId]);
}

// Suggestions
async function findSuggestions(productId, categoryId, limit = 4) {

    return await db.query(`
        SELECT
            p.id,
            p.name,
            p.slug,
            p.short_description,
            p.price,
            p.compare_at_price,
            p.currency,

            (
                SELECT pi.image_url
                FROM product_images pi
                WHERE pi.product_id = p.id
                ORDER BY
                    pi.is_primary DESC,
                    pi.position ASC,
                    pi.id ASC
                LIMIT 1
            ) AS image_url

        FROM products p

        WHERE p.is_active = 1
          AND p.id <> ?
          AND p.category_id = ?

        ORDER BY
            p.is_featured DESC,
            p.position ASC,
            p.id DESC

        LIMIT ?
    `, [
        productId,
        categoryId,
        Number(limit)
    ]);
}

module.exports = {
    findAllForAdmin,
    findAllForMenu,
    findById,
    findImages,
    create,
    update,

    addImage,
    removeImage,

    getImages,
    getImageById,
    countImages,
    deleteImage,
    setPrimaryImage,

    toggleActive,
    remove,

    findByIdForClient,
    findImagesForClient,
    findSuggestions
};