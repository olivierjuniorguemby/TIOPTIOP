const bcrypt = require("bcryptjs");
const Driver = require("../../models/driver.model");

function render(res, view, title, data = {}) {
    return res.render(view, {
        title,
        layout: "layouts/driver",
        ...data
    });
}

exports.loginPage = (req, res) => {
    return render(
        res,
        "driver/auth/login",
        "Connexion livreur",
        {
            error: null,
            email: ""
        }
    );
};

exports.login = async (req, res, next) => {
    try {
        const email =
            String(req.body.email || "")
                .trim()
                .toLowerCase();

        const password =
            String(req.body.password || "");

        const driver =
            await Driver.findByEmail(email);

        if (
            !driver
            ||
            driver.status !== "ACTIVE"
            ||
            !driver.password_hash
        ) {
            return render(
                res,
                "driver/auth/login",
                "Connexion livreur",
                {
                    error:
                        "Email ou mot de passe incorrect.",
                    email
                }
            );
        }

        const valid =
            await bcrypt.compare(
                password,
                driver.password_hash
            );

        if (!valid) {
            return render(
                res,
                "driver/auth/login",
                "Connexion livreur",
                {
                    error:
                        "Email ou mot de passe incorrect.",
                    email
                }
            );
        }

        await Driver.updateLastLogin(driver.id);

        req.session.driver = {
            id: driver.id,
            publicId: driver.public_id,
            displayName:
                driver.display_name
                ||
                `${driver.first_name} ${driver.last_name}`.trim(),
            email: driver.email,
            phone: driver.phone,
            availability:
                driver.availability_status === "OFFLINE"
                    ? "AVAILABLE"
                    : driver.availability_status
        };

        return req.session.save(error => {
            if (error) return next(error);

            return res.redirect("/livreur");
        });
    }
    catch (error) {
        console.error(
            "Erreur connexion livreur :",
            error
        );

        return next(error);
    }
};

exports.logout = async (req, res, next) => {
    try {
        const id =
            Number(
                req.session?.driver?.id
            );

        if (id) {
            const stats =
                await Driver.getDashboardStats(id);

            if (
                Number(
                    stats.active_deliveries || 0
                ) === 0
            ) {
                await Driver.updateAvailability(
                    id,
                    "OFFLINE"
                );
            }
        }

        delete req.session.driver;

        return req.session.save(error => {
            if (error) return next(error);

            return res.redirect(
                "/livreur/connexion"
            );
        });
    }
    catch (error) {
        return next(error);
    }
};
