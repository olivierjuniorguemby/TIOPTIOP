const router =
    require("express").Router();


/* =========================================================
   MIDDLEWARE AUTH
========================================================= */

const {
    requireAdmin,
    adminGuestOnly,
    logoutAdmin
} =
    require("../../middleware/auth");


/* =========================================================
   CLIENTS ADMIN
========================================================= */

const clientController =
    require(
        "../../controllers/admin/client.controller"
    );


/* =========================================================
   CONTROLLERS GENERAUX
========================================================= */

const dashboard =
    require(
        "../../controllers/admin/dashboard.controller"
    );


const applications =
    require(
        "../../controllers/admin/application.controller"
    );


const page =
    require(
        "../../controllers/admin/page.controller"
    );


const orderController =
    require(
        "../../controllers/admin/order.controller"
    );

const deliveryController =
    require(
        "../../controllers/admin/delivery.controller"
    );


const driverController =
    require(
        "../../controllers/admin/driver.controller"
    );


/* =========================================================
   CATEGORIES
========================================================= */

const category =
    require(
        "../../controllers/admin/category.controller"
    );


/* =========================================================
   PRODUITS
========================================================= */

const product =
    require(
        "../../controllers/admin/product.controller"
    );


const productController =
    require(
        "../../controllers/admin/product.controller"
    );


const productOptionController =
    require(
        "../../controllers/admin/product-option.controller"
    );


const {
    productUpload
} =
    require(
        "../../config/uploads"
    );


/* =========================================================
   FORMULES
========================================================= */

const multer =
    require("multer");

const path =
    require("path");

const fs =
    require("fs");


const formulaController =
    require(
        "../../controllers/admin/formula.controller"
    );


/* =========================================================
   DOSSIER UPLOAD FORMULES
========================================================= */

const formulaUploadDir =
    path.join(
        process.cwd(),
        "public",
        "uploads",
        "formulas"
    );


if (
    !fs.existsSync(
        formulaUploadDir
    )
) {

    fs.mkdirSync(
        formulaUploadDir,
        {
            recursive: true
        }
    );
}


/* =========================================================
   MULTER FORMULES
========================================================= */

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
                    Math.random()
                    * 1E9
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

        storage:
            formulaStorage,

        limits: {

            files: 6,

            fileSize:
                5 * 1024 * 1024
        }
    });


/* =========================================================
   AUTH ADMIN
========================================================= */


/*
 * IMPORTANT :
 *
 * Ces routes doivent absolument être
 * AVANT router.use(requireAdmin).
 *
 * Un utilisateur CLIENT connecté ou non
 * peut accéder à /admin/connexion.
 */


/* =========================================================
   PAGE CONNEXION ADMIN
========================================================= */

router.get(
    "/connexion",
    adminGuestOnly,
    (
        req,
        res
    ) => {

        return res.render(
            "admin/login",
            {
                title:
                    "Connexion administration",

                layout:
                    "layouts/admin"
            }
        );
    }
);


/* =========================================================
   CONNEXION ADMIN
========================================================= */

router.post(
    "/connexion",
    adminGuestOnly,
    (
        req,
        res,
        next
    ) => {

        try {

            const email =
                String(
                    req.body.email || ""
                ).trim();


            /*
             * Pour le moment votre ancien système
             * utilise encore un compte admin simulé.
             *
             * On conserve donc votre fonctionnement
             * actuel.
             *
             * Nous ferons la vraie authentification
             * administrateur avec users/roles
             * à l'étape Admin/Rôles.
             */


            req.session.admin = {

                id: 1,

                name:
                    "Admin TiopTiop",

                email
            };


            /*
             * IMPORTANT :
             *
             * On ne touche jamais à :
             *
             * req.session.user
             */


            return req.session.save(
                error => {

                    if (error) {

                        return next(
                            error
                        );
                    }


                    return res.redirect(
                        "/admin/dashboard"
                    );
                }
            );

        }
        catch (error) {

            return next(
                error
            );
        }
    }
);


/* =========================================================
   DECONNEXION ADMIN
========================================================= */

router.post(
    "/deconnexion",
    (
        req,
        res,
        next
    ) => {

        if (!req.session) {

            return res.redirect(
                "/admin/connexion"
            );
        }


        /*
         * Suppression uniquement
         * de l'identité ADMIN.
         *
         * session.user reste intact.
         */

        delete req.session.admin;


        return req.session.save(
            error => {

                if (error) {

                    console.error(
                        "Erreur déconnexion admin :",
                        error
                    );


                    return next(
                        error
                    );
                }


                return res.redirect(
                    "/admin/connexion"
                );
            }
        );
    }
);

/* =========================================================
   DECONNEXION ADMIN
========================================================= */

router.get(
    "/deconnexion",
    logoutAdmin
);

/* =========================================================
   PROTECTION ADMIN
========================================================= */

/*
 * TOUT CE QUI SE TROUVE EN DESSOUS
 * NECESSITE req.session.admin.
 */

router.use(
    requireAdmin
);


/* =========================================================
   DASHBOARD
========================================================= */

router.get(
    "/",
    (
        req,
        res
    ) => {

        return res.redirect(
            "/admin/dashboard"
        );
    }
);


router.get(
    "/dashboard",
    dashboard.index
);


/* =========================================================
   CANDIDATURES
========================================================= */

router.get(
    "/candidatures",
    applications.index
);


/* =========================================================
   OPERATIONS
========================================================= */

router.get(
    "/commandes",
    orderController.index
);


router.post(
    "/commandes/:reference/statut",
    orderController.updateStatus
);


router.post(
    "/commandes/:reference/livraison/affecter",
    deliveryController.assign
);


router.get(
    "/commandes/:reference",
    orderController.detail
);


router.get(
    "/pos",
    page.render(
        "admin/operations/pos",
        "POS / Nouvelle commande"
    )
);


router.get(
    "/livraisons",
    deliveryController.index
);


router.get(
    "/livreurs",
    driverController.index
);


router.post(
    "/livreurs",
    driverController.create
);


router.post(
    "/livreurs/:id/statut",
    driverController.updateStatus
);


router.get(
    "/paiements",
    page.render(
        "admin/operations/payments",
        "Paiements & caisse"
    )
);


/* =========================================================
   PRODUITS
========================================================= */

router.get(
    "/produits",
    product.index
);


router.post(
    "/produits",
    productUpload.array(
        "images",
        6
    ),
    product.create
);


router.post(
    "/produits/:id/update",
    productUpload.array(
        "images",
        6
    ),
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


/* =========================================================
   IMAGES PRODUITS
========================================================= */

router.get(
    "/produits/:id/images",
    productController.getProductImages
);


router.delete(
    "/produits/:productId/images/:imageId",
    productController.deleteProductImage
);


router.patch(
    "/produits/:productId/images/:imageId/primary",
    productController.setPrimaryProductImage
);


/* =========================================================
   CATEGORIES
========================================================= */

router.get(
    "/categories",
    category.index
);


router.post(
    "/categories",
    category.create
);


router.post(
    "/categories/:id/update",
    category.update
);


router.post(
    "/categories/:id/delete",
    category.remove
);


router.post(
    "/categories/:id/toggle",
    category.toggleActive
);


/* =========================================================
   PROMOTIONS / TIOP+
========================================================= */

router.get(
    "/promotions",
    page.render(
        "admin/catalog/promotions",
        "Promotions"
    )
);


router.get(
    "/tiopplus",
    page.render(
        "admin/catalog/loyalty",
        "Tiop+"
    )
);


/* =========================================================
   ADMINISTRATION CLIENTS
========================================================= */


/* LISTE */

router.get(
    "/clients",
    clientController.index
);


/* DETAIL */

router.get(
    "/clients/:id",
    clientController.getOne
);


/* MODIFIER */

router.post(
    "/clients/:id/update",
    clientController.update
);


/* BLOQUER */

router.post(
    "/clients/:id/block",
    clientController.block
);


/* DEBLOQUER */

router.post(
    "/clients/:id/unblock",
    clientController.unblock
);


/* SUPPRESSION LOGIQUE */

router.post(
    "/clients/:id/delete",
    clientController.remove
);


/* =========================================================
   CONTENU
========================================================= */

router.get(
    "/support",
    page.render(
        "admin/content/support",
        "Support"
    )
);


router.get(
    "/restaurants",
    page.render(
        "admin/content/restaurants",
        "Restaurants"
    )
);


router.get(
    "/pages",
    page.render(
        "admin/content/pages",
        "Pages CMS"
    )
);


router.get(
    "/faq",
    page.render(
        "admin/content/faq",
        "FAQ"
    )
);


router.get(
    "/conditions",
    page.render(
        "admin/content/conditions",
        "Conditions"
    )
);


router.get(
    "/carrieres",
    page.render(
        "admin/content/jobs",
        "Carrières"
    )
);


/* =========================================================
   SYSTEME
========================================================= */

router.get(
    "/utilisateurs",
    page.render(
        "admin/system/users",
        "Utilisateurs admin"
    )
);


router.get(
    "/roles",
    page.render(
        "admin/system/roles",
        "Rôles & permissions"
    )
);


router.get(
    "/notifications",
    page.render(
        "admin/system/notifications",
        "Notifications"
    )
);


router.get(
    "/parametres",
    page.render(
        "admin/system/settings",
        "Paramètres"
    )
);


router.get(
    "/journaux",
    page.render(
        "admin/system/logs",
        "Journaux"
    )
);


router.get(
    "/profil",
    page.render(
        "admin/system/profile",
        "Profil"
    )
);


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
    formulaUpload.array(
        "images",
        6
    ),
    formulaController.create
);


router.post(
    "/formules/:id/update",
    formulaUpload.array(
        "images",
        6
    ),
    formulaController.update
);


router.post(
    "/formules/:id/delete",
    formulaController.remove
);


/* =========================================================
   IMAGES FORMULES
========================================================= */

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


/* =========================================================
   PRODUITS FORMULES
========================================================= */

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


/* =========================================================
   EXPORT
========================================================= */

module.exports = router;