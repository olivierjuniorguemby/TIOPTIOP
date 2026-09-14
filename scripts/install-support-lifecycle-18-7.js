require('dotenv').config();
const db=require('../config/database');
(async()=>{try{await db.query(`CREATE TABLE IF NOT EXISTS support_ticket_status_history (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 ticket_id BIGINT UNSIGNED NOT NULL,
 from_status ENUM('NEW','IN_PROGRESS','WAITING_CUSTOMER','RESOLVED','CLOSED') NOT NULL,
 to_status ENUM('NEW','IN_PROGRESS','WAITING_CUSTOMER','RESOLVED','CLOSED') NOT NULL,
 actor_type ENUM('CUSTOMER','ADMIN','SYSTEM') NOT NULL,
 customer_user_id BIGINT UNSIGNED NULL,
 admin_user_id BIGINT UNSIGNED NULL,
 note VARCHAR(255) NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(id), KEY idx_support_history_ticket(ticket_id,created_at),
 CONSTRAINT fk_support_history_ticket FOREIGN KEY(ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
 CONSTRAINT fk_support_history_customer FOREIGN KEY(customer_user_id) REFERENCES users(id) ON DELETE SET NULL,
 CONSTRAINT fk_support_history_admin FOREIGN KEY(admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);console.log('OK - support_ticket_status_history prête (18.7)');process.exit(0);}catch(e){console.error('ERREUR 18.7:',e);process.exit(1);}})();
