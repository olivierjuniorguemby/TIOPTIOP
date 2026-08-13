const db = require("../config/database");

async function findAll() {
    return await db.query(`
        SELECT
            id,
            name,
            slug,
            description,
            image_url,
            icon,
            position,
            is_active,
            created_at
        FROM categories
        ORDER BY position ASC, id ASC
    `);
}

async function findById(id) {
    const rows = await db.query(`
        SELECT *
        FROM categories
        WHERE id = ?
        LIMIT 1
    `, [id]);

    return rows[0] || null;
}

async function create(data) {
    return await db.query(`
        INSERT INTO categories
        (
            name,
            slug,
            description,
            position,
            is_active
        )
        VALUES (?, ?, ?, ?, ?)
    `, [
        data.name,
        data.slug,
        data.description || null,
        data.position || 0,
        data.is_active ?? 1
    ]);
}

async function update(id, data) {
    return await db.query(`
        UPDATE categories
        SET
            name = ?,
            slug = ?,
            description = ?,
            position = ?,
            is_active = ?
        WHERE id = ?
    `, [
        data.name,
        data.slug,
        data.description || null,
        data.position || 0,
        data.is_active ?? 1,
        id
    ]);
}

async function remove(id) {
    return await db.query(`
        DELETE FROM categories
        WHERE id = ?
    `, [id]);
}

async function toggleActive(id) {
    return await db.query(`
        UPDATE categories
        SET is_active =
            CASE
                WHEN is_active = 1 THEN 0
                ELSE 1
            END
        WHERE id = ?
    `, [id]);
}

module.exports = {
    findAll,
    findById,
    create,
    update,
    remove,
    toggleActive
};