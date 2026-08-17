const Cart =
    require("../../models/cart.model");

const Order =
    require("../../models/order.model");


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

        /* =================================================
           CLIENT
        ================================================= */

        const userId =
            getUserId(req);


        if (!userId) {

            /*
             * Normalement impossible puisque
             * requireUser protège déjà cette route.
             */

            return res.redirect(
                "/connexion"
            );
        }


        /* =================================================
           PANIER ACTIF
        ================================================= */

        const activeCart =
            await Cart.findActiveByUserId(
                userId
            );


        /*
         * Ne surtout pas créer un panier vide
         * simplement parce que le client visite /checkout.
         */

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


        /* =================================================
           CLIENT MYSQL
        ================================================= */

        const customer =
            await Order.getCustomer(
                userId
            );


        if (!customer) {

            return res.redirect(
                "/connexion"
            );
        }


        /* =================================================
           ADRESSES
        ================================================= */

        const addresses =
            await Order.getAddresses(
                userId
            );


        /* =================================================
           RESTAURANTS
        ================================================= */

        const restaurants =
            await Order.getRestaurants();


        /*
         * Pour cette première version du checkout,
         * le premier restaurant ouvert devient
         * le restaurant présélectionné.
         *
         * Plus tard la sélection pourra dépendre
         * de la localisation.
         */

        const selectedRestaurant =
            restaurants.length > 0
                ? restaurants[0]
                : null;


        /* =================================================
           ZONES DE LIVRAISON
        ================================================= */

        let deliveryZones =
            [];


        if (selectedRestaurant) {

            deliveryZones =
                await Order.getDeliveryZones(
                    selectedRestaurant.id
                );
        }


        /* =================================================
           ADRESSE PAR DEFAUT
        ================================================= */

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


        /* =================================================
           MONNAIE
        ================================================= */

        const currency =
            cart.items[0]?.currency
            ||
            "XAF";


        /* =================================================
           RENDER
        ================================================= */

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

                    customer_note:
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

   Utilisé par JavaScript lorsque le restaurant change.
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

   CREATION COMMANDE
========================================================= */

exports.create =
async function (
    req,
    res,
    next
) {

    try {

        /* =================================================
           CLIENT
        ================================================= */

        const userId =
            getUserId(req);


        if (!userId) {

            return res.redirect(
                "/connexion"
            );
        }


        /* =================================================
           VALEURS FORMULAIRE
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


        let paymentMethod =
            String(
                req.body.payment_method || ""
            )
                .trim()
                .toUpperCase();


        const customerNote =
            String(
                req.body.customer_note || ""
            )
                .trim()
                .slice(
                    0,
                    2000
                );


        /* =================================================
           COMPATIBILITE ANCIEN FORMULAIRE

           Votre ancien checkout envoyait :
           CASH_ON_DELIVERY

           La table payments attend :
           CASH
        ================================================= */

        if (
            paymentMethod ===
            "CASH_ON_DELIVERY"
        ) {

            paymentMethod =
                "CASH";
        }


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

            customer_note:
                customerNote
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
            !cart.items ||
            cart.items.length === 0
        ) {

            return res.redirect(
                "/panier"
            );
        }


        /* =================================================
           VALIDATION
        ================================================= */

        const allowedOrderTypes =
            [
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


        if (
            orderType === "DELIVERY"
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
            orderType === "DELIVERY"
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


        const allowedPaymentMethods =
            [
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
           CREATION TRANSACTIONNELLE
        ================================================= */

        const result =
            await Order.createFromCart({

                userId,

                restaurantId,

                deliveryAddressId:
                    orderType === "DELIVERY"
                        ? deliveryAddressId
                        : null,

                deliveryZoneId:
                    orderType === "DELIVERY"
                        ? deliveryZoneId
                        : null,

                orderType,

                paymentMethod,

                customerNote,

                cart
            });


        /* =================================================
           SESSION

           Important :
           le panier vient d'être CONVERTED.
           On peut retirer l'ancien token guest.
        ================================================= */

        if (req.session) {

            delete req.session.cartGuestToken;
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
        );

    }
    catch (error) {

        console.error(
            "Erreur création commande :",
            error
        );


        /*
         * Les erreurs métier venant du model
         * peuvent être affichées au client.
         */

        try {

            const userId =
                getUserId(req);


            const activeCart =
                userId
                    ? await Cart.findActiveByUserId(
                        userId
                    )
                    : null;


            const cart =
                activeCart
                    ? await Cart.getDetailedCart(
                        activeCart.id
                    )
                    : null;


            if (
                cart &&
                cart.items &&
                cart.items.length
            ) {

                const values = {

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

                    customer_note:
                        req.body.customer_note
                };


                return await renderCheckoutError(
                    req,
                    res,
                    cart,
                    values,
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


        return next(error);
    }
};


/* =========================================================
   HELPER RENDU ERREUR
========================================================= */

async function renderCheckoutError(
    req,
    res,
    cart,
    values,
    message
) {

    const userId =
        getUserId(req);


    const [
        customer,
        addresses,
        restaurants
    ] =
        await Promise.all([

            Order.getCustomer(
                userId
            ),

            Order.getAddresses(
                userId
            ),

            Order.getRestaurants()
        ]);


    let selectedRestaurant =
        null;


    if (
        values.restaurant_id
    ) {

        selectedRestaurant =
            await Order.getRestaurantById(
                Number(
                    values.restaurant_id
                )
            );
    }


    if (
        !selectedRestaurant &&
        restaurants.length
    ) {

        selectedRestaurant =
            restaurants[0];
    }


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

            currency,

            error:
                message,

            values
        }
    );
}


/* =========================================================
   EXPORT HELPER POUR TESTS EVENTUELS
========================================================= */

exports.renderCheckoutError =
    renderCheckoutError;