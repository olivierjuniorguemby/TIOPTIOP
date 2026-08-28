require("dotenv").config();

const db = require("../config/database");

/*
 * TIOPTIOP — 13.9.4.4
 * Audit lecture seule des remboursements.
 *
 * Ne crée, ne modifie et ne rembourse rien.
 */

(async () => {
    try {
        const rows = await db.query(`
            SELECT
                p.id AS payment_id,
                p.public_id AS payment_public_id,
                p.status AS payment_status,
                p.amount AS payment_amount,
                p.currency,
                p.provider_reference,

                COALESCE(
                    SUM(
                        CASE
                            WHEN pr.status = 'SUCCEEDED'
                            THEN pr.amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS total_refunded,

                COALESCE(
                    SUM(
                        CASE
                            WHEN pr.status = 'PENDING'
                            THEN pr.amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS total_pending,

                COUNT(pr.id) AS refund_count

            FROM payments p

            LEFT JOIN payment_refunds pr
                ON pr.payment_id = p.id

            WHERE p.method = 'CARD'
              AND (
                    p.status IN ('PARTIAL', 'REFUNDED')
                    OR pr.id IS NOT NULL
                  )

            GROUP BY
                p.id,
                p.public_id,
                p.status,
                p.amount,
                p.currency,
                p.provider_reference

            ORDER BY p.id DESC
        `);

        console.log("");
        console.log("==============================================================");
        console.log(" TIOPTIOP — AUDIT REMBOURSEMENTS 13.9.4.4");
        console.log("==============================================================");
        console.log("");

        if (!rows.length) {
            console.log("Aucun remboursement Stripe à auditer.");
            process.exit(0);
        }

        let errors = 0;

        const output = rows.map(row => {
            const amount = Number(row.payment_amount || 0);
            const refunded = Number(row.total_refunded || 0);
            const pending = Number(row.total_pending || 0);
            const remaining = Math.max(0, amount - refunded - pending);

            let expectedStatus = row.payment_status;

            if (refunded >= amount && amount > 0) {
                expectedStatus = "REFUNDED";
            }
            else if (refunded > 0) {
                expectedStatus = "PARTIAL";
            }

            const valid =
                refunded <= amount
                &&
                pending <= amount
                &&
                refunded + pending <= amount
                &&
                (
                    refunded === 0
                    ||
                    row.payment_status === expectedStatus
                );

            if (!valid) {
                errors += 1;
            }

            return {
                paymentId: row.payment_id,
                status: row.payment_status,
                amount,
                refunded,
                pending,
                remaining,
                refunds: Number(row.refund_count || 0),
                expectedStatus,
                valid
            };
        });

        console.table(output);

        console.log("");

        if (errors > 0) {
            console.error(`❌ ${errors} incohérence(s) détectée(s).`);
            process.exit(1);
        }

        console.log("✅ Cohérence remboursements PARTIAL / REFUNDED validée.");
        process.exit(0);
    }
    catch (error) {
        console.error("❌ Audit remboursements :", error);
        process.exit(1);
    }
})();
