const Delivery = require("../../models/delivery.model");

function cleanString(value, maxLength = 160) {
    return String(value || "").trim().slice(0, maxLength);
}

exports.index = async (req, res, next) => {
    try {
        const search =
            cleanString(req.query.search);

        const status =
            cleanString(
                req.query.status,
                30
            )
                .toUpperCase();

        const allowedStatuses = [
            "WAITING",
            "ASSIGNED",
            "PICKED_UP",
            "ON_THE_WAY",
            "ARRIVED",
            "DELIVERED",
            "FAILED"
        ];

        const finalStatus =
            allowedStatuses.includes(status)
                ? status
                : "";

        const [deliveries, stats] =
            await Promise.all([
                Delivery.findAllForAdmin({
                    search,
                    status: finalStatus
                }),
                Delivery.getAdminStats()
            ]);

        return res.render(
            "admin/operations/deliveries",
            {
                title: "Livraisons",
                layout: "layouts/admin",
                deliveries,
                stats,
                filters: {
                    search,
                    status: finalStatus
                }
            }
        );
    }
    catch (error) {
        return next(error);
    }
};

exports.assign = async (req, res) => {
    const reference =
        cleanString(
            req.params.reference,
            60
        );

    try {
        const driverId =
            Number(
                req.body.driver_id
            );

        if (
            !Number.isInteger(driverId)
            ||
            driverId <= 0
        ) {
            throw new Error(
                "Veuillez sélectionner un livreur."
            );
        }

        const estimatedArrivalRaw =
            cleanString(
                req.body.estimated_arrival,
                40
            );

        let estimatedArrival = null;

        if (estimatedArrivalRaw) {
            const date =
                new Date(
                    estimatedArrivalRaw
                );

            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {
                throw new Error(
                    "L'heure d'arrivée estimée est invalide."
                );
            }

            estimatedArrival = date;
        }

        const delivery =
            await Delivery.assignDriver({
                reference,
                driverId,
                estimatedArrival
            });

        const io =
            req.app.get("io");

        if (io) {
            io
                .to(`order:${reference}`)
                .emit(
                    "delivery:assigned",
                    {
                        reference,
                        deliveryId:
                            delivery.id,
                        driverName:
                            delivery.driver_name,
                        driverPhone:
                            delivery.driver_phone,
                        status:
                            delivery.status,
                        acceptanceStatus:
                            delivery.acceptance_status,
                        estimatedArrival:
                            delivery.estimated_arrival
                            || null
                    }
                );
        }

        return res.redirect(
            "/admin/commandes/"
            +
            encodeURIComponent(reference)
            +
            "?delivery_updated=1"
        );
    }
    catch (error) {
        return res.redirect(
            "/admin/commandes/"
            +
            encodeURIComponent(reference)
            +
            "?delivery_error="
            +
            encodeURIComponent(
                error.message
            )
        );
    }
};
