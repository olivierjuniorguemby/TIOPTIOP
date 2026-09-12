require('dotenv').config();
const db=require('../config/database');
(async()=>{try{
 const cols=await db.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='support_tickets'`);
 const set=new Set(cols.map(x=>x.COLUMN_NAME));
 if(!set.has('client_archived_at')) await db.query(`ALTER TABLE support_tickets ADD COLUMN client_archived_at DATETIME NULL AFTER updated_at`);
 if(!set.has('admin_archived_at')) await db.query(`ALTER TABLE support_tickets ADD COLUMN admin_archived_at DATETIME NULL AFTER client_archived_at`);
 console.log('✅ 18.5.1 — colonnes archivage installées.'); process.exit(0);
}catch(e){console.error('❌',e);process.exit(1)}})();
