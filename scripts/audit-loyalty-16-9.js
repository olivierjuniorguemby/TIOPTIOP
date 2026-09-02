require("dotenv").config();

const db = require("../config/database");

async function query(sql, params = []) {
  const [rows] = await db.pool.execute(sql, params);
  return rows;
}

async function main() {
  console.log("============================================================");
  console.log(" TIOPTIOP — 16.9 — AUDIT FINAL TIOP+");
  console.log(" Solde / idempotence / cycle de vie / remboursements");
  console.log("============================================================");

  const checks = [
    [
      "Solde loyalty_accounts différent de la somme des transactions",
      `
      SELECT
        la.user_id,
        la.points_balance AS stored_balance,
        COALESCE(SUM(lt.points),0) AS calculated_balance
      FROM loyalty_accounts la
      LEFT JOIN loyalty_transactions lt ON lt.user_id=la.user_id
      GROUP BY la.user_id, la.points_balance
      HAVING la.points_balance <> COALESCE(SUM(lt.points),0)
      `
    ],
    [
      "Crédit EARN dupliqué pour une même commande/client",
      `
      SELECT user_id,order_id,COUNT(*) AS duplicate_count,SUM(points) AS points
      FROM loyalty_transactions
      WHERE transaction_type='EARN' AND order_id IS NOT NULL
      GROUP BY user_id,order_id
      HAVING COUNT(*) > 1
      `
    ],
    [
      "Compensation remboursement total dupliquée",
      `
      SELECT user_id,order_id,COUNT(*) AS duplicate_count,SUM(points) AS points
      FROM loyalty_transactions
      WHERE transaction_type='ADJUSTMENT'
        AND description LIKE 'REFUND_EARN_REVERSAL:%'
      GROUP BY user_id,order_id
      HAVING COUNT(*) > 1
      `
    ],
    [
      "AVAILABLE possède encore order_id ou used_at",
      `
      SELECT id,user_id,reward_id,order_id,status,used_at
      FROM loyalty_redemptions
      WHERE status='AVAILABLE'
        AND (order_id IS NOT NULL OR used_at IS NOT NULL)
      `
    ],
    [
      "RESERVED sans commande ou avec used_at",
      `
      SELECT id,user_id,reward_id,order_id,status,used_at
      FROM loyalty_redemptions
      WHERE status='RESERVED'
        AND (order_id IS NULL OR used_at IS NOT NULL)
      `
    ],
    [
      "USED sans commande ou sans used_at",
      `
      SELECT id,user_id,reward_id,order_id,status,used_at
      FROM loyalty_redemptions
      WHERE status='USED'
        AND (order_id IS NULL OR used_at IS NULL)
      `
    ],
    [
      "RESERVED alors que le paiement est déjà encaissé",
      `
      SELECT lr.id redemption_id,lr.order_id,p.id payment_id,p.method,p.status payment_status
      FROM loyalty_redemptions lr
      JOIN payments p ON p.order_id=lr.order_id
      WHERE lr.status='RESERVED'
        AND p.status IN ('PAID','PARTIAL','REFUNDED')
      `
    ],
    [
      "USED sur commande totalement remboursée",
      `
      SELECT lr.id redemption_id,lr.order_id,p.id payment_id,p.status payment_status
      FROM loyalty_redemptions lr
      JOIN payments p ON p.order_id=lr.order_id
      WHERE lr.status='USED' AND p.status='REFUNDED'
      `
    ],
    [
      "Points EARN non compensés après remboursement total",
      `
      SELECT lt.user_id,lt.order_id,SUM(lt.points) earned_points
      FROM loyalty_transactions lt
      JOIN payments p ON p.order_id=lt.order_id
      WHERE lt.transaction_type='EARN'
        AND p.status='REFUNDED'
      GROUP BY lt.user_id,lt.order_id
      HAVING NOT EXISTS (
        SELECT 1
        FROM loyalty_transactions adj
        WHERE adj.user_id=lt.user_id
          AND adj.order_id=lt.order_id
          AND adj.transaction_type='ADJUSTMENT'
          AND adj.description LIKE CONCAT('REFUND_EARN_REVERSAL:',lt.order_id,'%')
      )
      `
    ],
    [
      "Récompense PRODUCT active sans produit lié",
      `
      SELECT id,name,reward_type,reward_product_id,is_active
      FROM loyalty_rewards
      WHERE is_active=1
        AND reward_type='PRODUCT'
        AND reward_product_id IS NULL
      `
    ],
    [
      "Rédemption sans transaction SPEND correspondante",
      `
      SELECT lr.id redemption_id,lr.user_id,lr.reward_id,lr.points_cost,lr.created_at
      FROM loyalty_redemptions lr
      WHERE NOT EXISTS (
        SELECT 1
        FROM loyalty_transactions lt
        WHERE lt.user_id=lr.user_id
          AND lt.reward_id=lr.reward_id
          AND lt.transaction_type='SPEND'
          AND lt.points=-CAST(lr.points_cost AS SIGNED)
          AND lt.created_at <= DATE_ADD(lr.created_at, INTERVAL 5 SECOND)
          AND lt.created_at >= DATE_SUB(lr.created_at, INTERVAL 5 SECOND)
      )
      `
    ]
  ];

  let errors = 0;

  for (const [label, sql] of checks) {
    const rows = await query(sql);
    if (rows.length) {
      errors += rows.length;
      console.log(`❌ ${label}: ${rows.length}`);
      console.table(rows);
    } else {
      console.log(`✅ ${label}: 0`);
    }
  }

  const warnings = [];

  const negativeBalances = await query(`
    SELECT user_id,points_balance
    FROM loyalty_accounts
    WHERE points_balance < 0
    ORDER BY points_balance ASC`);
  if (negativeBalances.length) {
    warnings.push(["Solde Tiop+ négatif (possible dette après remboursement)", negativeBalances]);
  }

  const expiredAvailable = await query(`
    SELECT id,user_id,reward_id,expires_at
    FROM loyalty_redemptions
    WHERE status='AVAILABLE'
      AND expires_at IS NOT NULL
      AND expires_at <= NOW()`);
  if (expiredAvailable.length) {
    warnings.push(["Avantage expiré encore marqué AVAILABLE (non utilisable côté checkout)", expiredAvailable]);
  }

  for (const [label, rows] of warnings) {
    console.log(`⚠️ ${label}: ${rows.length}`);
    console.table(rows);
  }

  console.log("------------------------------------------------------------");
  console.log(`Erreurs critiques : ${errors}`);
  console.log(`Avertissements    : ${warnings.reduce((n, [, rows]) => n + rows.length, 0)}`);

  if (errors === 0) {
    console.log("✅ 16.9 VALIDEE — TIOP+ est cohérent et sécurisé.");
  } else {
    console.log("❌ 16.9 NON VALIDEE — corriger les anomalies critiques.");
    process.exitCode = 1;
  }
}

main()
  .catch(error => {
    console.error("❌ ERREUR AUDIT 16.9 :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.pool.end();
  });
