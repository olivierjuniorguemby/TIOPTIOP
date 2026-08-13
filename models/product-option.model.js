const db = require("../config/database");


/* =========================================================
   GROUPES D'OPTIONS
========================================================= */


/**
 * Retourne tous les groupes d'un produit
 * avec leurs options.
 */
async function findByProductId(productId, activeOnly = false) {

    let groupSql = `
        SELECT
            id,
            product_id,
            name,
            selection_type,
            is_required,
            min_choices,
            max_choices,
            position,
            is_active,
            created_at,
            updated_at
        FROM product_option_groups
        WHERE product_id = ?
    `;

    if (activeOnly) {
        groupSql += ` AND is_active = 1 `;
    }

    groupSql += `
        ORDER BY position ASC, id ASC
    `;

    const groups = await db.query(
        groupSql,
        [productId]
    );


    for (const group of groups) {

        let optionSql = `
            SELECT
                id,
                option_group_id,
                name,
                price_delta,
                is_default,
                position,
                is_active,
                created_at,
                updated_at
            FROM product_options
            WHERE option_group_id = ?
        `;

        if (activeOnly) {
            optionSql += ` AND is_active = 1 `;
        }

        optionSql += `
            ORDER BY position ASC, id ASC
        `;

        group.options = await db.query(
            optionSql,
            [group.id]
        );
    }


    return groups;
}


/**
 * Trouver un groupe
 */
async function findGroupById(id) {

    const rows = await db.query(`
        SELECT *
        FROM product_option_groups
        WHERE id = ?
        LIMIT 1
    `, [id]);

    return rows[0] || null;
}


/**
 * Ajouter un groupe
 */
async function createGroup(data) {

    const result = await db.query(`
        INSERT INTO product_option_groups
        (
            product_id,
            name,
            selection_type,
            is_required,
            min_choices,
            max_choices,
            position,
            is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        data.product_id,
        data.name,
        data.selection_type,
        data.is_required,
        data.min_choices,
        data.max_choices,
        data.position,
        data.is_active
    ]);

    return result;
}


/**
 * Modifier un groupe
 */
async function updateGroup(id, data) {

    return await db.query(`
        UPDATE product_option_groups
        SET
            name = ?,
            selection_type = ?,
            is_required = ?,
            min_choices = ?,
            max_choices = ?,
            position = ?,
            is_active = ?
        WHERE id = ?
    `, [
        data.name,
        data.selection_type,
        data.is_required,
        data.min_choices,
        data.max_choices,
        data.position,
        data.is_active,
        id
    ]);
}


/**
 * Supprimer un groupe
 *
 * Les options seront automatiquement supprimées
 * grâce au ON DELETE CASCADE.
 */
async function deleteGroup(id) {

    return await db.query(`
        DELETE FROM product_option_groups
        WHERE id = ?
    `, [id]);
}


/* =========================================================
   OPTIONS
========================================================= */


/**
 * Trouver une option
 */
async function findOptionById(id) {

    const rows = await db.query(`
        SELECT
            o.*,
            g.product_id
        FROM product_options o
        INNER JOIN product_option_groups g
            ON g.id = o.option_group_id
        WHERE o.id = ?
        LIMIT 1
    `, [id]);

    return rows[0] || null;
}


/**
 * Ajouter une option
 */
async function createOption(data) {

    /*
     * Si cette option devient celle par défaut
     * dans un groupe SINGLE, on enlève d'abord
     * l'ancien choix par défaut.
     */
    if (Number(data.is_default) === 1) {

        const group = await findGroupById(
            data.option_group_id
        );

        if (
            group &&
            group.selection_type === "single"
        ) {

            await db.query(`
                UPDATE product_options
                SET is_default = 0
                WHERE option_group_id = ?
            `, [
                data.option_group_id
            ]);
        }
    }


    return await db.query(`
        INSERT INTO product_options
        (
            option_group_id,
            name,
            price_delta,
            is_default,
            position,
            is_active
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `, [
        data.option_group_id,
        data.name,
        data.price_delta,
        data.is_default,
        data.position,
        data.is_active
    ]);
}


/**
 * Modifier une option
 */
async function updateOption(id, data) {

    if (Number(data.is_default) === 1) {

        const group = await findGroupById(
            data.option_group_id
        );

        if (
            group &&
            group.selection_type === "single"
        ) {

            await db.query(`
                UPDATE product_options
                SET is_default = 0
                WHERE option_group_id = ?
                AND id <> ?
            `, [
                data.option_group_id,
                id
            ]);
        }
    }


    return await db.query(`
        UPDATE product_options
        SET
            name = ?,
            price_delta = ?,
            is_default = ?,
            position = ?,
            is_active = ?
        WHERE id = ?
    `, [
        data.name,
        data.price_delta,
        data.is_default,
        data.position,
        data.is_active,
        id
    ]);
}


/**
 * Supprimer une option
 */
async function deleteOption(id) {

    return await db.query(`
        DELETE FROM product_options
        WHERE id = ?
    `, [id]);
}


module.exports = {

    findByProductId,

    findGroupById,
    createGroup,
    updateGroup,
    deleteGroup,

    findOptionById,
    createOption,
    updateOption,
    deleteOption

};