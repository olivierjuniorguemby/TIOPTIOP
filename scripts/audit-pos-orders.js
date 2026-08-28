require("dotenv").config();

const db = require("../config/database");

async function main() {
    console.log("============================================================");
    console.log(" TIOPTIOP — 13.9.6.7 — AUDIT COMMANDES POS");
    console.log("============================================================");

    let errors = 0;

    const orphanContext = await db.query(`
        SELECT opc.order_id
        FROM order_pos_context opc
        LEFT JOIN orders o ON o.id = opc.order_id
        WHERE o.id IS NULL
    `);

    const duplicateKeys = await db.query(`
        SELECT idempotency_key, COUNT(*) AS total
        FROM order_pos_context
        GROUP BY idempotency_key
        HAVING COUNT(*) > 1
    `);

    const posWithoutPayment = await db.query(`
        SELECT o.id, o.reference
        FROM orders o
        INNER JOIN order_pos_context opc ON opc.order_id = o.id
        LEFT JOIN payments p ON p.order_id = o.id
        WHERE p.id IS NULL
    `);

    const invalidTotals = await db.query(`
        SELECT
            o.id,
            o.reference,
            o.total_amount,
            COALESCE(SUM(oi.line_total),0) AS items_total,
            o.delivery_fee,
            o.discount_amount,
            o.tax_amount
        FROM orders o
        INNER JOIN order_pos_context opc ON opc.order_id = o.id
        LEFT JOIN order_items oi ON oi.order_id = o.id
        GROUP BY
            o.id, o.reference, o.total_amount,
            o.delivery_fee, o.discount_amount, o.tax_amount
        HAVING ABS(
            o.total_amount -
            (
                COALESCE(SUM(oi.line_total),0)
                - o.discount_amount
                + o.delivery_fee
                + o.tax_amount
            )
        ) > 0.009
    `);

    const paymentMismatch = await db.query(`
        SELECT
            o.id,
            o.reference,
            o.total_amount,
            p.amount,
            p.id AS payment_id
        FROM orders o
        INNER JOIN order_pos_context opc ON opc.order_id = o.id
        INNER JOIN payments p
            ON p.id = (
                SELECT p2.id
                FROM payments p2
                WHERE p2.order_id = o.id
                ORDER BY p2.id ASC
                LIMIT 1
            )
        WHERE ABS(o.total_amount - p.amount) > 0.009
    `);

    const checks = [
        ["Aucun contexte POS orphelin", orphanContext],
        ["Aucune clé d'idempotence POS dupliquée", duplicateKeys],
        ["Chaque commande POS possède un paiement", posWithoutPayment],
        ["Totaux commandes POS cohérents", invalidTotals],
        ["Montant paiement initial = total commande", paymentMismatch]
    ];

    for (const [label, rows] of checks) {
        if (rows.length) {
            errors += rows.length;
            console.log(`❌ ${label} : ${rows.length}`);
            console.table(rows);
        }
        else {
            console.log(`✅ ${label}`);
        }
    }

    console.log("------------------------------------------------------------");
    console.log(`Erreurs critiques : ${errors}`);

    if (errors > 0) {
        process.exitCode = 1;
    }
    else {
        console.log("✅ 13.9.6.7 : intégrité transactionnelle POS validée.");
    }
}

main()
    .catch(error => {
        console.error("Audit POS impossible :", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await db.pool.end();
        }
        catch (_) {}
    });
