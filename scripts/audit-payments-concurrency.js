const db = require("../config/database");

async function main() {
    console.log("============================================================");
    console.log(" TIOPTIOP — AUDIT 13.9.5.2");
    console.log(" Doubles actions / concurrence / idempotence");
    console.log("============================================================");

    let errors = 0;
    let warnings = 0;

    const duplicateRefundKeys = await db.query(`
        SELECT idempotency_key, COUNT(*) AS total
        FROM payment_refunds
        WHERE idempotency_key IS NOT NULL
          AND idempotency_key <> ''
        GROUP BY idempotency_key
        HAVING COUNT(*) > 1
    `);

    if (duplicateRefundKeys.length) {
        errors += duplicateRefundKeys.length;
        console.log("❌ Clés d'idempotence refund dupliquées :", duplicateRefundKeys);
    } else {
        console.log("✅ Aucune clé d'idempotence de remboursement dupliquée.");
    }

    const impossibleRefunds = await db.query(`
        SELECT id, payment_id, status, processed_at
        FROM payment_refunds
        WHERE status IN ('SUCCEEDED','FAILED','CANCELLED')
          AND processed_at IS NULL
    `);

    if (impossibleRefunds.length) {
        warnings += impossibleRefunds.length;
        console.log("⚠️ Refunds terminaux sans processed_at :", impossibleRefunds);
    } else {
        console.log("✅ Tous les remboursements terminaux ont processed_at.");
    }

    const duplicateCashEvents = await db.query(`
        SELECT payment_id, COUNT(*) AS total
        FROM payment_events
        WHERE event_type = 'CASH_PAYMENT_COLLECTED'
        GROUP BY payment_id
        HAVING COUNT(*) > 1
    `);

    if (duplicateCashEvents.length) {
        errors += duplicateCashEvents.length;
        console.log("❌ Encaissements CASH dupliqués :", duplicateCashEvents);
    } else {
        console.log("✅ Aucun événement CASH_PAYMENT_COLLECTED dupliqué.");
    }

    const duplicateMtnConfirmed = await db.query(`
        SELECT
            JSON_UNQUOTE(JSON_EXTRACT(payload, '$.refundId')) AS refund_id,
            COUNT(*) AS total
        FROM payment_events
        WHERE event_type = 'MTN_MOMO_REFUND_CONFIRMED'
          AND JSON_VALID(payload)
        GROUP BY JSON_UNQUOTE(JSON_EXTRACT(payload, '$.refundId'))
        HAVING refund_id IS NOT NULL AND COUNT(*) > 1
    `);

    if (duplicateMtnConfirmed.length) {
        errors += duplicateMtnConfirmed.length;
        console.log("❌ Confirmations MTN dupliquées :", duplicateMtnConfirmed);
    } else {
        console.log("✅ Aucune confirmation MTN dupliquée par refundId.");
    }

    const duplicateMtnCancelled = await db.query(`
        SELECT
            JSON_UNQUOTE(JSON_EXTRACT(payload, '$.refundId')) AS refund_id,
            COUNT(*) AS total
        FROM payment_events
        WHERE event_type = 'MTN_MOMO_REFUND_CANCELLED'
          AND JSON_VALID(payload)
        GROUP BY JSON_UNQUOTE(JSON_EXTRACT(payload, '$.refundId'))
        HAVING refund_id IS NOT NULL AND COUNT(*) > 1
    `);

    if (duplicateMtnCancelled.length) {
        errors += duplicateMtnCancelled.length;
        console.log("❌ Annulations MTN dupliquées :", duplicateMtnCancelled);
    } else {
        console.log("✅ Aucune annulation MTN dupliquée par refundId.");
    }

    console.log("------------------------------------------------------------");
    console.log(`Erreurs critiques : ${errors}`);
    console.log(`Avertissements    : ${warnings}`);

    if (errors === 0) {
        console.log("✅ 13.9.5.2 : cohérence d'idempotence validée.");
    } else {
        console.log("❌ 13.9.5.2 : anomalies critiques détectées.");
        process.exitCode = 1;
    }
}

main()
    .catch((error) => {
        console.error("Erreur audit 13.9.5.2 :", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await db.pool.end();
        } catch (_) {}
    });
