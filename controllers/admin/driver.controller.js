const bcrypt = require("bcryptjs");
const Driver = require("../../models/driver.model");

exports.index = async (req, res, next) => {
    try {
        const drivers =
            await Driver.findAllForAdmin();

        return res.render(
            "admin/operations/drivers",
            {
                title: "Livreurs",
                layout: "layouts/admin",
                drivers,
                success:
                    String(req.query.success || ""),
                error:
                    String(req.query.error || "")
            }
        );
    }
    catch (error) {
        return next(error);
    }
};

exports.create = async (req, res) => {
    try {
        const firstName =
            String(
                req.body.first_name || ""
            ).trim();

        const lastName =
            String(
                req.body.last_name || ""
            ).trim();

        const email =
            String(
                req.body.email || ""
            )
                .trim()
                .toLowerCase();

        const phone =
            String(
                req.body.phone || ""
            ).trim();

        const password =
            String(
                req.body.password || ""
            );

        if (
            !firstName ||
            !lastName ||
            !email ||
            !phone ||
            !password
        ) {
            throw new Error(
                "Tous les champs obligatoires doivent être renseignés."
            );
        }

        if (password.length < 8) {
            throw new Error(
                "Le mot de passe doit contenir au moins 8 caractères."
            );
        }

        if (
            await Driver.emailExists(email)
        ) {
            throw new Error(
                "Cet email est déjà utilisé par un livreur."
            );
        }

        if (
            await Driver.phoneExists(phone)
        ) {
            throw new Error(
                "Ce téléphone est déjà utilisé par un livreur."
            );
        }

        const passwordHash =
            await bcrypt.hash(
                password,
                12
            );

        await Driver.create({
            first_name: firstName,
            last_name: lastName,
            display_name:
                `${firstName} ${lastName}`.trim(),
            email,
            phone,
            password_hash: passwordHash,
            vehicle_type:
                String(
                    req.body.vehicle_type || "MOTORBIKE"
                ).toUpperCase(),
            vehicle_plate:
                req.body.vehicle_plate
        });

        return res.redirect(
            "/admin/livreurs?success=Livreur créé"
        );
    }
    catch (error) {
        return res.redirect(
            "/admin/livreurs?error="
            +
            encodeURIComponent(
                error.message
            )
        );
    }
};

exports.updateStatus = async (req, res) => {
    try {
        await Driver.updateStatus(
            Number(req.params.id),
            String(
                req.body.status || ""
            )
                .trim()
                .toUpperCase()
        );

        return res.redirect(
            "/admin/livreurs?success=Statut mis à jour"
        );
    }
    catch (error) {
        return res.redirect(
            "/admin/livreurs?error="
            +
            encodeURIComponent(
                error.message
            )
        );
    }
};
