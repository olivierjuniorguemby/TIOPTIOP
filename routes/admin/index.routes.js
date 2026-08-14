const router = require("express").Router();

// FORMULAS PLUGINS

const multer = require("multer");
const path = require("path");
const fs = require("fs");

const formulaController =
    require("../../controllers/admin/formula.controller");


const formulaUploadDir =
    path.join(
        process.cwd(),
        "public",
        "uploads",
        "formulas"
    );


if (!fs.existsSync(formulaUploadDir)) {

    fs.mkdirSync(
        formulaUploadDir,
        {
            recursive: true
        }
    );
}


const formulaStorage =
    multer.diskStorage({

        destination: (
            req,
            file,
            cb
        ) => {

            cb(
                null,
                formulaUploadDir
            );
        },


        filename: (
            req,
            file,
            cb
        ) => {

            const extension =
                path.extname(
                    file.originalname
                );


            const filename =
                "formula-" +
                Date.now() +
                "-" +
                Math.round(
                    Math.random() *
                    1E9
                ) +
                extension;


            cb(
                null,
                filename
            );
        }
    });


const formulaUpload =
    multer({
        storage: formulaStorage,
        limits: {
            files: 6,
            fileSize:
                5 * 1024 * 1024
        }
    });
// FIN FORMULAS PLUGINS

const dashboard = require("../../controllers/admin/dashboard.controller");
const applications = require("../../controllers/admin/application.controller");
const page = require("../../controllers/admin/page.controller");
const { requireAdmin } = require("../../middleware/auth");

const category = require("../../controllers/admin/category.controller");
const product = require("../../controllers/admin/product.controller");
const { productUpload } = require("../../config/uploads");
const productController =
    require("../../controllers/admin/product.controller");
const productOptionController =
    require("../../controllers/admin/product-option.controller");






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

// Products Images
// Images existantes
router.get(
    "/produits/:id/images",
    productController.getProductImages
);


// Supprimer une image
router.delete(
    "/produits/:productId/images/:imageId",
    productController.deleteProductImage
);


// Choisir l'image principale
router.patch(
    "/produits/:productId/images/:imageId/primary",
    productController.setPrimaryProductImage
);

// Categories
router.get("/categories", category.index);
router.post("/categories", category.create);
router.post("/categories/:id/update", category.update);
router.post("/categories/:id/delete", category.remove);
router.post("/categories/:id/toggle", category.toggleActive);


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

/* =========================================================
   OPTIONS / SUPPLEMENTS PRODUITS
========================================================= */

router.get(
    "/produits/:productId/options",
    productOptionController.index
);

router.post(
    "/produits/:productId/options/groupes",
    productOptionController.createGroup
);

router.post(
    "/produits/options/groupes/:groupId/update",
    productOptionController.updateGroup
);

router.post(
    "/produits/options/groupes/:groupId/delete",
    productOptionController.deleteGroup
);

router.post(
    "/produits/options/groupes/:groupId/options",
    productOptionController.createOption
);

router.post(
    "/produits/options/:optionId/update",
    productOptionController.updateOption
);

router.post(
    "/produits/options/:optionId/delete",
    productOptionController.deleteOption
);

/* =========================================================
   FORMULES
========================================================= */

router.get(
    "/formules",
    formulaController.index
);


router.post(
    "/formules",
    formulaUpload.array("images", 6),
    formulaController.create
);


router.post(
    "/formules/:id/update",
    formulaUpload.array("images", 6),
    formulaController.update
);


router.post(
    "/formules/:id/delete",
    formulaController.remove
);


/* IMAGES */

router.get(
    "/formules/:id/images",
    formulaController.getImages
);


router.post(
    "/formules/:formulaId/images/:imageId/delete",
    formulaController.deleteImage
);


router.post(
    "/formules/:formulaId/images/:imageId/primary",
    formulaController.setPrimaryImage
);


/* PRODUITS */

router.get(
    "/formules/:id/products",
    formulaController.getProducts
);


router.post(
    "/formules/:id/products",
    formulaController.addProduct
);


router.post(
    "/formules/:formulaId/products/:relationId/update",
    formulaController.updateProduct
);


router.post(
    "/formules/:formulaId/products/:relationId/delete",
    formulaController.removeProduct
);

module.exports = router;
