require('dotenv').config();
const db = require('../config/database');
const Loyalty = require('../models/loyalty.model');

(async () => {
  try {
    console.log('============================================================');
    console.log(' TIOPTIOP — 16.8 — REPARATION FIDELITE REMBOURSEMENTS TOTAUX');
    console.log('============================================================');

    const [rows] = await db.pool.execute(`
      SELECT DISTINCT p.order_id
      FROM payments p
      WHERE p.status='REFUNDED' AND p.order_id IS NOT NULL
      ORDER BY p.order_id ASC`);

    console.log(`🔎 ${rows.length} commande(s) totalement remboursée(s) à vérifier.`);
    for (const row of rows) {
      const result = await Loyalty.reverseFullyRefundedOrder(row.order_id, 'REPAIR_16_8');
      console.log(`Commande #${row.order_id}:`, result);
    }

    console.log('------------------------------------------------------------');
    console.log('✅ Réparation 16.8 terminée.');
    console.log('   Lancez : node scripts/audit-loyalty-16-8.js');
  } catch (error) {
    console.error('❌ ERREUR 16.8 :', error);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
