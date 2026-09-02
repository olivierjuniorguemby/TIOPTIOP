require('dotenv').config();
const db = require('../config/database');

(async () => {
  try {
    console.log('============================================================');
    console.log(' TIOPTIOP — 16.8 — AUDIT REMBOURSEMENT & FIDELITE');
    console.log('============================================================');

    const checks = [
      ['Points EARN non compensés sur paiement totalement remboursé', `
        SELECT p.id payment_id,p.order_id,lt.user_id,lt.points earned_points
        FROM payments p
        JOIN loyalty_transactions lt ON lt.order_id=p.order_id AND lt.transaction_type='EARN'
        WHERE p.status='REFUNDED'
          AND NOT EXISTS (
            SELECT 1 FROM loyalty_transactions adj
            WHERE adj.user_id=lt.user_id AND adj.order_id=lt.order_id
              AND adj.transaction_type='ADJUSTMENT'
              AND adj.description LIKE CONCAT('REFUND_EARN_REVERSAL:', lt.order_id, '%')
          )`],
      ['Avantage USED encore lié à une commande totalement remboursée', `
        SELECT lr.id redemption_id,lr.order_id,lr.status
        FROM loyalty_redemptions lr
        JOIN payments p ON p.order_id=lr.order_id
        WHERE p.status='REFUNDED' AND lr.status='USED'`],
      ['Compensation fidélité appliquée sur remboursement seulement partiel', `
        SELECT p.id payment_id,p.order_id,lt.id transaction_id,lt.points
        FROM payments p
        JOIN loyalty_transactions lt ON lt.order_id=p.order_id
        WHERE p.status='PARTIAL' AND lt.transaction_type='ADJUSTMENT'
          AND lt.description LIKE CONCAT('REFUND_EARN_REVERSAL:', p.order_id, '%')`]
    ];

    let errors = 0;
    for (const [label, sql] of checks) {
      const [rows] = await db.pool.execute(sql);
      if (rows.length) {
        errors += rows.length;
        console.log(`❌ ${label}: ${rows.length}`);
        console.table(rows);
      } else {
        console.log(`✅ ${label}: 0`);
      }
    }

    console.log('------------------------------------------------------------');
    if (errors === 0) console.log('✅ 16.8 VALIDEE — remboursement total et fidélité cohérents');
    else console.log(`❌ 16.8 NON VALIDEE — ${errors} anomalie(s) détectée(s)`);
  } catch (error) {
    console.error('❌ ERREUR AUDIT 16.8 :', error);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
