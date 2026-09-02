require('dotenv').config();
const db = require('../config/database');
(async()=>{
  try {
    console.log('============================================================');
    console.log(' TIOPTIOP — 16.7 — AUDIT CYCLE DE VIE TIOP+');
    console.log('============================================================');
    const checks = [
      ['RESERVED sans commande', `SELECT lr.id,lr.public_id,lr.status FROM loyalty_redemptions lr WHERE lr.status='RESERVED' AND lr.order_id IS NULL`],
      ['AVAILABLE encore liée à une commande', `SELECT lr.id,lr.public_id,lr.order_id FROM loyalty_redemptions lr WHERE lr.status='AVAILABLE' AND lr.order_id IS NOT NULL`],
      ['USED sans used_at', `SELECT lr.id,lr.public_id FROM loyalty_redemptions lr WHERE lr.status='USED' AND lr.used_at IS NULL`],
      ['USED sur paiement non encaissé', `SELECT lr.id,lr.public_id,lr.order_id,p.status payment_status FROM loyalty_redemptions lr JOIN payments p ON p.id=(SELECT p2.id FROM payments p2 WHERE p2.order_id=lr.order_id ORDER BY p2.id DESC LIMIT 1) WHERE lr.status='USED' AND p.status NOT IN ('PAID','PARTIAL','REFUNDED')`],
      ['RESERVED sur paiement encaissé', `SELECT lr.id,lr.public_id,lr.order_id,p.id payment_id,p.method,p.status payment_status FROM loyalty_redemptions lr JOIN payments p ON p.id=(SELECT p2.id FROM payments p2 WHERE p2.order_id=lr.order_id ORDER BY p2.id DESC LIMIT 1) WHERE lr.status='RESERVED' AND p.status IN ('PAID','PARTIAL','REFUNDED')`],
      ['RESERVED sur commande annulée', `SELECT lr.id,lr.public_id,lr.order_id FROM loyalty_redemptions lr JOIN orders o ON o.id=lr.order_id WHERE lr.status='RESERVED' AND o.status='CANCELLED'`]
    ];
    let errors=0;
    for (const [label,sql] of checks) {
      const rows=await db.query(sql);
      if(rows.length){ errors+=rows.length; console.log(`❌ ${label}: ${rows.length}`); console.table(rows); }
      else console.log(`✅ ${label}: 0`);
    }
    console.log('------------------------------------------------------------');
    console.log(errors ? `❌ 16.7 NON VALIDEE — ${errors} anomalie(s)` : '✅ 16.7 VALIDEE — cycle de vie cohérent');
    process.exitCode=errors?1:0;
  } catch(e){ console.error('❌ Audit impossible:',e); process.exitCode=1; }
  finally { await db.pool.end(); }
})();
