const Product = require("../../models/product.model");
const Category =
    require("../../models/category.model");
const ProductOption =
    require("../../models/product-option.model");

/* ======================================================
   FONCTION COMMUNE DE RENDU
====================================================== */

function render(view, title, data = {}) {

    return {
        view,
        options: {
            title,
            layout: "layouts/client",
            ...data
        }
    };
}


/* ======================================================
   ACCUEIL
====================================================== */

exports.home = async (req, res, next) => {

    try {

        const products = await Product.findAllForMenu({});

        const page = render(
            "client/home",
            "Accueil",
            {
                products: products.slice(0, 8)
            }
        );

        res.render(
            page.view,
            page.options
        );

    } catch (error) {

        console.error(
            "Erreur chargement accueil :",
            error
        );

        next(error);
    }
};


/* ======================================================
   MENU CLIENT
====================================================== */

exports.menu = async (req, res, next) => {

    try {

        /* =====================================
           FILTRES URL
        ===================================== */

        const filters = {

            q:
                req.query.q || "",

            category:
                req.query.category || "",

            maxPrice:
                req.query.maxPrice || ""
        };


        /* =====================================
           PRODUITS
        ===================================== */

        const products =
            await Product.findAllForMenu(filters);


        /* =====================================
           CATEGORIES
        ===================================== */

        const categories =
            await Category.findAllActive();


        /* =====================================
           ENVOI A LA VUE
        ===================================== */

        const page = render(
            "client/catalog/menu",
            "Menu",
            {
                products,
                categories,

                query:
                    filters.q,

                selectedCategory:
                    filters.category,

                maxPrice:
                    filters.maxPrice
            }
        );


        res.render(
            page.view,
            page.options
        );

    } catch (error) {

        console.error(
            "Erreur chargement menu :",
            error
        );

        next(error);
    }
};


/* ======================================================
   FICHE PRODUIT

   Version provisoire.
   Nous ferons la vraie implémentation à l'étape 6.
====================================================== */

exports.product = async (req, res, next) => {

    try {

        const productId =
            parseInt(req.params.id, 10);


        /* =========================================
           VERIFICATION ID
        ========================================= */

        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {

            return res.status(404).send(
                "Produit introuvable."
            );
        }


        /* =========================================
           PRODUIT
        ========================================= */

        const product =
            await Product.findByIdForClient(productId);


        if (!product) {

            return res.status(404).send(
                "Produit introuvable."
            );
        }


        /* =========================================
           IMAGES
        ========================================= */

        const images =
            await Product.findImagesForClient(productId);


        product.images = images;


        /* =========================================
           IMAGE PRINCIPALE
        ========================================= */

        product.main_image =
            images.length > 0
                ? images[0].image_url
                : null;


        /* =========================================
           SUGGESTIONS
        ========================================= */

        const suggestions =
            await Product.findSuggestions(
                productId,
                product.category_id,
                4
            );
        
        /* =========================================
           OptionGroups
        ========================================= */
        const optionGroups =
            await ProductOption.findByProductId(
                product.id,
                true
            );

        /* =========================================
           RENDER
        ========================================= */

        const page = render(
            "client/catalog/product",
            product.name,
            {
                product,
                suggestions,
                optionGroups
            }
        );


        res.render(
            page.view,
            page.options
        );

    }
    catch (error) {

        console.error(
            "Erreur chargement produit :",
            error
        );

        next(error);
    }
};


/* ======================================================
   PAGES STATIQUES
====================================================== */

exports.staticPage = (view, title) => {

    return (req, res) => {

        const page = render(
            view,
            title
        );

        res.render(
            page.view,
            page.options
        );
    };
};