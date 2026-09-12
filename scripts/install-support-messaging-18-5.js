require('dotenv').config();
const db=require('../config/database');
async function col(table,name){return (await db.query(`SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`,[table,name]))[0].n>0;}
async function run(){
 console.log('TIOPTIOP — 18.5 — installation messagerie avancée');
 for(const [name,sql] of [
  ['edited_at',`ALTER TABLE support_messages ADD COLUMN edited_at DATETIME NULL AFTER created_at`],
  ['deleted_at',`ALTER TABLE support_messages ADD COLUMN deleted_at DATETIME NULL AFTER edited_at`],
  ['read_at',`ALTER TABLE support_messages ADD COLUMN read_at DATETIME NULL AFTER deleted_at`]
 ]){if(!await col('support_messages',name)){await db.query(sql);console.log('✓ support_messages.'+name);}else console.log('= support_messages.'+name+' existe');}
 await db.query(`CREATE TABLE IF NOT EXISTS support_message_attachments(
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  message_id BIGINT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sma_message(message_id),
  CONSTRAINT fk_sma_message FOREIGN KEY(message_id) REFERENCES support_messages(id) ON DELETE CASCADE
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
 await db.query(`CREATE TABLE IF NOT EXISTS support_message_reactions(
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  message_id BIGINT UNSIGNED NOT NULL,
  reactor_type ENUM('CUSTOMER','ADMIN') NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  admin_user_id BIGINT UNSIGNED NULL,
  emoji VARCHAR(16) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_react_user(message_id,reactor_type,user_id),
  UNIQUE KEY uq_react_admin(message_id,reactor_type,admin_user_id),
  KEY idx_react_message(message_id),
  CONSTRAINT fk_react_message FOREIGN KEY(message_id) REFERENCES support_messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_react_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_react_admin FOREIGN KEY(admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
 // Backfill legacy single attachment without duplicating.
 const legacy=await db.query(`SELECT id,attachment_url FROM support_messages WHERE attachment_url IS NOT NULL AND attachment_url<>''`);
 for(const m of legacy){const stored=String(m.attachment_url).split('/').pop();await db.query(`INSERT INTO support_message_attachments(message_id,original_name,stored_name,mime_type,file_size) SELECT ?,?,?, '',0 WHERE NOT EXISTS(SELECT 1 FROM support_message_attachments WHERE message_id=? AND stored_name=?)`,[m.id,stored,stored,m.id,stored]);}
 console.log('✓ tables pièces jointes / réactions');
 console.log('✓ reprise des anciennes pièces jointes');
 console.log('18.5 SQL prêt.');
 await db.pool.end();
}
run().catch(async e=>{console.error('✗',e);try{await db.pool.end()}catch{}process.exit(1)});
