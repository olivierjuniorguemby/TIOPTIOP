const db = require("../config/database");


/* =========================================================
   FORMULES
========================================================= */


/**
 * Retourne toutes les formules pour l'administration.
 */
async function findAll() {

    const rows = await db.query(`
        SELECT
            f.*,

            (
                SELECT COUNT(*)
                FROM formula_items fi2
                WHERE fi2.formula_id = f.id
            ) AS products_count,

            (
                SELECT COUNT(*)
                FROM formula_images fi
                WHERE fi.formula_id = f.id
            ) AS images_count,

            (
                SELECT fi.image_url
                FROM formula_images fi
                WHERE fi.formula_id = f.id
                ORDER BY
                    fi.is_primary DESC,
                    fi.position ASC,
                    fi.id ASC
                LIMIT 1
            ) AS primary_image

        FROM formulas f

        ORDER BY
            f.position ASC,
            f.id DESC
    `);

    return Array.isArray(rows)
        ? rows
        : [];
}


/**
 * Retourne les formules visibles côté client.
 */
async function findAllForClient() {

    const rows = await db.query(`
        SELECT
            f.*,

            (
                SELECT fi.image_url
                FROM formula_images fi
                WHERE fi.formula_id = f.id
                ORDER BY
                    fi.is_primary DESC,
                    fi.position ASC,
                    fi.id ASC
                LIMIT 1
            ) AS primary_image

        FROM formulas f

        WHERE f.is_active = 1

        ORDER BY
            f.position ASC,
            f.id DESC
    `);

    return Array.isArray(rows)
        ? rows
        : [];
}

/* =========================================================
   DETAIL FORMULE COTE CLIENT
========================================================= */

async function findByIdForClient(id) {

    const rows = await db.query(`
        SELECT
            f.*,

            (
                SELECT fi.image_url
                FROM formula_images fi
                WHERE fi.formula_id = f.id
                ORDER BY
                    fi.is_primary DESC,
                    fi.position ASC,
                    fi.id ASC
                LIMIT 1
            ) AS primary_image

        FROM formulas f

        WHERE f.id = ?
          AND f.is_active = 1

        LIMIT 1
    `, [id]);

    return rows[0] || null;
}

/* =========================================================
   FORMULE PAR ID
========================================================= */

async function findById(id) {

    const rows = await db.query(`
        SELECT *
        FROM formulas
        WHERE id = ?
        LIMIT 1
    `, [id]);

    return rows[0] || null;
}

/* =========================================================
   CREATE
========================================================= */

async function create(data) {

    const {
        name,
        slug,
        short_description,
        description,
        price,
        compare_at_price,
        currency,
        position,
        is_featured,
        is_active
    } = data;

    const result = await db.query(`
        INSERT INTO formulas
        (
            name,
            slug,
            short_description,
            description,
            price,
            compare_at_price,
            currency,
            position,
            is_featured,
            is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        name,
        slug,
        short_description || null,
        description || null,
        price,
        compare_at_price || null,
        currency || "XAF",
        position || 0,
        is_featured ? 1 : 0,
        is_active ? 1 : 0
    ]);

    return result.insertId;
}



/* =========================================================
   MODIFIER FORMULE
========================================================= */
async function update(id, data) {

    return await db.query(`
        UPDATE formulas
        SET
            name = ?,
            slug = ?,
            short_description = ?,
            description = ?,
            price = ?,
            compare_at_price = ?,
            currency = ?,
            position = ?,
            is_featured = ?,
            is_active = ?
        WHERE id = ?
    `, [
        data.name,
        data.slug,

        data.short_description || null,
        data.description || null,

        data.price,
        data.compare_at_price || null,

        data.currency || "XAF",
        Number(data.position || 0),

        data.is_featured ? 1 : 0,
        data.is_active ? 1 : 0,

        id
    ]);
}


/**
 * Suppression.
 */
async function remove(id) {

    const result = await db.query(`
        DELETE FROM formulas
        WHERE id = ?
    `, [id]);

    return result;
}


/* =========================================================
   IMAGES D'UNE FORMULE
========================================================= */

async function getImages(formulaId) {

    const rows = await db.query(`
        SELECT
            id,
            formula_id,
            image_url,
            alt_text,
            position,
            is_primary
        FROM formula_images
        WHERE formula_id = ?
        ORDER BY
            is_primary DESC,
            position ASC,
            id ASC
    `, [formulaId]);

    return rows;
}


/* =========================================================
   COMPTER IMAGES
========================================================= */

async function countImages(formulaId) {

    const rows = await db.query(`
        SELECT COUNT(*) AS total
        FROM formula_images
        WHERE formula_id = ?
    `, [formulaId]);

    return Number(
        rows[0]?.total || 0
    );
}


/* =========================================================
   AJOUT IMAGE
========================================================= */

async function addImage(
    formulaId,
    imageUrl,
    position,
    isPrimary = 0
) {

    return await db.query(`
        INSERT INTO formula_images
        (
            formula_id,
            image_url,
            alt_text,
            position,
            is_primary
        )
        VALUES (?, ?, ?, ?, ?)
    `, [
        formulaId,
        imageUrl,
        null,
        position,
        isPrimary
    ]);
}


async function findImageById(imageId) {

    const rows = await db.query(`
        SELECT *
        FROM formula_images
        WHERE id = ?
        LIMIT 1
    `, [imageId]);

    return rows[0] || null;
}


/* =========================================================
   SUPPRIMER IMAGE
========================================================= */

async function deleteImage(
    formulaId,
    imageId
) {

    return await db.query(`
        DELETE FROM formula_images
        WHERE id = ?
        AND formula_id = ?
    `, [
        imageId,
        formulaId
    ]);
}


/* =========================================================
   IMAGE PRINCIPALE
========================================================= */

async function setPrimaryImage(
    formulaId,
    imageId
) {

    await db.query(`
        UPDATE formula_images
        SET is_primary = 0
        WHERE formula_id = ?
    `, [formulaId]);


    return await db.query(`
        UPDATE formula_images
        SET is_primary = 1
        WHERE id = ?
        AND formula_id = ?
    `, [
        imageId,
        formulaId
    ]);
}


async function setFirstImagePrimary(formulaId) {

    const rows = await db.query(`
        SELECT id
        FROM formula_images
        WHERE formula_id = ?
        ORDER BY
            position ASC,
            id ASC
        LIMIT 1
    `, [formulaId]);

    if (!rows.length) {
        return;
    }

    await setPrimaryImage(
        formulaId,
        rows[0].id
    );
}


/* =========================================================
   PRODUITS D'UNE FORMULE
   IMPORTANT : votre table SQL est formula_items
========================================================= */

async function getProducts(formulaId) {

    const rows = await db.query(`
        SELECT
            fi.id AS formula_product_id,
            fi.formula_id,
            fi.product_id,
            fi.quantity,
            fi.position,

            p.name,
            p.slug,
            p.short_description,
            p.description,
            p.price,
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
            ) AS primary_image

        FROM formula_items fi

        INNER JOIN products p
            ON p.id = fi.product_id

        WHERE fi.formula_id = ?

        ORDER BY
            fi.position ASC,
            fi.id ASC
    `, [formulaId]);

    return Array.isArray(rows)
        ? rows
        : [];
}

/**
 * Liste des produits disponibles dans l'admin.
 */
async function getAvailableProducts() {

    const rows = await db.query(`
        SELECT
            id,
            name,
            price,
            currency,
            is_active
        FROM products
        WHERE is_active = 1
        ORDER BY name ASC
    `);

    return Array.isArray(rows)
        ? rows
        : [];
}


/* =========================================================
   AJOUTER PRODUIT
========================================================= */

async function addProduct(
    formulaId,
    productId,
    quantity = 1,
    position = 0
) {

    return await db.query(`
        INSERT INTO formula_items
        (
            formula_id,
            product_id,
            quantity,
            position
        )
        VALUES (?, ?, ?, ?)
    `, [
        formulaId,
        productId,
        quantity,
        position
    ]);
}

/* =========================================================
   MODIFIER PRODUIT
========================================================= */

async function updateProduct(
    formulaId,
    relationId,
    quantity,
    position
) {

    return await db.query(`
        UPDATE formula_items
        SET
            quantity = ?,
            position = ?
        WHERE id = ?
          AND formula_id = ?
    `, [
        quantity,
        position,
        relationId,
        formulaId
    ]);
}


/* =========================================================
   RETIRER PRODUIT
========================================================= */

async function removeProduct(
    formulaId,
    relationId
) {

    return await db.query(`
        DELETE FROM formula_items
        WHERE id = ?
          AND formula_id = ?
    `, [
        relationId,
        formulaId
    ]);
}

async function slugExists(slug, excludeId = null) {

    let sql = `
        SELECT id
        FROM formulas
        WHERE slug = ?
    `;

    const params = [slug];

    if (excludeId !== null) {
        sql += ` AND id <> ?`;
        params.push(excludeId);
    }

    sql += ` LIMIT 1`;

    const rows = await db.query(sql, params);

    return rows.length > 0;
}


async function generateUniqueSlug(baseSlug, excludeId = null) {

    let slug = baseSlug;
    let counter = 2;

    while (await slugExists(slug, excludeId)) {

        slug = `${baseSlug}-${counter}`;

        counter++;
    }

    return slug;
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

    findAll,
    findAllForClient,
    findByIdForClient,
    findById,

    create,
    update,
    remove,

    getImages,
    countImages,
    addImage,
    findImageById,
    deleteImage,
    setPrimaryImage,
    setFirstImagePrimary,

    getProducts,
    getAvailableProducts,
    addProduct,
    removeProduct,
    updateProduct,

    slugExists,
    generateUniqueSlug
};