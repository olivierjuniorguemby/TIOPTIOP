require('dotenv').config();
const db=require('../config/database');
(async()=>{try{
 await db.query(`CREATE TABLE IF NOT EXISTS support_ticket_activity (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id BIGINT UNSIGNED NOT NULL,
  activity_type ENUM('ASSIGNMENT','PRIORITY','INTERNAL_NOTE') NOT NULL,
  admin_user_id BIGINT UNSIGNED NULL,
  old_value VARCHAR(120) NULL,
  new_value VARCHAR(120) NULL,
  note VARCHAR(2000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(id),
  KEY idx_support_activity_ticket(ticket_id,created_at),
  KEY idx_support_activity_admin(admin_user_id),
  CONSTRAINT fk_support_activity_ticket FOREIGN KEY(ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_support_activity_admin FOREIGN KEY(admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
 console.log('OK - support_ticket_activity prête (18.8)');process.exit(0);
}catch(e){console.error('ERREUR 18.8:',e);process.exit(1);}})();
