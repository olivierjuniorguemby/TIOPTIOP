const Product = require("../../models/product.model");
const Formula = require("../../models/formula.model");

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

/* =========================================================
   FORMULES
   /formules
========================================================= */

exports.formulas = async (req, res, next) => {

    try {

        const formulas =
            await Formula.findAllForClient();


        /*
         * On récupère les produits et images
         * associés à chaque formule.
         */

        for (const formula of formulas) {

            formula.products =
                await Formula.getProducts(
                    formula.id
                );


            formula.images =await Formula.getImages(
                    formula.id
                );
        }


        const page = render(
            "client/catalog/formulas",
            "Formules",
            {
                formulas
            }
        );


        res.render(
            page.view,
            page.options
        );

    } catch (error) {

        console.error(
            "Erreur chargement formules client :",
            error
        );

        next(error);
    }
};

/* =========================================================
   DETAIL D'UNE FORMULE
========================================================= */

exports.formulaDetail = async (req, res, next) => {

    try {

        const formulaId =
            Number(req.params.id);


        /* =============================================
           VALIDATION ID
        ============================================= */

        if (
            !Number.isInteger(formulaId) ||
            formulaId <= 0
        ) {

            return res.status(404).send(
                "Formule introuvable."
            );
        }


        /* =============================================
           FORMULE
        ============================================= */

        const formula =
            await Formula.findByIdForClient(
                formulaId
            );


        if (!formula) {

            return res.status(404).send(
                "Formule introuvable."
            );
        }


        /* =============================================
           IMAGES
        ============================================= */

        formula.images =
            await Formula.getImages(
                formulaId
            );


        /* =============================================
           PRODUITS DE LA FORMULE
        ============================================= */

        formula.products =
            await Formula.getProducts(
                formulaId
            );


        /* =============================================
           IMAGE PRINCIPALE
        ============================================= */

        formula.mainImage =
            formula.images.find(
                image =>
                    Number(image.is_primary) === 1
            )
            ||
            formula.images[0]
            ||
            null;


        /* =============================================
           RENDER
        ============================================= */

        const page = render(
            "client/catalog/formula-detail",
            formula.name,
            {
                formula
            }
        );


        return res.render(
            page.view,
            page.options
        );

    }
    catch (error) {

        console.error(
            "Erreur chargement détail formule :",
            error
        );

        next(error);
    }
};