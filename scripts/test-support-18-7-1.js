require('dotenv').config();
const fs=require('fs');
let pass=0,fail=0;
function test(name,ok){if(ok){pass++;console.log('PASS - '+name)}else{fail++;console.log('FAIL - '+name)}}
const read=f=>fs.readFileSync(f,'utf8');
const admin=read('views/admin/content/support.ejs'), client=read('views/client/account/support.ejs'), ac=read('controllers/admin/support.controller.js'), cc=read('controllers/client/support.controller.js'), model=read('models/support.model.js'), routes=read('routes/admin/index.routes.js');
test('route changement statut immédiat',routes.includes('/support/:id/status'));
test('modèle setStatusAdmin + historique',model.includes('exports.setStatusAdmin=')&&model.includes("note:'Statut modifié par le support'"));
test('poll admin retourne statut historique stats',ac.includes('selectedTicket,history,stats'));
test('poll client retourne statut historique compteurs',cc.includes('selectedTicket,history,counts'));
test('badge et cycle client synchronisés DOM',client.includes('updateLifecycle(data.selectedTicket')&&client.includes(".sd-ticket-top .badge"));
test('cycle admin synchronisé DOM',admin.includes('updateLifecycle(id,data.selectedTicket')&&admin.includes('updateStats(data.stats'));
test('compose/réouvrir client sans reload',client.includes('data-lifecycle-compose')&&client.includes('data-lifecycle-closed')&&!client.includes('location.href=`/compte/demandes?ticket=${b.dataset.ticket}`'));
test('compose/réouvrir admin dynamique',admin.includes('data-lifecycle-compose')&&admin.includes('data-lifecycle-reopen'));
test('sons message réaction statut admin',admin.includes("type==='message:new'")&&admin.includes("type==='reaction'")&&admin.includes("type==='ticket:status'"));
test('sons message réaction statut client',client.includes("type==='message:new'")&&client.includes("type==='reaction'")&&client.includes("type==='ticket:status'"));
test('boutons son client/admin',client.includes('sd-sound-toggle')&&admin.includes('as-sound-toggle'));
test('brouillon + statut restent envoyables ensemble',admin.includes('hasDraft')&&admin.includes('if(hasDraft)return'));
console.log(`\nRÉSULTAT 18.7.1 : PASS=${pass} | FAIL=${fail}`);process.exitCode=fail?1:0;
