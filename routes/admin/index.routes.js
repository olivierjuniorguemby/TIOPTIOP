const router = require("express").Router();
const dashboard = require("../../controllers/admin/dashboard.controller");
const applications = require("../../controllers/admin/application.controller");
const page = require("../../controllers/admin/page.controller");
const { requireAdmin } = require("../../middleware/auth");

const category = require("../../controllers/admin/category.controller");
const product = require("../../controllers/admin/product.controller");
const { productUpload } = require("../../config/uploads");

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

// Products
router.get(
    "/produits",
    product.index
);


router.post(
    "/produits",
    productUpload.array("images", 6),
    product.create
);


router.post(
    "/produits/:id/update",
    productUpload.array("images", 6),
    product.update
);


router.post(
    "/produits/:id/toggle",
    product.toggleActive
);


router.post(
    "/produits/:id/delete",
    product.remove
);

// Categories
router.get("/categories", category.index);
router.post("/categories", category.create);
router.post("/categories/:id/update", category.update);
router.post("/categories/:id/delete", category.remove);
router.post("/categories/:id/toggle", category.toggleActive);


router.get("/formules", page.render("admin/catalog/formulas", "Formules"));
router.get("/promotions", page.render("admin/catalog/promotions", "Promotions"));
router.get("/tiopplus", page.render("admin/catalog/loyalty", "Tiop+"));

router.get("/clients", page.render("admin/content/clients", "Clients"));
router.get("/support", page.render("admin/content/support", "Support"));
router.get("/restaurants", page.render("admin/content/restaurants", "Restaurants"));
router.get("/pages", page.render("admin/content/pages", "Pages CMS"));
router.get("/faq", page.render("admin/content/faq", "FAQ"));
router.get("/conditions", page.render("admin/content/conditions", "Conditions"));
router.get("/carrieres", page.render("admin/content/jobs", "Carrières"));

router.get("/utilisateurs", page.render("admin/system/users", "Utilisateurs admin"));
router.get("/roles", page.render("admin/system/roles", "Rôles & permissions"));
router.get("/notifications", page.render("admin/system/notifications", "Notifications"));
router.get("/parametres", page.render("admin/system/settings", "Paramètres"));
router.get("/journaux", page.render("admin/system/logs", "Journaux"));
router.get("/profil", page.render("admin/system/profile", "Profil"));

module.exports = router;
