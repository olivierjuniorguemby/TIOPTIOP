const Cart =
    require("../../models/cart.model");

const Order =
    require("../../models/order.model");

const PaymentService =
    require("../../services/payment.service");


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


        if (
            paymentMethod ===
            "CASH_ON_DELIVERY"
        ) {

            paymentMethod =
                "CASH";
        }


        const momoMsisdn =
            String(req.body.momo_msisdn || "")
                .replace(/\D/g, "")
                .slice(0, 15);


        const customerNote =
            String(
                req.body.customer_note || ""
            )
                .trim()
                .slice(
                    0,
                    2000
                );


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
                customerNote
        };


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
            orderType === "DELIVERY" &&
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
            orderType === "DELIVERY" &&
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


        if (
            paymentMethod === "MOBILE_MONEY"
            &&
            (momoMsisdn.length < 8 || momoMsisdn.length > 15)
        ) {
            return await renderCheckoutError(
                req, res, cart, values,
                "Veuillez renseigner un numéro MTN MoMo valide."
            );
        }


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


        if (req.session) {

            delete req.session.cartGuestToken;


            req.session.lastOrder = {
                reference:
                    result.reference,

                publicId:
                    result.publicId
            };
        }


        let paymentQuery = "";

        if (paymentMethod === "MOBILE_MONEY") {
            try {
                await PaymentService.initiateMtnMomo({
                    paymentId: result.paymentId,
                    orderReference: result.reference,
                    payerMsisdn: momoMsisdn
                });
                paymentQuery = "?payment=momo-pending";
            } catch (paymentError) {
                console.error("Erreur initiation MTN MoMo :", paymentError);
                paymentQuery = "?payment=momo-error";
            }
        }

        return res.redirect(
            "/commande/confirmation/"
            + encodeURIComponent(result.reference)
            + paymentQuery
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
                Array.isArray(cart.items) &&
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
        catch (renderError) {

            console.error(
                "Erreur affichage erreur checkout :",
                renderError
            );
        }


        return next(error);
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


exports.renderCheckoutError =
    renderCheckoutError;
