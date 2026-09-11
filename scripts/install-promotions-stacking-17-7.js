const db = require('../config/database');
(async()=>{
  try {
    console.log('TIOPTIOP — 17.7 — CUMUL PROMO / TIOP+');
    const rows = await db.query(`SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='promotions' AND COLUMN_NAME='allow_loyalty_stack'`);
    if (!Number(rows[0]?.n || 0)) {
      await db.query(`ALTER TABLE promotions ADD COLUMN allow_loyalty_stack TINYINT(1) NOT NULL DEFAULT 1 AFTER usage_limit_per_user`);
      console.log('✅ allow_loyalty_stack ajouté (défaut = cumul autorisé).');
    } else console.log('ℹ️ allow_loyalty_stack existe déjà.');
    console.log('✅ 17.7 — infrastructure cumul Promo / Tiop+ installée.');
  } catch(e) { console.error('❌',e); process.exitCode=1; }
  finally { if(db.pool?.end) await db.pool.end(); }
})();
