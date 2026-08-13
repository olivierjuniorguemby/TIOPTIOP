const Product = require("../../models/product.model");
const Category = require("../../models/category.model");

const fs = require("fs");
const path = require("path");

function createSlug(text) {

    return text
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}


/* ======================================================
   LISTE
====================================================== */

exports.index = async (req, res, next) => {

    try {

        const [products, categories] = await Promise.all([
            Product.findAllForAdmin(),
            Category.findAll()
        ]);

        res.render("admin/catalog/products", {
            title: "Produits",
            layout: "layouts/admin",
            products,
            categories
        });

    } catch (error) {

        next(error);

    }
};


/* ======================================================
   AJOUT
====================================================== */

exports.create = async (req, res, next) => {

    try {

        const {
            category_id,
            sku,
            icon,
            name,
            short_description,
            description,
            price,
            compare_at_price,
            preparation_minutes,
            spice_level,
            allergens,
            ingredients,
            calories,
            is_halal,
            is_vegetarian,
            is_breakfast,
            breakfast_start,
            breakfast_end,
            is_featured,
            position
        } = req.body;


        if (!name || !category_id || !price) {
            return res.redirect("/admin/produits");
        }


        const result = await Product.create({

            category_id: Number(category_id),

            sku,

            icon,

            name: name.trim(),

            slug: createSlug(name),

            short_description,

            description,

            price: Number(price),

            compare_at_price:
                compare_at_price
                    ? Number(compare_at_price)
                    : null,

            currency: "XAF",

            preparation_minutes:
                Number(preparation_minutes) || 15,

            spice_level:
                Number(spice_level) || 0,

            allergens,

            ingredients,

            calories:
                calories
                    ? Number(calories)
                    : null,

            is_halal:
                is_halal ? 1 : 0,

            is_vegetarian:
                is_vegetarian ? 1 : 0,

            is_breakfast:
                is_breakfast ? 1 : 0,

            breakfast_start:
                breakfast_start || null,

            breakfast_end:
                breakfast_end || null,

            is_featured:
                is_featured ? 1 : 0,

            is_active: 1,

            position:
                Number(position) || 0
        });


        const productId = result.insertId;


        /* ===============================================
           IMAGES
        =============================================== */

        if (req.files && req.files.length > 0) {

            for (let i = 0; i < req.files.length; i++) {

                const file = req.files[i];

                const imageUrl =
                    `/uploads/products/${file.filename}`;

                await Product.addImage(
                    productId,
                    imageUrl,
                    i,
                    i === 0 ? 1 : 0
                );
            }

        }


        res.redirect("/admin/produits");

    } catch (error) {

        next(error);

    }
};

/* ======================================================
   MODIFIER
====================================================== */

exports.update = async (req, res, next) => {

    try {

        // ======================================================
        // 1. ID DU PRODUIT
        // ======================================================

        const productId = Number(req.params.id);

        if (!productId) {
            return res.status(400).send(
                "Identifiant du produit invalide."
            );
        }


        // ======================================================
        // 2. VERIFIER QUE LE PRODUIT EXISTE
        // ======================================================

        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).send(
                "Produit introuvable."
            );
        }


        // ======================================================
        // 3. DEBUG FORMULAIRE
        // ======================================================

        console.log("BODY UPDATE =", req.body);


        // ======================================================
        // 4. RECUPERATION DES CHAMPS
        // ======================================================

        const {
            category_id,
            sku,
            icon,
            name,
            short_description,
            description,
            price,
            compare_at_price,
            preparation_minutes,
            spice_level,
            allergens,
            ingredients,
            calories,
            breakfast_start,
            breakfast_end,
            position
        } = req.body;


        // ======================================================
        // 5. VALIDATION MINIMALE
        // ======================================================

        if (!name || !name.trim()) {

            return res.status(400).send(
                "Le nom du produit est obligatoire."
            );
        }


        if (!category_id) {

            return res.status(400).send(
                "La catégorie est obligatoire."
            );
        }


        if (
            price === undefined ||
            price === null ||
            price === ""
        ) {

            return res.status(400).send(
                "Le prix est obligatoire."
            );
        }


        // ======================================================
        // 6. GENERATION AUTOMATIQUE DU SLUG
        // ======================================================

        const generatedSlug = name
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");


        // ======================================================
        // 7. CHECKBOX
        //
        // Une checkbox HTML non cochée n'est pas envoyée
        // dans req.body.
        // ======================================================

        const is_halal =
            req.body.is_halal ? 1 : 0;

        const is_vegetarian =
            req.body.is_vegetarian ? 1 : 0;

        const is_breakfast =
            req.body.is_breakfast ? 1 : 0;

        const is_featured =
            req.body.is_featured ? 1 : 0;


        // ======================================================
        // 8. IS_ACTIVE
        //
        // Votre formulaire UPDATE actuel n'envoie pas is_active.
        // On conserve donc la valeur existante.
        // ======================================================

        const is_active =
            req.body.is_active !== undefined
                ? (req.body.is_active ? 1 : 0)
                : Number(product.is_active);


        // ======================================================
        // 9. COMPTER LES IMAGES EXISTANTES
        // ======================================================

        const existingImagesCount =
            await Product.countImages(productId);


        // ======================================================
        // 10. COMPTER LES NOUVELLES IMAGES
        // ======================================================

        const newImagesCount =
            req.files
                ? req.files.length
                : 0;


        console.log(
            "IMAGES :",
            {
                existingImagesCount,
                newImagesCount
            }
        );


        // ======================================================
        // 11. MAXIMUM 6 IMAGES
        // ======================================================

        if (
            existingImagesCount + newImagesCount > 6
        ) {

            return res.status(400).send(
                `Un produit ne peut pas avoir plus de 6 images. ` +
                `Le produit possède déjà ${existingImagesCount} image(s) ` +
                `et vous essayez d'en ajouter ${newImagesCount}.`
            );
        }


        // ======================================================
        // 12. PREPARER LES DONNEES PRODUIT
        // ======================================================

        const productData = {

            category_id:
                category_id || null,

            sku:
                sku && sku.trim()
                    ? sku.trim()
                    : null,

            icon:
                icon && icon.trim()
                    ? icon.trim()
                    : null,

            name:
                name.trim(),

            slug:
                generatedSlug,

            short_description:
                short_description &&
                short_description.trim()
                    ? short_description.trim()
                    : null,

            description:
                description &&
                description.trim()
                    ? description.trim()
                    : null,

            price:
                price,

            compare_at_price:
                compare_at_price !== undefined &&
                compare_at_price !== ""
                    ? compare_at_price
                    : null,

            // Votre formulaire ne l'envoie pas actuellement.
            currency:
                req.body.currency || product.currency || "XAF",

            preparation_minutes:
                preparation_minutes !== undefined &&
                preparation_minutes !== ""
                    ? preparation_minutes
                    : 15,

            spice_level:
                spice_level !== undefined &&
                spice_level !== ""
                    ? spice_level
                    : 0,

            allergens:
                allergens &&
                allergens.trim()
                    ? allergens.trim()
                    : null,

            ingredients:
                ingredients &&
                ingredients.trim()
                    ? ingredients.trim()
                    : null,

            calories:
                calories !== undefined &&
                calories !== ""
                    ? calories
                    : null,

            is_halal:
                is_halal,

            is_vegetarian:
                is_vegetarian,

            is_breakfast:
                is_breakfast,

            // Les horaires n'ont de sens que pour
            // les produits petit-déjeuner.
            breakfast_start:
                is_breakfast
                    ? (breakfast_start || null)
                    : null,

            breakfast_end:
                is_breakfast
                    ? (breakfast_end || null)
                    : null,

            is_featured:
                is_featured,

            is_active:
                is_active,

            position:
                position !== undefined &&
                position !== ""
                    ? position
                    : 0
        };


        // ======================================================
        // 13. DEBUG DONNEES ENVOYEES AU MODEL
        // ======================================================

        console.log(
            "PRODUCT DATA UPDATE =",
            productData
        );


        // Sécurité supplémentaire :
        // aucune valeur ne doit être undefined.
        for (const [key, value] of Object.entries(productData)) {

            if (value === undefined) {

                console.error(
                    `ERREUR : ${key} est undefined`
                );

                return res.status(500).send(
                    `Erreur interne : le champ ${key} est undefined.`
                );
            }
        }


        // ======================================================
        // 14. MODIFIER LE PRODUIT
        // ======================================================

        await Product.update(
            productId,
            productData
        );


        // ======================================================
        // 15. AJOUTER LES NOUVELLES IMAGES
        // ======================================================

        if (
            req.files &&
            req.files.length > 0
        ) {

            for (
                let i = 0;
                i < req.files.length;
                i++
            ) {

                const file =
                    req.files[i];


                // Chemin enregistré en BDD
                const imageUrl =
                    `/uploads/products/${file.filename}`;


                // Position après les images existantes
                const imagePosition =
                    existingImagesCount + i;


                // Si le produit n'avait aucune image,
                // la première nouvelle image devient principale.
                const isPrimary =
                    existingImagesCount === 0 &&
                    i === 0
                        ? 1
                        : 0;


                await Product.addImage(
                    productId,
                    imageUrl,
                    imagePosition,
                    isPrimary
                );
            }
        }


        // ======================================================
        // 16. SUCCES
        // ======================================================

        console.log(
            `Produit ${productId} modifié avec succès.`
        );


        // ======================================================
        // 17. REDIRECTION
        // ======================================================

        return res.redirect(
            "/admin/produits"
        );

    }
    catch (error) {

        console.error(
            "Erreur modification produit :",
            error
        );

        next(error);
    }
};

/* ======================================================
   TOGGLE
====================================================== */

exports.toggleActive = async (req, res, next) => {

    try {

        await Product.toggleActive(
            req.params.id
        );

        res.redirect("/admin/produits");

    } catch (error) {

        next(error);

    }
};


/* ======================================================
   SUPPRESSION
====================================================== */

exports.remove = async (req, res, next) => {

    try {

        await Product.remove(
            req.params.id
        );

        res.redirect("/admin/produits");

    } catch (error) {

        next(error);

    }
};

// Get All Images
exports.getProductImages = async (req, res, next) => {

    try {

        const productId = Number(req.params.id);

        const images =
            await Product.getImages(productId);

        res.json({
            success: true,
            images
        });

    }
    catch (error) {

        next(error);

    }
};

exports.deleteProductImage = async (req, res, next) => {

    try {

        const productId =
            Number(req.params.productId);

        const imageId =
            Number(req.params.imageId);


        const image =
            await Product.getImageById(imageId);


        if (!image || Number(image.product_id) !== productId) {

            return res.status(404).json({
                success: false,
                message: "Image introuvable."
            });

        }


        const wasPrimary =
            Number(image.is_primary) === 1;


        // ==========================
        // SUPPRESSION MYSQL
        // ==========================

        await Product.deleteImage(imageId);


        // ==========================
        // SUPPRESSION FICHIER
        // ==========================

        if (
            image.image_url &&
            image.image_url.startsWith("/uploads/products/")
        ) {

            const fileName =
                path.basename(image.image_url);

            const filePath =
                path.join(
                    process.cwd(),
                    "uploads",
                    "products",
                    fileName
                );


            if (fs.existsSync(filePath)) {

                fs.unlinkSync(filePath);

            }

        }


        // ==========================
        // SI C'ETAIT LA PRINCIPALE
        // ==========================

        if (wasPrimary) {

            const remainingImages =
                await Product.getImages(productId);

            if (remainingImages.length > 0) {

                await Product.setPrimaryImage(
                    productId,
                    remainingImages[0].id
                );

            }

        }


        return res.json({
            success: true,
            message: "Image supprimée."
        });

    }
    catch (error) {

        next(error);

    }
};

// To choice primary image
exports.setPrimaryProductImage = async (req, res, next) => {

    try {

        const productId = Number(req.params.productId);
        const imageId = Number(req.params.imageId);

        if (!productId || !imageId) {
            return res.status(400).json({
                success: false,
                message: "Produit ou image invalide."
            });
        }

        const image =
            await Product.getImageById(imageId);

        if (!image) {
            return res.status(404).json({
                success: false,
                message: "Image introuvable."
            });
        }

        if (Number(image.product_id) !== productId) {
            return res.status(400).json({
                success: false,
                message:
                    "Cette image n'appartient pas à ce produit."
            });
        }

        await Product.setPrimaryImage(
            productId,
            imageId
        );

        return res.json({
            success: true,
            message: "Image principale modifiée."
        });

    } catch (error) {

        console.error(
            "Erreur image principale :",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Erreur lors de la modification de l'image principale."
        });
    }
};