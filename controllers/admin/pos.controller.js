const Product = require("../../models/product.model");
const Formula = require("../../models/formula.model");
const Category = require("../../models/category.model");
const User = require("../../models/user.model");
const Order = require("../../models/order.model");
const ProductOption = require("../../models/product-option.model");
const PaymentService = require("../../services/payment.service");
const StripeService = require("../../services/stripe.service");

function normalizeImage(value) {
    if (!value) return null;
    const image = String(value).trim();
    if (!image) return null;
    if (/^(https?:)?\/\//i.test(image) || image.startsWith("/")) return image;
    return `/${image.replace(/^\.?\//, "")}`;
}

async function index(req, res) {
    try {
        const [products, formulas, categories, restaurants] = await Promise.all([
            Product.findAllForMenu({}),
            Formula.findAllForClient(),
            Category.findAllActive(),
            Order.getRestaurants()
        ]);

        const posProducts = (products || []).map(product => ({
            id: Number(product.id),
            type: "PRODUCT",
            categoryId: Number(product.category_id),
            categoryName: product.category_name || "Autres",
            name: product.name,
            description: product.short_description || "",
            price: Number(product.price || 0),
            currency: product.currency || "XAF",
            image: normalizeImage(product.image_url),
            icon: product.icon || "🍽️"
        }));

        const posFormulas = (formulas || []).map(formula => ({
            id: Number(formula.id),
            type: "FORMULA",
            categoryId: null,
            categoryName: "Formules",
            name: formula.name,
            description: formula.short_description || formula.description || "",
            price: Number(formula.price || 0),
            currency: formula.currency || "XAF",
            image: normalizeImage(formula.primary_image),
            icon: "🍱"
        }));

        res.render("admin/operations/pos", {
            title: "POS / Nouvelle commande",
            layout: "layouts/admin",
            products: posProducts,
            formulas: posFormulas,
            categories: categories || [],
            restaurants: restaurants || []
        });
    } catch (error) {
        console.error("[ADMIN POS] Chargement catalogue :", error);
        res.status(500).render("admin/operations/pos", {
            title: "POS / Nouvelle commande",
            layout: "layouts/admin",
            products: [],
            formulas: [],
            categories: [],
            restaurants: [],
            posError: "Impossible de charger le catalogue POS."
        });
    }
}


function normalizeQuantity(value) {
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        throw new Error("Quantité POS invalide.");
    }
    return quantity;
}


function normalizeOptionIds(values) {
    const list = Array.isArray(values) ? values : (values == null ? [] : [values]);
    return [...new Set(
        list.map(Number).filter(id => Number.isInteger(id) && id > 0)
    )];
}

async function priceConfiguredProduct(product, rawItem) {
    const optionGroups = await ProductOption.findByProductId(product.id, true);
    const selectedIds = normalizeOptionIds(rawItem.optionValueIds);
    const selectedSet = new Set(selectedIds);
    const selectedOptions = [];
    const selectedByGroup = new Map();

    for (const group of optionGroups) {
        const activeOptions = Array.isArray(group.options) ? group.options : [];
        const groupSelected = activeOptions.filter(option => selectedSet.has(Number(option.id)));
        selectedByGroup.set(Number(group.id), groupSelected);

        const type = String(group.selection_type || "").toLowerCase();
        const minChoices = Math.max(0, Number(group.min_choices || 0));
        const maxChoices = Number(group.max_choices || 0);
        const requiredMinimum = Number(group.is_required) === 1 ? Math.max(1, minChoices) : minChoices;

        if (type === "single" && groupSelected.length > 1) {
            const error = new Error(`Un seul choix est autorisé pour « ${group.name} ».`);
            error.code = "POS_OPTION_SINGLE";
            throw error;
        }

        if (groupSelected.length < requiredMinimum) {
            const error = new Error(`Sélection obligatoire pour « ${group.name} ».`);
            error.code = "POS_OPTION_REQUIRED";
            throw error;
        }

        if (maxChoices > 0 && groupSelected.length > maxChoices) {
            const error = new Error(`Trop de choix pour « ${group.name} » (maximum ${maxChoices}).`);
            error.code = "POS_OPTION_MAX";
            throw error;
        }

        for (const option of groupSelected) {
            selectedOptions.push({
                id: Number(option.id),
                groupId: Number(group.id),
                groupName: group.name,
                name: option.name,
                priceDelta: Number(option.price_delta || 0)
            });
        }
    }

    const allActiveOptionIds = new Set(
        optionGroups.flatMap(group => (group.options || []).map(option => Number(option.id)))
    );

    for (const id of selectedIds) {
        if (!allActiveOptionIds.has(id)) {
            const error = new Error("Une option sélectionnée n'est plus disponible pour ce produit.");
            error.code = "POS_OPTION_INVALID";
            throw error;
        }
    }

    const optionTotal = selectedOptions.reduce((sum, option) => sum + option.priceDelta, 0);
    const basePrice = Number(product.price || 0);

    return {
        basePrice,
        optionTotal,
        unitPrice: basePrice + optionTotal,
        selectedOptions
    };
}


async function buildPosPricedCart(payload = {}) {
    const rawItems = Array.isArray(payload?.items) ? payload.items : [];

    if (!rawItems.length) {
        return {
            items: [],
            itemCount: 0,
            subtotal: 0,
            discountAmount: 0,
            deliveryFee: 0,
            taxAmount: 0,
            total: 0,
            currency: "XAF",
            restaurant: null,
            orderType: String(payload?.orderType || "PICKUP").trim().toUpperCase(),
            deliveryZone: null
        };
    }

    if (rawItems.length > 100) {
        const error = new Error("Le panier POS contient trop de lignes.");
        error.code = "POS_CART_TOO_LARGE";
        throw error;
    }

    const normalizedItems = rawItems.map((raw, index) => {
        const type = String(raw?.type || "").trim().toUpperCase();
        const id = Number(raw?.id);
        const quantity = normalizeQuantity(raw?.quantity);
        const key = String(raw?.key || `POSLINE-${index}-${type}-${id}`).slice(0, 180);

        if (!["PRODUCT", "FORMULA"].includes(type) || !Number.isInteger(id) || id <= 0) {
            const error = new Error("Article POS invalide.");
            error.code = "POS_ITEM_INVALID";
            throw error;
        }

        return {
            type,
            id,
            quantity,
            key,
            optionValueIds: normalizeOptionIds(raw?.optionValueIds),
            instructions: String(raw?.instructions || "").trim().slice(0, 2000)
        };
    });

    const pricedItems = [];
    let currency = null;

    for (const item of normalizedItems) {
        const row = item.type === "PRODUCT"
            ? await Product.findById(item.id)
            : await Formula.findById(item.id);

        if (!row || Number(row.is_active) !== 1) {
            const error = new Error(
                `Un article du panier n'est plus disponible (${item.type}:${item.id}).`
            );
            error.code = "POS_ITEM_UNAVAILABLE";
            throw error;
        }

        const itemCurrency = String(row.currency || "XAF").toUpperCase();

        if (currency && currency !== itemCurrency) {
            const error = new Error("Les articles du panier n'utilisent pas la même devise.");
            error.code = "POS_MIXED_CURRENCIES";
            throw error;
        }

        currency = itemCurrency;

        let basePrice = Number(row.price || 0);
        let optionTotal = 0;
        let unitPrice = basePrice;
        let selectedOptions = [];

        if (!Number.isFinite(basePrice) || basePrice < 0) {
            const error = new Error("Prix catalogue invalide.");
            error.code = "POS_PRICE_INVALID";
            throw error;
        }

        if (item.type === "PRODUCT") {
            const configuration = await priceConfiguredProduct(row, item);
            basePrice = configuration.basePrice;
            optionTotal = configuration.optionTotal;
            unitPrice = configuration.unitPrice;
            selectedOptions = configuration.selectedOptions;
        }

        pricedItems.push({
            key: item.key,
            type: item.type,
            id: item.id,
            name: row.name,
            basePrice,
            optionTotal,
            unitPrice,
            quantity: item.quantity,
            lineTotal: unitPrice * item.quantity,
            currency: itemCurrency,
            selectedOptions,
            instructions: item.instructions
        });
    }

    const subtotal = pricedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const orderType = String(payload?.orderType || "PICKUP").trim().toUpperCase();

    if (!["DELIVERY", "PICKUP", "DINE_IN"].includes(orderType)) {
        const error = new Error("Mode de réception invalide.");
        error.code = "POS_ORDER_TYPE_INVALID";
        throw error;
    }

    const restaurantId = Number(payload?.restaurantId);

    if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
        const error = new Error("Sélectionnez un restaurant.");
        error.code = "POS_RESTAURANT_REQUIRED";
        throw error;
    }

    const restaurant = await Order.getRestaurantById(restaurantId);

    if (!restaurant) {
        const error = new Error("Le restaurant sélectionné n'est pas disponible.");
        error.code = "POS_RESTAURANT_UNAVAILABLE";
        throw error;
    }

    const supportColumn =
        orderType === "DELIVERY"
            ? "supports_delivery"
            : orderType === "PICKUP"
                ? "supports_pickup"
                : "supports_dine_in";

    if (Number(restaurant[supportColumn]) !== 1) {
        const error = new Error("Ce restaurant ne prend pas en charge ce mode de réception.");
        error.code = "POS_ORDER_TYPE_UNSUPPORTED";
        throw error;
    }

    let zone = null;
    let deliveryFee = 0;

    if (orderType === "DELIVERY") {
        const zoneId = Number(payload?.deliveryZoneId);

        if (!Number.isInteger(zoneId) || zoneId <= 0) {
            const error = new Error("Sélectionnez une zone de livraison.");
            error.code = "POS_DELIVERY_ZONE_REQUIRED";
            throw error;
        }

        zone = await Order.getDeliveryZoneById(restaurantId, zoneId);

        if (!zone) {
            const error = new Error(
                "La zone de livraison n'est pas disponible pour ce restaurant."
            );
            error.code = "POS_DELIVERY_ZONE_INVALID";
            throw error;
        }

        const minimum = Number(zone.min_order || 0);

        if (subtotal < minimum) {
            const error = new Error(
                `Commande minimum pour ${zone.name} : ${minimum.toLocaleString("fr-FR")} ${currency || "XAF"}.`
            );
            error.code = "POS_MIN_ORDER_NOT_REACHED";
            throw error;
        }

        deliveryFee = Order.calculateDeliveryFee(subtotal, orderType, zone);
    }

    // 13.9.6.5 : aucune règle POS active de promotion/taxe n'est appliquée.
    // Le navigateur ne peut pas imposer ces montants.
    const discountAmount = 0;
    const taxAmount = 0;
    const total = subtotal - discountAmount + deliveryFee + taxAmount;

    return {
        items: pricedItems,
        itemCount: pricedItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal,
        discountAmount,
        deliveryFee,
        taxAmount,
        total,
        currency: currency || "XAF",
        restaurant: {
            id: Number(restaurant.id),
            name: restaurant.name
        },
        orderType,
        deliveryZone: zone
            ? {
                id: Number(zone.id),
                name: zone.name,
                minOrder: Number(zone.min_order || 0),
                deliveryFee: Number(zone.delivery_fee || 0),
                freeDeliveryFrom:
                    zone.free_delivery_from == null
                        ? null
                        : Number(zone.free_delivery_from)
            }
            : null
    };
}

async function calculateCart(req, res) {
    try {
        const cart = await buildPosPricedCart(req.body || {});
        return res.json({ ok: true, cart });
    }
    catch (error) {
        console.error("[ADMIN POS] Calcul panier :", error);
        return res.status(400).json({
            ok: false,
            code: error.code || "POS_CART_CALCULATION_FAILED",
            message: error.message || "Impossible de recalculer le panier POS."
        });
    }
}

function normalizePosText(value, maxLength = 255) {
    return String(value || "").trim().slice(0, maxLength);
}

function normalizePosChannel(value) {
    const channel = String(value || "POS").trim().toUpperCase();

    if (!["POS", "PHONE", "WHATSAPP"].includes(channel)) {
        const error = new Error("Canal de commande POS invalide.");
        error.code = "POS_CHANNEL_INVALID";
        throw error;
    }

    return channel;
}

function normalizePosPaymentMethod(value) {
    const method = String(value || "").trim().toUpperCase();

    if (!["CASH", "CARD", "MOBILE_MONEY"].includes(method)) {
        const error = new Error("Moyen de paiement POS invalide.");
        error.code = "POS_PAYMENT_METHOD_INVALID";
        throw error;
    }

    return method;
}

function normalizePosCustomerContext(raw = {}, channel) {
    const mode = String(raw?.mode || "GUEST").trim().toUpperCase();

    if (!["ACCOUNT", "GUEST", "ANONYMOUS"].includes(mode)) {
        const error = new Error("Type de client POS invalide.");
        error.code = "POS_CUSTOMER_MODE_INVALID";
        throw error;
    }

    if (mode === "ACCOUNT") {
        const userId = Number(raw?.userId);

        if (!Number.isInteger(userId) || userId <= 0) {
            const error = new Error("Sélectionnez un client avec compte.");
            error.code = "POS_ACCOUNT_REQUIRED";
            throw error;
        }

        return {
            mode,
            userId,
            firstName: "",
            lastName: "",
            phone: "",
            email: ""
        };
    }

    if (mode === "ANONYMOUS") {
        return {
            mode,
            userId: null,
            firstName: "",
            lastName: "",
            phone: "",
            email: ""
        };
    }

    const firstName = normalizePosText(raw?.firstName, 100);
    const lastName = normalizePosText(raw?.lastName, 100);
    const phone = normalizePosText(raw?.phone, 40);
    const email = normalizePosText(raw?.email, 190);

    if (["PHONE", "WHATSAPP"].includes(channel) && !phone) {
        const error = new Error(
            "Le téléphone du client invité est obligatoire pour ce canal."
        );
        error.code = "POS_GUEST_PHONE_REQUIRED";
        throw error;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        const error = new Error("L'adresse email du client invité n'est pas valide.");
        error.code = "POS_GUEST_EMAIL_INVALID";
        throw error;
    }

    return {
        mode,
        userId: null,
        firstName,
        lastName,
        phone,
        email
    };
}

function normalizePosDelivery(raw = {}, orderType) {
    if (orderType !== "DELIVERY") {
        return {
            savedAddressId: null,
            recipientName: "",
            phone: "",
            addressLine1: "",
            addressLine2: "",
            district: "",
            city: "",
            countryCode: "CG",
            instructions: ""
        };
    }

    const savedAddressId = Number(raw?.savedAddressId || 0) || null;
    const recipientName = normalizePosText(raw?.recipientName, 160);
    const phone = normalizePosText(raw?.phone, 40);
    const addressLine1 = normalizePosText(raw?.addressLine1, 255);
    const addressLine2 = normalizePosText(raw?.addressLine2, 255);
    const district = normalizePosText(raw?.district, 120);
    const city = normalizePosText(raw?.city, 120);
    const instructions = normalizePosText(raw?.instructions, 2000);

    if (!phone) {
        const error = new Error("Le téléphone de livraison est obligatoire.");
        error.code = "POS_DELIVERY_PHONE_REQUIRED";
        throw error;
    }

    if (!addressLine1) {
        const error = new Error("L'adresse de livraison est obligatoire.");
        error.code = "POS_DELIVERY_ADDRESS_REQUIRED";
        throw error;
    }

    if (!city) {
        const error = new Error("La ville de livraison est obligatoire.");
        error.code = "POS_DELIVERY_CITY_REQUIRED";
        throw error;
    }

    return {
        savedAddressId,
        recipientName,
        phone,
        addressLine1,
        addressLine2,
        district,
        city,
        countryCode: "CG",
        instructions
    };
}

async function createOrder(req, res) {
    try {
        const channel = normalizePosChannel(req.body?.channel);
        const paymentMethod = normalizePosPaymentMethod(req.body?.paymentMethod);
        const customer = normalizePosCustomerContext(req.body?.customer || {}, channel);

        /*
         * IMPORTANT :
         * on recalcule TOUT une nouvelle fois au moment exact de la création.
         * posLastServerCart / les totaux du navigateur ne sont jamais utilisés.
         */
        const cart = await buildPosPricedCart(req.body || {});

        if (!cart.items.length || cart.total <= 0) {
            const error = new Error("Le panier POS est vide.");
            error.code = "POS_CART_EMPTY";
            throw error;
        }

        const delivery = normalizePosDelivery(
            req.body?.delivery || {},
            cart.orderType
        );

        const idempotencyKey =
            normalizePosText(req.body?.idempotencyKey, 100);

        if (!idempotencyKey || idempotencyKey.length < 16) {
            const error = new Error(
                "Jeton de création POS invalide. Rechargez le récapitulatif."
            );
            error.code = "POS_IDEMPOTENCY_KEY_INVALID";
            throw error;
        }

        const result = await Order.createFromPos({
            idempotencyKey,
            adminUserId: Number(req.session?.admin?.id) || null,
            clientMode: customer.mode,
            userId: customer.userId,
            guest: {
                firstName: customer.firstName,
                lastName: customer.lastName,
                phone: customer.phone,
                email: customer.email
            },
            channel,
            restaurantId: Number(cart.restaurant.id),
            deliveryAddressId:
                customer.mode === "ACCOUNT"
                    ? delivery.savedAddressId
                    : null,
            deliveryZoneId:
                cart.deliveryZone
                    ? Number(cart.deliveryZone.id)
                    : null,
            orderType: cart.orderType,
            paymentMethod,
            deliverySnapshot: delivery,
            cart
        });

        let cardPayment = null;
        let cardPaymentError = null;

        if (paymentMethod === "CARD") {
            try {
                cardPayment = await PaymentService.initiateStripeCard({
                    paymentId: result.paymentId,
                    orderReference: result.reference
                });
            } catch (error) {
                cardPaymentError = {
                    code: error.code || "POS_STRIPE_INIT_FAILED",
                    message: error.message || "Impossible d'initialiser le paiement par carte."
                };
                console.error("[ADMIN POS] Initialisation Stripe :", error);
            }
        }

        return res.status(result.duplicate ? 200 : 201).json({
            ok: true,
            duplicate: Boolean(result.duplicate),
            order: {
                id: result.orderId,
                publicId: result.publicId,
                reference: result.reference,
                channel: result.channel,
                orderType: result.orderType,
                status: result.orderStatus,
                subtotal: result.subtotal,
                deliveryFee: result.deliveryFee,
                discountAmount: result.discountAmount,
                taxAmount: result.taxAmount,
                totalAmount: result.totalAmount,
                currency: result.currency
            },
            payment: {
                id: result.paymentId,
                publicId: result.paymentPublicId,
                method: result.paymentMethod,
                provider: result.paymentProvider,
                status: result.paymentStatus
            },
            cardPaymentError,
            nextUrl:
                paymentMethod === "CARD" && !cardPaymentError
                    ? `/admin/pos/carte/${encodeURIComponent(result.reference)}`
                    : paymentMethod === "MOBILE_MONEY"
                        ? `/admin/pos/mobile-money/${encodeURIComponent(result.reference)}`
                        : `/admin/commandes/${encodeURIComponent(result.reference)}`
        });
    }
    catch (error) {
        console.error("[ADMIN POS] Création commande :", error);

        const status =
            [
                "POS_IDEMPOTENCY_KEY_INVALID",
                "POS_CHANNEL_INVALID",
                "POS_PAYMENT_METHOD_INVALID",
                "POS_CUSTOMER_MODE_INVALID",
                "POS_ACCOUNT_REQUIRED",
                "POS_GUEST_PHONE_REQUIRED",
                "POS_GUEST_EMAIL_INVALID",
                "POS_DELIVERY_PHONE_REQUIRED",
                "POS_DELIVERY_ADDRESS_REQUIRED",
                "POS_DELIVERY_CITY_REQUIRED",
                "POS_CART_EMPTY"
            ].includes(error.code)
                ? 400
                : 409;

        return res.status(status).json({
            ok: false,
            code: error.code || "POS_ORDER_CREATE_FAILED",
            message:
                error.message ||
                "Impossible de créer la commande POS."
        });
    }
}


async function searchCustomers(req, res) {
    try {
        const search = String(req.query?.q || "").trim();
        if (search.length < 2) return res.json({ ok: true, customers: [] });

        const rows = await User.searchCustomersForPos(search, 12);
        const customers = (rows || []).map(customer => ({
            id: Number(customer.id),
            publicId: customer.public_id || null,
            firstName: customer.first_name || "",
            lastName: customer.last_name || "",
            displayName: customer.display_name ||
                [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
                customer.email || customer.phone || `Client #${customer.id}`,
            email: customer.email || "",
            phone: customer.phone || "",
            avatarUrl: customer.avatar_url || null,
            status: customer.status
        }));
        return res.json({ ok: true, customers });
    } catch (error) {
        console.error("[ADMIN POS] Recherche client :", error);
        return res.status(500).json({ ok: false, message: "Impossible de rechercher les clients." });
    }
}

async function customerAddresses(req, res) {
    try {
        const userId = Number(req.params.userId);
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({ ok: false, message: "Client invalide." });
        }

        const addresses = await Order.getPosCustomerAddresses(userId);

        return res.json({
            ok: true,
            addresses: addresses.map(address => ({
                id: Number(address.id),
                label: address.label || "Adresse",
                recipientName: address.recipient_name || "",
                phone: address.phone || "",
                addressLine1: address.address_line1 || "",
                addressLine2: address.address_line2 || "",
                district: address.district || "",
                city: address.city || "Brazzaville",
                countryCode: address.country_code || "CG",
                latitude: address.latitude,
                longitude: address.longitude,
                instructions: address.delivery_instructions || "",
                isDefault: Number(address.is_default) === 1
            }))
        });
    } catch (error) {
        console.error("[ADMIN POS] Adresses client :", error);
        return res.status(500).json({ ok: false, message: "Impossible de charger les adresses du client." });
    }
}

async function deliveryZones(req, res) {
    try {
        const restaurantId = Number(req.params.restaurantId);
        if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
            return res.status(400).json({ok:false,message:"Restaurant invalide."});
        }
        const restaurant = await Order.getRestaurantById(restaurantId);
        if (!restaurant) return res.status(404).json({ok:false,message:"Restaurant indisponible."});
        const zones = await Order.getDeliveryZones(restaurantId);
        return res.json({ok:true,zones:zones.map(zone=>({
            id:Number(zone.id),name:zone.name,
            minOrder:Number(zone.min_order||0),
            deliveryFee:Number(zone.delivery_fee||0),
            freeDeliveryFrom:zone.free_delivery_from == null ? null : Number(zone.free_delivery_from),
            estimatedMinMinutes:Number(zone.estimated_min_minutes||0),
            estimatedMaxMinutes:Number(zone.estimated_max_minutes||0)
        }))});
    } catch(error) {
        console.error("[ADMIN POS] Zones livraison :",error);
        return res.status(500).json({ok:false,message:"Impossible de charger les zones de livraison."});
    }
}

async function productConfiguration(req, res) {
    try {
        const productId = Number(req.params.productId);
        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({ ok:false, message:"Produit invalide." });
        }

        const product = await Product.findByIdForClient(productId);
        if (!product) {
            return res.status(404).json({ ok:false, message:"Produit indisponible." });
        }

        const [groups, images] = await Promise.all([
            ProductOption.findByProductId(productId, true),
            Product.findImagesForClient(productId)
        ]);

        return res.json({
            ok:true,
            product:{
                id:Number(product.id),
                name:product.name,
                description:product.short_description || product.description || "",
                price:Number(product.price || 0),
                currency:product.currency || "XAF",
                image: normalizeImage(images?.[0]?.image_url || null),
                groups:(groups || []).map(group => ({
                    id:Number(group.id),
                    name:group.name,
                    selectionType:String(group.selection_type || "single").toLowerCase(),
                    isRequired:Number(group.is_required) === 1,
                    minChoices:Number(group.min_choices || 0),
                    maxChoices:Number(group.max_choices || 0),
                    options:(group.options || []).map(option => ({
                        id:Number(option.id),
                        name:option.name,
                        priceDelta:Number(option.price_delta || 0),
                        isDefault:Number(option.is_default) === 1
                    }))
                }))
            }
        });
    } catch (error) {
        console.error("[ADMIN POS] Détail produit :", error);
        return res.status(500).json({ok:false,message:"Impossible de charger les options du produit."});
    }
}

async function formulaConfiguration(req, res) {
    try {
        const formulaId = Number(req.params.formulaId);
        if (!Number.isInteger(formulaId) || formulaId <= 0) {
            return res.status(400).json({ok:false,message:"Formule invalide."});
        }

        const formula = await Formula.findByIdForClient(formulaId);
        if (!formula) {
            return res.status(404).json({ok:false,message:"Formule indisponible."});
        }

        const [products, images] = await Promise.all([
            Formula.getProducts(formulaId),
            Formula.getImages(formulaId)
        ]);

        return res.json({
            ok:true,
            formula:{
                id:Number(formula.id),
                name:formula.name,
                description:formula.short_description || formula.description || "",
                price:Number(formula.price || 0),
                currency:formula.currency || "XAF",
                image: normalizeImage(images?.[0]?.image_url || formula.primary_image || null),
                composition:(products || []).map(product => ({
                    productId:Number(product.product_id),
                    name:product.name,
                    description:product.short_description || "",
                    quantity:Number(product.quantity || 1),
                    image:normalizeImage(product.primary_image || null)
                }))
            }
        });
    } catch (error) {
        console.error("[ADMIN POS] Détail formule :", error);
        return res.status(500).json({ok:false,message:"Impossible de charger la composition de la formule."});
    }
}


async function cardPaymentPage(req, res, next) {
    try {
        const reference = normalizePosText(req.params.reference, 60);
        const order = await Order.findForAdminByReference(reference);
        if (!order) return res.status(404).send("Commande introuvable.");

        const payment = await Order.getPaymentByOrderId(order.id);
        if (!payment || payment.method !== "CARD") {
            return res.status(400).send("Cette commande n'utilise pas le paiement par carte.");
        }
        if (payment.status === "PAID") {
            return res.redirect(`/admin/commandes/${encodeURIComponent(reference)}`);
        }

        if (!payment.provider_reference) {
            await PaymentService.initiateStripeCard({paymentId: payment.id, orderReference: reference});
        }

        const freshPayment = await Order.getPaymentByOrderId(order.id);
        if (!freshPayment?.provider_reference) {
            return res.status(409).send("Le PaymentIntent Stripe n'a pas été initialisé.");
        }

        const intent = await StripeService.retrievePaymentIntent(freshPayment.provider_reference);
        const config = StripeService.getConfig();

        return res.render("client/orders/card-payment", {
            title: `Paiement POS ${reference}`,
            layout: "layouts/admin",
            order,
            payment: freshPayment,
            stripePublishableKey: config.publishableKey,
            clientSecret: intent.client_secret,
            stripeStatus: intent.status,
            adminPos: true,
            syncUrl: `/admin/pos/carte/${encodeURIComponent(reference)}/sync`,
            returnUrl: `/admin/pos/carte/${encodeURIComponent(reference)}/retour`,
            successUrl: `/admin/commandes/${encodeURIComponent(reference)}`,
            backUrl: `/admin/commandes/${encodeURIComponent(reference)}`
        });
    } catch (error) {
        console.error("[ADMIN POS] Page Stripe :", error);
        return next(error);
    }
}

async function syncCardPayment(req, res) {
    try {
        const reference = normalizePosText(req.params.reference, 60);
        const order = await Order.findForAdminByReference(reference);
        if (!order) return res.status(404).json({success:false,message:"Commande introuvable."});
        const payment = await Order.getPaymentByOrderId(order.id);
        if (!payment || payment.method !== "CARD") return res.status(400).json({success:false,message:"Paiement carte introuvable."});
        const result = await PaymentService.syncStripeCardPayment(payment);
        return res.json({success:true,stripeStatus:result.stripeStatus,payment:{id:result.payment.id,status:result.payment.status,providerReference:result.payment.provider_reference}});
    } catch (error) {
        console.error("[ADMIN POS] Synchronisation Stripe :", error);
        return res.status(500).json({success:false,message:error.message || "Impossible de vérifier le paiement Stripe."});
    }
}

async function cardReturn(req, res) {
    try {
        const reference = normalizePosText(req.params.reference, 60);
        const order = await Order.findForAdminByReference(reference);
        if (!order) return res.status(404).send("Commande introuvable.");
        const payment = await Order.getPaymentByOrderId(order.id);
        if (!payment || payment.method !== "CARD") return res.status(400).send("Paiement carte introuvable.");
        const returnedIntent = String(req.query.payment_intent || "").trim();
        if (returnedIntent && returnedIntent !== payment.provider_reference) return res.status(400).send("Référence Stripe incohérente.");
        const result = await PaymentService.syncStripeCardPayment(payment);
        if (result.payment.status === "PAID") return res.redirect(`/admin/commandes/${encodeURIComponent(reference)}`);
        return res.redirect(`/admin/pos/carte/${encodeURIComponent(reference)}`);
    } catch (error) {
        console.error("[ADMIN POS] Retour Stripe :", error);
        return res.redirect(`/admin/pos/carte/${encodeURIComponent(req.params.reference || "")}`);
    }
}


async function mobileMoneyPage(req, res, next) {
    try {
        const reference = normalizePosText(req.params.reference, 60);
        const order = await Order.findForAdminByReference(reference);
        if (!order) return res.status(404).send("Commande introuvable.");
        const payment = await Order.getPaymentByOrderId(order.id);
        if (!payment || payment.method !== "MOBILE_MONEY") {
            return res.status(400).send("Cette commande n'utilise pas Mobile Money.");
        }
        if (payment.status === "PAID") {
            return res.redirect(`/admin/commandes/${encodeURIComponent(reference)}`);
        }
        return res.render("admin/operations/mobile-money-payment", {
            title: `Mobile Money POS ${reference}`,
            layout: "layouts/admin",
            order,
            payment,
            defaultPhone: order.delivery_phone || order.guest_phone || order.customer_phone || ""
        });
    } catch (error) {
        console.error("[ADMIN POS] Page Mobile Money :", error);
        return next(error);
    }
}

async function initiateMobileMoney(req, res) {
    try {
        const reference = normalizePosText(req.params.reference, 60);
        const order = await Order.findForAdminByReference(reference);
        if (!order) return res.status(404).json({success:false,message:"Commande introuvable."});
        const payment = await Order.getPaymentByOrderId(order.id);
        if (!payment || payment.method !== "MOBILE_MONEY") {
            return res.status(400).json({success:false,message:"Paiement Mobile Money introuvable."});
        }
        if (payment.status === "PAID") return res.json({success:true,alreadyPaid:true,payment:{status:"PAID"}});
        const payerMsisdn = String(req.body?.momoMsisdn || "").replace(/\D/g, "").slice(0, 15);
        if (payerMsisdn.length < 8 || payerMsisdn.length > 15) {
            return res.status(400).json({success:false,message:"Veuillez renseigner un numéro MTN MoMo valide (8 à 15 chiffres)."});
        }
        const result = await PaymentService.initiateMtnMomo({paymentId:payment.id,orderReference:reference,payerMsisdn});
        return res.json({success:true,initiated:Boolean(result.initiated),reason:result.reason || null,providerReference:result.providerReference || result.payment?.provider_reference || null,payment:{status:result.payment?.status || payment.status}});
    } catch (error) {
        console.error("[ADMIN POS] Initialisation Mobile Money :", error);
        return res.status(500).json({success:false,code:error.code || "MOMO_INIT_ERROR",message:error.message || "Impossible d'initialiser Mobile Money."});
    }
}

async function syncMobileMoney(req, res) {
    try {
        const reference = normalizePosText(req.params.reference, 60);
        const order = await Order.findForAdminByReference(reference);
        if (!order) return res.status(404).json({success:false,message:"Commande introuvable."});
        const payment = await Order.getPaymentByOrderId(order.id);
        if (!payment || payment.method !== "MOBILE_MONEY") return res.status(400).json({success:false,message:"Paiement Mobile Money introuvable."});
        if (payment.status === "PAID") return res.json({success:true,providerStatus:"SUCCESSFUL",payment:{status:"PAID"}});
        if (!payment.provider_reference) return res.json({success:true,providerStatus:"NOT_INITIATED",payment:{status:payment.status}});
        const result = await PaymentService.syncMtnMomoPayment(payment);
        return res.json({success:true,providerStatus:result.providerStatus,providerReason:result.providerResult?.reason || null,payment:{id:result.payment.id,status:result.payment.status,providerReference:result.payment.provider_reference}});
    } catch (error) {
        console.error("[ADMIN POS] Synchronisation Mobile Money :", error);
        return res.status(500).json({success:false,message:error.message || "Impossible de vérifier Mobile Money."});
    }
}

module.exports = { index, calculateCart, createOrder, searchCustomers, customerAddresses, deliveryZones, productConfiguration, formulaConfiguration, cardPaymentPage, syncCardPayment, cardReturn, mobileMoneyPage, initiateMobileMoney, syncMobileMoney };

