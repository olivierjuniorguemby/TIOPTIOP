require('dotenv').config();
const db=require('../config/database');
(async()=>{
 try{
  await db.query(`
   CREATE TABLE IF NOT EXISTS loyalty_card_order_links (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id BIGINT UNSIGNED NOT NULL,
    card_id BIGINT UNSIGNED NOT NULL,
    created_by_admin_user_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(id),
    UNIQUE KEY uq_loyalty_card_order(order_id),
    KEY idx_loyalty_card_order_card(card_id),
    CONSTRAINT fk_lcol_order FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_lcol_card FOREIGN KEY(card_id) REFERENCES loyalty_cards(id) ON DELETE RESTRICT
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✅ loyalty_card_order_links disponible');
  console.log('✅ 16.10.5 — liaison commande POS ↔ carte Tiop+ installée');
 }catch(e){console.error('❌ Installation 16.10.5 impossible :',e);process.exitCode=1}
 finally{try{await db.pool.end()}catch(_){}}
})();
