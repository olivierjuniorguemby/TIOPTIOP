const Stripe =
    require("stripe");


/* =========================================================
   STRIPE SERVICE
   TIOPTIOP — 13.8.3
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
   CRÉATION PAYMENT INTENT
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


    /*
     * XAF est une devise sans décimales dans notre
     * application : 6000 XAF => amount: 6000.
     *
     * Math.round protège également contre l'envoi
     * accidentel d'une valeur décimale.
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

                automatic_payment_methods: {
                    enabled: true
                },

                description:
                    `Commande TiopTiop ${reference}`,

                metadata: {
                    orderReference:
                        reference,

                    paymentPublicId:
                        String(
                            paymentPublicId || ""
                        )
                }
            },
            {
                /*
                 * Protection contre une création
                 * accidentelle en double.
                 */
                idempotencyKey:
                    `tioptiop-payment-${paymentPublicId}`
            }
        );


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


    return getClient()
        .paymentIntents
        .retrieve(
            value
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
    retrievePaymentIntent
};