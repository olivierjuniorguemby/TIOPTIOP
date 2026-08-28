const crypto = require("crypto");

const Payment =
    require("../models/payment.model");

const PaymentRefund =
    require("../models/payment-refund.model");

const StripeService =
    require("./stripe.service");

const db = require("../config/database");


/* =========================================================
   REFUND SERVICE
   TIOPTIOP — 13.9.4.3

   - lecture de l'éligibilité
   - remboursement Stripe TEST
   - idempotence
   - payment_refunds
   - payment_events
   - statut payments PARTIAL / REFUNDED
========================================================= */

function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function normalizeReasonCode(value) {
    const code = String(value || "")
        .trim()
        .toUpperCase()
        .slice(0, 60);

    const allowed = [
        "CUSTOMER_REQUEST",
        "ORDER_CANCELLED",
        "PRODUCT_UNAVAILABLE",
        "DUPLICATE",
        "OTHER"
    ];

    return allowed.includes(code)
        ? code
        : "OTHER";
}

function stripeReasonFromCode(reasonCode) {
    if (reasonCode === "DUPLICATE") {
        return "duplicate";
    }

    if (reasonCode === "CUSTOMER_REQUEST") {
        return "requested_by_customer";
    }

    /*
     * Stripe n'accepte pas nos motifs métier personnalisés.
     * Pour ceux-ci, on ne renseigne pas reason chez Stripe ;
     * le détail reste conservé dans TiopTiop.
     */
    return null;
}

function buildRefundState(payment, summary = {}) {
    const paymentAmount = Math.max(
        0,
        number(payment?.amount)
    );

    const refundedAmount = Math.max(
        0,
        number(summary.total_refunded)
    );

    const pendingAmount = Math.max(
        0,
        number(summary.total_pending)
    );

    const refundableAmount = Math.max(
        0,
        paymentAmount
        -
        refundedAmount
        -
        pendingAmount
    );

    const status = String(
        payment?.status || ""
    ).toUpperCase();

    const method = String(
        payment?.method || ""
    ).toUpperCase();

    const provider = String(
        payment?.provider || ""
    ).toUpperCase();

    const allowedStatus =
        [
            "PAID",
            "PARTIAL"
        ].includes(status);

    const eligible =
        allowedStatus
        &&
        refundableAmount > 0;

    let reason = "";

    if (!allowedStatus) {
        reason =
            `Statut ${status || "INCONNU"} non remboursable.`;
    }
    else if (
        refundableAmount <= 0
    ) {
        reason =
            "Aucun montant restant à rembourser.";
    }

    let processingMode =
        "MANUAL";

    /*
     * Dans TiopTiop, les cartes Stripe sont enregistrées
     * avec provider = CARD_SANDBOX.
     */
    if (
        method === "CARD"
        &&
        (
            provider === "CARD_SANDBOX"
            ||
            provider.includes("STRIPE")
        )
    ) {
        processingMode =
            "STRIPE";
    }
    else if (
        method ===
        "MOBILE_MONEY"
    ) {
        processingMode =
            "MOBILE_MONEY";
    }
    else if (
        method ===
        "CASH"
    ) {
        processingMode =
            "CASH";
    }

    return {
        eligible,
        reason,
        paymentAmount,
        refundedAmount,
        pendingAmount,
        refundableAmount,
        processingMode,
        currency:
            payment?.currency
            ||
            "XAF",

        canExecuteStripe:
            eligible
            &&
            processingMode ===
                "STRIPE"
    };
}


/* =========================================================
   EXECUTION STRIPE TEST
========================================================= */

async function executeStripeRefund({
    payment,
    refundType,
    amount,
    reasonCode,
    reasonText = null,
    requestedByAdminUserId = null,
    formToken
}) {
    if (!payment) {
        const error =
            new Error(
                "Paiement introuvable."
            );

        error.code =
            "REFUND_PAYMENT_NOT_FOUND";

        throw error;
    }

    const method =
        String(
            payment.method || ""
        ).toUpperCase();

    const provider =
        String(
            payment.provider || ""
        ).toUpperCase();

    if (
        method !== "CARD"
        ||
        !(
            provider === "CARD_SANDBOX"
            ||
            provider.includes("STRIPE")
        )
    ) {
        const error =
            new Error(
                "13.9.4.3 exécute uniquement les remboursements Stripe TEST."
            );

        error.code =
            "REFUND_PROVIDER_NOT_STRIPE";

        throw error;
    }

    if (
        !String(
            payment.provider_reference || ""
        ).startsWith(
            "pi_"
        )
    ) {
        const error =
            new Error(
                "Ce paiement ne possède pas de PaymentIntent Stripe valide."
            );

        error.code =
            "REFUND_STRIPE_PAYMENT_INTENT_MISSING";

        throw error;
    }

    const normalizedType =
        String(
            refundType || ""
        )
            .trim()
            .toUpperCase();

    if (
        ![
            "FULL",
            "PARTIAL"
        ].includes(
            normalizedType
        )
    ) {
        const error =
            new Error(
                "Type de remboursement invalide."
            );

        error.code =
            "REFUND_TYPE_INVALID";

        throw error;
    }

    const numericAmount =
        Math.round(
            Number(amount)
        );

    if (
        !Number.isFinite(
            numericAmount
        )
        ||
        numericAmount <= 0
    ) {
        const error =
            new Error(
                "Montant de remboursement invalide."
            );

        error.code =
            "REFUND_AMOUNT_INVALID";

        throw error;
    }

    const token =
        String(
            formToken || ""
        )
            .trim()
            .slice(
                0,
                100
            );

    if (!token) {
        const error =
            new Error(
                "Jeton d'idempotence du formulaire absent. Rechargez la page."
            );

        error.code =
            "REFUND_FORM_TOKEN_REQUIRED";

        throw error;
    }

    const normalizedReasonCode =
        normalizeReasonCode(
            reasonCode
        );

    const publicId =
        crypto.randomUUID();

    const idempotencyKey =
        `tioptiop-refund-${payment.id}-${token}`;

    /*
     * Création locale atomique AVANT Stripe.
     * Cette fonction réserve le montant PENDING et verrouille
     * le paiement pour empêcher un dépassement concurrent.
     */
    const request =
        await PaymentRefund
            .createPendingValidated({
                publicId,

                paymentId:
                    payment.id,

                provider:
                    "STRIPE",

                refundType:
                    normalizedType,

                amount:
                    numericAmount,

                currency:
                    payment.currency
                    ||
                    "XAF",

                reasonCode:
                    normalizedReasonCode,

                reasonText:
                    reasonText
                    ? String(
                        reasonText
                    ).slice(
                        0,
                        500
                    )
                    : null,

                idempotencyKey,

                requestedByAdminUserId
            });

    /*
     * Double clic / répétition exacte du même formulaire :
     * ne jamais rappeler Stripe.
     */
    if (
        request.duplicate
    ) {
        return {
            duplicate:
                true,

            refund:
                request.refund,

            payment:
                await Payment.findById(
                    payment.id
                )
        };
    }

    let localRefund =
        request.refund;

    await Payment.addEvent({
        paymentId:
            payment.id,

        eventType:
            "REFUND_REQUESTED",

        description:
            "Demande de remboursement Stripe TEST enregistrée.",

        payload: {
            refundPublicId:
                localRefund.public_id,

            refundId:
                localRefund.id,

            refundType:
                localRefund.refund_type,

            amount:
                localRefund.amount,

            currency:
                localRefund.currency,

            reasonCode:
                normalizedReasonCode,

            requestedByAdminUserId:
                requestedByAdminUserId
                ||
                null
        }
    });

    try {
        const stripeRefund =
            await StripeService
                .createRefund({
                    paymentIntentId:
                        payment.provider_reference,

                    amount:
                        localRefund.amount,

                    reason:
                        stripeReasonFromCode(
                            normalizedReasonCode
                        ),

                    refundPublicId:
                        localRefund.public_id,

                    paymentId:
                        payment.id,

                    idempotencyKey
                });

        const stripeStatus =
            String(
                stripeRefund.status || ""
            )
                .trim()
                .toLowerCase();

        if (
            stripeStatus ===
            "succeeded"
        ) {
            localRefund =
                await PaymentRefund
                    .updateProviderResult({
                        refundId:
                            localRefund.id,

                        status:
                            "SUCCEEDED",

                        providerReference:
                            stripeRefund.id,

                        providerPayload: {
                            id:
                                stripeRefund.id,

                            status:
                                stripeRefund.status,

                            amount:
                                stripeRefund.amount,

                            currency:
                                stripeRefund.currency,

                            paymentIntent:
                                stripeRefund.payment_intent,

                            reason:
                                stripeRefund.reason,

                            livemode:
                                stripeRefund.livemode
                        },

                        processed:
                            true
                    });

            assertRefundablePaymentState(
                payment
            );


            const summary =
                await PaymentRefund
                    .getSummaryByPaymentId(
                        payment.id
                    );

            const totalRefunded =
                Number(
                    summary.total_refunded || 0
                );

            const paymentAmount =
                Number(
                    payment.amount || 0
                );

            const fullyRefunded =
                totalRefunded >=
                paymentAmount;

            const nextStatus =
                fullyRefunded

                    ? Payment.STATUSES
                        .REFUNDED

                    : Payment.STATUSES
                        .PARTIAL;

            const updatedPayment =
                await Payment.updateStatus(
                    payment.id,
                    nextStatus
                );

            await Payment.addEvent({
                paymentId:
                    payment.id,

                eventType:
                    "STRIPE_REFUND_SUCCEEDED",

                description:
                    "Remboursement Stripe TEST confirmé.",

                payload: {
                    refundId:
                        localRefund.id,

                    refundPublicId:
                        localRefund.public_id,

                    stripeRefundId:
                        stripeRefund.id,

                    amount:
                        stripeRefund.amount,

                    currency:
                        stripeRefund.currency,

                    totalRefunded,

                    paymentAmount,

                    paymentStatus:
                        nextStatus
                }
            });

            await Payment.addEvent({
                paymentId:
                    payment.id,

                eventType:
                    fullyRefunded

                        ? "PAYMENT_REFUNDED"

                        : "PAYMENT_PARTIALLY_REFUNDED",

                description:
                    fullyRefunded

                        ? "Paiement totalement remboursé."

                        : "Paiement partiellement remboursé.",

                payload: {
                    refundId:
                        localRefund.id,

                    stripeRefundId:
                        stripeRefund.id,

                    refundAmount:
                        stripeRefund.amount,

                    totalRefunded,

                    remainingAmount:
                        Math.max(
                            0,
                            paymentAmount
                            -
                            totalRefunded
                        )
                }
            });

            return {
                duplicate:
                    false,

                providerStatus:
                    stripeStatus,

                refund:
                    localRefund,

                stripeRefund,

                payment:
                    updatedPayment,

                totalRefunded
            };
        }

        /*
         * Certains moyens/providers peuvent retourner pending.
         * On garde alors payment_refunds = PENDING.
         * Le traitement webhook avancé arrivera en 13.9.4.6.
         */
        if (
            stripeStatus ===
            "pending"
        ) {
            localRefund =
                await PaymentRefund
                    .updateProviderResult({
                        refundId:
                            localRefund.id,

                        status:
                            "PENDING",

                        providerReference:
                            stripeRefund.id,

                        providerPayload: {
                            id:
                                stripeRefund.id,

                            status:
                                stripeRefund.status,

                            amount:
                                stripeRefund.amount,

                            currency:
                                stripeRefund.currency,

                            livemode:
                                stripeRefund.livemode
                        },

                        processed:
                            false
                    });

            await Payment.addEvent({
                paymentId:
                    payment.id,

                eventType:
                    "STRIPE_REFUND_PENDING",

                description:
                    "Remboursement Stripe en attente de confirmation.",

                payload: {
                    refundId:
                        localRefund.id,

                    stripeRefundId:
                        stripeRefund.id,

                    amount:
                        stripeRefund.amount,

                    currency:
                        stripeRefund.currency
                }
            });

            return {
                duplicate:
                    false,

                providerStatus:
                    stripeStatus,

                refund:
                    localRefund,

                stripeRefund,

                payment:
                    await Payment.findById(
                        payment.id
                    )
            };
        }

        /*
         * Toute réponse provider terminale autre que succeeded
         * est considérée comme échec local à cette étape.
         */
        localRefund =
            await PaymentRefund
                .updateProviderResult({
                    refundId:
                        localRefund.id,

                    status:
                        "FAILED",

                    providerReference:
                        stripeRefund.id
                        ||
                        null,

                    providerPayload: {
                        id:
                            stripeRefund.id
                            ||
                            null,

                        status:
                            stripeRefund.status
                            ||
                            null,

                        failureReason:
                            stripeRefund.failure_reason
                            ||
                            null
                    },

                    processed:
                        true
                });

        await Payment.addEvent({
            paymentId:
                payment.id,

            eventType:
                "STRIPE_REFUND_FAILED",

            description:
                "Remboursement Stripe non abouti.",

            payload: {
                refundId:
                    localRefund.id,

                stripeRefundId:
                    stripeRefund.id
                    ||
                    null,

                stripeStatus:
                    stripeRefund.status
                    ||
                    null,

                failureReason:
                    stripeRefund.failure_reason
                    ||
                    null
            }
        });

        const error =
            new Error(
                `Stripe n'a pas confirmé le remboursement (${stripeStatus || "unknown"}).`
            );

        error.code =
            "STRIPE_REFUND_NOT_SUCCEEDED";

        throw error;
    }
    catch (error) {
        const current = await PaymentRefund.findById(localRefund.id);

        if (current && current.status === "PENDING") {
            const terminalTypes = ["StripeInvalidRequestError", "StripeCardError", "StripePermissionError", "StripeAuthenticationError"];
            const terminal = terminalTypes.includes(String(error.type || ""));

            /*
             * 13.9.5.3 : une erreur réseau/timeout est AMBIGUË. Stripe peut avoir
             * accepté le remboursement alors que TiopTiop n'a pas reçu la réponse.
             * On ne marque donc jamais FAILED dans ce cas : PENDING sera réconcilié.
             */
            if (terminal) {
                await PaymentRefund.updateProviderResult({
                    refundId: current.id,
                    status: "FAILED",
                    providerReference: current.provider_reference || null,
                    providerPayload: {code:error.code || null,type:error.type || null,message:error.message},
                    processed: true
                });
                await Payment.addEvent({paymentId:payment.id,eventType:"STRIPE_REFUND_FAILED",description:"Remboursement Stripe refusé de manière certaine.",payload:{refundId:current.id,code:error.code || null,type:error.type || null,message:error.message}});
            } else {
                await PaymentRefund.updateProviderResult({
                    refundId: current.id,
                    status: "PENDING",
                    providerReference: current.provider_reference || null,
                    providerPayload: {code:error.code || null,type:error.type || null,message:error.message,reconciliationRequired:true},
                    processed: false
                });
                await Payment.addEvent({paymentId:payment.id,eventType:"STRIPE_REFUND_RECONCILIATION_REQUIRED",description:"Réponse Stripe incertaine : remboursement conservé PENDING pour réconciliation.",payload:{refundId:current.id,refundPublicId:current.public_id,code:error.code || null,type:error.type || null,message:error.message}});
            }
        }
        throw error;
    }
}



/* =========================================================
   13.9.4.5 — OUTILS COMMUNS MTN MOMO / CASH
========================================================= */



function assertRefundablePaymentState(payment) {

    if (!payment) {

        const error =
            new Error(
                "Paiement introuvable."
            );

        error.code =
            "REFUND_PAYMENT_NOT_FOUND";

        throw error;
    }


    const status =
        String(
            payment.status || ""
        )
            .trim()
            .toUpperCase();


    if (
        ![
            Payment.STATUSES.PAID,
            Payment.STATUSES.PARTIAL
        ].includes(
            status
        )
    ) {

        const error =
            new Error(
                `Le paiement au statut ${status || "INCONNU"} ne peut pas recevoir un remboursement réussi.`
            );

        error.code =
            "REFUND_PAYMENT_STATUS_INVALID";

        throw error;
    }


    return true;
}


function buildManualIdempotencyKey(paymentId, formToken, prefix) {
    const token = String(formToken || "")
        .trim()
        .slice(0, 100);

    if (!token) {
        const error = new Error(
            "Jeton d'idempotence du formulaire absent. Rechargez la page."
        );
        error.code = "REFUND_FORM_TOKEN_REQUIRED";
        throw error;
    }

    return `tioptiop-${prefix}-${paymentId}-${token}`;
}

async function applySuccessfulRefundToPayment({
    payment,
    refund,
    successEventType,
    successDescription,
    providerReference = null,
    extraPayload = null
}) {

    assertRefundablePaymentState(
        payment
    );


    const summary =
        await PaymentRefund.getSummaryByPaymentId(
            payment.id
        );

    const totalRefunded =
        Number(
            summary.total_refunded || 0
        );

    const paymentAmount =
        Number(
            payment.amount || 0
        );

    const fullyRefunded =
        totalRefunded >= paymentAmount;

    const nextStatus =
        fullyRefunded
            ? Payment.STATUSES.REFUNDED
            : Payment.STATUSES.PARTIAL;

    const updatedPayment =
        await Payment.updateStatus(
            payment.id,
            nextStatus
        );

    await Payment.addEvent({
        paymentId:
            payment.id,

        eventType:
            successEventType,

        description:
            successDescription,

        payload: {
            refundId:
                refund.id,

            refundPublicId:
                refund.public_id,

            providerReference:
                providerReference
                || refund.provider_reference
                || null,

            refundAmount:
                Number(refund.amount),

            currency:
                refund.currency,

            totalRefunded,

            paymentAmount,

            paymentStatus:
                nextStatus,

            ...(extraPayload || {})
        }
    });

    await Payment.addEvent({
        paymentId:
            payment.id,

        eventType:
            fullyRefunded
                ? "PAYMENT_REFUNDED"
                : "PAYMENT_PARTIALLY_REFUNDED",

        description:
            fullyRefunded
                ? "Paiement totalement remboursé."
                : "Paiement partiellement remboursé.",

        payload: {
            refundId:
                refund.id,

            providerReference:
                providerReference
                || refund.provider_reference
                || null,

            refundAmount:
                Number(refund.amount),

            totalRefunded,

            remainingAmount:
                Math.max(
                    0,
                    paymentAmount - totalRefunded
                )
        }
    });

    return {
        payment:
            updatedPayment,

        totalRefunded,

        fullyRefunded
    };
}


/* =========================================================
   MTN MOMO — DEMANDE MANUELLE
   Aucun appel à une API de remboursement MTN ici.
========================================================= */

async function createManualMtnRefundRequest({
    payment,
    refundType,
    amount,
    reasonCode,
    reasonText = null,
    requestedByAdminUserId = null,
    formToken
}) {
    if (!payment) {
        const error =
            new Error("Paiement introuvable.");
        error.code =
            "REFUND_PAYMENT_NOT_FOUND";
        throw error;
    }

    if (
        String(payment.method || "").toUpperCase()
        !==
        "MOBILE_MONEY"
    ) {
        const error =
            new Error(
                "Ce paiement n'est pas un paiement Mobile Money."
            );
        error.code =
            "REFUND_NOT_MOBILE_MONEY";
        throw error;
    }

    const normalizedType =
        String(refundType || "")
            .trim()
            .toUpperCase();

    const numericAmount =
        Math.round(
            Number(amount)
        );

    const normalizedReasonCode =
        normalizeReasonCode(
            reasonCode
        );

    const publicId =
        crypto.randomUUID();

    const idempotencyKey =
        buildManualIdempotencyKey(
            payment.id,
            formToken,
            "mtn-refund"
        );

    const request =
        await PaymentRefund
            .createPendingValidated({
                publicId,

                paymentId:
                    payment.id,

                provider:
                    "MTN_MOMO_MANUAL",

                refundType:
                    normalizedType,

                amount:
                    numericAmount,

                currency:
                    payment.currency
                    || "XAF",

                reasonCode:
                    normalizedReasonCode,

                reasonText:
                    reasonText
                        ? String(reasonText).slice(0, 500)
                        : null,

                idempotencyKey,

                requestedByAdminUserId
            });

    if (request.duplicate) {
        return {
            duplicate:
                true,
            refund:
                request.refund
        };
    }

    await Payment.addEvent({
        paymentId:
            payment.id,

        eventType:
            "REFUND_REQUESTED",

        description:
            "Demande de remboursement MTN MoMo enregistrée.",

        payload: {
            refundId:
                request.refund.id,

            refundPublicId:
                request.refund.public_id,

            refundType:
                request.refund.refund_type,

            amount:
                Number(request.refund.amount),

            currency:
                request.refund.currency,

            reasonCode:
                normalizedReasonCode,

            processingMode:
                "MTN_MOMO_MANUAL"
        }
    });

    await Payment.addEvent({
        paymentId:
            payment.id,

        eventType:
            "MTN_MOMO_REFUND_PENDING",

        description:
            "Remboursement MTN MoMo à effectuer manuellement puis à confirmer dans l'administration.",

        payload: {
            refundId:
                request.refund.id,

            amount:
                Number(request.refund.amount),

            currency:
                request.refund.currency
        }
    });

    return {
        duplicate:
            false,

        refund:
            request.refund
    };
}


/* =========================================================
   MTN MOMO — CONFIRMATION MANUELLE APRES OPERATION REELLE
========================================================= */

async function confirmManualMtnRefund({
    payment,
    refundId,
    providerReference,
    adminNote = null,
    confirmedByAdminUserId = null
}) {
    if (!payment) {
        throw new Error(
            "Paiement introuvable."
        );
    }

    if (
        String(payment.method || "").toUpperCase()
        !==
        "MOBILE_MONEY"
    ) {
        throw new Error(
            "Ce paiement n'est pas un paiement Mobile Money."
        );
    }

    const refund =
        await PaymentRefund.findById(
            refundId
        );

    if (
        !refund
        ||
        Number(refund.payment_id)
        !==
        Number(payment.id)
    ) {
        const error =
            new Error(
                "Demande de remboursement MTN introuvable."
            );
        error.code =
            "MTN_REFUND_NOT_FOUND";
        throw error;
    }

    if (
        String(refund.provider || "").toUpperCase()
        !==
        "MTN_MOMO_MANUAL"
    ) {
        const error =
            new Error(
                "Cette demande n'est pas un remboursement MTN manuel."
            );
        error.code =
            "MTN_REFUND_PROVIDER_INVALID";
        throw error;
    }

    if (
        refund.status ===
        "SUCCEEDED"
    ) {
        return {
            duplicate:
                true,

            refund,

            payment:
                await Payment.findById(
                    payment.id
                )
        };
    }

    if (
        refund.status !==
        "PENDING"
    ) {
        const error =
            new Error(
                `Cette demande MTN ne peut pas être confirmée (${refund.status}).`
            );
        error.code =
            "MTN_REFUND_STATUS_INVALID";
        throw error;
    }

    const reference =
        String(
            providerReference || ""
        )
            .trim()
            .slice(0, 180);

    if (!reference) {
        const error =
            new Error(
                "La référence de transaction MTN est obligatoire pour confirmer le remboursement."
            );
        error.code =
            "MTN_REFUND_REFERENCE_REQUIRED";
        throw error;
    }

    const transition =
        await PaymentRefund
            .transitionPendingOnce({
                refundId:
                    refund.id,

                status:
                    "SUCCEEDED",

                providerReference:
                    reference,

                providerPayload: {
                    manual: true,
                    confirmedByAdminUserId:
                        confirmedByAdminUserId || null,
                    adminNote:
                        adminNote
                            ? String(adminNote).slice(0, 500)
                            : null
                },

                processed:
                    true
            });

    if (!transition.updated) {
        if (transition.duplicate && transition.refund.status === "SUCCEEDED") {
            return {
                duplicate: true,
                refund: transition.refund,
                payment: await Payment.findById(payment.id)
            };
        }

        const error = new Error(
            `Cette demande MTN a déjà été traitée (${transition.refund.status}).`
        );
        error.code = "MTN_REFUND_CONCURRENT_ACTION";
        throw error;
    }

    const updatedRefund = transition.refund;

    const state =
        await applySuccessfulRefundToPayment({
            payment,

            refund:
                updatedRefund,

            successEventType:
                "MTN_MOMO_REFUND_CONFIRMED",

            successDescription:
                "Remboursement MTN MoMo manuel confirmé par l'administration.",

            providerReference:
                reference,

            extraPayload: {
                confirmedByAdminUserId:
                    confirmedByAdminUserId
                    || null
            }
        });

    return {
        duplicate:
            false,

        refund:
            updatedRefund,

        ...state
    };
}


/* =========================================================
   MTN MOMO — ANNULATION D'UNE DEMANDE NON EXECUTEE
========================================================= */

async function cancelManualMtnRefund({
    payment,
    refundId,
    reason = null,
    cancelledByAdminUserId = null
}) {
    if (!payment) {
        throw new Error(
            "Paiement introuvable."
        );
    }

    const refund =
        await PaymentRefund.findById(
            refundId
        );

    if (
        !refund
        ||
        Number(refund.payment_id)
        !==
        Number(payment.id)
    ) {
        throw new Error(
            "Demande de remboursement introuvable."
        );
    }

    if (
        String(refund.provider || "").toUpperCase()
        !==
        "MTN_MOMO_MANUAL"
    ) {
        throw new Error(
            "Cette demande n'est pas une demande MTN manuelle."
        );
    }

    if (
        refund.status ===
        "CANCELLED"
    ) {
        return {
            duplicate:
                true,

            refund
        };
    }

    if (
        refund.status !==
        "PENDING"
    ) {
        throw new Error(
            `Seule une demande PENDING peut être annulée (${refund.status}).`
        );
    }

    const transition =
        await PaymentRefund
            .transitionPendingOnce({
                refundId:
                    refund.id,

                status:
                    "CANCELLED",

                providerReference:
                    refund.provider_reference || null,

                providerPayload: {
                    manual: true,
                    cancelledByAdminUserId:
                        cancelledByAdminUserId || null,
                    reason:
                        reason
                            ? String(reason).slice(0, 500)
                            : null
                },

                processed:
                    true
            });

    if (!transition.updated) {
        if (transition.duplicate && transition.refund.status === "CANCELLED") {
            return {
                duplicate: true,
                refund: transition.refund
            };
        }

        const error = new Error(
            `Cette demande MTN a déjà été traitée (${transition.refund.status}).`
        );
        error.code = "MTN_REFUND_CONCURRENT_ACTION";
        throw error;
    }

    const updated = transition.refund;

    await Payment.addEvent({
        paymentId:
            payment.id,

        eventType:
            "MTN_MOMO_REFUND_CANCELLED",

        description:
            "Demande de remboursement MTN MoMo annulée.",

        payload: {
            refundId:
                updated.id,

            cancelledByAdminUserId:
                cancelledByAdminUserId
                || null,

            reason:
                reason
                || null
        }
    });

    return {
        duplicate:
            false,

        refund:
            updated
    };
}


/* =========================================================
   CASH — REMBOURSEMENT MANUEL EN CAISSE
========================================================= */

async function executeCashRefund({
    payment,
    refundType,
    amount,
    reasonCode,
    reasonText = null,
    requestedByAdminUserId = null,
    formToken,
    cashReference = null
}) {
    if (!payment) {
        throw new Error(
            "Paiement introuvable."
        );
    }

    if (
        String(payment.method || "").toUpperCase()
        !==
        "CASH"
    ) {
        const error =
            new Error(
                "Ce paiement n'est pas un paiement en espèces."
            );
        error.code =
            "REFUND_NOT_CASH";
        throw error;
    }

    const normalizedType =
        String(refundType || "")
            .trim()
            .toUpperCase();

    const numericAmount =
        Math.round(
            Number(amount)
        );

    const normalizedReasonCode =
        normalizeReasonCode(
            reasonCode
        );

    const publicId =
        crypto.randomUUID();

    const idempotencyKey =
        buildManualIdempotencyKey(
            payment.id,
            formToken,
            "cash-refund"
        );

    const request =
        await PaymentRefund
            .createPendingValidated({
                publicId,

                paymentId:
                    payment.id,

                provider:
                    "TIOPTIOP_CASH_MANUAL",

                refundType:
                    normalizedType,

                amount:
                    numericAmount,

                currency:
                    payment.currency
                    || "XAF",

                reasonCode:
                    normalizedReasonCode,

                reasonText:
                    reasonText
                        ? String(reasonText).slice(0, 500)
                        : null,

                idempotencyKey,

                requestedByAdminUserId
            });

    if (request.duplicate) {
        return {
            duplicate:
                true,

            refund:
                request.refund,

            payment:
                await Payment.findById(
                    payment.id
                )
        };
    }

    await Payment.addEvent({
        paymentId:
            payment.id,

        eventType:
            "REFUND_REQUESTED",

        description:
            "Remboursement espèces demandé depuis l'administration.",

        payload: {
            refundId:
                request.refund.id,

            amount:
                Number(request.refund.amount),

            currency:
                request.refund.currency,

            reasonCode:
                normalizedReasonCode,

            processingMode:
                "CASH_MANUAL"
        }
    });

    const reference =
        String(
            cashReference || ""
        )
            .trim()
            .slice(0, 180)
        ||
        `CASH-${Date.now()}-${request.refund.id}`;

    const updatedRefund =
        await PaymentRefund
            .updateProviderResult({
                refundId:
                    request.refund.id,

                status:
                    "SUCCEEDED",

                providerReference:
                    reference,

                providerPayload: {
                    manual:
                        true,

                    handedToCustomer:
                        true,

                    confirmedByAdminUserId:
                        requestedByAdminUserId
                        || null
                },

                processed:
                    true
            });

    const state =
        await applySuccessfulRefundToPayment({
            payment,

            refund:
                updatedRefund,

            successEventType:
                "CASH_REFUND_CONFIRMED",

            successDescription:
                "Remboursement espèces confirmé par l'administration.",

            providerReference:
                reference,

            extraPayload: {
                confirmedByAdminUserId:
                    requestedByAdminUserId
                    || null
            }
        });

    return {
        duplicate:
            false,

        refund:
            updatedRefund,

        ...state
    };
}


async function synchronizePaymentFromRefundSummary(payment) {
    const summary = await PaymentRefund.getSummaryByPaymentId(payment.id);
    const totalRefunded = Number(summary.total_refunded || 0);
    const paymentAmount = Number(payment.amount || 0);
    if (totalRefunded <= 0) return payment;
    const nextStatus = totalRefunded >= paymentAmount ? Payment.STATUSES.REFUNDED : Payment.STATUSES.PARTIAL;
    if (String(payment.status) === String(nextStatus)) return payment;
    return Payment.updateStatus(payment.id, nextStatus);
}

async function reconcilePendingStripeRefunds({limit = 50} = {}) {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const rows = await db.query(`
        SELECT pr.*, p.provider_reference AS payment_provider_reference
        FROM payment_refunds pr
        INNER JOIN payments p ON p.id = pr.payment_id
        WHERE pr.provider = 'STRIPE' AND pr.status = 'PENDING'
        ORDER BY pr.requested_at ASC, pr.id ASC
        LIMIT ${safeLimit}
    `);

    const summary = {checked:0,succeeded:0,failed:0,pending:0,errors:0};
    for (const refund of rows || []) {
        summary.checked++;
        try {
            const payment = await Payment.findById(refund.payment_id);
            if (!payment) throw new Error(`Paiement ${refund.payment_id} introuvable.`);

            let stripeRefund = null;
            if (String(refund.provider_reference || "").startsWith("re_")) {
                stripeRefund = await StripeService.retrieveRefund(refund.provider_reference);
            } else {
                stripeRefund = await StripeService.findRefundForRecovery({
                    paymentIntentId: refund.payment_provider_reference || payment.provider_reference,
                    refundPublicId: refund.public_id
                });
            }

            if (!stripeRefund) {
                summary.pending++;
                continue;
            }

            const providerStatus = String(stripeRefund.status || "").toLowerCase();
            if (providerStatus === "succeeded") {
                await PaymentRefund.updateProviderResult({refundId:refund.id,status:"SUCCEEDED",providerReference:stripeRefund.id,providerPayload:{id:stripeRefund.id,status:stripeRefund.status,amount:stripeRefund.amount,currency:stripeRefund.currency,livemode:stripeRefund.livemode,reconciled:true},processed:true});
                const updatedPayment = await synchronizePaymentFromRefundSummary(payment);
                await Payment.addEvent({paymentId:payment.id,eventType:"STRIPE_REFUND_RECONCILED",description:"Remboursement Stripe récupéré après incident et réconcilié.",payload:{refundId:refund.id,refundPublicId:refund.public_id,stripeRefundId:stripeRefund.id,providerStatus,paymentStatus:updatedPayment?.status || payment.status}});
                summary.succeeded++;
            } else if (["failed","canceled","cancelled"].includes(providerStatus)) {
                await PaymentRefund.updateProviderResult({refundId:refund.id,status:"FAILED",providerReference:stripeRefund.id,providerPayload:{id:stripeRefund.id,status:stripeRefund.status,failureReason:stripeRefund.failure_reason || null,reconciled:true},processed:true});
                await Payment.addEvent({paymentId:payment.id,eventType:"STRIPE_REFUND_RECONCILED_FAILED",description:"Remboursement Stripe réconcilié en échec.",payload:{refundId:refund.id,stripeRefundId:stripeRefund.id,providerStatus}});
                summary.failed++;
            } else {
                summary.pending++;
            }
        } catch (error) {
            summary.errors++;
            console.error(`[Stripe Refund] Réconciliation refund ${refund.id}:`, error.message);
        }
    }
    return summary;
}

module.exports = {
    buildRefundState,
    assertRefundablePaymentState,
    executeStripeRefund,
    createManualMtnRefundRequest,
    confirmManualMtnRefund,
    cancelManualMtnRefund,
    executeCashRefund,
    reconcilePendingStripeRefunds
};

