const crypto =
    require("crypto");


const Payment =
    require("../models/payment.model");


const MtnMomo =
    require("./mtn-momo.service");

const StripeService =
    require("./stripe.service");

/* =========================================================
   PAYMENT SERVICE
   TIOPTIOP — 13.8.5
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
        payment.status ===
        Payment.STATUSES.PAID
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
        payment.status ===
        Payment.STATUSES.PAID
    ) {

        throw new Error(
            "Un paiement payé doit passer par un remboursement."
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



/* =========================================================
   STRIPE CARD — 13.8.4
   SYNCHRONISATION DU PAYMENT INTENT
========================================================= */

async function syncStripeCardPayment(
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
        !payment.provider_reference
    ) {

        const error =
            new Error(
                "Le paiement Stripe ne possède pas encore de PaymentIntent."
            );

        error.code =
            "STRIPE_PAYMENT_INTENT_MISSING";

        throw error;
    }


    const intent =
        await StripeService
            .retrievePaymentIntent(
                payment.provider_reference
            );


    const stripeStatus =
        String(
            intent.status || ""
        )
            .trim()
            .toLowerCase();


    const lastPaymentError =
        intent.last_payment_error
        ||
        null;


    await Payment.addEvent({

        paymentId:
            payment.id,

        eventType:
            "STRIPE_STATUS_CHECKED",

        description:
            "Statut PaymentIntent vérifié auprès de Stripe.",

        payload: {

            providerReference:
                intent.id,

            stripeStatus,

            livemode:
                intent.livemode,

            lastPaymentError:
                lastPaymentError
                    ? {
                        code:
                            lastPaymentError.code
                            ||
                            null,

                        declineCode:
                            lastPaymentError.decline_code
                            ||
                            null,

                        message:
                            lastPaymentError.message
                            ||
                            null
                    }
                    : null
        }
    });


    /* =============================================
       SUCCES
    ============================================= */

    if (
        stripeStatus ===
        "succeeded"
    ) {

        return {

            stripeStatus,

            intent,

            payment:
                await markPaid(
                    payment.id,
                    {
                        provider:
                            "STRIPE",

                        providerStatus:
                            stripeStatus,

                        providerReference:
                            intent.id,

                        paymentMethodId:
                            intent.payment_method
                            ||
                            null
                    }
                )
        };
    }


    /* =============================================
       ANNULE
    ============================================= */

    if (
        stripeStatus ===
        "canceled"
    ) {

        return {

            stripeStatus,

            intent,

            payment:
                await cancel(
                    payment.id,
                    {
                        provider:
                            "STRIPE",

                        providerStatus:
                            stripeStatus,

                        providerReference:
                            intent.id,

                        cancellationReason:
                            intent.cancellation_reason
                            ||
                            null
                    }
                )
        };
    }


    /* =============================================
       CARTE REFUSEE / ERREUR DE PAIEMENT

       Stripe remet généralement le PaymentIntent en
       requires_payment_method avec last_payment_error.
    ============================================= */

    if (
        stripeStatus ===
        "requires_payment_method"
        &&
        lastPaymentError
    ) {

        return {

            stripeStatus,

            intent,

            payment:
                await markFailed(
                    payment.id,
                    {
                        provider:
                            "STRIPE",

                        providerStatus:
                            stripeStatus,

                        providerReference:
                            intent.id,

                        code:
                            lastPaymentError.code
                            ||
                            null,

                        declineCode:
                            lastPaymentError.decline_code
                            ||
                            null,

                        message:
                            lastPaymentError.message
                            ||
                            null
                    }
                )
        };
    }


    /*
     * requires_payment_method sans erreur :
     * aucune carte n'a encore été confirmée.
     *
     * requires_action :
     * authentification 3DS en cours.
     *
     * processing :
     * Stripe traite encore le paiement.
     *
     * requires_confirmation :
     * confirmation encore requise.
     *
     * => le statut local reste PENDING.
     */

    return {

        stripeStatus:
            stripeStatus
            ||
            "unknown",

        intent,

        payment:
            await Payment.findById(
                payment.id
            )
    };
}




/* =========================================================
   STRIPE WEBHOOK — 13.8.5

   Le statut final provient de Stripe côté serveur.
   Le navigateur n'est jamais considéré comme source de vérité.
========================================================= */

async function handleStripeWebhookEvent(
    stripeEvent
) {

    if (
        !stripeEvent
        ||
        !stripeEvent.id
        ||
        !stripeEvent.type
    ) {

        const error =
            new Error(
                "Evénement Stripe invalide."
            );

        error.code =
            "STRIPE_WEBHOOK_EVENT_INVALID";

        throw error;
    }


    const eventType =
        String(
            stripeEvent.type
        );


    const intent =
        stripeEvent.data?.object
        ||
        null;


    /*
     * 13.8.5 traite uniquement les PaymentIntent.
     * Les autres événements Stripe sont acquittés sans effet.
     */
    if (
        !eventType.startsWith(
            "payment_intent."
        )
        ||
        !intent
        ||
        !String(
            intent.id || ""
        ).startsWith(
            "pi_"
        )
    ) {

        return {
            handled:
                false,

            ignored:
                true,

            reason:
                "EVENT_NOT_USED",

            eventId:
                stripeEvent.id,

            eventType
        };
    }


    /*
     * Protection supplémentaire :
     * notre 13.8 est exclusivement en TEST.
     */
    if (
        intent.livemode ===
        true
    ) {

        const error =
            new Error(
                "Webhook Stripe LIVE refusé dans l'environnement 13.8 TEST."
            );

        error.code =
            "STRIPE_LIVE_WEBHOOK_BLOCKED";

        throw error;
    }


    const payment =
        await Payment
            .findByProviderReference(
                intent.id
            );


    /*
     * Stripe CLI peut envoyer des événements de test
     * qui ne correspondent à aucune commande TiopTiop.
     *
     * On répond 200 pour éviter des retries inutiles,
     * mais on ne modifie rien en base.
     */
    if (!payment) {

        return {
            handled:
                false,

            ignored:
                true,

            reason:
                "PAYMENT_NOT_FOUND",

            eventId:
                stripeEvent.id,

            eventType,

            providerReference:
                intent.id
        };
    }


    if (
        payment.method !==
        Payment.METHODS.CARD
    ) {

        const error =
            new Error(
                "Le PaymentIntent Stripe correspond à un paiement local non CARD."
            );

        error.code =
            "STRIPE_WEBHOOK_PAYMENT_METHOD_MISMATCH";

        throw error;
    }


    const alreadyProcessed =
        await Payment
            .hasProcessedStripeWebhookEvent(
                payment.id,
                stripeEvent.id
            );


    if (
        alreadyProcessed
    ) {

        return {
            handled:
                true,

            duplicate:
                true,

            eventId:
                stripeEvent.id,

            eventType,

            payment:
                await Payment.findById(
                    payment.id
                )
        };
    }


    /*
     * On enregistre l'evt_ Stripe AVANT l'effet métier.
     *
     * Si Stripe renvoie exactement le même evt_,
     * il sera reconnu comme doublon.
     */
    await Payment.addEvent({

        paymentId:
            payment.id,

        eventType:
            "STRIPE_WEBHOOK_RECEIVED",

        description:
            `Webhook Stripe ${eventType} reçu.`,

        payload: {

            stripeEventId:
                stripeEvent.id,

            stripeEventType:
                eventType,

            providerReference:
                intent.id,

            stripeStatus:
                intent.status
                ||
                null,

            livemode:
                Boolean(
                    intent.livemode
                )
        }
    });


    /* =============================================
       PAIEMENT REUSSI
    ============================================= */

    if (
        eventType ===
        "payment_intent.succeeded"
    ) {

        const updated =
            await markPaid(
                payment.id,
                {
                    provider:
                        "STRIPE",

                    source:
                        "WEBHOOK",

                    stripeEventId:
                        stripeEvent.id,

                    providerStatus:
                        intent.status
                        ||
                        "succeeded",

                    providerReference:
                        intent.id,

                    paymentMethodId:
                        intent.payment_method
                        ||
                        null
                }
            );


        return {
            handled:
                true,

            duplicate:
                false,

            eventId:
                stripeEvent.id,

            eventType,

            payment:
                updated
        };
    }


    /* =============================================
       PAIEMENT ECHOUE
    ============================================= */

    if (
        eventType ===
        "payment_intent.payment_failed"
    ) {

        const stripeError =
            intent.last_payment_error
            ||
            null;


        const updated =
            await markFailed(
                payment.id,
                {
                    provider:
                        "STRIPE",

                    source:
                        "WEBHOOK",

                    stripeEventId:
                        stripeEvent.id,

                    providerStatus:
                        intent.status
                        ||
                        "requires_payment_method",

                    providerReference:
                        intent.id,

                    code:
                        stripeError?.code
                        ||
                        null,

                    declineCode:
                        stripeError?.decline_code
                        ||
                        null,

                    message:
                        stripeError?.message
                        ||
                        null
                }
            );


        return {
            handled:
                true,

            duplicate:
                false,

            eventId:
                stripeEvent.id,

            eventType,

            payment:
                updated
        };
    }


    /* =============================================
       PAIEMENT ANNULE
    ============================================= */

    if (
        eventType ===
        "payment_intent.canceled"
    ) {

        const updated =
            await cancel(
                payment.id,
                {
                    provider:
                        "STRIPE",

                    source:
                        "WEBHOOK",

                    stripeEventId:
                        stripeEvent.id,

                    providerStatus:
                        intent.status
                        ||
                        "canceled",

                    providerReference:
                        intent.id,

                    cancellationReason:
                        intent.cancellation_reason
                        ||
                        null
                }
            );


        return {
            handled:
                true,

            duplicate:
                false,

            eventId:
                stripeEvent.id,

            eventType,

            payment:
                updated
        };
    }


    /*
     * Autres statuts utiles :
     * processing / requires_action / created...
     *
     * On conserve la trace du webhook mais on laisse
     * le paiement local dans son état actuel.
     */
    return {
        handled:
            true,

        duplicate:
            false,

        eventId:
            stripeEvent.id,

        eventType,

        payment:
            await Payment.findById(
                payment.id
            )
    };
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

    getPaymentForOrder,

    markAuthorized,
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
    handleStripeWebhookEvent
};
