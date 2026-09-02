const Cart =
    require("../../models/cart.model");

const Order =
    require("../../models/order.model");

const PaymentService =
    require("../../services/payment.service");

const StripeService =
    require("../../services/stripe.service");

const Loyalty =
    require("../../models/loyalty.model");


/* =========================================================
   CHECKOUT CONTROLLER
   TIOPTIOP

   13.7   : MTN MoMo
   13.8.4 : Stripe Elements
========================================================= */


/* =========================================================
   HELPERS
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
   GET /checkout
========================================================= */

exports.index =
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


        const activeCart =
            await Cart.findActiveByUserId(
                userId
            );


        if (!activeCart) {

            return res.redirect(
                "/panier"
            );
        }


        const cart =
            await Cart.getDetailedCart(
                activeCart.id
            );


        if (
            !cart ||
            !Array.isArray(cart.items) ||
            cart.items.length === 0
        ) {

            return res.redirect(
                "/panier"
            );
        }


        const [
            customer,
            addresses,
            restaurants,
            availableRedemptions
        ] =
            await Promise.all([

                Order.getCustomer(
                    userId
                ),

                Order.getAddresses(
                    userId
                ),

                Order.getRestaurants(),

                Loyalty.listAvailableRedemptions(userId)
            ]);


        if (!customer) {

            return res.redirect(
                "/connexion"
            );
        }


        const selectedRestaurant =
            restaurants[0]
            ||
            null;


        let deliveryZones =
            [];


        if (selectedRestaurant) {

            deliveryZones =
                await Order.getDeliveryZones(
                    selectedRestaurant.id
                );
        }


        const defaultAddress =
            addresses.find(
                address =>
                    Number(
                        address.is_default
                    ) === 1
            )
            ||
            addresses[0]
            ||
            null;


        const currency =
            cart.items[0]?.currency
            ||
            "XAF";


        return res.render(
            "client/orders/checkout",
            {
                title:
                    "Finaliser la commande",

                layout:
                    "layouts/client",

                customer,
                cart,

                items:
                    cart.items,

                addresses,
                defaultAddress,

                restaurants,
                selectedRestaurant,

                deliveryZones,
                availableRedemptions,

                currency,

                error:
                    null,

                values: {

                    order_type:
                        "DELIVERY",

                    restaurant_id:
                        selectedRestaurant
                            ? selectedRestaurant.id
                            : "",

                    delivery_address_id:
                        defaultAddress
                            ? defaultAddress.id
                            : "",

                    delivery_zone_id:
                        "",

                    payment_method:
                        "CASH",

                    momo_msisdn:
                        "",

                    customer_note:
                        "",

                    loyalty_redemption_public_id:
                        ""
                }
            }
        );

    }
    catch (error) {

        console.error(
            "Erreur chargement checkout :",
            error
        );

        return next(error);
    }
};


/* =========================================================
   GET /checkout/zones/:restaurantId
========================================================= */

exports.deliveryZones =
async function (
    req,
    res
) {

    try {

        const restaurantId =
            Number(
                req.params.restaurantId
            );


        if (
            !Number.isInteger(
                restaurantId
            )
            ||
            restaurantId <= 0
        ) {

            return res.status(400).json({
                success:
                    false,

                message:
                    "Restaurant invalide."
            });
        }


        const restaurant =
            await Order.getRestaurantById(
                restaurantId
            );


        if (!restaurant) {

            return res.status(404).json({
                success:
                    false,

                message:
                    "Restaurant introuvable."
            });
        }


        const zones =
            await Order.getDeliveryZones(
                restaurantId
            );


        return res.json({

            success:
                true,

            restaurant: {

                id:
                    restaurant.id,

                name:
                    restaurant.name,

                supports_delivery:
                    Number(
                        restaurant.supports_delivery
                    ) === 1,

                supports_pickup:
                    Number(
                        restaurant.supports_pickup
                    ) === 1,

                supports_dine_in:
                    Number(
                        restaurant.supports_dine_in
                    ) === 1
            },

            zones:
                zones.map(
                    zone => ({

                        id:
                            zone.id,

                        name:
                            zone.name,

                        min_order:
                            Number(
                                zone.min_order || 0
                            ),

                        delivery_fee:
                            Number(
                                zone.delivery_fee || 0
                            ),

                        free_delivery_from:
                            zone.free_delivery_from !== null
                                ? Number(
                                    zone.free_delivery_from
                                )
                                : null,

                        estimated_min_minutes:
                            zone.estimated_min_minutes,

                        estimated_max_minutes:
                            zone.estimated_max_minutes
                    })
                )
        });

    }
    catch (error) {

        console.error(
            "Erreur récupération zones :",
            error
        );


        return res.status(500).json({

            success:
                false,

            message:
                "Impossible de récupérer les zones de livraison."
        });
    }
};


/* =========================================================
   POST /checkout

   CASH
   MOBILE_MONEY / MTN MOMO
   CARD / STRIPE
========================================================= */

exports.create =
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
           TYPE DE COMMANDE
        ================================================= */

        const orderType =
            String(
                req.body.order_type || ""
            )
                .trim()
                .toUpperCase();


        const restaurantId =
            Number(
                req.body.restaurant_id
            );


        const deliveryAddressId =
            req.body.delivery_address_id
                ? Number(
                    req.body.delivery_address_id
                )
                : null;


        const deliveryZoneId =
            req.body.delivery_zone_id
                ? Number(
                    req.body.delivery_zone_id
                )
                : null;


        /* =================================================
           MOYEN DE PAIEMENT
        ================================================= */

        let paymentMethod =
            String(
                req.body.payment_method || ""
            )
                .trim()
                .toUpperCase();


        if (
            paymentMethod ===
            "CASH_ON_DELIVERY"
        ) {

            paymentMethod =
                "CASH";
        }


        const momoMsisdn =
            String(
                req.body.momo_msisdn || ""
            )
                .replace(
                    /\D/g,
                    ""
                )
                .slice(
                    0,
                    15
                );


        const customerNote =
            String(
                req.body.customer_note || ""
            )
                .trim()
                .slice(
                    0,
                    2000
                );

        const loyaltyRedemptionPublicId =
            String(req.body.loyalty_redemption_public_id || "")
                .trim()
                .slice(0, 36);


        const values = {

            order_type:
                orderType,

            restaurant_id:
                restaurantId,

            delivery_address_id:
                deliveryAddressId,

            delivery_zone_id:
                deliveryZoneId,

            payment_method:
                paymentMethod,

            momo_msisdn:
                momoMsisdn,

            customer_note:
                customerNote,

            loyalty_redemption_public_id:
                loyaltyRedemptionPublicId
        };


        /* =================================================
           PANIER
        ================================================= */

        const activeCart =
            await Cart.findActiveByUserId(
                userId
            );


        if (!activeCart) {

            return res.redirect(
                "/panier"
            );
        }


        const cart =
            await Cart.getDetailedCart(
                activeCart.id
            );


        if (
            !cart ||
            !Array.isArray(
                cart.items
            ) ||
            cart.items.length === 0
        ) {

            return res.redirect(
                "/panier"
            );
        }


        /* =================================================
           VALIDATION TYPE COMMANDE
        ================================================= */

        const allowedOrderTypes = [

            "DELIVERY",
            "PICKUP",
            "DINE_IN"
        ];


        if (
            !allowedOrderTypes.includes(
                orderType
            )
        ) {

            return await renderCheckoutError(
                req,
                res,
                cart,
                values,
                "Type de commande invalide."
            );
        }


        /* =================================================
           VALIDATION RESTAURANT
        ================================================= */

        if (
            !Number.isInteger(
                restaurantId
            )
            ||
            restaurantId <= 0
        ) {

            return await renderCheckoutError(
                req,
                res,
                cart,
                values,
                "Veuillez sélectionner un restaurant."
            );
        }


        /* =================================================
           VALIDATION LIVRAISON
        ================================================= */

        if (
            orderType ===
            "DELIVERY"
            &&
            (
                !Number.isInteger(
                    deliveryAddressId
                )
                ||
                deliveryAddressId <= 0
            )
        ) {

            return await renderCheckoutError(
                req,
                res,
                cart,
                values,
                "Veuillez sélectionner une adresse de livraison."
            );
        }


        if (
            orderType ===
            "DELIVERY"
            &&
            (
                !Number.isInteger(
                    deliveryZoneId
                )
                ||
                deliveryZoneId <= 0
            )
        ) {

            return await renderCheckoutError(
                req,
                res,
                cart,
                values,
                "Veuillez sélectionner une zone de livraison."
            );
        }


        /* =================================================
           VALIDATION PAIEMENT
        ================================================= */

        const allowedPaymentMethods = [

            "CARD",
            "MOBILE_MONEY",
            "CASH"
        ];


        if (
            !allowedPaymentMethods.includes(
                paymentMethod
            )
        ) {

            return await renderCheckoutError(
                req,
                res,
                cart,
                values,
                "Moyen de paiement invalide."
            );
        }


        /* =================================================
           VALIDATION MTN MOMO
        ================================================= */

        if (
            paymentMethod ===
            "MOBILE_MONEY"
            &&
            (
                momoMsisdn.length < 8
                ||
                momoMsisdn.length > 15
            )
        ) {

            return await renderCheckoutError(
                req,
                res,
                cart,
                values,
                "Veuillez renseigner un numéro MTN MoMo valide."
            );
        }


        /* =================================================
           CREATION COMMANDE
        ================================================= */

        const result =
            await Order.createFromCart({

                userId,

                restaurantId,

                deliveryAddressId:
                    orderType ===
                    "DELIVERY"
                        ? deliveryAddressId
                        : null,

                deliveryZoneId:
                    orderType ===
                    "DELIVERY"
                        ? deliveryZoneId
                        : null,

                orderType,

                paymentMethod,

                customerNote,

                cart,

                loyaltyRedemptionPublicId
            });


        /* =================================================
           SESSION
        ================================================= */

        if (
            req.session
        ) {

            delete req.session
                .cartGuestToken;


            req.session.lastOrder = {

                reference:
                    result.reference,

                publicId:
                    result.publicId
            };
        }


        let paymentQuery =
            "";


        /* =================================================
           MTN MOMO
           13.7.x

           ON NE MODIFIE PAS LE FONCTIONNEMENT EXISTANT
        ================================================= */

        if (
            paymentMethod ===
            "MOBILE_MONEY"
        ) {

            try {

                await PaymentService
                    .initiateMtnMomo({

                        paymentId:
                            result.paymentId,

                        orderReference:
                            result.reference,

                        payerMsisdn:
                            momoMsisdn
                    });


                paymentQuery =
                    "?payment=momo-pending";
            }
            catch (
                paymentError
            ) {

                console.error(
                    "Erreur initiation MTN MoMo :",
                    paymentError
                );


                paymentQuery =
                    "?payment=momo-error";
            }
        }


        /* =================================================
           STRIPE CARD
           13.8.3

           Création du vrai PaymentIntent Stripe TEST.

           IMPORTANT :
           Aucune carte n'est encore saisie ici.
           Aucun argent réel n'est débité.
        ================================================= */

        else if (
            paymentMethod ===
            "CARD"
        ) {

            try {

                const stripeResult =
                    await PaymentService
                        .initiateStripeCard({

                            paymentId:
                                result.paymentId,

                            orderReference:
                                result.reference
                        });


                /*
                 * On conserve temporairement le
                 * client_secret dans la session.
                 *
                 * Il sera utilisé en 13.8.4 pour
                 * afficher Stripe Elements.
                 *
                 * Il ne doit PAS être stocké
                 * dans MySQL.
                 */

                if (
                    req.session
                    &&
                    stripeResult.clientSecret
                ) {

                    req.session
                        .stripePayment = {

                            orderReference:
                                result.reference,

                            paymentId:
                                result.paymentId,

                            providerReference:
                                stripeResult
                                    .providerReference,

                            clientSecret:
                                stripeResult
                                    .clientSecret
                        };
                }


                console.log(
                    "[Stripe] PaymentIntent créé :",
                    stripeResult
                        .providerReference
                );


                console.log(
                    "[Stripe] Statut :",
                    stripeResult
                        .providerStatus
                );


                /*
                 * Pour une carte, on ne va plus directement
                 * à la confirmation de commande.
                 *
                 * On affiche d'abord Stripe Payment Element.
                 */
                return res.redirect(
                    "/checkout/carte/"
                    +
                    encodeURIComponent(
                        result.reference
                    )
                );
            }
            catch (
                paymentError
            ) {

                console.error(
                    "Erreur initiation Stripe :",
                    paymentError
                );


                /*
                 * La commande existe déjà.
                 *
                 * On ne détruit donc pas la commande.
                 * La confirmation indiquera simplement
                 * que l'initialisation CB a échoué.
                 */

                paymentQuery =
                    "?payment=card-error";
            }
        }


        /* =================================================
           CASH

           Aucun appel provider.
        ================================================= */

        else {

            paymentQuery =
                "?payment=cash";
        }


        /* =================================================
           REDIRECTION CONFIRMATION
        ================================================= */

        return res.redirect(

            "/commande/confirmation/"
            +
            encodeURIComponent(
                result.reference
            )
            +
            paymentQuery
        );

    }
    catch (error) {

        console.error(
            "Erreur création commande :",
            error
        );


        try {

            const userId =
                getUserId(req);


            const activeCart =
                userId
                    ? await Cart
                        .findActiveByUserId(
                            userId
                        )
                    : null;


            const cart =
                activeCart
                    ? await Cart
                        .getDetailedCart(
                            activeCart.id
                        )
                    : null;


            if (
                cart
                &&
                Array.isArray(
                    cart.items
                )
                &&
                cart.items.length > 0
            ) {

                return await renderCheckoutError(
                    req,
                    res,
                    cart,
                    {

                        order_type:
                            req.body.order_type,

                        restaurant_id:
                            req.body.restaurant_id,

                        delivery_address_id:
                            req.body.delivery_address_id,

                        delivery_zone_id:
                            req.body.delivery_zone_id,

                        payment_method:
                            req.body.payment_method,

                        momo_msisdn:
                            req.body.momo_msisdn,

                        customer_note:
                            req.body.customer_note
                    },

                    error.message
                    ||
                    "Impossible de créer la commande."
                );
            }

        }
        catch (
            renderError
        ) {

            console.error(
                "Erreur affichage erreur checkout :",
                renderError
            );
        }


        return next(
            error
        );
    }
};




/* =========================================================
   GET /checkout/carte/:reference
   PAGE STRIPE PAYMENT ELEMENT
========================================================= */

exports.cardPayment =
async function (
    req,
    res,
    next
) {

    try {

        const userId =
            getUserId(
                req
            );


        if (!userId) {

            return res.redirect(
                "/connexion"
            );
        }


        const reference =
            String(
                req.params.reference || ""
            )
                .trim()
                .slice(
                    0,
                    60
                );


        const order =
            await Order.findByReference(
                reference,
                userId
            );


        if (!order) {

            return res
                .status(404)
                .send(
                    "Commande introuvable."
                );
        }


        const payment =
            await Order.getPaymentByOrderId(
                order.id
            );


        if (
            !payment
            ||
            payment.method !==
                "CARD"
        ) {

            return res
                .status(400)
                .send(
                    "Cette commande n'utilise pas le paiement par carte."
                );
        }


        /*
         * Si le paiement est déjà payé,
         * inutile de réafficher le formulaire CB.
         */
        if (
            payment.status ===
            "PAID"
        ) {

            return res.redirect(
                "/commande/confirmation/"
                +
                encodeURIComponent(
                    reference
                )
                +
                "?payment=card-paid"
            );
        }


        if (
            !payment.provider_reference
        ) {

            return res
                .status(409)
                .send(
                    "Le PaymentIntent Stripe n'a pas été initialisé."
                );
        }


        const intent =
            await StripeService
                .retrievePaymentIntent(
                    payment.provider_reference
                );


        const config =
            StripeService.getConfig();


        return res.render(
            "client/orders/card-payment",
            {
                title:
                    `Paiement ${reference}`,

                layout:
                    "layouts/client",

                order,

                payment,

                stripePublishableKey:
                    config.publishableKey,

                clientSecret:
                    intent.client_secret,

                stripeStatus:
                    intent.status
            }
        );

    }
    catch (error) {

        console.error(
            "Erreur page paiement Stripe :",
            error
        );


        return next(
            error
        );
    }
};


/* =========================================================
   POST /checkout/carte/:reference/sync

   Le navigateur ne décide JAMAIS du statut final.
   Le serveur relit le PaymentIntent directement chez Stripe.
========================================================= */

exports.syncCardPayment =
async function (
    req,
    res
) {

    try {

        const userId =
            getUserId(
                req
            );


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
            String(
                req.params.reference || ""
            )
                .trim()
                .slice(
                    0,
                    60
                );


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


        const payment =
            await Order.getPaymentByOrderId(
                order.id
            );


        if (
            !payment
            ||
            payment.method !==
                "CARD"
        ) {

            return res
                .status(400)
                .json({
                    success:
                        false,

                    message:
                        "Paiement carte introuvable."
                });
        }


        const result =
            await PaymentService
                .syncStripeCardPayment(
                    payment
                );


        return res.json({

            success:
                true,

            stripeStatus:
                result.stripeStatus,

            payment: {
                id:
                    result.payment.id,

                status:
                    result.payment.status,

                providerReference:
                    result.payment.provider_reference
            }
        });

    }
    catch (error) {

        console.error(
            "Synchronisation Stripe :",
            error
        );


        return res
            .status(500)
            .json({
                success:
                    false,

                message:
                    "Impossible de vérifier le paiement Stripe."
            });
    }
};


/* =========================================================
   GET /checkout/carte/:reference/retour

   Utilisé notamment si Stripe doit rediriger le client
   après une authentification.
========================================================= */

exports.cardReturn =
async function (
    req,
    res,
    next
) {

    try {

        const userId =
            getUserId(
                req
            );


        if (!userId) {

            return res.redirect(
                "/connexion"
            );
        }


        const reference =
            String(
                req.params.reference || ""
            )
                .trim()
                .slice(
                    0,
                    60
                );


        const order =
            await Order.findByReference(
                reference,
                userId
            );


        if (!order) {

            return res
                .status(404)
                .send(
                    "Commande introuvable."
                );
        }


        const payment =
            await Order.getPaymentByOrderId(
                order.id
            );


        if (
            !payment
            ||
            payment.method !==
                "CARD"
        ) {

            return res
                .status(400)
                .send(
                    "Paiement carte introuvable."
                );
        }


        const returnedPaymentIntent =
            String(
                req.query.payment_intent || ""
            ).trim();


        /*
         * Empêche une URL de retour utilisant un PaymentIntent
         * appartenant à une autre commande.
         */
        if (
            returnedPaymentIntent
            &&
            returnedPaymentIntent !==
                payment.provider_reference
        ) {

            return res
                .status(400)
                .send(
                    "Référence Stripe incohérente."
                );
        }


        let result =
            null;


        try {

            result =
                await PaymentService
                    .syncStripeCardPayment(
                        payment
                    );
        }
        catch (syncError) {

            console.error(
                "Retour Stripe - synchronisation :",
                syncError
            );
        }


        const localStatus =
            result?.payment?.status
            ||
            payment.status;


        if (
            localStatus ===
            "PAID"
        ) {

            return res.redirect(
                "/commande/confirmation/"
                +
                encodeURIComponent(
                    reference
                )
                +
                "?payment=card-paid"
            );
        }


        /*
         * Si une action est encore nécessaire ou que le
         * paiement est toujours en attente, on réaffiche
         * le formulaire Stripe.
         */
        if (
            localStatus ===
            "PENDING"
        ) {

            return res.redirect(
                "/checkout/carte/"
                +
                encodeURIComponent(
                    reference
                )
                +
                "?payment=card-pending"
            );
        }


        return res.redirect(
            "/checkout/carte/"
            +
            encodeURIComponent(
                reference
            )
            +
            "?payment=card-error"
        );

    }
    catch (error) {

        console.error(
            "Retour Stripe :",
            error
        );


        return next(
            error
        );
    }
};



/* =========================================================
   HELPER ERREUR CHECKOUT
========================================================= */

async function renderCheckoutError(
    req,
    res,
    cart,
    values,
    message
) {

    const userId =
        getUserId(
            req
        );


    const [
        customer,
        addresses,
        restaurants,
        availableRedemptions
    ] =
        await Promise.all([

            Order.getCustomer(
                userId
            ),

            Order.getAddresses(
                userId
            ),

            Order.getRestaurants(),

            Loyalty.listAvailableRedemptions(userId)
        ]);


    let selectedRestaurant =
        null;


    if (
        values.restaurant_id
    ) {

        selectedRestaurant =
            await Order
                .getRestaurantById(
                    Number(
                        values.restaurant_id
                    )
                );
    }


    if (
        !selectedRestaurant
        &&
        restaurants.length
    ) {

        selectedRestaurant =
            restaurants[0];
    }


    let deliveryZones =
        [];


    if (
        selectedRestaurant
    ) {

        deliveryZones =
            await Order
                .getDeliveryZones(
                    selectedRestaurant.id
                );
    }


    const defaultAddress =
        addresses.find(
            address =>
                Number(
                    address.is_default
                ) === 1
        )
        ||
        addresses[0]
        ||
        null;


    const currency =
        cart.items[0]?.currency
        ||
        "XAF";


    return res.status(400).render(
        "client/orders/checkout",
        {

            title:
                "Finaliser la commande",

            layout:
                "layouts/client",

            customer,
            cart,

            items:
                cart.items,

            addresses,
            defaultAddress,

            restaurants,
            selectedRestaurant,

            deliveryZones,
            availableRedemptions,

            currency,

            error:
                message,

            values
        }
    );
}


exports.renderCheckoutError =
    renderCheckoutError;