const Stripe =
    require("stripe");


/* =========================================================
   STRIPE SERVICE
   TIOPTIOP — 13.8.5

   MODE TEST UNIQUEMENT
========================================================= */


function getConfig() {

    const environment =
        String(
            process.env.STRIPE_ENVIRONMENT || "test"
        )
            .trim()
            .toLowerCase();


    const secretKey =
        String(
            process.env.STRIPE_SECRET_KEY || ""
        ).trim();


    const publishableKey =
        String(
            process.env.STRIPE_PUBLISHABLE_KEY || ""
        ).trim();


    const missing = [];


    if (!secretKey) {
        missing.push("STRIPE_SECRET_KEY");
    }


    if (!publishableKey) {
        missing.push("STRIPE_PUBLISHABLE_KEY");
    }


    if (missing.length) {

        const error =
            new Error(
                `Configuration Stripe incomplète : ${missing.join(", ")}`
            );

        error.code =
            "STRIPE_CONFIG_MISSING";

        throw error;
    }


    if (environment !== "test") {

        const error =
            new Error(
                "13.8 fonctionne uniquement avec STRIPE_ENVIRONMENT=test."
            );

        error.code =
            "STRIPE_LIVE_NOT_ALLOWED";

        throw error;
    }


    if (!secretKey.startsWith("sk_test_")) {

        const error =
            new Error(
                "STRIPE_SECRET_KEY doit commencer par sk_test_."
            );

        error.code =
            "STRIPE_TEST_SECRET_REQUIRED";

        throw error;
    }


    if (!publishableKey.startsWith("pk_test_")) {

        const error =
            new Error(
                "STRIPE_PUBLISHABLE_KEY doit commencer par pk_test_."
            );

        error.code =
            "STRIPE_TEST_PUBLISHABLE_REQUIRED";

        throw error;
    }


    return {
        environment,
        secretKey,
        publishableKey
    };
}


let stripeInstance =
    null;


function getClient() {

    if (stripeInstance) {
        return stripeInstance;
    }


    const config =
        getConfig();


    stripeInstance =
        new Stripe(
            config.secretKey
        );


    return stripeInstance;
}


function maskKey(key) {

    const value =
        String(key || "");


    if (value.length <= 12) {
        return "********";
    }


    return (
        value.slice(0, 8)
        +
        "..."
        +
        value.slice(-4)
    );
}


/* =========================================================
   TEST CONNEXION
========================================================= */

async function testConnection() {

    const config =
        getConfig();

    const stripe =
        getClient();

    const balance =
        await stripe.balance.retrieve();


    return {
        ok: true,

        environment:
            config.environment,

        secretKey:
            maskKey(config.secretKey),

        publishableKey:
            maskKey(config.publishableKey),

        livemode:
            Boolean(balance.livemode)
    };
}


/* =========================================================
   CREATION PAYMENT INTENT

   13.8.4 :
   uniquement paiement par CARTE.
========================================================= */

async function createPaymentIntent({

    amount,
    currency = "xaf",
    orderReference,
    paymentPublicId

}) {

    const stripe =
        getClient();


    const numericAmount =
        Number(amount);


    if (
        !Number.isFinite(numericAmount)
        ||
        numericAmount <= 0
    ) {

        const error =
            new Error(
                "Montant Stripe invalide."
            );

        error.code =
            "STRIPE_AMOUNT_INVALID";

        throw error;
    }


    const reference =
        String(
            orderReference || ""
        ).trim();


    if (!reference) {

        const error =
            new Error(
                "Référence commande obligatoire."
            );

        error.code =
            "STRIPE_ORDER_REFERENCE_REQUIRED";

        throw error;
    }


    const publicId =
        String(
            paymentPublicId || ""
        ).trim();


    if (!publicId) {

        const error =
            new Error(
                "Identifiant public du paiement obligatoire."
            );

        error.code =
            "STRIPE_PAYMENT_PUBLIC_ID_REQUIRED";

        throw error;
    }


    /*
     * XAF est une devise Stripe à zéro décimale :
     * 6500 XAF => amount = 6500.
     */

    const stripeAmount =
        Math.round(
            numericAmount
        );


    const intent =
        await stripe.paymentIntents.create(
            {
                amount:
                    stripeAmount,

                currency:
                    String(currency || "xaf")
                        .trim()
                        .toLowerCase(),

                /*
                 * TiopTiop 13.8 = carte bancaire.
                 * On évite d'afficher d'autres moyens Stripe
                 * dans le Payment Element.
                 */
                payment_method_types: [
                    "card"
                ],

                description:
                    `Commande TiopTiop ${reference}`,

                metadata: {
                    orderReference:
                        reference,

                    paymentPublicId:
                        publicId
                }
            },
            {
                /*
                 * Même paiement local = même PaymentIntent.
                 */
                idempotencyKey:
                    `tioptiop-payment-${publicId}`
            }
        );


    if (
        intent.livemode === true
    ) {

        const error =
            new Error(
                "SECURITE : PaymentIntent Stripe LIVE détecté."
            );

        error.code =
            "STRIPE_LIVE_PAYMENT_BLOCKED";

        throw error;
    }


    return {
        id:
            intent.id,

        status:
            intent.status,

        amount:
            intent.amount,

        currency:
            intent.currency,

        clientSecret:
            intent.client_secret,

        livemode:
            intent.livemode
    };
}


/* =========================================================
   LECTURE PAYMENT INTENT
========================================================= */

async function retrievePaymentIntent(
    paymentIntentId
) {

    const value =
        String(
            paymentIntentId || ""
        ).trim();


    if (!value.startsWith("pi_")) {

        const error =
            new Error(
                "Référence PaymentIntent Stripe invalide."
            );

        error.code =
            "STRIPE_PAYMENT_INTENT_INVALID";

        throw error;
    }


    const intent =
        await getClient()
            .paymentIntents
            .retrieve(
                value
            );


    if (
        intent.livemode === true
    ) {

        const error =
            new Error(
                "SECURITE : PaymentIntent Stripe LIVE détecté."
            );

        error.code =
            "STRIPE_LIVE_PAYMENT_BLOCKED";

        throw error;
    }


    return intent;
}




/* =========================================================
   WEBHOOK STRIPE — 13.8.5
========================================================= */

function getWebhookSecret() {

    const value =
        String(
            process.env.STRIPE_WEBHOOK_SECRET || ""
        ).trim();


    if (!value) {

        const error =
            new Error(
                "STRIPE_WEBHOOK_SECRET est absent du .env."
            );

        error.code =
            "STRIPE_WEBHOOK_SECRET_MISSING";

        throw error;
    }


    if (
        !value.startsWith(
            "whsec_"
        )
    ) {

        const error =
            new Error(
                "STRIPE_WEBHOOK_SECRET doit commencer par whsec_."
            );

        error.code =
            "STRIPE_WEBHOOK_SECRET_INVALID";

        throw error;
    }


    return value;
}


function constructWebhookEvent(
    rawBody,
    signature
) {

    if (
        !Buffer.isBuffer(
            rawBody
        )
    ) {

        const error =
            new Error(
                "Le body brut Stripe est invalide."
            );

        error.code =
            "STRIPE_WEBHOOK_RAW_BODY_REQUIRED";

        throw error;
    }


    const stripeSignature =
        String(
            signature || ""
        ).trim();


    if (!stripeSignature) {

        const error =
            new Error(
                "Header stripe-signature manquant."
            );

        error.code =
            "STRIPE_WEBHOOK_SIGNATURE_MISSING";

        throw error;
    }


    return getClient()
        .webhooks
        .constructEvent(
            rawBody,
            stripeSignature,
            getWebhookSecret()
        );
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

    getConfig,
    getClient,

    testConnection,

    createPaymentIntent,
    retrievePaymentIntent,

    getWebhookSecret,
    constructWebhookEvent
};
