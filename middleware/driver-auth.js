const Driver = require("../models/driver.model");

async function requireDriver(req, res, next) {
    try {
        if (!req.session || !req.session.driver) {
            return res.redirect("/livreur/connexion");
        }

        const id = Number(req.session.driver.id);
        const driver = id ? await Driver.findById(id) : null;

        if (!driver || driver.status !== "ACTIVE") {
            delete req.session.driver;
            return req.session.save(error => {
                if (error) return next(error);
                return res.redirect("/livreur/connexion");
            });
        }

        req.driver = driver;

        req.session.driver = {
            id: driver.id,
            publicId: driver.public_id,
            displayName:
                driver.display_name
                ||
                `${driver.first_name} ${driver.last_name}`.trim(),
            email: driver.email,
            phone: driver.phone,
            availability: driver.availability_status
        };

        return next();
    }
    catch (error) {
        return next(error);
    }
}

function driverGuestOnly(req, res, next) {
    if (req.session && req.session.driver) {
        return res.redirect("/livreur");
    }

    return next();
}

module.exports = {
    requireDriver,
    driverGuestOnly
};
