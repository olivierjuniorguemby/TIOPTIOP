const db = require('../config/database');
(async()=>{
  console.log('TIOPTIOP — 17.5 — AUDIENCE CLIENTS SÉLECTIONNÉS');
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS promotion_selected_users (
      promotion_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (promotion_id,user_id),
      KEY idx_psu_user (user_id),
      CONSTRAINT fk_psu_promotion FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE,
      CONSTRAINT fk_psu_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    console.log('✅ promotion_selected_users disponible');
    console.log('✅ 17.5 — infrastructure audience SELECTED installée.');
    process.exit(0);
  } catch(e) { console.error('❌',e); process.exit(1); }
})();
