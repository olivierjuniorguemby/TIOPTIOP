module.exports = function notFound(req, res) {
  res.status(404).render("errors/404", {
    title: "Page introuvable",
    layout: "layouts/client"
  });
};
