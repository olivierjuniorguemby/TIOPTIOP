require('dotenv').config();
const db=require('../config/database');
(async()=>{try{
console.log('============================================================');
console.log(' TIOPTIOP — 16.10.6.2 — REMPLACEMENT CARTES TIOP+');
console.log('============================================================');
await db.query(`CREATE TABLE IF NOT EXISTS loyalty_card_replacements (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 old_card_id BIGINT UNSIGNED NOT NULL,
 new_card_id BIGINT UNSIGNED NOT NULL,
 points_transferred INT NOT NULL DEFAULT 0,
 reason VARCHAR(255) NULL,
 created_by_admin_user_id BIGINT UNSIGNED NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_lcr_old_card(old_card_id),
 UNIQUE KEY uq_lcr_new_card(new_card_id),
 INDEX idx_lcr_created(created_at),
 CONSTRAINT fk_lcr_old_card FOREIGN KEY(old_card_id) REFERENCES loyalty_cards(id) ON DELETE RESTRICT,
 CONSTRAINT fk_lcr_new_card FOREIGN KEY(new_card_id) REFERENCES loyalty_cards(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
console.log('✅ loyalty_card_replacements disponible');
console.log('✅ 16.10.6.2 — remplacement sécurisé des cartes installé.');
process.exit(0);
}catch(e){console.error('❌',e);process.exit(1)}})();
