const Order =
    require("../../models/order.model");

const Delivery =
    require("../../models/delivery.model");

const Driver =
    require("../../models/driver.model");


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


function adminId(req) {

    const id =
        Number(
            req.session?.admin?.id
        );


    return Number.isInteger(id) &&
        id > 0

        ? id
        : null;
}


/* =========================================================
   GET /admin/commandes
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


        const paymentMethod =
            cleanString(
                req.query.payment_method,
                30
            )
                .toUpperCase();


        const channel =
            cleanString(
                req.query.channel,
                30
            )
                .toUpperCase();


        const restaurantIdRaw =
            cleanString(
                req.query.restaurant_id,
                30
            );


        const minAmountRaw =
            cleanString(
                req.query.min_amount,
                30
            );


        const allowedStatuses = [
            "RECEIVED",
            "CONFIRMED",
            "PREPARING",
            "READY",
            "PICKED_UP",
            "ON_THE_WAY",
            "DELIVERED",
            "CANCELLED",
            "REFUNDED"
        ];


        const allowedPaymentMethods = [
            "CARD",
            "MOBILE_MONEY",
            "CASH"
        ];


        const allowedChannels = [
            "WEB",
            "MOBILE",
            "POS",
            "PHONE",
            "WHATSAPP",
            "ADMIN"
        ];


        const finalStatus =
            allowedStatuses.includes(
                status
            )
                ? status
                : "";


        const finalPaymentMethod =
            allowedPaymentMethods.includes(
                paymentMethod
            )
                ? paymentMethod
                : "";


        const finalChannel =
            allowedChannels.includes(
                channel
            )
                ? channel
                : "";


        const restaurantId =
            Number(
                restaurantIdRaw
            );


        const minAmount =
            Number(
                minAmountRaw
            );


        const [
            orders,
            restaurants,
            stats
        ] =
            await Promise.all([

                Order.findAllForAdmin({
                    search,

                    status:
                        finalStatus,

                    paymentMethod:
                        finalPaymentMethod,

                    channel:
                        finalChannel,

                    restaurantId:
                        Number.isInteger(
                            restaurantId
                        )
                            ? restaurantId
                            : null,

                    minAmount:
                        Number.isFinite(
                            minAmount
                        )
                            ? minAmount
                            : null
                }),

                Order.getRestaurants(),

                Order.getAdminOrderStats()
            ]);


        return res.render(
            "admin/operations/orders",
            {
                title:
                    "Commandes",

                layout:
                    "layouts/admin",

                orders,

                restaurants,

                stats,

                filters: {
                    search,

                    status:
                        finalStatus,

                    payment_method:
                        finalPaymentMethod,

                    channel:
                        finalChannel,

                    restaurant_id:
                        restaurantIdRaw,

                    min_amount:
                        minAmountRaw
                }
            }
        );

    }
    catch (error) {

        console.error(
            "Erreur commandes admin :",
            error
        );


        return next(error);
    }
};


/* =========================================================
   GET /admin/commandes/:reference
========================================================= */

exports.detail =
async function (
    req,
    res,
    next
) {

    try {

        const reference =
            cleanString(
                req.params.reference,
                60
            );


        if (!reference) {

            return res
                .status(404)
                .send(
                    "Commande introuvable."
                );
        }


        const order =
            await Order.findForAdminByReference(
                reference
            );


        if (!order) {

            return res
                .status(404)
                .send(
                    "Commande introuvable."
                );
        }


        const [
            items,
            payment,
            history,
            delivery,
            drivers
        ] =
            await Promise.all([

                Order.getOrderItems(
                    order.id
                ),

                Order.getPaymentByOrderId(
                    order.id
                ),

                Order.getStatusHistory(
                    order.id
                ),

                order.order_type === "DELIVERY"
                    ? Delivery.findByOrderId(
                        order.id
                    )
                    : null,

                order.order_type === "DELIVERY"
                    ? Driver.findAssignable()
                    : []
            ]);


        return res.render(
            "admin/operations/order-detail",
            {
                title:
                    `Commande ${order.reference}`,

                layout:
                    "layouts/admin",

                order,
                items,
                payment,
                history,
                delivery,
                drivers,

                currentAdminId:
                    adminId(req),

                allowedNextStatuses:
                    Order.getAllowedNextStatuses(
                        order.order_type,
                        order.status
                    ),

                statusUpdated:
                    req.query.updated === "1",

                statusError:
                    cleanString(
                        req.query.status_error,
                        300
                    ),

                deliveryUpdated:
                    req.query.delivery_updated === "1",

                deliveryError:
                    cleanString(
                        req.query.delivery_error,
                        300
                    )
            }
        );

    }
    catch (error) {

        console.error(
            "Erreur détail commande admin :",
            error
        );


        return next(error);
    }
};


/* =========================================================
   POST /admin/commandes/:reference/statut
========================================================= */

exports.updateStatus =
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

        if (!reference) {

            return res
                .status(404)
                .send(
                    "Commande introuvable."
                );
        }


        const nextStatus =
            cleanString(
                req.body.status,
                30
            )
                .toUpperCase();


        const comment =
            cleanString(
                req.body.comment,
                1000
            );


        const currentAdminId =
            adminId(req);


        if (!currentAdminId) {

            return res.redirect(
                "/admin/connexion"
            );
        }


        const result =
            await Order.updateStatus({
                reference,
                nextStatus,
                comment,
                adminUserId:
                    currentAdminId
            });


        /* =================================================
           TEMPS REEL

           app.js place io dans app.set("io", io).
           On émet uniquement APRES COMMIT MySQL.
        ================================================= */

        const io =
            req.app.get("io");


        if (io) {

            io
                .to(
                    `order:${result.reference}`
                )
                .emit(
                    "order:status",
                    {
                        reference:
                            result.reference,

                        orderId:
                            result.id,

                        orderType:
                            result.orderType,

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
        }


        return res.redirect(
            "/admin/commandes/"
            +
            encodeURIComponent(
                reference
            )
            +
            "?updated=1"
        );

    }
    catch (error) {

        console.error(
            "Erreur changement statut commande :",
            error
        );


        const businessErrors = [
            "ORDER_NOT_FOUND",
            "ORDER_STATUS_UNCHANGED",
            "ORDER_STATUS_INVALID_TRANSITION",
            "ORDER_STATUS_CONFLICT"
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
                "?status_error="
                +
                encodeURIComponent(
                    error.message
                )
            );
        }


        return next(error);
    }
};

