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


// ======================================================
// LISTE
// ======================================================

exports.index = async (req, res, next) => {
    try {

        const categories = await Category.findAll();

        res.render("admin/catalog/categories", {
            title: "Catégories",
            layout: "layouts/admin",
            categories
        });

    } catch (error) {
        next(error);
    }
};


// ======================================================
// AJOUTER
// ======================================================

exports.create = async (req, res, next) => {
    try {

        const {
            name,
            description,
            position
        } = req.body;

        if (!name || !name.trim()) {
            return res.redirect("/admin/categories");
        }

        const slug = createSlug(name);

        await Category.create({
            name: name.trim(),
            slug,
            description,
            position: Number(position) || 0,
            is_active: 1
        });

        res.redirect("/admin/categories");

    } catch (error) {
        next(error);
    }
};


// ======================================================
// MODIFIER
// ======================================================

exports.update = async (req, res, next) => {
    try {

        const id = req.params.id;

        const {
            name,
            description,
            position,
            is_active
        } = req.body;

        const category = await Category.findById(id);

        if (!category) {
            return res.status(404).send("Catégorie introuvable");
        }

        const slug = createSlug(name);

        await Category.update(id, {
            name: name.trim(),
            slug,
            description,
            position: Number(position) || 0,

            // si aucun champ n'est envoyé,
            // on conserve l'état actuel
            is_active:
                is_active !== undefined
                    ? Number(is_active)
                    : category.is_active
        });

        res.redirect("/admin/categories");

    } catch (error) {
        next(error);
    }
};


// ======================================================
// SUPPRIMER
// ======================================================

exports.remove = async (req, res, next) => {
    try {

        const id = req.params.id;

        await Category.remove(id);

        res.redirect("/admin/categories");

    } catch (error) {
        next(error);
    }
};


// ======================================================
// ACTIVER / DESACTIVER
// ======================================================

exports.toggleActive = async (req, res, next) => {
    try {

        const id = req.params.id;

        await Category.toggleActive(id);

        res.redirect("/admin/categories");

    } catch (error) {
        next(error);
    }
};