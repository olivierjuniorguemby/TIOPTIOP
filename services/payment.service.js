const crypto =
    require("crypto");


const Payment =
    require("../models/payment.model");


const MtnMomo =
    require("./mtn-momo.service");

const StripeService =
    require("./stripe.service");

const Loyalty =
    require("../models/loyalty.model");

const LoyaltyCard =
    require("../models/loyalty-card.model");

/* =========================================================
   PAYMENT SERVICE
   TIOPTIOP — 13.8.6
========================================================= */


async function getPaymentForOrder(
    orderId
) {

    return Payment.findLatestByOrderId(
        orderId
    );
}


/* =========================================================
   STATUTS LOCAUX
========================================================= */

async function markPaid(
    paymentId,
    metadata = null
) {

    const payment =
        await Payment.findById(
            paymentId
        );


    if (!payment) {

        throw new Error(
            "Paiement introuvable."
        );
    }


    if (
        [
            Payment.STATUSES.PAID,
            Payment.STATUSES.PARTIAL,
            Payment.STATUSES.REFUNDED
        ].includes(
            payment.status
        )
    ) {

        return payment;
    }


    const updated =
        await Payment.updateStatus(
            payment.id,
            Payment.STATUSES.PAID
        );


    await Payment.addEvent({

        paymentId:
            payment.id,

        eventType:
            "PAYMENT_PAID",

        description:
            "Paiement confirmé côté serveur.",

        payload:
            metadata
    });

    // 16.7 — Le paiement confirmé rend l'avantage réservé définitivement USED.
    // Une panne fidélité ne doit jamais annuler un paiement provider déjà confirmé.
    try {
        await Loyalty.finalizeOrderRedemption(payment.order_id, 'PAYMENT_CONFIRMED');
        await LoyaltyCard.finalizeOrderRedemption(payment.order_id);
    } catch (loyaltyLifecycleError) {
        console.error('[TIOP+ 16.7] Finalisation avantage impossible :', loyaltyLifecycleError);
    }

    // 16.10.5 — carte physique prioritaire; sinon compte Tiop+ classique.
    try {
        const cardResult = await LoyaltyCard.awardPaidOrder(payment.id);
        const loyaltyResult = cardResult?.reason === "NO_PHYSICAL_CARD"
            ? await Loyalty.awardPaidOrder(payment.id)
            : cardResult;
        if (loyaltyResult?.credited) {
            await Payment.addEvent({
                paymentId: payment.id,
                eventType: "LOYALTY_POINTS_EARNED",
                description: `${loyaltyResult.points} point(s) Tiop+ crédité(s).`,
                payload: loyaltyResult
            });
        }
    } catch (loyaltyError) {
        console.error("[TIOP+ 16.10.5] Crédit des points impossible :", loyaltyError);
    }

    return updated;
}


async function markAuthorized(
    paymentId,
    metadata = null
) {

    const payment =
        await Payment.findById(
            paymentId
        );


    if (!payment) {

        throw new Error(
            "Paiement introuvable."
        );
    }


    if (
        payment.status ===
        Payment.STATUSES.AUTHORIZED
    ) {

        return payment;
    }


    if (
        [
            Payment.STATUSES.PAID,
            Payment.STATUSES.PARTIAL,
            Payment.STATUSES.REFUNDED,
            Payment.STATUSES.CANCELLED
        ].includes(
            payment.status
        )
    ) {

        return payment;
    }


    const updated =
        await Payment.updateStatus(
            paymentId,
            Payment.STATUSES.AUTHORIZED
        );


    await Payment.addEvent({

        paymentId,

        eventType:
            "PAYMENT_AUTHORIZED",

        description:
            "Paiement autorisé.",

        payload:
            metadata
    });


    return updated;
}


async function markPending(paymentId, metadata = null) {
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new Error("Paiement introuvable.");
    if ([Payment.STATUSES.PAID,Payment.STATUSES.PARTIAL,Payment.STATUSES.CANCELLED,Payment.STATUSES.REFUNDED].includes(payment.status)) return payment;
    if (payment.status===Payment.STATUSES.PENDING) return payment;
    const updated=await Payment.updateStatus(payment.id,Payment.STATUSES.PENDING);
    await Payment.addEvent({paymentId:payment.id,eventType:"PAYMENT_PENDING",description:"Paiement remis en attente.",payload:metadata});
    return updated;
}


async function markFailed(
    paymentId,
    metadata = null
) {

    const payment =
        await Payment.findById(
            paymentId
        );


    if (!payment) {

        throw new Error(
            "Paiement introuvable."
        );
    }


    if (
        payment.status ===
        Payment.STATUSES.FAILED
    ) {

        return payment;
    }


    if (
        [
            Payment.STATUSES.PAID,
            Payment.STATUSES.PARTIAL,
            Payment.STATUSES.CANCELLED,
            Payment.STATUSES.REFUNDED
        ].includes(payment.status)
    ) {
        return payment;
    }


    const updated =
        await Payment.updateStatus(
            paymentId,
            Payment.STATUSES.FAILED
        );


    await Payment.addEvent({

        paymentId,

        eventType:
            "PAYMENT_FAILED",

        description:
            "Paiement échoué.",

        payload:
            metadata
    });


    return updated;
}


async function cancel(
    paymentId,
    metadata = null
) {

    const payment =
        await Payment.findById(
            paymentId
        );


    if (!payment) {

        throw new Error(
            "Paiement introuvable."
        );
    }


    if (
        [
            Payment.STATUSES.PAID,
            Payment.STATUSES.PARTIAL,
            Payment.STATUSES.REFUNDED
        ].includes(
            payment.status
        )
    ) {

        throw new Error(
            "Un paiement encaissé ou remboursé ne peut plus être annulé."
        );
    }


    if (
        payment.status ===
        Payment.STATUSES.CANCELLED
    ) {

        return payment;
    }


    const updated =
        await Payment.updateStatus(
            payment.id,
            Payment.STATUSES.CANCELLED
        );


    await Payment.addEvent({

        paymentId:
            payment.id,

        eventType:
            "PAYMENT_CANCELLED",

        description:
            "Paiement annulé.",

        payload:
            metadata
    });


    return updated;
}


/* =========================================================
   OUTILS
========================================================= */

function maskMsisdn(
    value
) {

    const digits =
        String(
            value || ""
        )
            .replace(
                /\D/g,
                ""
            );


    if (
        digits.length <= 4
    ) {

        return "****";
    }


    return (
        "*".repeat(
            Math.max(
                4,
                digits.length - 4
            )
        )
        +
        digits.slice(
            -4
        )
    );
}


/* =========================================================
   MTN MOMO - INITIATION
========================================================= */

async function initiateMtnMomo({
    paymentId,
    orderReference,
    payerMsisdn
}) {

    const payment =
        await Payment.findById(
            paymentId
        );


    if (!payment) {

        throw new Error(
            "Paiement introuvable."
        );
    }


    if (
        payment.method !==
        Payment.METHODS.MOBILE_MONEY
    ) {

        throw new Error(
            "Ce paiement n'est pas un paiement Mobile Money."
        );
    }


    if (
        payment.status !==
        Payment.STATUSES.PENDING
    ) {

        return {

            payment,

            initiated:
                false,

            reason:
                "PAYMENT_NOT_PENDING"
        };
    }


    if (
        payment.provider_reference
    ) {

        return {

            payment,

            initiated:
                false,

            reason:
                "ALREADY_INITIATED",

            providerReference:
                payment.provider_reference
        };
    }


    const providerReference =
        MtnMomo.createRequestReference();


    await Payment.setProvider({

        paymentId:
            payment.id,

        provider:
            Payment.PROVIDERS.MOBILE_MONEY,

        providerReference
    });


    await Payment.addEvent({

        paymentId:
            payment.id,

        eventType:
            "MTN_MOMO_REQUEST_CREATED",

        description:
            "Préparation d'une RequestToPay MTN MoMo Sandbox.",

        payload: {

            providerReference,

            orderReference,

            payer:
                maskMsisdn(
                    payerMsisdn
                )
        }
    });


    try {

        const result =
            await MtnMomo.requestToPay({

                referenceId:
                    providerReference,

                externalId:
                    orderReference,

                payerMsisdn,

                payerMessage:
                    `Commande ${orderReference}`,

                payeeNote:
                    "Paiement TiopTiop"
            });


        await Payment.addEvent({

            paymentId:
                payment.id,

            eventType:
                "MTN_MOMO_REQUEST_ACCEPTED",

            description:
                "RequestToPay acceptée par MTN MoMo Sandbox (HTTP 202).",

            payload: {

                providerReference:
                    result.referenceId,

                httpStatus:
                    result.httpStatus,

                sandboxAmount:
                    result.sandboxAmount,

                sandboxCurrency:
                    result.sandboxCurrency
            }
        });


        return {

            payment:
                await Payment.findById(
                    payment.id
                ),

            initiated:
                true,

            providerReference,

            providerStatus:
                "PENDING"
        };
    }
    catch (error) {

        await Payment.addEvent({

            paymentId:
                payment.id,

            eventType:
                "MTN_MOMO_REQUEST_ERROR",

            description:
                "Erreur lors de RequestToPay MTN MoMo.",

            payload: {

                code:
                    error.code
                    ||
                    null,

                httpStatus:
                    error.httpStatus
                    ||
                    null,

                message:
                    error.message,

                providerBody:
                    error.providerBody
                    ||
                    null
            }
        });


        throw error;
    }
}


/* =========================================================
   MTN MOMO - SYNCHRONISATION
========================================================= */

async function syncMtnMomoPayment(
    paymentOrId
) {

    const payment =
        typeof paymentOrId ===
        "object"

            ? paymentOrId

            : await Payment.findById(
                paymentOrId
            );


    if (!payment) {

        throw new Error(
            "Paiement introuvable."
        );
    }


    if (
        payment.method !==
        Payment.METHODS.MOBILE_MONEY
    ) {

        throw new Error(
            "Ce paiement n'est pas un paiement MTN MoMo."
        );
    }


    if (
        !payment.provider_reference
    ) {

        throw new Error(
            "Le paiement MTN MoMo n'a pas encore de référence provider."
        );
    }


    const providerResult =
        await MtnMomo.getRequestToPayStatus(
            payment.provider_reference
        );


    const providerStatus =
        String(
            providerResult.status
            ||
            ""
        )
            .trim()
            .toUpperCase();


    await Payment.addEvent({

        paymentId:
            payment.id,

        eventType:
            "MTN_MOMO_STATUS_CHECKED",

        description:
            "Statut RequestToPay vérifié auprès de MTN MoMo.",

        payload: {

            providerReference:
                payment.provider_reference,

            providerStatus,

            financialTransactionId:
                providerResult.financialTransactionId
                ||
                null,

            reason:
                providerResult.reason
                ||
                null
        }
    });


    if (
        providerStatus ===
        "SUCCESSFUL"
    ) {

        return {

            providerStatus,

            providerResult,

            payment:
                await markPaid(
                    payment.id,
                    {

                        provider:
                            "MTN_MOMO",

                        providerStatus,

                        providerReference:
                            payment.provider_reference,

                        financialTransactionId:
                            providerResult.financialTransactionId
                            ||
                            null
                    }
                )
        };
    }


    if (
        [
            "FAILED",
            "REJECTED",
            "EXPIRED"
        ].includes(
            providerStatus
        )
    ) {

        return {

            providerStatus,

            providerResult,

            payment:
                await markFailed(
                    payment.id,
                    {

                        provider:
                            "MTN_MOMO",

                        providerStatus,

                        providerReference:
                            payment.provider_reference,

                        reason:
                            providerResult.reason
                            ||
                            null
                    }
                )
        };
    }


    /*
     * PENDING / ONGOING / DELAYED :
     * on garde PENDING localement.
     */
    return {

        providerStatus:
            providerStatus
            ||
            "PENDING",

        providerResult,

        payment:
            await Payment.findById(
                payment.id
            )
    };
}


/* =========================================================
   CALLBACK MTN MOMO
========================================================= */

async function handleMtnMomoCallback({
    referenceId = null,
    externalId = null,
    payload = null
}) {

    let payment =
        null;


    if (
        referenceId
    ) {

        payment =
            await Payment.findByProviderReference(
                referenceId
            );
    }


    if (
        !payment
        &&
        externalId
    ) {

        payment =
            await Payment.findLatestByOrderReference(
                externalId
            );
    }


    if (!payment) {

        const error =
            new Error(
                "Paiement du callback MTN MoMo introuvable."
            );


        error.code =
            "MTN_MOMO_CALLBACK_PAYMENT_NOT_FOUND";


        throw error;
    }


    await Payment.addEvent({

        paymentId:
            payment.id,

        eventType:
            "MTN_MOMO_CALLBACK_RECEIVED",

        description:
            "Callback MTN MoMo reçu. Vérification du statut auprès de MTN.",

        payload: {

            referenceId:
                referenceId
                ||
                null,

            externalId:
                externalId
                ||
                null,

            status:
                payload?.status
                ||
                null,

            reason:
                payload?.reason
                ||
                null
        }
    });


    return syncMtnMomoPayment(
        payment
    );
}


/* =========================================================
   RETRY MTN MOMO
========================================================= */

async function retryMtnMomo({
    order,
    payerMsisdn
}) {

    if (
        !order
        ||
        !Number.isInteger(
            Number(
                order.id
            )
        )
    ) {

        throw new Error(
            "Commande invalide."
        );
    }


    let latest =
        await Payment.findLatestByOrderId(
            order.id
        );


    if (!latest) {

        throw new Error(
            "Paiement introuvable."
        );
    }


    /*
     * Si l'ancienne tentative est PENDING,
     * on la synchronise d'abord pour éviter
     * un double paiement.
     */
    if (
        latest.status ===
        Payment.STATUSES.PENDING
        &&
        latest.method ===
        Payment.METHODS.MOBILE_MONEY
        &&
        latest.provider_reference
    ) {

        try {

            const sync =
                await syncMtnMomoPayment(
                    latest
                );


            latest =
                sync.payment
                ||
                latest;
        }
        catch (error) {

            const retryError =
                new Error(
                    "Impossible de vérifier la tentative en attente. Réessayez dans quelques instants."
                );


            retryError.code =
                "PAYMENT_PENDING_UNVERIFIED";


            throw retryError;
        }
    }


    if (
        latest.status ===
        Payment.STATUSES.PAID
    ) {

        const error =
            new Error(
                "Cette commande est déjà payée."
            );


        error.code =
            "PAYMENT_ALREADY_PAID";


        throw error;
    }


    if (
        latest.status ===
        Payment.STATUSES.PENDING
    ) {

        const error =
            new Error(
                "Le paiement est toujours en attente. Une nouvelle demande ne sera pas envoyée."
            );


        error.code =
            "PAYMENT_ALREADY_PENDING";


        throw error;
    }


    if (
        ![
            Payment.STATUSES.FAILED,
            Payment.STATUSES.CANCELLED
        ].includes(
            latest.status
        )
    ) {

        const error =
            new Error(
                "Ce paiement ne peut pas encore être relancé."
            );


        error.code =
            "PAYMENT_RETRY_NOT_ALLOWED";


        throw error;
    }


    if (
        typeof Payment.createRetryAttempt !==
        "function"
    ) {

        const error =
            new Error(
                "Payment.createRetryAttempt() est absent du payment.model.js 13.7.4."
            );


        error.code =
            "PAYMENT_RETRY_MODEL_MISSING";


        throw error;
    }


    const retry =
        await Payment.createRetryAttempt({

            orderId:
                Number(
                    order.id
                ),

            publicId:
                crypto.randomUUID()
        });


    await initiateMtnMomo({

        paymentId:
            retry.payment.id,

        orderReference:
            order.reference,

        payerMsisdn
    });


    return {

        previousPayment:
            retry.previousPayment,

        payment:
            await Payment.findById(
                retry.payment.id
            )
    };
}


/* =========================================================
   RECONCILIATION DES PAIEMENTS MTN MOMO PENDING
========================================================= */

async function reconcilePendingMtnMomo({
    limit = 50
} = {}) {

    if (
        typeof Payment.findPendingMtnMomo !==
        "function"
    ) {

        const error =
            new Error(
                "Payment.findPendingMtnMomo() est absent du payment.model.js 13.7.4."
            );


        error.code =
            "PAYMENT_RECONCILIATION_MODEL_MISSING";


        throw error;
    }


    const payments =
        await Payment.findPendingMtnMomo(
            limit
        );


    const summary = {

        checked:
            0,

        paid:
            0,

        failed:
            0,

        pending:
            0,

        notFound:
            0,

        errors:
            0
    };


    for (
        const payment
        of payments
    ) {

        summary.checked++;


        try {

            const result =
                await syncMtnMomoPayment(
                    payment
                );


            const localStatus =
                String(
                    result.payment?.status
                    ||
                    ""
                )
                    .trim()
                    .toUpperCase();


            if (
                localStatus ===
                Payment.STATUSES.PAID
            ) {

                summary.paid++;
            }
            else if (
                localStatus ===
                Payment.STATUSES.FAILED
            ) {

                summary.failed++;
            }
            else {

                summary.pending++;
            }
        }
        catch (error) {

            /*
             * 13.9.5.3 FIX
             * Un 404 du provider signifie que la référence n'est plus
             * retrouvée côté MTN (souvent ancienne donnée Sandbox).
             * On NE transforme pas automatiquement le paiement en FAILED :
             * l'absence de ressource ne prouve pas un échec financier.
             * On le classe séparément comme "notFound" pour intervention.
             */
            if (Number(error?.httpStatus) === 404) {
                summary.notFound++;

                console.warn(
                    `[MTN MoMo] Réconciliation payment ${payment.id} : référence provider introuvable (404), paiement local conservé ${payment.status}.`
                );

                continue;
            }

            summary.errors++;

            console.error(
                `[MTN MoMo] Réconciliation payment ${payment.id} :`,
                error.message
            );
        }
    }


    return summary;
}

/* =========================================================
   STRIPE CARD — 13.8.3
   CREATION DU PAYMENT INTENT
========================================================= */

async function initiateStripeCard({
    paymentId,
    orderReference
}) {

    const payment =
        await Payment.findById(
            paymentId
        );


    if (!payment) {

        throw new Error(
            "Paiement introuvable."
        );
    }


    if (
        payment.method !==
        Payment.METHODS.CARD
    ) {

        const error =
            new Error(
                "Ce paiement n'est pas un paiement par carte."
            );

        error.code =
            "PAYMENT_NOT_CARD";

        throw error;
    }


    if (
        payment.status !==
        Payment.STATUSES.PENDING
    ) {

        return {
            payment,
            initiated: false,
            reason: "PAYMENT_NOT_PENDING"
        };
    }


    /*
     * Si un PaymentIntent existe déjà,
     * surtout ne pas en créer un deuxième.
     */

    if (
        payment.provider_reference
    ) {

        return {
            payment,
            initiated: false,
            reason: "ALREADY_INITIATED",

            providerReference:
                payment.provider_reference
        };
    }


    await Payment.addEvent({

        paymentId:
            payment.id,

        eventType:
            "STRIPE_PAYMENT_INTENT_REQUESTED",

        description:
            "Préparation d'un PaymentIntent Stripe TEST.",

        payload: {
            orderReference,
            amount:
                payment.amount,

            currency:
                payment.currency
        }
    });


    try {

        const result =
            await StripeService
                .createPaymentIntent({

                    amount:
                        payment.amount,

                    currency:
                        payment.currency || "XAF",

                    orderReference,

                    paymentPublicId:
                        payment.public_id
                });


        /*
         * Sécurité absolue :
         * un PaymentIntent LIVE ne doit jamais
         * entrer dans notre environnement 13.8.
         */

        if (
            result.livemode === true
        ) {

            const error =
                new Error(
                    "SECURITE : PaymentIntent Stripe LIVE détecté."
                );

            error.code =
                "STRIPE_LIVE_PAYMENT_BLOCKED";

            throw error;
        }


        await Payment.setProvider({

            paymentId:
                payment.id,

            provider:
                Payment.PROVIDERS.CARD,

            providerReference:
                result.id
        });


        await Payment.addEvent({

            paymentId:
                payment.id,

            eventType:
                "STRIPE_PAYMENT_INTENT_CREATED",

            description:
                "PaymentIntent Stripe TEST créé.",

            payload: {

                providerReference:
                    result.id,

                stripeStatus:
                    result.status,

                amount:
                    result.amount,

                currency:
                    result.currency,

                livemode:
                    result.livemode
            }
        });


        return {

            payment:
                await Payment.findById(
                    payment.id
                ),

            initiated:
                true,

            providerReference:
                result.id,

            providerStatus:
                result.status,

            clientSecret:
                result.clientSecret
        };
    }
    catch (error) {

        await Payment.addEvent({

            paymentId:
                payment.id,

            eventType:
                "STRIPE_PAYMENT_INTENT_ERROR",

            description:
                "Erreur création PaymentIntent Stripe.",

            payload: {

                code:
                    error.code || null,

                type:
                    error.type || null,

                message:
                    error.message
            }
        });


        throw error;
    }
}





function normalizeCurrency(value) { return String(value || "").trim().toUpperCase(); }

function expectedLocalStripeStatus(intent) {
    const s=String(intent?.status || "").trim().toLowerCase();
    if (s==="succeeded") return Payment.STATUSES.PAID;
    if (s==="canceled") return Payment.STATUSES.CANCELLED;
    if (s==="requires_capture") return Payment.STATUSES.AUTHORIZED;
    if (s==="requires_payment_method" && intent?.last_payment_error) return Payment.STATUSES.FAILED;
    if (["requires_payment_method","requires_confirmation","requires_action","processing"].includes(s)) return Payment.STATUSES.PENDING;
    return null;
}

function assertStripePaymentConsistency(payment,intent) {
    const issues=[];
    if (String(intent.id || "")!==String(payment.provider_reference || "")) issues.push("provider_reference");
    if (Math.round(Number(payment.amount || 0))!==Number(intent.amount || 0)) issues.push("amount");
    if (normalizeCurrency(payment.currency)!==normalizeCurrency(intent.currency)) issues.push("currency");
    if (payment.order_total_amount!==undefined && Math.round(Number(payment.order_total_amount || 0))!==Number(intent.amount || 0)) issues.push("order_total_amount");
    if (payment.order_currency && normalizeCurrency(payment.order_currency)!==normalizeCurrency(intent.currency)) issues.push("order_currency");
    const metadata=intent.metadata || {};
    if (metadata.paymentPublicId && String(metadata.paymentPublicId)!==String(payment.public_id || "")) issues.push("metadata.paymentPublicId");
    if (payment.order_reference && metadata.orderReference && String(metadata.orderReference)!==String(payment.order_reference)) issues.push("metadata.orderReference");
    if (issues.length) { const e=new Error(`Incohérence Stripe/TiopTiop : ${issues.join(", ")}`); e.code="STRIPE_PAYMENT_CONSISTENCY_ERROR"; e.issues=issues; throw e; }
    return true;
}

async function applyStripeIntentState(payment,intent,metadata={}) {
    const s=String(intent?.status || "").trim().toLowerCase();
    const err=intent?.last_payment_error || null;
    const common={provider:"STRIPE",providerStatus:s,providerReference:intent?.id || payment.provider_reference,...metadata};
    if (s==="succeeded") return markPaid(payment.id,{...common,paymentMethodId:intent.payment_method || null});
    if (s==="canceled") return cancel(payment.id,{...common,cancellationReason:intent.cancellation_reason || null});
    if (s==="requires_capture") return markAuthorized(payment.id,common);
    if (s==="requires_payment_method" && err) return markFailed(payment.id,{...common,code:err.code || null,declineCode:err.decline_code || null,message:err.message || null});
    if (["requires_payment_method","requires_confirmation","requires_action","processing"].includes(s)) return markPending(payment.id,common);
    return Payment.findById(payment.id);
}

/* =========================================================
   STRIPE CARD — 13.8.6
   SYNCHRONISATION DEFINITIVE
========================================================= */

async function syncStripeCardPayment(paymentOrId) {
    let payment = typeof paymentOrId === "object" ? paymentOrId : await Payment.findById(paymentOrId);
    if (!payment) throw new Error("Paiement introuvable.");
    if (payment.method!==Payment.METHODS.CARD) { const e=new Error("Ce paiement n'est pas un paiement par carte."); e.code="PAYMENT_NOT_CARD"; throw e; }
    if (!payment.provider_reference) { const e=new Error("Le paiement Stripe ne possède pas encore de PaymentIntent."); e.code="STRIPE_PAYMENT_INTENT_MISSING"; throw e; }
    const context=await Payment.findStripeContextByProviderReference(payment.provider_reference);
    if (context) payment=context;
    const intent=await StripeService.retrievePaymentIntent(payment.provider_reference);
    assertStripePaymentConsistency(payment,intent);
    const stripeStatus=String(intent.status || "").trim().toLowerCase();
    await Payment.addEvent({paymentId:payment.id,eventType:"STRIPE_STATUS_CHECKED",description:"Statut PaymentIntent vérifié auprès de Stripe.",payload:{providerReference:intent.id,stripeStatus,expectedLocalStatus:expectedLocalStripeStatus(intent),livemode:intent.livemode}});
    const updated=await applyStripeIntentState(payment,intent,{source:"SERVER_SYNC"});
    return {stripeStatus,intent,payment:updated};
}

async function handleStripeWebhookEvent(stripeEvent) {
    if (!stripeEvent || !stripeEvent.id || !stripeEvent.type) { const e=new Error("Evénement Stripe invalide."); e.code="STRIPE_WEBHOOK_EVENT_INVALID"; throw e; }
    const eventType=String(stripeEvent.type);
    const intent=stripeEvent.data?.object || null;
    if (!eventType.startsWith("payment_intent.") || !intent || !String(intent.id || "").startsWith("pi_")) { return {handled:false,ignored:true,reason:"EVENT_NOT_USED",eventId:stripeEvent.id,eventType}; }
    StripeService.assertStripeObjectMode(intent.livemode);
    const payment=await Payment.findStripeContextByProviderReference(intent.id);
    if (!payment) return {handled:false,ignored:true,reason:"PAYMENT_NOT_FOUND",eventId:stripeEvent.id,eventType,providerReference:intent.id};
    if (payment.method!==Payment.METHODS.CARD) { const e=new Error("Le PaymentIntent Stripe correspond à un paiement local non CARD."); e.code="STRIPE_WEBHOOK_PAYMENT_METHOD_MISMATCH"; throw e; }
    assertStripePaymentConsistency(payment,intent);
    const registration=await Payment.registerStripeWebhookEventOnce({paymentId:payment.id,stripeEventId:stripeEvent.id,stripeEventType:eventType,providerReference:intent.id,stripeStatus:intent.status || null,livemode:intent.livemode});
    if (registration.duplicate) return {handled:true,duplicate:true,eventId:stripeEvent.id,eventType,payment:await Payment.findById(payment.id)};
    const updated=await applyStripeIntentState(payment,intent,{source:"WEBHOOK",stripeEventId:stripeEvent.id,stripeEventType:eventType});
    return {handled:true,duplicate:false,eventId:stripeEvent.id,eventType,payment:updated};
}

async function auditStripeCardPayments({limit=50, repair=false}={}) {
    const payments=await Payment.findRecentStripeCardPayments(limit);
    const results=[];
    for (const payment of payments) {
        const row={paymentId:payment.id,orderReference:payment.order_reference,providerReference:payment.provider_reference,localStatus:payment.status,stripeStatus:null,expectedLocalStatus:null,consistent:false,repaired:false,error:null};
        try {
            const intent=await StripeService.retrievePaymentIntent(payment.provider_reference);
            row.stripeStatus=intent.status;
            row.expectedLocalStatus=expectedLocalStripeStatus(intent);
            assertStripePaymentConsistency(payment,intent);
            /*
             * 13.9.5.3 FIX — un PaymentIntent Stripe "succeeded"
             * reste succeeded même après un remboursement.
             * Les statuts locaux PARTIAL/REFUNDED sont donc cohérents
             * avec un PaymentIntent Stripe succeeded.
             */
            const refundAwareSucceeded =
                row.expectedLocalStatus === Payment.STATUSES.PAID
                &&
                [
                    Payment.STATUSES.PARTIAL,
                    Payment.STATUSES.REFUNDED
                ].includes(payment.status);

            row.consistent =
                row.expectedLocalStatus === null
                ||
                row.expectedLocalStatus === payment.status
                ||
                refundAwareSucceeded;

            if (repair && !row.consistent && row.expectedLocalStatus) {
                const updated=await applyStripeIntentState(payment,intent,{source:"AUTOMATIC_RECONCILIATION"});
                row.localStatus=updated?.status || payment.status;
                row.repaired=row.localStatus===row.expectedLocalStatus;
                row.consistent=row.repaired;
                await Payment.addEvent({paymentId:payment.id,eventType:"STRIPE_RECONCILIATION_REPAIRED",description:"Statut local réparé depuis Stripe après contrôle serveur.",payload:{providerReference:intent.id,stripeStatus:intent.status,previousLocalStatus:payment.status,newLocalStatus:row.localStatus}});
            }
        } catch (error) { row.error=error.message; }
        results.push(row);
    }
    return results;
}

async function reconcileStripeCardPayments({limit=50}={}) {
    const rows=await auditStripeCardPayments({limit,repair:true});
    return {
        checked:rows.length,
        consistent:rows.filter(r=>r.consistent && !r.repaired).length,
        repaired:rows.filter(r=>r.repaired).length,
        errors:rows.filter(r=>Boolean(r.error)).length,
        rows
    };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

    getPaymentForOrder,

    markAuthorized,
    markPending,
    markPaid,
    markFailed,
    cancel,

    initiateMtnMomo,
    syncMtnMomoPayment,
    handleMtnMomoCallback,

    retryMtnMomo,
    reconcilePendingMtnMomo,

    initiateStripeCard,
    syncStripeCardPayment,
    handleStripeWebhookEvent,

    expectedLocalStripeStatus,
    assertStripePaymentConsistency,
    applyStripeIntentState,
    auditStripeCardPayments,
    reconcileStripeCardPayments
};
