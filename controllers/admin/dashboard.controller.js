const db = require("../../config/database");

exports.index = async (req, res, next) => {
  try {
    const [clients, orders, revenue, applications] = await Promise.all([
      db.query("SELECT COUNT(*) AS total FROM users"),
      db.query("SELECT status, COUNT(*) AS total FROM orders GROUP BY status"),
      db.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total
         FROM orders
         WHERE status NOT IN ("CANCELLED", "REFUNDED")`
      ),
      db.query("SELECT status, COUNT(*) AS total FROM job_applications GROUP BY status")
    ]);

    res.render("admin/dashboard", {
      title: "Tableau de bord",
      layout: "layouts/admin",
      stats: {
        clients: clients[0]?.total || 0,
        orders,
        revenue: revenue[0]?.total || 0,
        applications
      }
    });
  } catch (error) {
    next(error);
  }
};
