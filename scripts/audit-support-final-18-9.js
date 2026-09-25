require('dotenv').config();
const fs=require('fs');
const db=require('../config/database');
let pass=0,fail=0;
function ok(name,v){const yes=!!v;console.log(`${yes?'PASS':'FAIL'} - ${name}`);yes?pass++:fail++;}
function has(s,...parts){return parts.every(p=>s.includes(p));}
(async()=>{try{
  const tables=await db.query(`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('support_tickets','support_messages','support_message_attachments','support_message_reactions','support_message_hidden','support_ticket_status_history','support_ticket_activity')`);
  const ts=new Set(tables.map(x=>x.TABLE_NAME));
  for(const t of ['support_tickets','support_messages','support_message_attachments','support_message_reactions','support_message_hidden','support_ticket_status_history','support_ticket_activity']) ok(`table ${t}`,ts.has(t));

  const cols=await db.query(`SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('support_tickets','support_messages')`);
  const c=(t,n)=>cols.some(x=>x.TABLE_NAME===t&&x.COLUMN_NAME===n);
  ok('ticket: statut / priorité / affectation',c('support_tickets','status')&&c('support_tickets','priority')&&c('support_tickets','assigned_admin_user_id'));
  ok('ticket: archivage client indépendant',c('support_tickets','client_archived_at'));
  ok('ticket: archivage support indépendant',c('support_tickets','admin_archived_at'));
  ok('message: édition / suppression / lecture',c('support_messages','edited_at')&&c('support_messages','deleted_at')&&c('support_messages','read_at'));
  ok('message: citation',c('support_messages','reply_to_message_id'));

  const model=fs.readFileSync('models/support.model.js','utf8');
  const cc=fs.readFileSync('controllers/client/support.controller.js','utf8');
  const ac=fs.readFileSync('controllers/admin/support.controller.js','utf8');
  const cr=fs.readFileSync('routes/client/account.routes.js','utf8');
  const ar=fs.readFileSync('routes/admin/index.routes.js','utf8');
  const cv=fs.readFileSync('views/client/account/support.ejs','utf8');
  const av=fs.readFileSync('views/admin/content/support.ejs','utf8');
  const rt=fs.readFileSync('realtime/support-realtime.js','utf8');
  const up=fs.readFileSync('config/support-files.js','utf8');

  ok('création ticket client',has(model,'createTicket','SUP-${1000+id}'));
  ok('réponses client + support',has(model,'replyCustomer','replyAdmin'));
  ok('temps réel rooms client/support',has(rt,'support:admins','support:user:','support:join','support:typing'));
  ok('événements changement temps réel',has(cc,"support:changed")&&has(ac,"support:changed"));
  ok('pièces jointes protégées',has(cr,'/compte/demandes/fichier/:attachmentId')&&has(ar,'/support/fichier/:attachmentId')&&has(model,'attachmentForUser','attachmentForAdmin'));
  ok('validation fichiers support',has(up,'allowed','max')||has(up,'mime','size'));
  ok('édition et suppression messages',has(model,'editMessage','deleteMessage')&&has(cr,'/edit','/delete')&&has(ar,'/edit','/delete'));
  ok('réactions messages',has(model,'support_message_reactions','exports.react')&&has(cr,'/react')&&has(ar,'/react'));
  ok('citations / réponses',has(model,'reply_to_message_id','validateReplyTarget'));
  ok('transfert simple + multiple',has(model,'transferMessage','bulkTransferMessages')&&has(cr,'bulk-transfer')&&has(ar,'bulk-transfer'));
  ok('suppression multiple + pour moi',has(model,'bulkDeleteMessages','support_message_hidden')&&has(cr,'bulk-delete')&&has(ar,'bulk-delete'));
  ok('lecture / non-lus',has(model,'markRead','markReadThrough','unread_count'));
  ok('archivage/restauration client',has(model,'archiveForUser','restoreForUser','listArchivedForUser')&&has(cr,'/archiver','/restaurer'));
  ok('archivage support séparé',has(model,'archiveForAdmin','admin_archived_at')&&has(ar,'/archiver'));
  ok('cycle de vie + réouverture',has(model,'STATUS_TRANSITIONS','reopenForUser','reopenForAdmin','support_ticket_status_history'));
  ok('affectation agents',has(model,'assignTicket','listAgents')&&has(ar,'/assign'));
  ok('priorités',has(model,'setPriority','PRIORITIES')&&has(ar,'/priority'));
  ok('notes internes invisibles client',has(model,'addInternalNote','support_ticket_activity')&&has(ar,'/internal-note')&&!cc.includes('addInternalNote'));
  ok('journal opérationnel',has(model,"'ASSIGNMENT'","'PRIORITY'",'activityHistory'));
  ok('UI client support présente',has(cv,'Demandes masquées','Restaurer'));
  ok('UI support présente',has(av,'Notes internes & activité'));

  console.log(`\nAUDIT FINAL SUPPORT 18.9 : PASS=${pass} | FAIL=${fail}`);
  if(!fail) console.log('ÉTAPE 18 — SUPPORT : VALIDABLE / PRÊTE À FIGER');
  process.exit(fail?1:0);
}catch(e){console.error('ERREUR AUDIT 18.9 :',e.message||e);process.exit(1);}finally{try{await db.pool.end();}catch{}}})();
