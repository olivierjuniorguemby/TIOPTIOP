require('dotenv').config();
const db=require('../config/database');
(async()=>{try{
 console.log('============================================================');
 console.log(' TIOPTIOP — 16.10.6.3 — RATTACHEMENT COMPTE CLIENT TIOP+');
 console.log('============================================================');
 await db.query(`CREATE TABLE IF NOT EXISTS loyalty_card_account_links (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  card_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  card_points_at_link INT NOT NULL DEFAULT 0,
  account_points_at_link INT NOT NULL DEFAULT 0,
  reason VARCHAR(255) NULL,
  created_by_admin_user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(id), KEY idx_lcal_card(card_id), KEY idx_lcal_user(user_id),
  CONSTRAINT fk_lcal_card FOREIGN KEY(card_id) REFERENCES loyalty_cards(id) ON DELETE CASCADE,
  CONSTRAINT fk_lcal_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
 console.log('✅ loyalty_card_account_links disponible');
 console.log('✅ 16.10.6.3 — rattachement compte client installé.');
 process.exit(0);
}catch(e){console.error('❌',e);process.exit(1)}})();
