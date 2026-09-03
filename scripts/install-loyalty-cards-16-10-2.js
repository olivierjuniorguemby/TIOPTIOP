require('dotenv').config();
const db=require('../config/database');
(async()=>{try{
console.log('============================================================');
console.log(' TIOPTIOP — 16.10.2 — CARTES TIOP+ SANS COMPTE');
console.log('============================================================');
await db.query(`CREATE TABLE IF NOT EXISTS loyalty_cards (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 public_id CHAR(36) NOT NULL UNIQUE,
 card_number VARCHAR(40) NOT NULL UNIQUE,
 user_id BIGINT UNSIGNED NULL,
 first_name VARCHAR(100) NULL, last_name VARCHAR(100) NULL, display_name VARCHAR(180) NULL,
 phone VARCHAR(40) NULL, email VARCHAR(190) NULL,
 card_type VARCHAR(40) NOT NULL DEFAULT 'VIP',
 points_balance INT NOT NULL DEFAULT 0, issued_points INT NOT NULL DEFAULT 0,
 expires_at DATETIME NULL,
 status ENUM('ACTIVE','SUSPENDED','EXPIRED','REVOKED') NOT NULL DEFAULT 'ACTIVE',
 created_by_admin_user_id BIGINT UNSIGNED NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX idx_loyalty_cards_user(user_id), INDEX idx_loyalty_cards_phone(phone), INDEX idx_loyalty_cards_status(status),
 CONSTRAINT fk_loyalty_cards_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
await db.query(`CREATE TABLE IF NOT EXISTS loyalty_card_transactions (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 card_id BIGINT UNSIGNED NOT NULL,
 order_id BIGINT UNSIGNED NULL,
 transaction_type ENUM('EARN','SPEND','ADJUSTMENT','REVERSAL') NOT NULL,
 points INT NOT NULL, description VARCHAR(255) NULL,
 created_by_admin_user_id BIGINT UNSIGNED NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_lct_card(card_id), INDEX idx_lct_order(order_id),
 CONSTRAINT fk_lct_card FOREIGN KEY(card_id) REFERENCES loyalty_cards(id) ON DELETE CASCADE,
 CONSTRAINT fk_lct_order FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
console.log('✅ loyalty_cards disponible');console.log('✅ loyalty_card_transactions disponible');
console.log('✅ 16.10.2 — fondation cartes nominatives sans compte installée.');process.exit(0);
}catch(e){console.error('❌',e);process.exit(1);}})();
