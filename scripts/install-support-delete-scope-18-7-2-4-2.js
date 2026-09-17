require('dotenv').config();
const db=require('../config/database');
(async()=>{try{
 await db.query(`CREATE TABLE IF NOT EXISTS support_message_hidden (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  message_id BIGINT UNSIGNED NOT NULL,
  actor_type ENUM('CUSTOMER','ADMIN') NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(id),
  UNIQUE KEY uq_support_message_hidden_actor(message_id,actor_type,actor_id),
  KEY idx_support_message_hidden_actor(actor_type,actor_id),
  CONSTRAINT fk_support_message_hidden_message FOREIGN KEY(message_id) REFERENCES support_messages(id) ON DELETE CASCADE ON UPDATE CASCADE
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
 console.log('OK - support_message_hidden prête');
 console.log('OK - Support 18.7.2.4.2 prêt');
 process.exit(0);
}catch(e){console.error('ERREUR 18.7.2.4.2:',e);process.exit(1)}})();
