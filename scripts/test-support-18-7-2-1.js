const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');let pass=0,fail=0;
function test(name,ok){console.log(`${ok?'PASS':'FAIL'} - ${name}`);ok?pass++:fail++;}
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const model=read('models/support.model.js'),cc=read('controllers/client/support.controller.js'),ac=read('controllers/admin/support.controller.js'),cr=read('routes/client/account.routes.js'),ar=read('routes/admin/index.routes.js'),cv=read('views/client/account/support.ejs'),av=read('views/admin/content/support.ejs');
test('lecture partielle SQL jusqu’au message visible',model.includes('markReadThrough')&&model.includes('id<=? AND read_at IS NULL'));
test('plus de lecture globale à ouverture client',!cc.includes("Support.markRead(selectedId,'CUSTOMER'"));
test('plus de lecture globale à ouverture admin',!ac.includes("Support.markRead(selectedId,'ADMIN'"));
test('endpoint lecture visible client',cr.includes('/compte/demandes/:id/read-visible')&&cc.includes('markVisibleRead'));
test('endpoint lecture visible admin',ar.includes('/support/:id/read-visible')&&ac.includes('markVisibleRead'));
test('IntersectionObserver client',cv.includes('IntersectionObserver')&&cv.includes('bindReadObserver'));
test('IntersectionObserver admin',av.includes('IntersectionObserver')&&av.includes('bindReadObserver'));
test('séparateur nouveaux messages client',cv.includes('sd-unread-separator')&&cv.includes('nouveau${unread'));
test('séparateur nouveaux messages admin',av.includes('as-unread-separator')&&av.includes('nouveau${unread'));
test('position premier non lu client',cv.includes('positionInitialRead')&&cv.includes('data-unread="1"'));
test('position premier non lu admin',av.includes('positionInitialReadAdmin')&&av.includes('data-unread="1"'));
test('séparateurs Aujourd’hui Hier date',cv.includes("'Aujourd’hui'")&&cv.includes("'Hier'")&&av.includes("'Aujourd’hui'")&&av.includes("'Hier'"));
console.log(`\nRÉSULTAT 18.7.2.1 : PASS=${pass} | FAIL=${fail}`);process.exitCode=fail?1:0;
