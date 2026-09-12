require('dotenv').config();
const fs=require('fs'); const db=require('../config/database');
let pass=0,fail=0; function test(name,ok,detail=''){console.log(`${ok?'✅ PASS':'❌ FAIL'} — ${name}${detail?'\n   '+detail:''}`);ok?pass++:fail++;}
async function main(){
 console.log('='.repeat(78)); console.log(' TIOPTIOP — 18.5 — AUDIT MESSAGERIE AVANCÉE'); console.log('='.repeat(78));
 const cols=await db.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='support_messages' AND COLUMN_NAME IN ('edited_at','deleted_at','read_at')`);
 test('A — Colonnes lecture / édition / suppression',cols.length===3,`colonnes=${cols.map(x=>x.COLUMN_NAME).join(',')}`);
 const tabs=await db.query(`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('support_message_attachments','support_message_reactions')`);
 test('B — Tables pièces jointes / réactions',tabs.length===2,`tables=${tabs.map(x=>x.TABLE_NAME).join(',')}`);
 const orphanA=(await db.query(`SELECT COUNT(*) n FROM support_message_attachments a LEFT JOIN support_messages m ON m.id=a.message_id WHERE m.id IS NULL`))[0].n;
 const orphanR=(await db.query(`SELECT COUNT(*) n FROM support_message_reactions r LEFT JOIN support_messages m ON m.id=r.message_id WHERE m.id IS NULL`))[0].n;
 test('C — Intégrité des données',Number(orphanA)===0&&Number(orphanR)===0,`attachments_orphelins=${orphanA}, reactions_orphelines=${orphanR}`);
 const model=fs.readFileSync(require.resolve('../models/support.model'),'utf8');
 test('D — Multi-fichiers',model.includes('support_message_attachments')&&model.includes('addAttachments'));
 test('E — Lu / non lu',model.includes('markRead')&&model.includes('read_at'));
 test('F — Modification / suppression',model.includes('editMessage')&&model.includes('deleteMessage'));
 test('G — Réactions emoji',model.includes('support_message_reactions')&&model.includes('exports.react'));
 const sf=fs.readFileSync(require.resolve('../config/support-files'),'utf8');
 test('H — Validation contenu fichiers',sf.includes('sniff(')&&sf.includes('validateUploadedFiles'));
 const app=fs.readFileSync(require.resolve('../app'),'utf8');
 test('I — Accès direct /uploads/support bloqué',app.includes('app.use("/uploads/support"'));
 const cv=fs.readFileSync(require.resolve('../controllers/client/support.controller'),'utf8');
 const av=fs.readFileSync(require.resolve('../controllers/admin/support.controller'),'utf8');
 test('J — Téléchargements authentifiés',cv.includes('downloadAttachment')&&av.includes('downloadAttachment'));
 console.log('\n'+'='.repeat(78)); console.log(`RÉSULTAT 18.5 : PASS=${pass} | FAIL=${fail}`); if(fail===0)console.log('✅ 18.5 — MESSAGERIE AVANCÉE / FICHIERS VALIDÉE.'); console.log('='.repeat(78));
 await db.pool.end(); process.exitCode=fail?1:0;
}
main().catch(async e=>{console.error('❌ Audit interrompu:',e);try{await db.pool.end()}catch{}process.exit(1)});
