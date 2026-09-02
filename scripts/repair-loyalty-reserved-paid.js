require('dotenv').config();
const db = require('../config/database');
const Loyalty = require('../models/loyalty.model');

(async () => {
  try {
    console.log('============================================================');
    console.log(' TIOPTIOP — 16.7 FIX — REPARATION RESERVED SUR PAIEMENT PAID');
    console.log('============================================================');

    const rows = await db.query(`
      SELECT lr.id AS redemption_id, lr.order_id, lr.status,
             p.id AS payment_id, p.method, p.status AS payment_status
      FROM loyalty_redemptions lr
      JOIN payments p ON p.id = (
        SELECT p2.id
        FROM payments p2
        WHERE p2.order_id = lr.order_id
        ORDER BY p2.id DESC
        LIMIT 1
      )
      WHERE lr.status='RESERVED'
        AND p.status IN ('PAID','PARTIAL','REFUNDED')
      ORDER BY lr.id
    `);

    if (!rows.length) {
      console.log('✅ Aucun avantage RESERVED à réparer.');
      return;
    }

    console.log(`🔎 ${rows.length} avantage(s) à finaliser :`);
    console.table(rows);

    for (const row of rows) {
      const result = await Loyalty.finalizeOrderRedemption(
        row.order_id,
        'REPAIR_ALREADY_PAID_ORDER'
      );
      console.log(`✅ Commande #${row.order_id} :`, result);
    }

    console.log('------------------------------------------------------------');
    console.log('✅ Réparation terminée. Relancez ensuite :');
    console.log('   node scripts/audit-loyalty-16-7.js');
  } catch (error) {
    console.error('❌ Réparation impossible :', error);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
