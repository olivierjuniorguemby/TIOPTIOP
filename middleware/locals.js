module.exports = function locals(req, res, next) {
  res.locals.appName = process.env.APP_NAME || "TiopTiop";
  res.locals.currentPath = req.path;
  res.locals.currentUser = req.session?.user || null;
  res.locals.currentAdmin = req.session?.admin || null;
  res.locals.flashSuccess = req.session?.flashSuccess || null;
  res.locals.flashError = req.session?.flashError || null;
  res.locals.formatMoney = (value) =>
    `${new Intl.NumberFormat("fr-FR").format(Number(value || 0))} FCFA`;

  if (req.session) {
    delete req.session.flashSuccess;
    delete req.session.flashError;
  }
  next();
};
