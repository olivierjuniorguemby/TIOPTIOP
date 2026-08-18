const Order =
    require("../../models/order.model");


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
        history
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
            )
        ]);


    return {
        order,
        items,
        payment,
        history
    };
}


/* =========================================================
   GET /commandes

   LISTE DES COMMANDES DU CLIENT
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


        /* =================================================
           FILTRES
        ================================================= */

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


        /* =================================================
           STATUTS AUTORISES
        ================================================= */

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


        /* =================================================
           COMMANDES
        ================================================= */

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


        /* =================================================
           RENDER
        ================================================= */

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