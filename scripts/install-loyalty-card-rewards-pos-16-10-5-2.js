require('dotenv').config();
const db=require('../config/database');
(async()=>{
 try{
  await db.query(`
   CREATE TABLE IF NOT EXISTS loyalty_card_redemptions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    card_id BIGINT UNSIGNED NOT NULL,
    reward_id BIGINT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NULL,
    points_cost INT NOT NULL,
    reward_type ENUM('PRODUCT','DISCOUNT','FREE_DELIVERY','COUPON') NOT NULL,
    reward_value DECIMAL(12,2) NULL,
    status ENUM('RESERVED','USED','RESTORED') NOT NULL DEFAULT 'RESERVED',
    used_at DATETIME NULL,
    restored_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(id),
    UNIQUE KEY uq_lcr_public_id(public_id),
    UNIQUE KEY uq_lcr_order(order_id),
    KEY idx_lcr_card(card_id,status),
    CONSTRAINT fk_lcr_card FOREIGN KEY(card_id) REFERENCES loyalty_cards(id) ON DELETE RESTRICT,
    CONSTRAINT fk_lcr_reward FOREIGN KEY(reward_id) REFERENCES loyalty_rewards(id) ON DELETE RESTRICT,
    CONSTRAINT fk_lcr_order FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✅ loyalty_card_redemptions disponible');
  console.log('✅ 16.10.5.2 — récompenses carte physique POS installées');
 }catch(e){console.error('❌ Installation 16.10.5.2 impossible :',e);process.exitCode=1}
 finally{try{await db.pool.end()}catch(_){}}
})();
