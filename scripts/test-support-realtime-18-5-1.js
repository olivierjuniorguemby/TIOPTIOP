require('dotenv').config(); const fs=require('fs'); const db=require('../config/database');
(async()=>{let p=0,f=0; const t=(n,ok)=>{console.log(`${ok?'✅ PASS':'❌ FAIL'} — ${n}`);ok?p++:f++};try{
 const app=fs.readFileSync('app.js','utf8'), up=fs.readFileSync('config/uploads.js','utf8'), sf=fs.readFileSync('config/support-files.js','utf8');
 const cols=await db.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='support_tickets'`); const c=new Set(cols.map(x=>x.COLUMN_NAME));
 t('A — Socket.IO Support enregistré',app.includes('support-realtime')); t('B — Session Socket.IO',app.includes('io.engine.use(sessionMiddleware)'));
 t('C — MP4 admin prévu',up.includes('supportAdminUpload')&&up.includes('video/mp4')); t('D — MP4 contrôlé par signature',sf.includes("ext==='.mp4'")&&sf.includes("toString()==='ftyp'"));
 t('E — Archivage client',c.has('client_archived_at')); t('F — Archivage admin',c.has('admin_archived_at'));
 t('G — Plusieurs fichiers conservés',sf.includes('MAX_FILES = 5')); t('H — Sécurité client MP4',sf.includes('réservées au support'));
 console.log(`\nRÉSULTAT 18.5.1 : PASS=${p} | FAIL=${f}`); process.exit(f?1:0);
}catch(e){console.error(e);process.exit(1)}})();
