require("dotenv").config();

const db =
    require("../config/database");


/* =========================================================
   TIOPTIOP — 13.9.5.1
   AUDIT COHERENCE PAIEMENTS / REMBOURSEMENTS / COMMANDES

   LECTURE SEULE :
   - aucun INSERT
   - aucun UPDATE
   - aucun appel Stripe
   - aucun appel MTN MoMo
========================================================= */


function number(value) {

    const n =
        Number(
            value
        );


    return Number.isFinite(n)
        ? n
        : 0;
}


(async () => {

    try {

        const rows =
            await db.query(
                `
                SELECT
                    p.id AS payment_id,
                    p.order_id,
                    o.reference AS order_reference,
                    o.status AS order_status,
                    o.order_type,

                    p.method,
                    p.provider,
                    p.status AS payment_status,
                    p.amount AS payment_amount,
                    p.currency,
                    p.paid_at,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN pr.status = 'SUCCEEDED'
                                THEN pr.amount
                                ELSE 0
                            END
                        ),
                        0
                    ) AS refunded_amount,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN pr.status = 'PENDING'
                                THEN pr.amount
                                ELSE 0
                            END
                        ),
                        0
                    ) AS pending_refund_amount,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN pr.status = 'FAILED'
                                THEN 1
                                ELSE 0
                            END
                        ),
                        0
                    ) AS failed_refund_count,

                    COUNT(pr.id) AS refund_count

                FROM payments p

                INNER JOIN orders o
                    ON o.id = p.order_id

                LEFT JOIN payment_refunds pr
                    ON pr.payment_id = p.id

                GROUP BY
                    p.id,
                    p.order_id,
                    o.reference,
                    o.status,
                    o.order_type,
                    p.method,
                    p.provider,
                    p.status,
                    p.amount,
                    p.currency,
                    p.paid_at

                ORDER BY p.id DESC
                `
            );


        console.log("");
        console.log(
            "======================================================================"
        );
        console.log(
            " TIOPTIOP — AUDIT PAIEMENTS 13.9.5.1"
        );
        console.log(
            "======================================================================"
        );
        console.log("");


        if (!rows.length) {

            console.log(
                "Aucun paiement à auditer."
            );

            process.exit(0);
        }


        let errorCount =
            0;

        let warningCount =
            0;


        const results =
            rows.map(
                row => {

                    const amount =
                        number(
                            row.payment_amount
                        );

                    const refunded =
                        number(
                            row.refunded_amount
                        );

                    const pendingRefund =
                        number(
                            row.pending_refund_amount
                        );

                    const status =
                        String(
                            row.payment_status || ""
                        ).toUpperCase();

                    const method =
                        String(
                            row.method || ""
                        ).toUpperCase();

                    const orderStatus =
                        String(
                            row.order_status || ""
                        ).toUpperCase();

                    const errors = [];
                    const warnings = [];


                    if (
                        amount <= 0
                    ) {

                        errors.push(
                            "montant paiement <= 0"
                        );
                    }


                    if (
                        refunded < 0
                        ||
                        pendingRefund < 0
                    ) {

                        errors.push(
                            "montant remboursement négatif"
                        );
                    }


                    if (
                        refunded >
                        amount
                    ) {

                        errors.push(
                            "sur-remboursement SUCCEEDED"
                        );
                    }


                    if (
                        refunded
                        +
                        pendingRefund
                        >
                        amount
                    ) {

                        errors.push(
                            "SUCCEEDED + PENDING dépasse le paiement"
                        );
                    }


                    if (
                        status === "PAID"
                        &&
                        !row.paid_at
                    ) {

                        errors.push(
                            "PAID sans paid_at"
                        );
                    }


                    if (
                        status === "PARTIAL"
                    ) {

                        if (
                            refunded <= 0
                            ||
                            refunded >= amount
                        ) {

                            errors.push(
                                "PARTIAL incohérent avec le total remboursé"
                            );
                        }
                    }


                    if (
                        status === "REFUNDED"
                        &&
                        refunded !== amount
                    ) {

                        errors.push(
                            "REFUNDED mais total remboursé != montant paiement"
                        );
                    }


                    if (
                        status === "PAID"
                        &&
                        refunded > 0
                    ) {

                        errors.push(
                            "PAID avec remboursement SUCCEEDED existant"
                        );
                    }


                    if (
                        [
                            "PENDING",
                            "AUTHORIZED",
                            "FAILED",
                            "CANCELLED"
                        ].includes(
                            status
                        )
                        &&
                        refunded > 0
                    ) {

                        errors.push(
                            `${status} avec remboursement SUCCEEDED`
                        );
                    }


                    if (
                        method === "CASH"
                        &&
                        [
                            "PAID",
                            "PARTIAL",
                            "REFUNDED"
                        ].includes(
                            status
                        )
                        &&
                        !row.paid_at
                    ) {

                        errors.push(
                            "CASH encaissé sans paid_at"
                        );
                    }


                    if (
                        orderStatus === "REFUNDED"
                        &&
                        status !== "REFUNDED"
                    ) {

                        errors.push(
                            "commande REFUNDED mais paiement non REFUNDED"
                        );
                    }


                    if (
                        status === "REFUNDED"
                        &&
                        orderStatus !== "REFUNDED"
                    ) {

                        warnings.push(
                            "paiement REFUNDED, commande encore dans son statut opérationnel"
                        );
                    }


                    if (
                        orderStatus === "DELIVERED"
                        &&
                        [
                            "FAILED",
                            "CANCELLED"
                        ].includes(
                            status
                        )
                        &&
                        method !== "CASH"
                    ) {

                        warnings.push(
                            "commande livrée avec paiement électronique non payé"
                        );
                    }


                    errorCount +=
                        errors.length;

                    warningCount +=
                        warnings.length;


                    return {
                        paymentId:
                            row.payment_id,

                        order:
                            row.order_reference,

                        orderStatus,

                        method,

                        paymentStatus:
                            status,

                        amount,

                        refunded,

                        pendingRefund,

                        errors:
                            errors.join(" | ")
                            ||
                            "—",

                        warnings:
                            warnings.join(" | ")
                            ||
                            "—",

                        valid:
                            errors.length === 0
                    };
                }
            );


        console.table(
            results
        );


        console.log("");

        console.log(
            `Erreurs : ${errorCount}`
        );

        console.log(
            `Avertissements : ${warningCount}`
        );


        if (
            errorCount > 0
        ) {

            console.error(
                "❌ Des incohérences financières ont été détectées."
            );

            process.exit(1);
        }


        console.log(
            "✅ Cohérence financière critique validée."
        );


        if (
            warningCount > 0
        ) {

            console.log(
                "ℹ️ Les avertissements sont non bloquants et doivent être examinés."
            );
        }


        process.exit(0);
    }
    catch (error) {

        console.error(
            "❌ Audit paiements :",
            error
        );

        process.exit(1);
    }
})();
