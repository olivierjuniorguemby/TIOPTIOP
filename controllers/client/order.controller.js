const Order =
    require("../../models/order.model");

const Delivery =
    require("../../models/delivery.model");

const PaymentRefund =
    require("../../models/payment-refund.model");


const PaymentService =
    require("../../services/payment.service");


/* =========================================================
   HELPER USER
========================================================= */

function getUserId(req) {

    const id =
        Number(
            req.session?.user?.id
        );


    return Number.isInteger(id) &&
        id > 0

        ? id
        : null;
}


/* =========================================================
   HELPER REFERENCE
========================================================= */

function getReference(req) {

    return String(
        req.params.reference || ""
    )
        .trim()
        .slice(0, 60);
}


/* =========================================================
   HELPER COMMANDE COMPLETE
========================================================= */

async function getFullOrder(
    reference,
    userId
) {

    const order =
        await Order.findByReference(
            reference,
            userId
        );


    if (!order) {

        return null;
    }


    const [
        items,
        payment,
        history,
        delivery
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
                : null
        ]);


    let latestTrackingPoint =
        null;


    if (delivery) {

        latestTrackingPoint =
            await Delivery.getLatestTrackingPoint(
                delivery.id
            );
    }


    let refunds = [];
    let refundSummary = {
        total_refunded: 0,
        total_pending: 0,
        total_failed: 0,
        total_cancelled: 0,
        refund_count: 0
    };


    if (payment) {

        [
            refunds,
            refundSummary
        ] =
            await Promise.all([
                PaymentRefund.listClientByPaymentId(
                    payment.id
                ),

                PaymentRefund.getClientSummaryByPaymentId(
                    payment.id
                )
            ]);
    }


    const paymentAmount =
        Number(
            payment?.amount || 0
        );


    const totalRefunded =
        Number(
            refundSummary.total_refunded || 0
        );


    const totalPending =
        Number(
            refundSummary.total_pending || 0
        );


    const refundRemaining =
        Math.max(
            0,
            paymentAmount
            -
            totalRefunded
            -
            totalPending
        );


    return {
        order,
        items,
        payment,
        history,
        delivery,
        latestTrackingPoint,

        refunds,

        refundSummary: {
            ...refundSummary,
            total_refunded:
                totalRefunded,
            total_pending:
                totalPending,
            remaining_amount:
                refundRemaining
        }
    };
}


/* =========================================================
   GET /commandes
========================================================= */

exports.list =
async function (
    req,
    res,
    next
) {

    try {

        const userId =
            getUserId(req);


        if (!userId) {

            return res.redirect(
                "/connexion"
            );
        }


        const search =
            String(
                req.query.search || ""
            ).trim();


        const status =
            String(
                req.query.status || ""
            )
                .trim()
                .toUpperCase();


        const maxPriceRaw =
            String(
                req.query.maxPrice || ""
            ).trim();


        const maxPrice =
            maxPriceRaw
                ? Number(maxPriceRaw)
                : null;


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


        const finalStatus =
            allowedStatuses.includes(
                status
            )
                ? status
                : "";


        const orders =
            await Order.findAllByUserId(
                userId,
                {
                    search,

                    status:
                        finalStatus,

                    maxPrice:
                        Number.isFinite(
                            maxPrice
                        )
                            ? maxPrice
                            : null
                }
            );


        return res.render(
            "client/orders/list",
            {

                title:
                    "Mes commandes",

                layout:
                    "layouts/client",

                orders,

                filters: {

                    search,

                    status:
                        finalStatus,

                    maxPrice:
                        maxPriceRaw
                }
            }
        );

    }
    catch (error) {

        console.error(
            "Erreur liste commandes client :",
            error
        );


        return next(error);
    }
};


/* =========================================================
   GET /commande/confirmation/:reference
========================================================= */

exports.confirmation =
async function (
    req,
    res,
    next
) {

    try {

        const userId =
            getUserId(req);


        if (!userId) {

            return res.redirect(
                "/connexion"
            );
        }


        const reference =
            getReference(req);


        if (!reference) {

            return res.status(404).send(
                "Commande introuvable."
            );
        }


        const data =
            await getFullOrder(
                reference,
                userId
            );


        if (!data) {

            return res.status(404).send(
                "Commande introuvable."
            );
        }


        return res.render(
            "client/orders/confirmation",
            {

                title:
                    `Commande ${data.order.reference}`,

                layout:
                    "layouts/client",

                ...data
            }
        );

    }
    catch (error) {

        console.error(
            "Erreur confirmation commande :",
            error
        );


        return next(error);
    }
};


/* =========================================================
   GET /commande/:reference/payment-status
========================================================= */

exports.paymentStatus =
async function (
    req,
    res
) {

    try {

        const userId =
            getUserId(req);


        if (!userId) {

            return res
                .status(401)
                .json({
                    success:
                        false,

                    message:
                        "Utilisateur non connecté."
                });
        }


        const reference =
            getReference(req);


        const order =
            await Order.findByReference(
                reference,
                userId
            );


        if (!order) {

            return res
                .status(404)
                .json({
                    success:
                        false,

                    message:
                        "Commande introuvable."
                });
        }


        let payment =
            await Order.getPaymentByOrderId(
                order.id
            );


        if (!payment) {

            return res
                .status(404)
                .json({
                    success:
                        false,

                    message:
                        "Paiement introuvable."
                });
        }


        if (
            payment.method ===
                "MOBILE_MONEY"
            &&
            payment.provider ===
                "MTN_MOMO"
            &&
            payment.status ===
                "PENDING"
            &&
            payment.provider_reference
        ) {

            try {

                const sync =
                    await PaymentService
                        .syncMtnMomoPayment(
                            payment
                        );


                payment =
                    sync.payment
                    ||
                    payment;
            }
            catch (syncError) {

                console.error(
                    "Synchronisation MTN MoMo :",
                    syncError.message
                );
            }
        }


        const [
            refunds,
            refundSummary
        ] =
            await Promise.all([
                PaymentRefund.listClientByPaymentId(
                    payment.id
                ),

                PaymentRefund.getClientSummaryByPaymentId(
                    payment.id
                )
            ]);


        const totalRefunded =
            Number(
                refundSummary.total_refunded || 0
            );


        const totalPending =
            Number(
                refundSummary.total_pending || 0
            );


        return res.json({
            success:
                true,

            payment: {
                id:
                    payment.id,

                method:
                    payment.method,

                provider:
                    payment.provider,

                status:
                    payment.status,

                amount:
                    Number(
                        payment.amount || 0
                    ),

                currency:
                    payment.currency,

                paidAt:
                    payment.paid_at
                    ||
                    null,

                canRetry:
                    payment.method ===
                        "MOBILE_MONEY"
                    &&
                    [
                        "FAILED",
                        "CANCELLED"
                    ].includes(
                        payment.status
                    )
            },

            refund: {
                totalRefunded,
                totalPending,

                remainingAmount:
                    Math.max(
                        0,
                        Number(
                            payment.amount || 0
                        )
                        -
                        totalRefunded
                        -
                        totalPending
                    ),

                count:
                    Array.isArray(refunds)
                        ? refunds.length
                        : 0,

                items:
                    (refunds || [])
                        .map(item => ({
                            id:
                                item.id,

                            type:
                                item.refund_type,

                            status:
                                item.status,

                            amount:
                                Number(
                                    item.amount || 0
                                ),

                            currency:
                                item.currency,

                            reason:
                                item.reason_text
                                ||
                                item.reason_code
                                ||
                                null,

                            requestedAt:
                                item.requested_at
                                ||
                                item.created_at,

                            processedAt:
                                item.processed_at
                                ||
                                null
                        }))
            }
        });
    }
    catch (error) {

        console.error(
            "Erreur statut paiement :",
            error
        );


        return res
            .status(500)
            .json({
                success:
                    false,

                message:
                    "Impossible de vérifier le paiement."
            });
    }
};


/* =========================================================
   POST /commande/:reference/payment/retry
========================================================= */

exports.retryPayment =
async function (
    req,
    res
) {

    try {

        const userId =
            getUserId(req);


        if (!userId) {

            return res
                .status(401)
                .json({
                    success:
                        false,

                    message:
                        "Utilisateur non connecté."
                });
        }


        const reference =
            getReference(req);


        const order =
            await Order.findByReference(
                reference,
                userId
            );


        if (!order) {

            return res
                .status(404)
                .json({
                    success:
                        false,

                    message:
                        "Commande introuvable."
                });
        }


        const momoMsisdn =
            String(
                req.body.momo_msisdn
                ||
                ""
            )
                .replace(
                    /\D/g,
                    ""
                )
                .slice(
                    0,
                    15
                );


        if (
            momoMsisdn.length < 8
            ||
            momoMsisdn.length > 15
        ) {

            return res
                .status(400)
                .json({
                    success:
                        false,

                    message:
                        "Veuillez renseigner un numéro MTN MoMo valide."
                });
        }


        const result =
            await PaymentService
                .retryMtnMomo({
                    order,
                    payerMsisdn:
                        momoMsisdn
                });


        return res.json({
            success:
                true,

            message:
                "Nouvelle demande MTN MoMo envoyée.",

            payment: {
                id:
                    result.payment.id,

                status:
                    result.payment.status
            }
        });
    }
    catch (error) {

        console.error(
            "Retry paiement MTN MoMo :",
            error
        );


        const conflictCodes = [
            "PAYMENT_ALREADY_PAID",
            "PAYMENT_ALREADY_PENDING",
            "PAYMENT_PENDING_UNVERIFIED",
            "PAYMENT_RETRY_NOT_ALLOWED"
        ];


        return res
            .status(
                conflictCodes.includes(
                    error.code
                )
                    ? 409
                    : 500
            )
            .json({
                success:
                    false,

                code:
                    error.code
                    ||
                    "PAYMENT_RETRY_ERROR",

                message:
                    error.message
                    ||
                    "Impossible de relancer le paiement."
            });
    }
};


/* =========================================================
   GET /commande/:reference/facture
========================================================= */

exports.invoice =
async function (
    req,
    res,
    next
) {

    try {

        const userId =
            getUserId(req);


        if (!userId) {

            return res.redirect(
                "/connexion"
            );
        }


        const reference =
            getReference(req);


        if (!reference) {

            return res.status(404).send(
                "Commande introuvable."
            );
        }


        const data =
            await getFullOrder(
                reference,
                userId
            );


        if (!data) {

            return res.status(404).send(
                "Commande introuvable."
            );
        }


        const customer =
            await Order.getCustomer(
                userId
            );


        return res.render(
            "client/orders/invoice",
            {

                title:
                    `Facture ${data.order.reference}`,

                layout:
                    "layouts/client",

                customer,

                ...data
            }
        );

    }
    catch (error) {

        console.error(
            "Erreur facture commande :",
            error
        );


        return next(error);
    }
};


/* =========================================================
   GET /commande/:reference/suivi
========================================================= */

exports.tracking =
async function (
    req,
    res,
    next
) {

    try {

        const userId =
            getUserId(req);


        if (!userId) {

            return res.redirect(
                "/connexion"
            );
        }


        const reference =
            getReference(req);


        if (!reference) {

            return res.status(404).send(
                "Commande introuvable."
            );
        }


        const data =
            await getFullOrder(
                reference,
                userId
            );


        if (!data) {

            return res.status(404).send(
                "Commande introuvable."
            );
        }


        return res.render(
            "client/orders/tracking",
            {

                title:
                    `Suivi ${data.order.reference}`,

                layout:
                    "layouts/client",

                ...data
            }
        );

    }
    catch (error) {

        console.error(
            "Erreur suivi commande :",
            error
        );


        return next(error);
    }
};
