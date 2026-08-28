const Stripe = require("stripe");

function getConfig() {
    const environment = String(process.env.STRIPE_ENVIRONMENT || "test").trim().toLowerCase();
    if (!["test","live"].includes(environment)) {
        const error = new Error("STRIPE_ENVIRONMENT doit valoir test ou live.");
        error.code = "STRIPE_ENVIRONMENT_INVALID";
        throw error;
    }

    const secretKey = String(process.env.STRIPE_SECRET_KEY || "").trim();
    const publishableKey = String(process.env.STRIPE_PUBLISHABLE_KEY || "").trim();
    const liveEnabled = String(process.env.STRIPE_LIVE_ENABLED || "false").trim().toLowerCase() === "true";

    const missing=[];
    if (!secretKey) missing.push("STRIPE_SECRET_KEY");
    if (!publishableKey) missing.push("STRIPE_PUBLISHABLE_KEY");
    if (missing.length) {
        const error = new Error(`Configuration Stripe incomplète : ${missing.join(", ")}`);
        error.code = "STRIPE_CONFIG_MISSING";
        throw error;
    }

    if (environment === "test") {
        if (!secretKey.startsWith("sk_test_")) { const e=new Error("En mode TEST, STRIPE_SECRET_KEY doit commencer par sk_test_."); e.code="STRIPE_TEST_SECRET_REQUIRED"; throw e; }
        if (!publishableKey.startsWith("pk_test_")) { const e=new Error("En mode TEST, STRIPE_PUBLISHABLE_KEY doit commencer par pk_test_."); e.code="STRIPE_TEST_PUBLISHABLE_REQUIRED"; throw e; }
    }

    if (environment === "live") {
        if (!liveEnabled) { const e=new Error("Stripe LIVE est désactivé. STRIPE_LIVE_ENABLED doit être explicitement true."); e.code="STRIPE_LIVE_DISABLED"; throw e; }
        if (!secretKey.startsWith("sk_live_")) { const e=new Error("En mode LIVE, STRIPE_SECRET_KEY doit commencer par sk_live_."); e.code="STRIPE_LIVE_SECRET_REQUIRED"; throw e; }
        if (!publishableKey.startsWith("pk_live_")) { const e=new Error("En mode LIVE, STRIPE_PUBLISHABLE_KEY doit commencer par pk_live_."); e.code="STRIPE_LIVE_PUBLISHABLE_REQUIRED"; throw e; }
    }

    return {environment,secretKey,publishableKey,liveEnabled};
}

let stripeInstance=null;
let stripeInstanceKey=null;

function getClient() {
    const config=getConfig();
    if (stripeInstance && stripeInstanceKey===config.secretKey) return stripeInstance;
    stripeInstance=new Stripe(config.secretKey);
    stripeInstanceKey=config.secretKey;
    return stripeInstance;
}

function maskKey(key) {
    const value=String(key || "");
    if (value.length<=12) return "********";
    return value.slice(0,8)+"..."+value.slice(-4);
}

function assertStripeObjectMode(livemode) {
    const config=getConfig();
    const isLive=Boolean(livemode);
    if (config.environment==="test" && isLive) { const e=new Error("SECURITE : un objet Stripe LIVE a été reçu alors que TiopTiop est en TEST."); e.code="STRIPE_LIVE_OBJECT_BLOCKED"; throw e; }
    if (config.environment==="live" && !isLive) { const e=new Error("SECURITE : un objet Stripe TEST a été reçu alors que TiopTiop est en LIVE."); e.code="STRIPE_TEST_OBJECT_BLOCKED"; throw e; }
    return true;
}

async function testConnection() {
    const config=getConfig();
    const balance=await getClient().balance.retrieve();
    assertStripeObjectMode(balance.livemode);
    return {ok:true,environment:config.environment,liveEnabled:config.liveEnabled,secretKey:maskKey(config.secretKey),publishableKey:maskKey(config.publishableKey),livemode:Boolean(balance.livemode)};
}

async function createPaymentIntent({amount,currency="xaf",orderReference,paymentPublicId}) {
    const numericAmount=Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount<=0) { const e=new Error("Montant Stripe invalide."); e.code="STRIPE_AMOUNT_INVALID"; throw e; }
    const reference=String(orderReference || "").trim();
    if (!reference) { const e=new Error("Référence commande obligatoire."); e.code="STRIPE_ORDER_REFERENCE_REQUIRED"; throw e; }
    const publicId=String(paymentPublicId || "").trim();
    if (!publicId) { const e=new Error("Identifiant public du paiement obligatoire."); e.code="STRIPE_PAYMENT_PUBLIC_ID_REQUIRED"; throw e; }
    const intent=await getClient().paymentIntents.create({
        amount:Math.round(numericAmount),
        currency:String(currency || "xaf").trim().toLowerCase(),
        payment_method_types:["card"],
        description:`Commande TiopTiop ${reference}`,
        metadata:{orderReference:reference,paymentPublicId:publicId}
    },{idempotencyKey:`tioptiop-payment-${publicId}`});
    assertStripeObjectMode(intent.livemode);
    return {id:intent.id,status:intent.status,amount:intent.amount,currency:intent.currency,clientSecret:intent.client_secret,livemode:intent.livemode};
}

async function retrievePaymentIntent(paymentIntentId) {
    const value=String(paymentIntentId || "").trim();
    if (!value.startsWith("pi_")) { const e=new Error("Référence PaymentIntent Stripe invalide."); e.code="STRIPE_PAYMENT_INTENT_INVALID"; throw e; }
    const intent=await getClient().paymentIntents.retrieve(value);
    assertStripeObjectMode(intent.livemode);
    return intent;
}

async function retrieveEvent(stripeEventId) {
    const value=String(stripeEventId || "").trim();
    if (!value.startsWith("evt_")) { const e=new Error("Identifiant événement Stripe invalide."); e.code="STRIPE_EVENT_INVALID"; throw e; }
    const event=await getClient().events.retrieve(value);
    assertStripeObjectMode(event.livemode);
    return event;
}

function getWebhookSecret() {
    const value=String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
    if (!value) { const e=new Error("STRIPE_WEBHOOK_SECRET est absent du .env."); e.code="STRIPE_WEBHOOK_SECRET_MISSING"; throw e; }
    if (!value.startsWith("whsec_")) { const e=new Error("STRIPE_WEBHOOK_SECRET doit commencer par whsec_."); e.code="STRIPE_WEBHOOK_SECRET_INVALID"; throw e; }
    return value;
}

function constructWebhookEvent(rawBody,signature) {
    if (!Buffer.isBuffer(rawBody)) { const e=new Error("Le body brut Stripe est invalide."); e.code="STRIPE_WEBHOOK_RAW_BODY_REQUIRED"; throw e; }
    const stripeSignature=String(signature || "").trim();
    if (!stripeSignature) { const e=new Error("Header stripe-signature manquant."); e.code="STRIPE_WEBHOOK_SIGNATURE_MISSING"; throw e; }
    const event=getClient().webhooks.constructEvent(rawBody,stripeSignature,getWebhookSecret());
    assertStripeObjectMode(event.livemode);
    return event;
}


/* =========================================================
   STRIPE REFUNDS — 13.9.4.3
========================================================= */

async function createRefund({
    paymentIntentId,
    amount,
    reason = null,
    refundPublicId,
    paymentId,
    idempotencyKey
}) {
    const config = getConfig();

    /*
     * 13.9.4.3 est volontairement TEST ONLY.
     * Même si le projet sait préparer LIVE, cette fonction
     * refuse explicitement l'environnement live.
     */
    if (config.environment !== "test") {
        const error = new Error(
            "SECURITE : les remboursements 13.9.4.3 sont autorisés uniquement en Stripe TEST."
        );
        error.code = "STRIPE_REFUND_TEST_ONLY";
        throw error;
    }

    const intentId = String(paymentIntentId || "").trim();

    if (!intentId.startsWith("pi_")) {
        const error = new Error(
            "PaymentIntent Stripe invalide pour le remboursement."
        );
        error.code = "STRIPE_REFUND_PAYMENT_INTENT_INVALID";
        throw error;
    }

    const numericAmount = Number(amount);

    if (
        !Number.isFinite(numericAmount)
        ||
        numericAmount <= 0
    ) {
        const error = new Error(
            "Montant Stripe Refund invalide."
        );
        error.code = "STRIPE_REFUND_AMOUNT_INVALID";
        throw error;
    }

    const key = String(idempotencyKey || "").trim();

    if (!key) {
        const error = new Error(
            "Clé d'idempotence Stripe Refund obligatoire."
        );
        error.code = "STRIPE_REFUND_IDEMPOTENCY_REQUIRED";
        throw error;
    }

    const params = {
        payment_intent: intentId,
        amount: Math.round(numericAmount),

        metadata: {
            tioptiopRefundPublicId:
                String(refundPublicId || ""),

            tioptiopPaymentId:
                String(paymentId || "")
        }
    };

    if (
        [
            "duplicate",
            "fraudulent",
            "requested_by_customer"
        ].includes(reason)
    ) {
        params.reason = reason;
    }

    const refund = await getClient()
        .refunds
        .create(
            params,
            {
                idempotencyKey: key
            }
        );

    assertStripeObjectMode(
        refund.livemode
    );

    return refund;
}

async function retrieveRefund(refundId) {
    const value = String(refundId || "").trim();

    if (!value.startsWith("re_")) {
        const error = new Error(
            "Référence Stripe Refund invalide."
        );
        error.code = "STRIPE_REFUND_ID_INVALID";
        throw error;
    }

    const refund = await getClient()
        .refunds
        .retrieve(value);

    assertStripeObjectMode(
        refund.livemode
    );

    return refund;
}


async function findRefundForRecovery({paymentIntentId, refundPublicId}) {
    const intentId = String(paymentIntentId || "").trim();
    const publicId = String(refundPublicId || "").trim();
    if (!intentId.startsWith("pi_") || !publicId) return null;

    const refunds = await getClient().refunds.list({
        payment_intent: intentId,
        limit: 100
    });

    for (const refund of refunds.data || []) {
        assertStripeObjectMode(refund.livemode);
        if (String(refund.metadata?.tioptiopRefundPublicId || "") === publicId) {
            return refund;
        }
    }
    return null;
}

module.exports={getConfig,getClient,maskKey,assertStripeObjectMode,testConnection,createPaymentIntent,retrievePaymentIntent,retrieveEvent,getWebhookSecret,constructWebhookEvent,createRefund,retrieveRefund,findRefundForRecovery};
