const Loyalty = require("../../models/loyalty.model");
const crypto = require("crypto");

const AdminPayment = require("../../models/admin-payment.model");
const PaymentRefund = require("../../models/payment-refund.model");
const RefundService = require("../../services/refund.service");
const Payment = require("../../models/payment.model");

/* =========================================================
   ADMIN PAYMENT CONTROLLER
   TIOPTIOP — 13.9.2
========================================================= */

function cleanString(value, max = 180) {
    return String(value || "").trim().slice(0, max);
}

exports.index = async function (req, res, next) {
    try {
        const filters = {
            search: cleanString(req.query.search, 180),
            method: cleanString(req.query.method, 30).toUpperCase(),
            status: cleanString(req.query.status, 30).toUpperCase(),
            provider: cleanString(req.query.provider, 80).toUpperCase()
        };

        const [payments, stats, providers] = await Promise.all([
            AdminPayment.list(filters),
            AdminPayment.getStats(),
            AdminPayment.getProviders()
        ]);

        return res.render("admin/operations/payments", {
            title: "Paiements & caisse",
            layout: "layouts/admin",
            payments,
            stats,
            providers,
            filters
        });
    }
    catch (error) {
        console.error("Erreur paiements admin :", error);
        return next(error);
    }
};


exports.detail = async function (req, res, next) {
    try {
        const paymentId = Number(req.params.id);

        if (!Number.isInteger(paymentId) || paymentId <= 0) {
            return res.status(404).render("errors/404", {
                title: "Paiement introuvable"
            });
        }

        const [payment, events, refunds, refundSummary] = await Promise.all([
            AdminPayment.findDetailById(paymentId),
            AdminPayment.getEventsByPaymentId(paymentId),
            PaymentRefund.listByPaymentId(paymentId),
            PaymentRefund.getSummaryByPaymentId(paymentId)
        ]);

        if (!payment) {
            return res.status(404).render("errors/404", {
                title: "Paiement introuvable"
            });
        }

        return res.render("admin/operations/payment-detail", {
            title: `Paiement #${payment.id}`,
            layout: "layouts/admin",
            payment,
            events,
            refunds,
            refundSummary,
            refundState: RefundService.buildRefundState(payment, refundSummary),
            refundRequestToken: crypto.randomUUID()
        });
    }
    catch (error) {
        console.error("Erreur détail paiement admin :", error);
        return next(error);
    }
};


/* =========================================================
   13.9.4.3 — REMBOURSEMENT STRIPE TEST
========================================================= */

exports.refundStripe = async function (req, res) {
    const paymentId =
        Number(
            req.params.id
        );

    const redirectUrl =
        `/admin/paiements/${paymentId}`;

    try {
        if (
            !Number.isInteger(paymentId)
            ||
            paymentId <= 0
        ) {
            req.session.flashError =
                "Paiement invalide.";

            return res.redirect(
                "/admin/paiements"
            );
        }

        const payment =
            await AdminPayment
                .findDetailById(
                    paymentId
                );

        if (!payment) {
            req.session.flashError =
                "Paiement introuvable.";

            return res.redirect(
                "/admin/paiements"
            );
        }

        const refundType =
            cleanString(
                req.body.refundType,
                20
            )
                .toUpperCase();

        const amount =
            Number(
                req.body.amount
            );

        const reasonCode =
            cleanString(
                req.body.reasonCode,
                60
            )
                .toUpperCase();

        const reasonText =
            cleanString(
                req.body.reasonText,
                500
            );

        const formToken =
            cleanString(
                req.body.refundRequestToken,
                100
            );

        const adminId =
            Number(
                req.session?.admin?.id
            );

        const result =
            await RefundService
                .executeStripeRefund({
                    payment,

                    refundType,

                    amount,

                    reasonCode,

                    reasonText,

                    requestedByAdminUserId:
                        Number.isInteger(adminId)
                        &&
                        adminId > 0

                            ? adminId

                            : null,

                    formToken
                });

        if (
            result.duplicate
        ) {
            req.session.flashSuccess =
                "Cette demande de remboursement avait déjà été traitée. Aucun doublon Stripe n'a été créé.";
        }
        else if (
            result.providerStatus ===
            "pending"
        ) {
            req.session.flashSuccess =
                "Remboursement Stripe envoyé. Il est en attente de confirmation.";
        }
        else {
            req.session.flashSuccess =
                `Remboursement Stripe TEST réussi : ${Number(result.refund.amount).toLocaleString("fr-FR")} ${result.refund.currency}.`;
        }

        return res.redirect(
            redirectUrl
        );
    }
    catch (error) {
        console.error(
            "Erreur remboursement Stripe admin :",
            error
        );

        req.session.flashError =
            error.message
            ||
            "Le remboursement Stripe a échoué.";

        return res.redirect(
            redirectUrl
        );
    }
};


/* =========================================================
   13.9.4.5 — MTN MOMO : CREER DEMANDE MANUELLE
========================================================= */

exports.refundMtnCreate = async function (req, res) {
    const paymentId = Number(req.params.id);
    const redirectUrl = `/admin/paiements/${paymentId}`;

    try {
        const payment =
            await AdminPayment.findDetailById(
                paymentId
            );

        if (!payment) {
            throw new Error(
                "Paiement introuvable."
            );
        }

        const adminId =
            Number(
                req.session?.admin?.id
            );

        const result =
            await RefundService
                .createManualMtnRefundRequest({
                    payment,

                    refundType:
                        cleanString(
                            req.body.refundType,
                            20
                        ).toUpperCase(),

                    amount:
                        Number(
                            req.body.amount
                        ),

                    reasonCode:
                        cleanString(
                            req.body.reasonCode,
                            60
                        ).toUpperCase(),

                    reasonText:
                        cleanString(
                            req.body.reasonText,
                            500
                        ),

                    requestedByAdminUserId:
                        Number.isInteger(adminId)
                        && adminId > 0
                            ? adminId
                            : null,

                    formToken:
                        cleanString(
                            req.body.refundRequestToken,
                            100
                        )
                });

        req.session.flashSuccess =
            result.duplicate
                ? "Cette demande MTN MoMo existe déjà."
                : "Demande de remboursement MTN MoMo enregistrée. Effectuez maintenant le remboursement via votre canal MTN puis confirmez sa référence ici.";

        return res.redirect(
            redirectUrl
        );
    }
    catch (error) {
        console.error(
            "Erreur création remboursement MTN :",
            error
        );

        req.session.flashError =
            error.message
            || "Impossible de créer la demande de remboursement MTN.";

        return res.redirect(
            redirectUrl
        );
    }
};


/* =========================================================
   13.9.4.5 — MTN MOMO : CONFIRMER APRES OPERATION MANUELLE
========================================================= */

exports.refundMtnConfirm = async function (req, res) {
    const paymentId = Number(req.params.id);
    const refundId = Number(req.params.refundId);
    const redirectUrl = `/admin/paiements/${paymentId}`;

    try {
        const payment =
            await AdminPayment.findDetailById(
                paymentId
            );

        if (!payment) {
            throw new Error(
                "Paiement introuvable."
            );
        }

        const adminId =
            Number(
                req.session?.admin?.id
            );

        const result =
            await RefundService
                .confirmManualMtnRefund({
                    payment,
                    refundId,

                    providerReference:
                        cleanString(
                            req.body.providerReference,
                            180
                        ),

                    adminNote:
                        cleanString(
                            req.body.adminNote,
                            500
                        ),

                    confirmedByAdminUserId:
                        Number.isInteger(adminId)
                        && adminId > 0
                            ? adminId
                            : null
                });

        req.session.flashSuccess =
            result.duplicate
                ? "Ce remboursement MTN MoMo était déjà confirmé."
                : `Remboursement MTN MoMo confirmé : ${Number(result.refund.amount).toLocaleString("fr-FR")} ${result.refund.currency}.`;

        return res.redirect(
            redirectUrl
        );
    }
    catch (error) {
        console.error(
            "Erreur confirmation remboursement MTN :",
            error
        );

        req.session.flashError =
            error.message
            || "Impossible de confirmer le remboursement MTN.";

        return res.redirect(
            redirectUrl
        );
    }
};


/* =========================================================
   13.9.4.5 — MTN MOMO : ANNULER DEMANDE NON EXECUTEE
========================================================= */

exports.refundMtnCancel = async function (req, res) {
    const paymentId = Number(req.params.id);
    const refundId = Number(req.params.refundId);
    const redirectUrl = `/admin/paiements/${paymentId}`;

    try {
        const payment =
            await AdminPayment.findDetailById(
                paymentId
            );

        if (!payment) {
            throw new Error(
                "Paiement introuvable."
            );
        }

        const adminId =
            Number(
                req.session?.admin?.id
            );

        const result =
            await RefundService
            .cancelManualMtnRefund({
                payment,
                refundId,

                reason:
                    cleanString(
                        req.body.reason,
                        500
                    ),

                cancelledByAdminUserId:
                    Number.isInteger(adminId)
                    && adminId > 0
                        ? adminId
                        : null
            });

        req.session.flashSuccess =
            result.duplicate
                ? "Cette demande MTN MoMo était déjà annulée."
                : "Demande de remboursement MTN MoMo annulée.";

        return res.redirect(
            redirectUrl
        );
    }
    catch (error) {
        console.error(
            "Erreur annulation remboursement MTN :",
            error
        );

        req.session.flashError =
            error.message
            || "Impossible d'annuler la demande MTN.";

        return res.redirect(
            redirectUrl
        );
    }
};


/* =========================================================
   13.9.4.5 — CASH : REMBOURSEMENT MANUEL IMMEDIAT
========================================================= */

exports.refundCash = async function (req, res) {
    const paymentId = Number(req.params.id);
    const redirectUrl = `/admin/paiements/${paymentId}`;

    try {
        const payment =
            await AdminPayment.findDetailById(
                paymentId
            );

        if (!payment) {
            throw new Error(
                "Paiement introuvable."
            );
        }

        const adminId =
            Number(
                req.session?.admin?.id
            );

        const result =
            await RefundService
                .executeCashRefund({
                    payment,

                    refundType:
                        cleanString(
                            req.body.refundType,
                            20
                        ).toUpperCase(),

                    amount:
                        Number(
                            req.body.amount
                        ),

                    reasonCode:
                        cleanString(
                            req.body.reasonCode,
                            60
                        ).toUpperCase(),

                    reasonText:
                        cleanString(
                            req.body.reasonText,
                            500
                        ),

                    cashReference:
                        cleanString(
                            req.body.cashReference,
                            180
                        ),

                    requestedByAdminUserId:
                        Number.isInteger(adminId)
                        && adminId > 0
                            ? adminId
                            : null,

                    formToken:
                        cleanString(
                            req.body.refundRequestToken,
                            100
                        )
                });

        req.session.flashSuccess =
            result.duplicate
                ? "Ce remboursement espèces avait déjà été enregistré."
                : `Remboursement espèces confirmé : ${Number(result.refund.amount).toLocaleString("fr-FR")} ${result.refund.currency}.`;

        return res.redirect(
            redirectUrl
        );
    }
    catch (error) {
        console.error(
            "Erreur remboursement espèces :",
            error
        );

        req.session.flashError =
            error.message
            || "Impossible d'enregistrer le remboursement espèces.";

        return res.redirect(
            redirectUrl
        );
    }
};


/* =========================================================
   13.9.4.5.1 — CASH : CONFIRMER L'ENCAISSEMENT
========================================================= */
exports.collectCash = async function (req, res) {
    const paymentId = Number(req.params.id);
    const redirectUrl = `/admin/paiements/${paymentId}`;
    try {
        const adminId = Number(req.session?.admin?.id);
        const result = await Payment.collectCashPayment({
            paymentId,
            collectedBy: Number.isInteger(adminId) && adminId > 0 ? adminId : null,
            receivedAmount: req.body.receivedAmount,
            comment: cleanString(req.body.comment, 500)
        });
        // collectCashPayment() peut renvoyer directement le paiement
        // ou un objet contenant { payment, duplicate } selon l'implémentation.
        // On normalise donc le résultat avant de construire le message.
        const collectedPayment = result?.payment || result;

        if (!collectedPayment) {
            throw new Error("Le paiement encaissé n'a pas été retourné par le modèle.");
        }

        const collectedAmount = Number(collectedPayment.amount || 0);
        const collectedCurrency = collectedPayment.currency || "XAF";

        // 16.7 FIX — CASH ne passe pas par PaymentService.markPaid().
        // Il faut donc finaliser ici l'avantage RESERVED -> USED après encaissement.
        // finalizeOrderRedemption() est idempotent : on l'appelle même si collectCashPayment()
        // indique un doublon, ce qui permet aussi de réparer une ancienne commande déjà encaissée
        // dont l'avantage serait resté RESERVED.
        try {
            const lifecycleResult = await Loyalty.finalizeOrderRedemption(
                collectedPayment.order_id,
                'CASH_PAYMENT_CONFIRMED'
            );

            if (lifecycleResult?.finalized && !lifecycleResult?.duplicate) {
                await Payment.addEvent({
                    paymentId: collectedPayment.id,
                    eventType: "LOYALTY_REWARD_USED",
                    description: "Avantage Tiop+ définitivement consommé après encaissement espèces.",
                    payload: lifecycleResult
                });
            }
        } catch (loyaltyLifecycleError) {
            // Un paiement espèces déjà encaissé ne doit jamais être annulé à cause d'un souci fidélité.
            console.error("[TIOP+ 16.7] Finalisation avantage CASH impossible :", loyaltyLifecycleError);
        }

        // 16.2 — Crédit des points gagnés après paiement.
        // awardPaidOrder() possède déjà sa propre idempotence SQL : on peut donc l'appeler
        // même lors d'une nouvelle ouverture/reconfirmation technique sans doubler les points.
        try {
            const loyaltyResult = await Loyalty.awardPaidOrder(collectedPayment.id);
            if (loyaltyResult?.credited) {
                await Payment.addEvent({
                    paymentId: collectedPayment.id,
                    eventType: "LOYALTY_POINTS_EARNED",
                    description: `${loyaltyResult.points} point(s) Tiop+ crédité(s).`,
                    payload: loyaltyResult
                });
            }
        } catch (loyaltyError) {
            console.error("[TIOP+ 16.2] Crédit CASH impossible :", loyaltyError);
        }

        req.session.flashSuccess = result?.duplicate
            ? "Ce paiement en espèces était déjà encaissé."
            : `Paiement en espèces encaissé : ${collectedAmount.toLocaleString("fr-FR")} ${collectedCurrency}.`;
        return res.redirect(redirectUrl);
    } catch (error) {
        console.error("Erreur encaissement espèces :", error);
        req.session.flashError = error.message || "Impossible de confirmer l'encaissement espèces.";
        return res.redirect(redirectUrl);
    }
};
