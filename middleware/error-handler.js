module.exports = function errorHandler(error, req, res, _next) {
  console.error(error);

  const status = error.status || 500;
  const isAdmin = req.path.startsWith("/admin");

  res.status(status).render("errors/500", {
    title: "Erreur",
    layout: isAdmin ? "layouts/admin" : "layouts/client",
    error: process.env.NODE_ENV === "development" ? error : null
  });
};
