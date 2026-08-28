const PaymentService = require("./payment.service");
const RefundService = require("./refund.service");

/* =========================================================
   PAYMENT / REFUND RECONCILIATION
   TIOPTIOP — 13.9.5.3
========================================================= */

let timer = null;
let running = false;

function envNumber(name, fallback, minimum) {
    const value = Number(process.env[name] || fallback);
    return Math.max(minimum, Number.isFinite(value) ? value : fallback);
}

async function runOnce() {
    if (running) return { skipped: true, reason: "ALREADY_RUNNING" };
    running = true;

    try {
        const mtn = await PaymentService.reconcilePendingMtnMomo({
            limit: envNumber("MTN_MOMO_RECONCILIATION_LIMIT", 50, 1)
        }).catch(error => ({ checked:0, paid:0, failed:0, pending:0, notFound:0, errors:1, error:error.message }));

        const stripe = await PaymentService.reconcileStripeCardPayments({
            limit: envNumber("STRIPE_RECONCILIATION_LIMIT", 50, 1)
        }).catch(error => ({ checked:0, consistent:0, repaired:0, errors:1, error:error.message, rows:[] }));

        const stripeRefunds = await RefundService.reconcilePendingStripeRefunds({
            limit: envNumber("STRIPE_REFUND_RECONCILIATION_LIMIT", 50, 1)
        }).catch(error => ({ checked:0, succeeded:0, failed:0, pending:0, errors:1, error:error.message }));

        const result = { mtn, stripe, stripeRefunds };
        if ((mtn.checked || 0) + (stripe.checked || 0) + (stripeRefunds.checked || 0) > 0) {
            console.log("[Payments] Réconciliation 13.9.5.3 :", {
                mtn: {checked:mtn.checked,paid:mtn.paid,failed:mtn.failed,pending:mtn.pending,notFound:mtn.notFound || 0,errors:mtn.errors},
                stripe: {checked:stripe.checked,consistent:stripe.consistent,repaired:stripe.repaired,errors:stripe.errors},
                stripeRefunds: {checked:stripeRefunds.checked,succeeded:stripeRefunds.succeeded,failed:stripeRefunds.failed,pending:stripeRefunds.pending,errors:stripeRefunds.errors}
            });
        }
        return result;
    } finally {
        running = false;
    }
}

function start() {
    const enabled = String(process.env.PAYMENT_RECONCILIATION_ENABLED ?? process.env.MTN_MOMO_RECONCILIATION_ENABLED ?? "true")
        .trim().toLowerCase() !== "false";
    if (!enabled) {
        console.log("[Payments] Réconciliation automatique désactivée.");
        return;
    }
    if (timer) return;

    const intervalMs = envNumber("PAYMENT_RECONCILIATION_INTERVAL_MS", process.env.MTN_MOMO_RECONCILIATION_INTERVAL_MS || 60000, 15000);
    const initialDelayMs = envNumber("PAYMENT_RECONCILIATION_INITIAL_DELAY_MS", process.env.MTN_MOMO_RECONCILIATION_INITIAL_DELAY_MS || 10000, 3000);

    const launch = async () => {
        try { await runOnce(); }
        catch (error) { console.error("[Payments] Réconciliation :", error); }
    };

    const startupTimer = setTimeout(() => {
        launch();
        timer = setInterval(launch, intervalMs);
        timer.unref?.();
    }, initialDelayMs);
    startupTimer.unref?.();
}

module.exports = { start, runOnce };
