require('dotenv').config();
const db=require('../config/database');
(async()=>{
  console.log('============================================================');
  console.log(' TIOPTIOP — 17.2 — CODES PROMO PANIER / CHECKOUT');
  console.log('============================================================');
  try{
    await db.query(`CREATE TABLE IF NOT EXISTS promotion_usages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      promotion_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NULL,
      order_id BIGINT UNSIGNED NOT NULL,
      code VARCHAR(80) NOT NULL,
      discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(id),
      UNIQUE KEY uq_promotion_usages_order(order_id),
      KEY idx_promotion_usages_promotion(promotion_id),
      KEY idx_promotion_usages_user(user_id),
      CONSTRAINT fk_promotion_usages_promotion FOREIGN KEY(promotion_id) REFERENCES promotions(id) ON DELETE CASCADE,
      CONSTRAINT fk_promotion_usages_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_promotion_usages_order FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    console.log('✅ promotion_usages disponible');
    console.log('✅ 17.2 — infrastructure codes promo installée.');
  }catch(e){console.error('❌',e);process.exitCode=1;}finally{await db.pool.end();}
})();
