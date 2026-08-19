const Driver = require("../../models/driver.model");
const Delivery = require("../../models/delivery.model");
const Order = require("../../models/order.model");

function driverId(req) {
    return Number(req.session?.driver?.id);
}

function getReference(req) {
    return String(req.params.reference || "")
        .trim()
        .slice(0, 60);
}

exports.dashboard = async (req, res, next) => {
    try {
        const id = driverId(req);

        const [stats, deliveries] =
            await Promise.all([
                Driver.getDashboardStats(id),
                Delivery.findAllForDriver(id)
            ]);

        return res.render(
            "driver/dashboard",
            {
                title: "Espace livreur",
                layout: "layouts/driver",
                driver: req.driver,
                stats,
                deliveries
            }
        );
    }
    catch (error) {
        return next(error);
    }
};

exports.detail = async (req, res, next) => {
    try {
        const delivery =
            await Delivery.findForDriverByReference(
                driverId(req),
                getReference(req)
            );

        if (!delivery) {
            return res
                .status(404)
                .send("Livraison introuvable.");
        }

        return res.render(
            "driver/delivery-detail",
            {
                title:
                    `Livraison ${delivery.order_reference}`,
                layout: "layouts/driver",
                driver: req.driver,
                delivery,
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

exports.availability = async (req, res, next) => {
    try {
        const availability =
            String(
                req.body.availability || ""
            )
                .trim()
                .toUpperCase();

        await Driver.updateAvailability(
            driverId(req),
            availability
        );

        req.session.driver.availability =
            availability;

        return req.session.save(error => {
            if (error) return next(error);

            return res.redirect("/livreur");
        });
    }
    catch (error) {
        return next(error);
    }
};

exports.accept = async (req, res) => {
    const reference =
        getReference(req);

    try {
        const result =
            await Delivery.acceptAssignment(
                driverId(req),
                reference
            );

        const io = req.app.get("io");

        if (io) {
            io
                .to(`order:${reference}`)
                .emit(
                    "delivery:status",
                    {
                        reference,
                        status: result.status,
                        acceptanceStatus:
                            result.acceptanceStatus,
                        message:
                            "Votre livreur a accepté la livraison."
                    }
                );
        }

        return res.redirect(
            `/livreur/livraisons/${encodeURIComponent(reference)}?success=Affectation acceptée`
        );
    }
    catch (error) {
        return res.redirect(
            `/livreur/livraisons/${encodeURIComponent(reference)}?error=${encodeURIComponent(error.message)}`
        );
    }
};

exports.reject = async (req, res) => {
    const reference =
        getReference(req);

    try {
        const result =
            await Delivery.rejectAssignment(
                driverId(req),
                reference,
                req.body.reason
            );

        const io = req.app.get("io");

        if (io) {
            io
                .to(`order:${reference}`)
                .emit(
                    "delivery:status",
                    {
                        reference,
                        status: result.status,
                        acceptanceStatus:
                            result.acceptanceStatus,
                        message:
                            "L'affectation du livreur doit être réattribuée."
                    }
                );
        }

        return res.redirect("/livreur");
    }
    catch (error) {
        return res.redirect(
            `/livreur/livraisons/${encodeURIComponent(reference)}?error=${encodeURIComponent(error.message)}`
        );
    }
};

exports.pickup = async (req, res) => {
    const reference =
        getReference(req);

    try {
        const result =
            await Delivery.markPickedUp(
                driverId(req),
                reference
            );

        const io = req.app.get("io");

        if (io) {
            io
                .to(`order:${reference}`)
                .emit(
                    "delivery:status",
                    {
                        reference,
                        status: result.status,
                        message:
                            "Le livreur a récupéré votre commande."
                    }
                );
        }

        return res.redirect(
            `/livreur/livraisons/${encodeURIComponent(reference)}?success=Commande récupérée`
        );
    }
    catch (error) {
        return res.redirect(
            `/livreur/livraisons/${encodeURIComponent(reference)}?error=${encodeURIComponent(error.message)}`
        );
    }
};

exports.start = async (req, res) => {
    const reference =
        getReference(req);

    try {
        const delivery =
            await Delivery.findForDriverByReference(
                driverId(req),
                reference
            );

        if (!delivery) {
            throw new Error(
                "Livraison introuvable."
            );
        }

        if (delivery.status !== "PICKED_UP") {
            throw new Error(
                "Vous devez d'abord récupérer la commande."
            );
        }

        const result =
            await Order.updateStatus({
                reference,
                nextStatus: "ON_THE_WAY",
                comment:
                    "Le livreur a quitté le restaurant.",
                adminUserId: null
            });

        const io = req.app.get("io");

        if (io) {
            io
                .to(`order:${reference}`)
                .emit(
                    "order:status",
                    {
                        reference,
                        previousStatus:
                            result.previousStatus,
                        status:
                            result.status,
                        statusLabel:
                            result.statusLabel,
                        comment:
                            result.comment,
                        changedAt:
                            result.changedAt
                    }
                );

            io
                .to(`order:${reference}`)
                .emit(
                    "delivery:status",
                    {
                        reference,
                        status: "ON_THE_WAY",
                        message:
                            "Votre livreur est en route."
                    }
                );
        }

        return res.redirect(
            `/livreur/livraisons/${encodeURIComponent(reference)}?success=Livraison démarrée`
        );
    }
    catch (error) {
        return res.redirect(
            `/livreur/livraisons/${encodeURIComponent(reference)}?error=${encodeURIComponent(error.message)}`
        );
    }
};

exports.arrived = async (req, res) => {
    const reference =
        getReference(req);

    try {
        const result =
            await Delivery.markArrived(
                driverId(req),
                reference
            );

        const io = req.app.get("io");

        if (io) {
            io
                .to(`order:${reference}`)
                .emit(
                    "delivery:status",
                    {
                        reference,
                        status:
                            result.status,
                        message:
                            "Le livreur est arrivé à destination."
                    }
                );
        }

        return res.redirect(
            `/livreur/livraisons/${encodeURIComponent(reference)}?success=Arrivée confirmée`
        );
    }
    catch (error) {
        return res.redirect(
            `/livreur/livraisons/${encodeURIComponent(reference)}?error=${encodeURIComponent(error.message)}`
        );
    }
};

exports.delivered = async (req, res) => {
    const reference =
        getReference(req);

    try {
        const delivery =
            await Delivery.findForDriverByReference(
                driverId(req),
                reference
            );

        if (!delivery) {
            throw new Error(
                "Livraison introuvable."
            );
        }

        if (
            ![
                "ON_THE_WAY",
                "ARRIVED"
            ].includes(
                delivery.status
            )
        ) {
            throw new Error(
                "La livraison ne peut pas encore être finalisée."
            );
        }

        const result =
            await Order.updateStatus({
                reference,
                nextStatus: "DELIVERED",
                comment:
                    "Livraison confirmée par le livreur.",
                adminUserId: null
            });

        await Delivery.releaseDriver(
            driverId(req)
        );

        const io = req.app.get("io");

        if (io) {
            io
                .to(`order:${reference}`)
                .emit(
                    "order:status",
                    {
                        reference,
                        previousStatus:
                            result.previousStatus,
                        status:
                            result.status,
                        statusLabel:
                            result.statusLabel,
                        comment:
                            result.comment,
                        changedAt:
                            result.changedAt
                    }
                );

            io
                .to(`order:${reference}`)
                .emit(
                    "delivery:status",
                    {
                        reference,
                        status: "DELIVERED",
                        message:
                            "Votre commande a été livrée."
                    }
                );
        }

        return res.redirect(
            `/livreur/livraisons/${encodeURIComponent(reference)}?success=Livraison terminée`
        );
    }
    catch (error) {
        return res.redirect(
            `/livreur/livraisons/${encodeURIComponent(reference)}?error=${encodeURIComponent(error.message)}`
        );
    }
};


/* =========================================================
   GPS REEL LIVREUR
   POST /livreur/livraisons/:reference/position

   Cette route est protégée par requireDriver.
========================================================= */

exports.position =
async function (
    req,
    res
) {

    const reference =
        getReference(
            req
        );


    try {

        const result =
            await Delivery.recordTrackingPoint({

                driverId:
                    driverId(
                        req
                    ),

                reference,

                latitude:
                    req.body.latitude,

                longitude:
                    req.body.longitude,

                heading:
                    req.body.heading,

                speedMps:
                    req.body.speed_mps,

                accuracyMeters:
                    req.body.accuracy_meters
            });


        /*
         * Si le serveur a limité la fréquence,
         * on ne réémet pas inutilement l'ancien point.
         */

        if (
            result.inserted
        ) {

            const io =
                req.app.get(
                    "io"
                );


            if (io) {

                io
                    .to(
                        `order:${reference}`
                    )
                    .emit(
                        "driver:location",
                        {
                            orderId:
                                reference,

                            reference,

                            deliveryId:
                                result.deliveryId,

                            lat:
                                result.latitude,

                            lng:
                                result.longitude,

                            heading:
                                result.heading,

                            speedKmh:
                                result.speedKmh,

                            accuracyMeters:
                                result.accuracyMeters,

                            recordedAt:
                                result.recordedAt
                        }
                    );
            }
        }


        return res.status(
            result.inserted
                ? 201
                : 200
        ).json({
            ok:
                true,

            inserted:
                result.inserted,

            rateLimited:
                result.rateLimited,

            point: {
                latitude:
                    result.latitude,

                longitude:
                    result.longitude,

                heading:
                    result.heading,

                speedKmh:
                    result.speedKmh,

                accuracyMeters:
                    result.accuracyMeters,

                recordedAt:
                    result.recordedAt
            }
        });

    }
    catch (error) {

        console.error(
            "Erreur GPS livreur :",
            error
        );


        const businessCodes = [
            "GPS_INVALID_COORDINATES",
            "GPS_DELIVERY_NOT_FOUND",
            "GPS_DELIVERY_NOT_ACCEPTED",
            "GPS_DELIVERY_NOT_ACTIVE"
        ];


        return res.status(
            businessCodes.includes(
                error.code
            )
                ? 400
                : 500
        ).json({
            ok:
                false,

            message:
                error.message
                ||
                "Impossible d'enregistrer la position."
        });
    }
};

