const db = require("../config/database");

async function findAll(filters = {}) {
  const where = ["p.is_active = 1"];
  const values = [];

  if (filters.q) {
    where.push("(p.name LIKE ? OR p.description LIKE ?)");
    values.push(`%${filters.q}%`, `%${filters.q}%`);
  }

  if (filters.category) {
    where.push("c.slug = ?");
    values.push(filters.category);
  }

  return db.query(
    `SELECT p.*, c.name AS category_name,
      (SELECT image_url
       FROM product_images pi
       WHERE pi.product_id = p.id
       ORDER BY pi.is_primary DESC, pi.position, pi.id
       LIMIT 1) AS image_url
     FROM products p
     INNER JOIN categories c ON c.id = p.category_id
     WHERE ${where.join(" AND ")}
     ORDER BY p.is_featured DESC, p.position, p.name`,
    values
  );
}

async function findById(id) {
  const rows = await db.query(
    `SELECT p.*, c.name AS category_name
     FROM products p
     INNER JOIN categories c ON c.id = p.category_id
     WHERE p.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

module.exports = { findAll, findById };
