const router = require("express").Router();
const dashboard = require("../../controllers/admin/dashboard.controller");
const applications = require("../../controllers/admin/application.controller");
const page = require("../../controllers/admin/page.controller");
const { requireAdmin } = require("../../middleware/auth");

router.get("/connexion", (req, res) => {
  res.render("admin/login", {
    title: "Connexion administration",
    layout: "layouts/admin"
  });
});

router.post("/connexion", (req, res) => {
  req.session.admin = {
    id: 1,
    name: "Admin TiopTiop",
    email: req.body.email
  };
  res.redirect("/admin/dashboard");
});

router.use(requireAdmin);

router.get("/", (_req, res) => res.redirect("/admin/dashboard"));
router.get("/dashboard", dashboard.index);
router.get("/candidatures", applications.index);

router.get("/commandes", page.render("admin/operations/orders", "Commandes"));
router.get("/pos", page.render("admin/operations/pos", "POS / Nouvelle commande"));
router.get("/livraisons", page.render("admin/operations/deliveries", "Livraisons"));
router.get("/paiements", page.render("admin/operations/payments", "Paiements & caisse"));

router.get("/produits", page.render("admin/catalog/products", "Produits"));
router.get("/categories", page.render("admin/catalog/categories", "Catégories"));
router.get("/formules", page.render("admin/catalog/formulas", "Formules"));
router.get("/promotions", page.render("admin/catalog/promotions", "Promotions"));
router.get("/tiopplus", page.render("admin/catalog/loyalty", "Tiop+"));

router.get("/clients", page.render("admin/content/clients", "Clients"));
router.get("/support", page.render("admin/content/support", "Support"));
router.get("/restaurants", page.render("admin/content/restaurants", "Restaurants"));
router.get("/pages", page.render("admin/content/pages", "Pages CMS"));
router.get("/faq", page.render("admin/content/faq", "FAQ"));
router.get("/carrieres", page.render("admin/content/jobs", "Carrières"));

router.get("/utilisateurs", page.render("admin/system/users", "Utilisateurs admin"));
router.get("/roles", page.render("admin/system/roles", "Rôles & permissions"));
router.get("/parametres", page.render("admin/system/settings", "Paramètres"));
router.get("/journaux", page.render("admin/system/logs", "Journaux"));
router.get("/profil", page.render("admin/system/profile", "Profil"));

module.exports = router;
