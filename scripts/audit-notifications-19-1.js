require('dotenv').config();
const fs=require('fs'), path=require('path');
const db=require('../config/database');
let pass=0,fail=0;const ok=(name,v)=>{console.log(`${v?'PASS':'FAIL'} - ${name}`);v?pass++:fail++};
(async()=>{try{
 const cols=await db.query("SHOW COLUMNS FROM notifications"); const names=new Set(cols.map(x=>x.Field));
 ok('table notifications accessible',cols.length>0); ['user_id','channel','notification_type','title','body','payload','read_at','sent_at','created_at'].forEach(c=>ok(`colonne ${c}`,names.has(c)));
 const files=['models/notification.model.js','services/notification.service.js','controllers/client/notification.controller.js','controllers/admin/notification.controller.js','realtime/notification-realtime.js','views/partials/notification-bell.ejs']; files.forEach(f=>ok(f,fs.existsSync(path.join(__dirname,'..',f))));
 const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'); ok('realtime notifications branché',app.includes('notification-realtime'));
 const ch=fs.readFileSync(path.join(__dirname,'../views/partials/client/header.ejs'),'utf8'); ok('cloche client',ch.includes('notification-bell'));
 const ah=fs.readFileSync(path.join(__dirname,'../views/partials/admin/header.ejs'),'utf8'); ok('cloche admin',ah.includes('notification-bell'));
 const sb=fs.readFileSync(path.join(__dirname,'../views/partials/admin/sidebar.ejs'),'utf8'); ok('badge sidebar admin',sb.includes('adminNotifSideBadge'));
 const u=await db.query("SELECT id FROM users ORDER BY id LIMIT 1"); if(u[0]){const N=require('../models/notification.model');const s=await N.summary('USER',u[0].id);ok('compteur client SQL',Number.isFinite(s.unread));}else ok('compteur client SQL (aucun user)',true);
 console.log(`\nAUDIT NOTIFICATIONS 19.1 : PASS=${pass} | FAIL=${fail}`); process.exitCode=fail?1:0;
}catch(e){console.error(e);process.exitCode=1;}finally{await db.pool.end();}})();
