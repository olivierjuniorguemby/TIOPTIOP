require('dotenv').config();
const fs=require('fs'),path=require('path');
const db=require('../config/database');
let pass=0,fail=0;function ok(name,v){console.log(`${v?'PASS':'FAIL'} - ${name}`);v?pass++:fail++;}
(async()=>{try{
 const [cols]=await db.pool.query(`SHOW COLUMNS FROM support_tickets`);const names=cols.map(x=>x.Field);
 ok('assigned_admin_user_id existe',names.includes('assigned_admin_user_id'));
 ok('priority existe',names.includes('priority'));
 const [agents]=await db.pool.query(`SELECT DISTINCT au.id FROM admin_users au LEFT JOIN admin_user_roles aur ON aur.admin_user_id=au.id LEFT JOIN roles r ON r.id=aur.role_id WHERE au.is_active=1 AND r.name IN ('SUPPORT','MANAGER','SUPER_ADMIN')`);ok('agents Support/Manager/Super Admin détectables',agents.length>=1);
 const m=fs.readFileSync(path.join(__dirname,'../models/support.model.js'),'utf8'),c=fs.readFileSync(path.join(__dirname,'../controllers/admin/support.controller.js'),'utf8'),v=fs.readFileSync(path.join(__dirname,'../views/admin/content/support.ejs'),'utf8'),r=fs.readFileSync(path.join(__dirname,'../routes/admin/index.routes.js'),'utf8');
 ok('liste agents',m.includes('exports.listAgents'));
 ok('affectation ticket',m.includes('exports.assignTicket'));
 ok('priorité ticket',m.includes('exports.setPriority'));
 ok('conversation depuis commande',m.includes('createAdminOrderConversation'));
 ok('routes affectation/priorité',r.includes('/:id/assign')&&r.includes('/:id/priority'));
 ok('route initiation commande',r.includes('/support/initier-commande'));
 ok('filtres avancés UI',v.includes('adminPriority')&&v.includes('adminAgent')&&v.includes('adminUnread'));
 ok('Mes tickets / Non assignés',v.includes('MINE')&&v.includes('UNASSIGNED'));
 ok('contrôleur initiation',c.includes('initiateOrderConversation'));
 console.log(`\nRÉSULTAT 18.6 : PASS=${pass} | FAIL=${fail}`);process.exitCode=fail?1:0;
 }catch(e){console.error(e);process.exitCode=1;}finally{try{await db.pool.end();}catch{}}})();
