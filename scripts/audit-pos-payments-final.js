require("dotenv").config();

const db = require("../config/database");

/* =========================================================
   TIOPTIOP — 13.9.6.8.5
   AUDIT FINAL D'INTEGRITE PAIEMENTS / REFUNDS / COMMANDES

   STRICTEMENT READ-ONLY :
   - aucun INSERT / UPDATE / DELETE
   - aucun appel Stripe
   - aucun appel MTN MoMo
   - compatible CASH / CARD Stripe / MOBILE_MONEY
========================================================= */

async function query(sql, params = []) {
    const rows = await db.query(sql, params);
    return Array.isArray(rows) ? rows : [];
}

function section(title) {
    console.log("\n------------------------------------------------------------");
    console.log(title);
    console.log("------------------------------------------------------------");
}

function printRows(rows) {
    if (rows.length) console.table(rows);
}

async function main() {
    let errors = 0;
    let warnings = 0;

    const critical = async (label, sql) => {
        const rows = await query(sql);
        if (rows.length) {
            errors += rows.length;
            console.log(`❌ ${label} : ${rows.length}`);
            printRows(rows);
        } else {
            console.log(`✅ ${label}`);
        }
    };

    const warning = async (label, sql) => {
        const rows = await query(sql);
        if (rows.length) {
            warnings += rows.length;
            console.log(`⚠️ ${label} : ${rows.length}`);
            printRows(rows);
        } else {
            console.log(`✅ ${label}`);
        }
    };

    console.log("============================================================");
    console.log(" TIOPTIOP — 13.9.6.8.5 — AUDIT FINAL PAIEMENTS");
    console.log(" Intégrité globale / reprise / idempotence / traçabilité");
    console.log("============================================================");

    section("1. INTEGRITE REFERENTIELLE");
    await critical("Aucun paiement orphelin", `
        SELECT p.id AS payment_id, p.order_id
        FROM payments p
        LEFT JOIN orders o ON o.id = p.order_id
        WHERE o.id IS NULL
    `);
    await critical("Aucun remboursement orphelin", `
        SELECT pr.id AS refund_id, pr.payment_id
        FROM payment_refunds pr
        LEFT JOIN payments p ON p.id = pr.payment_id
        WHERE p.id IS NULL
    `);
    await critical("Aucun événement de paiement orphelin", `
        SELECT pe.id AS event_id, pe.payment_id, pe.event_type
        FROM payment_events pe
        LEFT JOIN payments p ON p.id = pe.payment_id
        WHERE p.id IS NULL
    `);

    section("2. IDENTIFIANTS ET REFERENCES PROVIDER");
    await critical("Aucun public_id paiement dupliqué", `
        SELECT public_id, COUNT(*) AS total
        FROM payments
        WHERE public_id IS NOT NULL AND public_id <> ''
        GROUP BY public_id HAVING COUNT(*) > 1
    `);
    await critical("Aucune provider_reference paiement dupliquée", `
        SELECT provider_reference, COUNT(*) AS total
        FROM payments
        WHERE provider_reference IS NOT NULL AND provider_reference <> ''
        GROUP BY provider_reference HAVING COUNT(*) > 1
    `);
    await critical("Aucun public_id remboursement dupliqué", `
        SELECT public_id, COUNT(*) AS total
        FROM payment_refunds
        WHERE public_id IS NOT NULL AND public_id <> ''
        GROUP BY public_id HAVING COUNT(*) > 1
    `);
    await critical("Aucune clé d'idempotence remboursement dupliquée", `
        SELECT idempotency_key, COUNT(*) AS total
        FROM payment_refunds
        WHERE idempotency_key IS NOT NULL AND idempotency_key <> ''
        GROUP BY idempotency_key HAVING COUNT(*) > 1
    `);
    /*
       Une provider_reference doit être unique lorsqu'elle identifie
       réellement une opération distante unique (ex. Stripe re_xxx).

       Pour les remboursements manuels MTN/CASH, plusieurs remboursements
       partiels d'un même paiement peuvent partager une référence métier /
       commande. L'idempotence de chaque demande reste garantie séparément
       par idempotency_key.
    */
    await critical("Aucune référence Stripe de remboursement dupliquée", `
        SELECT provider, provider_reference, COUNT(*) AS total
        FROM payment_refunds
        WHERE UPPER(provider)='STRIPE'
          AND provider_reference IS NOT NULL
          AND provider_reference <> ''
        GROUP BY provider, provider_reference
        HAVING COUNT(*) > 1
    `);

    section("3. MONTANTS ET STATUTS FINANCIERS");
    await critical("Tous les paiements ont un montant positif", `
        SELECT id AS payment_id, amount, status, method
        FROM payments
        WHERE amount IS NULL OR amount <= 0
    `);
    await critical("Tous les remboursements ont un montant positif", `
        SELECT id AS refund_id, payment_id, amount, status
        FROM payment_refunds
        WHERE amount IS NULL OR amount <= 0
    `);
    await critical("Devise refund identique au paiement", `
        SELECT pr.id AS refund_id, pr.payment_id,
               pr.currency AS refund_currency, p.currency AS payment_currency
        FROM payment_refunds pr
        INNER JOIN payments p ON p.id = pr.payment_id
        WHERE UPPER(COALESCE(pr.currency,'')) <> UPPER(COALESCE(p.currency,''))
    `);
    await critical("Aucun sur-remboursement SUCCEEDED", `
        SELECT p.id AS payment_id, p.amount,
               SUM(CASE WHEN pr.status='SUCCEEDED' THEN pr.amount ELSE 0 END) AS refunded
        FROM payments p
        LEFT JOIN payment_refunds pr ON pr.payment_id=p.id
        GROUP BY p.id, p.amount
        HAVING refunded > p.amount
    `);
    await critical("SUCCEEDED + PENDING ne dépasse jamais le paiement", `
        SELECT p.id AS payment_id, p.amount,
               SUM(CASE WHEN pr.status='SUCCEEDED' THEN pr.amount ELSE 0 END) AS refunded,
               SUM(CASE WHEN pr.status='PENDING' THEN pr.amount ELSE 0 END) AS pending_refund
        FROM payments p
        LEFT JOIN payment_refunds pr ON pr.payment_id=p.id
        GROUP BY p.id, p.amount
        HAVING refunded + pending_refund > p.amount
    `);
    await critical("Statut PARTIAL cohérent", `
        SELECT p.id AS payment_id, p.amount,
               SUM(CASE WHEN pr.status='SUCCEEDED' THEN pr.amount ELSE 0 END) AS refunded
        FROM payments p
        LEFT JOIN payment_refunds pr ON pr.payment_id=p.id
        WHERE p.status='PARTIAL'
        GROUP BY p.id, p.amount
        HAVING refunded <= 0 OR refunded >= p.amount
    `);
    await critical("Statut REFUNDED cohérent", `
        SELECT p.id AS payment_id, p.amount,
               SUM(CASE WHEN pr.status='SUCCEEDED' THEN pr.amount ELSE 0 END) AS refunded
        FROM payments p
        LEFT JOIN payment_refunds pr ON pr.payment_id=p.id
        WHERE p.status='REFUNDED'
        GROUP BY p.id, p.amount
        HAVING refunded <> p.amount
    `);
    await critical("PAID n'a pas de refund SUCCEEDED", `
        SELECT p.id AS payment_id, p.status,
               SUM(CASE WHEN pr.status='SUCCEEDED' THEN pr.amount ELSE 0 END) AS refunded
        FROM payments p
        LEFT JOIN payment_refunds pr ON pr.payment_id=p.id
        WHERE p.status='PAID'
        GROUP BY p.id, p.status
        HAVING refunded > 0
    `);

    section("4. HORODATAGE ET ETATS TERMINAUX");
    await critical("PAID/PARTIAL/REFUNDED possèdent paid_at", `
        SELECT id AS payment_id, method, status, paid_at
        FROM payments
        WHERE status IN ('PAID','PARTIAL','REFUNDED') AND paid_at IS NULL
    `);
    await critical("Refunds terminaux possèdent processed_at", `
        SELECT id AS refund_id, payment_id, provider, status, processed_at
        FROM payment_refunds
        WHERE status IN ('SUCCEEDED','FAILED','CANCELLED') AND processed_at IS NULL
    `);
    await warning("Refund PENDING déjà marqué processed_at", `
        SELECT id AS refund_id, payment_id, provider, processed_at
        FROM payment_refunds
        WHERE status='PENDING' AND processed_at IS NOT NULL
    `);

    section("5. PROVIDERS");
    /*
       La contrainte pi_ ne concerne que les paiements réellement gérés
       par Stripe. Les anciennes données de démonstration CARD (DemoPay,
       etc.) ne doivent pas être interprétées comme des paiements Stripe.
    */
    await critical("Paiements Stripe encaissés ont une référence pi_", `
        SELECT id AS payment_id, provider, provider_reference, status
        FROM payments
        WHERE method='CARD'
          AND UPPER(COALESCE(provider,'')) LIKE 'STRIPE%'
          AND status IN ('PAID','PARTIAL','REFUNDED','AUTHORIZED')
          AND (provider_reference IS NULL OR provider_reference NOT LIKE 'pi\\_%')
    `);
    await critical("Refunds Stripe SUCCEEDED ont une référence re_", `
        SELECT id AS refund_id, payment_id, provider_reference
        FROM payment_refunds
        WHERE UPPER(provider)='STRIPE' AND status='SUCCEEDED'
          AND (provider_reference IS NULL OR provider_reference NOT LIKE 're\\_%')
    `);
    await critical("Refunds MTN manuels SUCCEEDED ont une référence transaction", `
        SELECT id AS refund_id, payment_id, provider_reference
        FROM payment_refunds
        WHERE UPPER(provider)='MTN_MOMO_MANUAL' AND status='SUCCEEDED'
          AND (provider_reference IS NULL OR TRIM(provider_reference)='')
    `);

    section("6. COMMANDE ↔ DERNIER PAIEMENT");
    await critical("Commande REFUNDED => dernier paiement REFUNDED", `
        SELECT o.id AS order_id, o.reference, o.status AS order_status,
               p.id AS payment_id, p.status AS payment_status
        FROM orders o
        LEFT JOIN payments p ON p.id = (
            SELECT p2.id FROM payments p2
            WHERE p2.order_id=o.id
            ORDER BY p2.id DESC LIMIT 1
        )
        WHERE o.status='REFUNDED'
          AND (p.id IS NULL OR p.status <> 'REFUNDED')
    `);
    await warning("Dernier paiement REFUNDED mais commande reste opérationnelle", `
        SELECT o.id AS order_id, o.reference, o.status AS order_status,
               p.id AS payment_id, p.status AS payment_status
        FROM orders o
        INNER JOIN payments p ON p.id = (
            SELECT p2.id FROM payments p2
            WHERE p2.order_id=o.id
            ORDER BY p2.id DESC LIMIT 1
        )
        WHERE p.status='REFUNDED' AND o.status <> 'REFUNDED'
    `);
    await warning("Commande DELIVERED avec dernier paiement électronique FAILED/CANCELLED", `
        SELECT o.id AS order_id, o.reference,
               p.id AS payment_id, p.method, p.status AS payment_status
        FROM orders o
        INNER JOIN payments p ON p.id = (
            SELECT p2.id FROM payments p2
            WHERE p2.order_id=o.id
            ORDER BY p2.id DESC LIMIT 1
        )
        WHERE o.status='DELIVERED'
          AND p.method <> 'CASH'
          AND p.status IN ('FAILED','CANCELLED')
    `);

    section("7. IDEMPOTENCE / EVENEMENTS CRITIQUES");
    await critical("Un seul CASH_PAYMENT_COLLECTED par paiement", `
        SELECT payment_id, COUNT(*) AS total
        FROM payment_events
        WHERE event_type='CASH_PAYMENT_COLLECTED'
        GROUP BY payment_id HAVING COUNT(*) > 1
    `);
    await critical("Une seule confirmation MTN par refundId", `
        SELECT JSON_UNQUOTE(JSON_EXTRACT(payload,'$.refundId')) AS refund_id,
               COUNT(*) AS total
        FROM payment_events
        WHERE event_type='MTN_MOMO_REFUND_CONFIRMED' AND JSON_VALID(payload)
        GROUP BY JSON_UNQUOTE(JSON_EXTRACT(payload,'$.refundId'))
        HAVING refund_id IS NOT NULL AND COUNT(*) > 1
    `);
    await critical("Une seule annulation MTN par refundId", `
        SELECT JSON_UNQUOTE(JSON_EXTRACT(payload,'$.refundId')) AS refund_id,
               COUNT(*) AS total
        FROM payment_events
        WHERE event_type='MTN_MOMO_REFUND_CANCELLED' AND JSON_VALID(payload)
        GROUP BY JSON_UNQUOTE(JSON_EXTRACT(payload,'$.refundId'))
        HAVING refund_id IS NOT NULL AND COUNT(*) > 1
    `);

    section("8. FINALISATION POS — CASH / CARD / MOBILE MONEY");
    await critical("Méthodes POS supportées uniquement", `
        SELECT id AS payment_id, order_id, method, status
        FROM payments
        WHERE method NOT IN ('CASH','CARD','MOBILE_MONEY')
    `);
    await critical("CASH PENDING ne possède jamais paid_at", `
        SELECT id AS payment_id, order_id, status, paid_at
        FROM payments
        WHERE method='CASH' AND status='PENDING' AND paid_at IS NOT NULL
    `);
    await critical("CARD/MOBILE_MONEY PENDING ne possèdent jamais paid_at", `
        SELECT id AS payment_id, order_id, method, provider, status, paid_at
        FROM payments
        WHERE method IN ('CARD','MOBILE_MONEY')
          AND status='PENDING' AND paid_at IS NOT NULL
    `);
    await critical("Paiements électroniques PAID ont une référence provider", `
        SELECT id AS payment_id, order_id, method, provider, provider_reference
        FROM payments
        WHERE method IN ('CARD','MOBILE_MONEY')
          AND status IN ('PAID','PARTIAL','REFUNDED')
          AND (provider_reference IS NULL OR TRIM(provider_reference)='')
    `);
    await critical("Un seul paiement non terminal actif par commande/méthode", `
        SELECT order_id, method, COUNT(*) AS total
        FROM payments
        WHERE status IN ('PENDING','AUTHORIZED','PAID','PARTIAL')
        GROUP BY order_id, method
        HAVING COUNT(*) > 1
    `);

    section("RESULTAT 13.9.6.8.5");
    console.log(`Erreurs critiques : ${errors}`);
    console.log(`Avertissements    : ${warnings}`);

    if (errors > 0) {
        console.log("❌ 13.9.6.8.5 NON VALIDEE : corriger les anomalies critiques.");
        process.exitCode = 1;
        return;
    }

    console.log("✅ 13.9.6.8.5 : paiements POS sécurisés et intégrité financière critique validée.");
    if (warnings > 0) {
        console.log("ℹ️ Les avertissements sont non bloquants et doivent être examinés.");
    }
}

main()
    .catch(error => {
        console.error("❌ Audit final 13.9.6.8.5 :", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        try { await db.pool.end(); } catch (_) {}
    });
