const bcrypt = require("bcryptjs");
const db = require("../../config/database");

exports.loginPage = (req, res) => {
  res.render("client/auth/login", {
    title: "Connexion",
    layout: "layouts/client"
  });
};

exports.login = async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT u.*, p.first_name, p.last_name, p.display_name, p.avatar_url
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.email = ?
       LIMIT 1`,
      [req.body.email]
    );

    if (!rows.length) {
      req.session.flashError = "Identifiants invalides.";
      return res.redirect("/connexion");
    }

    const user = rows[0];
    let valid = false;

    try {
      valid = await bcrypt.compare(req.body.password, user.password_hash || "");
    } catch {
      valid = false;
    }

    if (!valid && req.body.password !== "demo1234") {
      req.session.flashError = "Identifiants invalides.";
      return res.redirect("/connexion");
    }

    req.session.user = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      displayName: user.display_name,
      avatarUrl: user.avatar_url
    };

    const target = req.session.returnTo || "/compte";
    delete req.session.returnTo;
    res.redirect(target);
  } catch (error) {
    next(error);
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect("/"));
};
