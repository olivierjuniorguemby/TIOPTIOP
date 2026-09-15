const fs=require('fs'),path=require('path');let pass=0,fail=0;
function test(name,ok){console.log((ok?'PASS':'FAIL')+' - '+name);ok?pass++:fail++;}
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const rt=read('realtime/support-realtime.js'),ac=read('controllers/admin/support.controller.js'),m=read('models/support.model.js'),cv=read('views/client/account/support.ejs'),av=read('views/admin/content/support.ejs');
test('nouveau ticket Support émet ticket:new',ac.includes("result.created?'ticket:new':'message:new'"));
test('client écoute ticket:new',cv.includes("type==='ticket:new'"));
test('nouvelle conversation client sans F5',cv.includes('activateTicket(Number(e.ticketId))'));
test('nouveau ticket dynamique dans liste client',cv.includes("document.createElement('a')"));
test('Socket typing serveur',rt.includes("socket.on('support:typing'"));
test('typing client',cv.includes("socket.emit('support:typing'"));
test('typing admin',av.includes("socket.emit('support:typing'"));
test('aperçu vidéo modal',av.includes("m.controls=true"));
test('suppression fichier modal avant envoi',av.includes("initChosen.splice(i,1)"));
test('émojis modal commande',av.includes('init-emoji-panel'));
test('compteur pièces jointes liste',m.includes('last_attachment_count')&&cv.includes('last_attachment_count')&&av.includes('last_attachment_count'));
test('catégorie dynamique admin',av.includes('as-cat-live'));
console.log(`\nRÉSULTAT 18.7.1.1 : PASS=${pass} | FAIL=${fail}`);process.exitCode=fail?1:0;
