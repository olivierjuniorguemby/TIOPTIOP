const db = require("../config/database");

async function findAll() {
  return db.query(
    `SELECT *
     FROM jobs
     WHERE is_active = 1
       AND (closes_at IS NULL OR closes_at >= NOW())
     ORDER BY published_at DESC`
  );
}

async function findById(id) {
  const rows = await db.query("SELECT * FROM jobs WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
}

module.exports = { findAll, findById };
