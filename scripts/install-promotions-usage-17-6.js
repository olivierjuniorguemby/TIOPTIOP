const db=require('../config/database');
(async()=>{try{
 console.log('TIOPTIOP — 17.6 — LIMITES UTILISATION PROMOTIONS');
 const [cols]=await db.pool.execute("SHOW COLUMNS FROM promotion_usages LIKE 'status'");
 if(!cols.length) await db.pool.execute("ALTER TABLE promotion_usages ADD COLUMN status ENUM('RESERVED','USED','RELEASED') NOT NULL DEFAULT 'USED' AFTER discount_amount, ADD COLUMN used_at DATETIME NULL AFTER status, ADD COLUMN released_at DATETIME NULL AFTER used_at, ADD COLUMN release_reason VARCHAR(80) NULL AFTER released_at");
 console.log('✅ cycle RESERVED / USED / RELEASED disponible');
 console.log('✅ 17.6 — infrastructure limites installée.');
 process.exit(0);
}catch(e){console.error('❌',e);process.exit(1)}})();
