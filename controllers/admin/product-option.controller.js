const ProductOption =
    require("../../models/product-option.model");


/* =========================================================
   OUTILS
========================================================= */

function intValue(value, defaultValue = 0) {

    const parsed = parseInt(value, 10);

    return Number.isNaN(parsed)
        ? defaultValue
        : parsed;
}


function nullableInt(value) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return null;
    }

    const parsed = parseInt(value, 10);

    return Number.isNaN(parsed)
        ? null
        : parsed;
}


function boolValue(value) {

    return (
        value === "1" ||
        value === 1 ||
        value === true ||
        value === "on"
    )
        ? 1
        : 0;
}


/* =========================================================
   LISTE
========================================================= */

exports.index = async (req, res, next) => {

    try {

        const productId =
            Number(req.params.productId);


        const groups =
            await ProductOption.findByProductId(
                productId,
                false
            );


        res.json({
            success: true,
            groups
        });

    }
    catch (error) {

        console.error(
            "Erreur options produit :",
            error
        );

        next(error);
    }
};


/* =========================================================
   AJOUTER GROUPE
========================================================= */

exports.createGroup = async (req, res, next) => {

    try {

        const productId =
            Number(req.params.productId);


        if (!req.body.name?.trim()) {

            return res.status(400).json({
                success: false,
                message:
                    "Le nom du groupe est obligatoire."
            });
        }


        const selectionType =
            req.body.selection_type === "multiple"
                ? "multiple"
                : "single";


        const data = {

            product_id: productId,

            name:
                req.body.name.trim(),

            selection_type:
                selectionType,

            is_required:
                boolValue(req.body.is_required),

            min_choices:
                intValue(
                    req.body.min_choices,
                    selectionType === "single"
                        ? 1
                        : 0
                ),

            max_choices:
                selectionType === "single"
                    ? 1
                    : nullableInt(
                        req.body.max_choices
                    ),

            position:
                intValue(req.body.position, 0),

            is_active:
                req.body.is_active === undefined
                    ? 1
                    : boolValue(
                        req.body.is_active
                    )
        };


        await ProductOption.createGroup(data);


        res.json({
            success: true,
            message:
                "Groupe ajouté avec succès."
        });

    }
    catch (error) {

        console.error(
            "Erreur création groupe :",
            error
        );

        next(error);
    }
};


/* =========================================================
   MODIFIER GROUPE
========================================================= */

exports.updateGroup = async (req, res, next) => {

    try {

        const groupId =
            Number(req.params.groupId);


        const existing =
            await ProductOption.findGroupById(
                groupId
            );


        if (!existing) {

            return res.status(404).json({
                success: false,
                message:
                    "Groupe introuvable."
            });
        }


        const selectionType =
            req.body.selection_type === "multiple"
                ? "multiple"
                : "single";


        const data = {

            name:
                req.body.name?.trim()
                || existing.name,

            selection_type:
                selectionType,

            is_required:
                boolValue(req.body.is_required),

            min_choices:
                intValue(
                    req.body.min_choices,
                    0
                ),

            max_choices:
                selectionType === "single"
                    ? 1
                    : nullableInt(
                        req.body.max_choices
                    ),

            position:
                intValue(
                    req.body.position,
                    0
                ),

            is_active:
                boolValue(req.body.is_active)
        };


        await ProductOption.updateGroup(
            groupId,
            data
        );


        res.json({
            success: true,
            message:
                "Groupe modifié avec succès."
        });

    }
    catch (error) {

        console.error(
            "Erreur modification groupe :",
            error
        );

        next(error);
    }
};


/* =========================================================
   SUPPRIMER GROUPE
========================================================= */

exports.deleteGroup = async (req, res, next) => {

    try {

        const groupId =
            Number(req.params.groupId);


        await ProductOption.deleteGroup(
            groupId
        );


        res.json({
            success: true,
            message:
                "Groupe supprimé."
        });

    }
    catch (error) {

        console.error(
            "Erreur suppression groupe :",
            error
        );

        next(error);
    }
};


/* =========================================================
   AJOUTER OPTION
========================================================= */

exports.createOption = async (req, res, next) => {

    try {

        const groupId =
            Number(req.params.groupId);


        const group =
            await ProductOption.findGroupById(
                groupId
            );


        if (!group) {

            return res.status(404).json({
                success: false,
                message:
                    "Groupe introuvable."
            });
        }


        if (!req.body.name?.trim()) {

            return res.status(400).json({
                success: false,
                message:
                    "Le nom de l'option est obligatoire."
            });
        }


        const price =
            Number(req.body.price_delta || 0);


        const data = {

            option_group_id:
                groupId,

            name:
                req.body.name.trim(),

            price_delta:
                Number.isNaN(price)
                    ? 0
                    : price,

            is_default:
                boolValue(
                    req.body.is_default
                ),

            position:
                intValue(
                    req.body.position,
                    0
                ),

            is_active:
                req.body.is_active === undefined
                    ? 1
                    : boolValue(
                        req.body.is_active
                    )
        };


        await ProductOption.createOption(
            data
        );


        res.json({
            success: true,
            message:
                "Option ajoutée."
        });

    }
    catch (error) {

        console.error(
            "Erreur création option :",
            error
        );

        next(error);
    }
};


/* =========================================================
   MODIFIER OPTION
========================================================= */

exports.updateOption = async (req, res, next) => {

    try {

        const optionId =
            Number(req.params.optionId);


        const existing =
            await ProductOption.findOptionById(
                optionId
            );


        if (!existing) {

            return res.status(404).json({
                success: false,
                message:
                    "Option introuvable."
            });
        }


        const price =
            Number(req.body.price_delta || 0);


        const data = {

            option_group_id:
                existing.option_group_id,

            name:
                req.body.name?.trim()
                || existing.name,

            price_delta:
                Number.isNaN(price)
                    ? 0
                    : price,

            is_default:
                boolValue(
                    req.body.is_default
                ),

            position:
                intValue(
                    req.body.position,
                    0
                ),

            is_active:
                boolValue(
                    req.body.is_active
                )
        };


        await ProductOption.updateOption(
            optionId,
            data
        );


        res.json({
            success: true,
            message:
                "Option modifiée."
        });

    }
    catch (error) {

        console.error(
            "Erreur modification option :",
            error
        );

        next(error);
    }
};


/* =========================================================
   SUPPRIMER OPTION
========================================================= */

exports.deleteOption = async (req, res, next) => {

    try {

        const optionId =
            Number(req.params.optionId);


        await ProductOption.deleteOption(
            optionId
        );


        res.json({
            success: true,
            message:
                "Option supprimée."
        });

    }
    catch (error) {

        console.error(
            "Erreur suppression option :",
            error
        );

        next(error);
    }
};