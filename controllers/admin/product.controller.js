const Product = require("../../models/product.model");
const Category = require("../../models/category.model");


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

        const id = req.params.id;

        const existing =
            await Product.findById(id);


        if (!existing) {

            return res
                .status(404)
                .send("Produit introuvable");

        }


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


        await Product.update(id, {

            category_id:
                Number(category_id),

            sku,

            icon,

            name: name.trim(),

            slug:
                createSlug(name),

            short_description,

            description,

            price:
                Number(price),

            compare_at_price:
                compare_at_price
                    ? Number(compare_at_price)
                    : null,

            currency:
                existing.currency || "XAF",

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

            is_active:
                existing.is_active,

            position:
                Number(position) || 0
        });


        /* nouvelles images */

        if (req.files && req.files.length > 0) {

            const existingImages =
                await Product.findImages(id);

            let position =
                existingImages.length;


            for (const file of req.files) {

                await Product.addImage(
                    id,
                    `/uploads/products/${file.filename}`,
                    position,
                    existingImages.length === 0 &&
                    position === 0
                        ? 1
                        : 0
                );

                position++;
            }

        }


        res.redirect("/admin/produits");

    } catch (error) {

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