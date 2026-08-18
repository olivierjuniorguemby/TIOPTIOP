const Delivery =
    require("../../models/delivery.model");


/* =========================================================
   HELPERS
========================================================= */

function cleanString(
    value,
    maxLength = 160
) {

    return String(
        value || ""
    )
        .trim()
        .slice(
            0,
            maxLength
        );
}


/* =========================================================
   GET /admin/livraisons
========================================================= */

exports.index =
async function (
    req,
    res,
    next
) {

    try {

        const search =
            cleanString(
                req.query.search
            );


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
            allowedStatuses.includes(
                status
            )
                ? status
                : "";


        const [
            deliveries,
            stats
        ] =
            await Promise.all([

                Delivery.findAllForAdmin({
                    search,

                    status:
                        finalStatus
                }),

                Delivery.getAdminStats()
            ]);


        return res.render(
            "admin/operations/deliveries",
            {

                title:
                    "Livraisons",

                layout:
                    "layouts/admin",

                deliveries,

                stats,

                filters: {
                    search,

                    status:
                        finalStatus
                }
            }
        );

    }
    catch (error) {

        console.error(
            "Erreur liste livraisons admin :",
            error
        );


        return next(error);
    }
};


/* =========================================================
   POST /admin/commandes/:reference/livraison/affecter
========================================================= */

exports.assign =
async function (
    req,
    res,
    next
) {

    const reference =
        cleanString(
            req.params.reference,
            60
        );


    try {

        const driverName =
            cleanString(
                req.body.driver_name,
                160
            );


        const driverPhone =
            cleanString(
                req.body.driver_phone,
                40
            );


        const estimatedArrivalRaw =
            cleanString(
                req.body.estimated_arrival,
                40
            );


        let estimatedArrival =
            null;


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

                const error =
                    new Error(
                        "L'heure estimée d'arrivée est invalide."
                    );

                error.code =
                    "ETA_INVALID";

                throw error;
            }


            estimatedArrival =
                date;
        }


        const delivery =
            await Delivery.assignDriver({
                reference,
                driverName,
                driverPhone,

                estimatedArrival
            });


        const io =
            req.app.get("io");


        if (io) {

            io
                .to(
                    `order:${reference}`
                )
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

                        estimatedArrival:
                            delivery.estimated_arrival
                            || null
                    }
                );
        }


        return res.redirect(
            "/admin/commandes/"
            +
            encodeURIComponent(
                reference
            )
            +
            "?delivery_updated=1"
        );

    }
    catch (error) {

        console.error(
            "Erreur affectation livreur :",
            error
        );


        const businessErrors = [
            "ORDER_NOT_FOUND",
            "ORDER_NOT_DELIVERY",
            "DELIVERY_ORDER_TERMINAL",
            "DRIVER_NAME_REQUIRED",
            "DRIVER_PHONE_REQUIRED",
            "ETA_INVALID"
        ];


        if (
            businessErrors.includes(
                error.code
            )
        ) {

            return res.redirect(
                "/admin/commandes/"
                +
                encodeURIComponent(
                    reference
                )
                +
                "?delivery_error="
                +
                encodeURIComponent(
                    error.message
                )
            );
        }


        return next(error);
    }
};
