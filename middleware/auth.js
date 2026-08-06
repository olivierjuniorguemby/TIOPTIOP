function requireUser(req, res, next) {
  if (!req.session?.user) {
    req.session.returnTo = req.originalUrl;
    req.session.flashError = "Veuillez vous connecter.";
    return res.redirect("/connexion");
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session?.admin) {
    req.session.returnTo = req.originalUrl;
    req.session.flashError = "Connexion administrateur requise.";
    return res.redirect("/admin/connexion");
  }
  next();
}

function guestOnly(req, res, next) {
  if (req.session?.user) {
    return res.redirect("/compte");
  }
  next();
}

module.exports = { requireUser, requireAdmin, guestOnly };
