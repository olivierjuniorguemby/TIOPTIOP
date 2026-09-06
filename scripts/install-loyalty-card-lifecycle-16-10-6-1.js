require('dotenv').config();
const db=require('../config/database');
(async()=>{try{
console.log('============================================================');
console.log(' TIOPTIOP — 16.10.6.1 — CYCLE DE VIE CARTES TIOP+');
console.log('============================================================');
await db.query(`CREATE TABLE IF NOT EXISTS loyalty_card_lifecycle_events (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 card_id BIGINT UNSIGNED NOT NULL, event_type VARCHAR(40) NOT NULL,
 old_status VARCHAR(20) NULL,new_status VARCHAR(20) NULL,reason VARCHAR(255) NULL,
 created_by_admin_user_id BIGINT UNSIGNED NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_lcle_card(card_id),INDEX idx_lcle_created(created_at),
 CONSTRAINT fk_lcle_card FOREIGN KEY(card_id) REFERENCES loyalty_cards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
await db.query(`UPDATE loyalty_cards SET status='EXPIRED',updated_at=CURRENT_TIMESTAMP WHERE status='ACTIVE' AND expires_at IS NOT NULL AND expires_at<=NOW()`);
console.log('✅ loyalty_card_lifecycle_events disponible');
console.log('✅ Cartes ACTIVE déjà expirées synchronisées en EXPIRED');
console.log('✅ 16.10.6.1 installée.');process.exit(0);
}catch(e){console.error('❌',e);process.exit(1)}})();
