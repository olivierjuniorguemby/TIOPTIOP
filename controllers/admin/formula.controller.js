const Formula = require("../../models/formula.model");
const Product = require("../../models/product.model");

const fs = require("fs");
const path = require("path");


/* =========================================================
   HELPERS
========================================================= */


function nullable(value) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return null;
    }

    return value;
}


function numberOrZero(value) {

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
}


function checkbox(value) {

    return value === "1" ||
           value === "on" ||
           value === 1
        ? 1
        : 0;
}


function slugify(value) {

    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}


function deletePhysicalFile(imageUrl) {

    if (!imageUrl) {
        return;
    }

    try {

        const relative =
            imageUrl.replace(/^\/+/, "");

        const filePath =
            path.join(
                process.cwd(),
                "public",
                relative
            );

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

    } catch (error) {

        console.error(
            "Impossible de supprimer le fichier :",
            error
        );
    }
}


/* =========================================================
   LISTE ADMIN
========================================================= */


/* =========================================================
   PAGE ADMIN - FORMULES
========================================================= */

exports.index = async (req, res, next) => {

    try {

        /* =====================================================
           1. RÉCUPÉRATION DES FORMULES
        ===================================================== */

        let formulas = await Formula.findAll();


        /* =====================================================
           2. RÉCUPÉRATION DES PRODUITS
           
           Votre product.model.js possède :
           Product.findAllForAdmin()
        ===================================================== */

        let products = await Product.findAllForAdmin();


        /* =====================================================
           3. SÉCURISATION DES RÉSULTATS
        ===================================================== */

        if (!Array.isArray(formulas)) {
            formulas = [];
        }

        if (!Array.isArray(products)) {
            products = [];
        }


        /* =====================================================
           4. AFFICHAGE DE LA PAGE
        ===================================================== */

        return res.render(
            "admin/catalog/formulas",
            {
                title: "Gestion des formules",
                layout: "layouts/admin",

                formulas: formulas,
                products: products
            }
        );

    }
    catch (error) {

        console.error(
            "Erreur chargement administration formules :",
            error
        );

        return next(error);
    }
};


/* =========================================================
   CREATE
========================================================= */


exports.create = async (req, res, next) => {
    
    try {

        const {
            name,
            short_description,
            description,
            price,
            compare_at_price,
            currency,
            position
        } = req.body;


        if (!name || !name.trim()) {
            return res.status(400).send(
                "Le nom de la formule est obligatoire."
            );
        }


        if (!price) {
            return res.status(400).send(
                "Le prix de la formule est obligatoire."
            );
        }


        const baseSlug = slugify(name);

        const slug =
            await Formula.generateUniqueSlug(baseSlug);


        const formulaId = await Formula.create({

            name: name.trim(),

            slug,

            short_description:
                short_description?.trim() || null,

            description:
                description?.trim() || null,

            price:
                Number(price),

            compare_at_price:
                compare_at_price
                    ? Number(compare_at_price)
                    : null,

            currency:
                currency || "XAF",

            position:
                Number(position || 0),

            is_featured:
                req.body.is_featured ? 1 : 0,

            is_active:
                req.body.is_active ? 1 : 0
        });


        /* ================================================
           IMAGES
        ================================================= */

        if (req.files && req.files.length > 0) {

            const files =
                req.files.slice(0, 6);

            for (
                let i = 0;
                i < files.length;
                i++
            ) {

                const file = files[i];

                const imageUrl =
                    `/uploads/formulas/${file.filename}`;

                await Formula.addImage(
                    formulaId,
                    imageUrl,
                    i,
                    i === 0 ? 1 : 0
                );
            }
        }


        return res.redirect(
            "/admin/formules"
        );

    }
    catch (error) {

        console.error(
            "Erreur création formule :",
            error
        );


        /* sécurité supplémentaire en cas de collision */
        if (error.code === "ER_DUP_ENTRY") {

            return res.status(409).send(
                "Une formule possédant cet identifiant existe déjà."
            );
        }


        next(error);
    }
};


/* =========================================================
   UPDATE
========================================================= */


exports.update = async (req, res, next) => {

    try {

        const formulaId =
            Number(req.params.id);


        /* =============================================
           VERIFICATION
        ============================================= */

        const formula =
            await Formula.findById(
                formulaId
            );


        if (!formula) {

            return res
                .status(404)
                .send(
                    "Formule introuvable."
                );
        }


        /* =============================================
           DONNEES
        ============================================= */

        const name =
            String(
                req.body.name || ""
            ).trim();


        if (!name) {

            return res
                .status(400)
                .send(
                    "Le nom est obligatoire."
                );
        }


        const baseSlug =
            slugify(name);


        const slug =
            await Formula.generateUniqueSlug(
                baseSlug,
                formulaId
            );


        const data = {

            name,

            slug,

            short_description:
                req.body.short_description
                    ?.trim() || null,

            description:
                req.body.description
                    ?.trim() || null,

            price:
                Number(
                    req.body.price || 0
                ),

            compare_at_price:
                req.body.compare_at_price
                    ? Number(
                        req.body.compare_at_price
                    )
                    : null,

            currency:
                req.body.currency || "XAF",

            position:
                Number(
                    req.body.position || 0
                ),

            is_featured:
                req.body.is_featured
                    ? 1
                    : 0,

            is_active:
                req.body.is_active
                    ? 1
                    : 0
        };


        /* =============================================
           UPDATE
        ============================================= */

        await Formula.update(
            formulaId,
            data
        );


        /* =============================================
           NOUVELLES IMAGES
        ============================================= */

        const existingImagesCount =
            await Formula.countImages(
                formulaId
            );


        const newFiles =
            Array.isArray(req.files)
                ? req.files
                : [];


        if (
            existingImagesCount +
            newFiles.length >
            6
        ) {

            return res
                .status(400)
                .send(
                    "Maximum 6 images par formule."
                );
        }


        for (
            let i = 0;
            i < newFiles.length;
            i++
        ) {

            const file =
                newFiles[i];


            const imageUrl =
                `/uploads/formulas/${file.filename}`;


            const totalBefore =
                existingImagesCount + i;


            await Formula.addImage(
                formulaId,
                imageUrl,
                totalBefore,
                totalBefore === 0
                    ? 1
                    : 0
            );
        }


        /* =============================================
           RETOUR PAGE FORMULES
        ============================================= */

        return res.redirect(
            "/admin/formules"
        );

    }
    catch (error) {

        console.error(
            "Erreur modification formule :",
            error
        );

        next(error);
    }
};


/* =========================================================
   DELETE FORMULA
========================================================= */


exports.remove = async (req, res, next) => {

    try {

        const formulaId =
            Number(req.params.id);


        const images =
            await Formula.getImages(
                formulaId
            );


        await Formula.remove(
            formulaId
        );


        for (const image of images) {

            deletePhysicalFile(
                image.image_url
            );
        }


        res.redirect("/admin/formules");

    } catch (error) {

        console.error(
            "Erreur suppression formule :",
            error
        );

        next(error);
    }
};


/* =========================================================
   GET IMAGES JSON
========================================================= */


exports.getImages = async (
    req,
    res,
    next
) => {

    try {

        const formulaId =
            Number(req.params.id);


        const images =
            await Formula.getImages(
                formulaId
            );


        return res.json(
            Array.isArray(images)
                ? images
                : []
        );

    }
    catch (error) {

        console.error(
            "Erreur chargement images formule :",
            error
        );

        return res
            .status(500)
            .json({
                message:
                    "Impossible de charger les images."
            });
    }
};


/* =========================================================
   DELETE IMAGE
========================================================= */


exports.deleteImage = async (
    req,
    res
) => {

    try {

        const formulaId =
            Number(
                req.params.formulaId
            );

        const imageId =
            Number(
                req.params.imageId
            );


        await Formula.deleteImage(
            formulaId,
            imageId
        );


        /* ===========================================
           SI PLUS AUCUNE PRINCIPALE
        =========================================== */

        const images =
            await Formula.getImages(
                formulaId
            );


        if (images.length > 0) {

            const hasPrimary =
                images.some(
                    image =>
                        Number(
                            image.is_primary
                        ) === 1
                );


            if (!hasPrimary) {

                await Formula.setPrimaryImage(
                    formulaId,
                    images[0].id
                );
            }
        }


        return res.json({
            success: true
        });

    }
    catch (error) {

        console.error(
            "Erreur suppression image :",
            error
        );


        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Impossible de supprimer l'image."
            });
    }
};


/* =========================================================
   IMAGE PRINCIPALE
========================================================= */


exports.setPrimaryImage = async (
    req,
    res
) => {

    try {

        const formulaId =
            Number(
                req.params.formulaId
            );

        const imageId =
            Number(
                req.params.imageId
            );


        await Formula.setPrimaryImage(
            formulaId,
            imageId
        );


        return res.json({
            success: true,
            message:
                "Image principale modifiée."
        });

    }
    catch (error) {

        console.error(
            "Erreur image principale :",
            error
        );


        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Impossible de modifier l'image principale."
            });
    }
};


/* =========================================================
   GET PRODUCTS JSON
========================================================= */


exports.getProducts = async (
    req,
    res
) => {

    try {

        const formulaId =
            Number(req.params.id);


        const products =
            await Formula.getProducts(
                formulaId
            );


        return res.json(
            Array.isArray(products)
                ? products
                : []
        );

    }
    catch (error) {

        console.error(
            "Erreur produits formule :",
            error
        );


        return res
            .status(500)
            .json({
                message:
                    "Impossible de charger les produits."
            });
    }
};


/* =========================================================
   ADD PRODUCT
========================================================= */


exports.addProduct = async (
    req,
    res
) => {

    try {

        const formulaId =
            Number(req.params.id);


        const productId =
            Number(
                req.body.product_id
            );


        const quantity =
            Math.max(
                1,
                Number(
                    req.body.quantity || 1
                )
            );


        const position =
            Number(
                req.body.position || 0
            );


        if (!productId) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Produit obligatoire."
                });
        }


        await Formula.addProduct(
            formulaId,
            productId,
            quantity,
            position
        );


        return res.json({
            success: true
        });

    }
    catch (error) {

        console.error(
            "Erreur ajout produit formule :",
            error
        );


        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Impossible d'ajouter le produit."
            });
    }
};


/* =========================================================
   UPDATE PRODUCT RELATION
========================================================= */


exports.updateProduct = async (
    req,
    res
) => {

    try {

        const formulaId =
            Number(
                req.params.formulaId
            );


        const relationId =
            Number(
                req.params.relationId
            );


        const quantity =
            Math.max(
                1,
                Number(
                    req.body.quantity || 1
                )
            );


        const position =
            Number(
                req.body.position || 0
            );


        await Formula.updateProduct(
            formulaId,
            relationId,
            quantity,
            position
        );


        return res.json({
            success: true
        });

    }
    catch (error) {

        console.error(
            "Erreur modification produit formule :",
            error
        );


        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Impossible de modifier le produit."
            });
    }
};


/* =========================================================
   REMOVE PRODUCT
========================================================= */


exports.removeProduct = async (
    req,
    res
) => {

    try {

        const formulaId =
            Number(
                req.params.formulaId
            );


        const relationId =
            Number(
                req.params.relationId
            );


        await Formula.removeProduct(
            formulaId,
            relationId
        );


        return res.json({
            success: true
        });

    }
    catch (error) {

        console.error(
            "Erreur retrait produit formule :",
            error
        );


        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Impossible de retirer le produit."
            });
    }
};