require('dotenv').config();
const fs=require('fs');const db=require('../config/database');let pass=0,fail=0;
function ok(name,v){console.log(`${v?'PASS':'FAIL'} - ${name}`);v?pass++:fail++;}
(async()=>{try{
 const cols=await db.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='support_ticket_activity'`);const names=new Set(cols.map(x=>x.COLUMN_NAME));
 ok('table support_ticket_activity créée',cols.length>0);ok('ticket_id présent',names.has('ticket_id'));ok('activity_type présent',names.has('activity_type'));ok('admin_user_id présent',names.has('admin_user_id'));ok('note présente',names.has('note'));
 const model=fs.readFileSync('models/support.model.js','utf8'),ctl=fs.readFileSync('controllers/admin/support.controller.js','utf8'),route=fs.readFileSync('routes/admin/index.routes.js','utf8'),view=fs.readFileSync('views/admin/content/support.ejs','utf8');
 ok('journal affectation',model.includes("'ASSIGNMENT'"));ok('journal priorité',model.includes("'PRIORITY'"));ok('notes internes modèle',model.includes('addInternalNote'));ok('route note interne',route.includes('/internal-note'));ok('contrôleur note interne',ctl.includes('internalNote'));ok('UI notes internes',view.includes('Notes internes & activité'));ok('synchronisation activité',view.includes('updateActivity(id,data.activity'));
 console.log(`\nRÉSULTAT 18.8 : PASS=${pass} | FAIL=${fail}`);process.exit(fail?1:0);
}catch(e){console.error(e);process.exit(1);}})();
