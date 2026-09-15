const fs=require('fs');
let pass=0,fail=0;
const admin=fs.readFileSync('views/admin/content/support.ejs','utf8');
const client=fs.readFileSync('views/client/account/support.ejs','utf8');
function t(name,ok){console.log((ok?'PASS':'FAIL')+' - '+name);ok?pass++:fail++;}
t('admin ouvre ?ticket automatiquement',admin.includes("initialTicketId=Number(new URLSearchParams(location.search).get('ticket')")&&admin.includes("open(initialTicketId)"));
t('détail admin activé au chargement',admin.includes("document.querySelectorAll('.as-detail').forEach(d=>d.classList.toggle('active'"));
t('liste tickets client scroll indépendant',client.includes('.sd-ticket-list{flex:1;min-height:0;overflow-y:auto'));
t('hauteurs client alignées',client.includes('.sd-list-panel,.sd-conversation{height:650px'));
t('conversation client flex sans grand vide',client.includes('.sd-conversation{display:flex;flex-direction:column;position:relative}')&&client.includes('.sd-messages{flex:1;min-height:0;max-height:none'));
t('ouverture client descend au dernier message',client.includes("scrollConversationBottom('auto')"));
t('bouton nouveaux messages client',client.includes('sd-scroll-bottom')&&client.includes('pendingBelow+=added'));
t('réception client ne force pas le bas si lecture ancienne',client.includes("else if(reason==='message:new'&&added>0)"));
t('bouton nouveaux messages admin',admin.includes('as-scroll-bottom')&&admin.includes('pendingBelow+=added'));
t('admin respecte lecture en haut',admin.includes("else if(reason==='message:new'&&added>0)"));
t('clic bouton client revient en bas',client.includes("box.scrollTo({top:box.scrollHeight,behavior:'smooth'})"));
t('clic bouton admin revient en bas',admin.includes("x.scrollTo({top:x.scrollHeight,behavior:'smooth'})"));
console.log(`\nRÉSULTAT 18.7.1.3 : PASS=${pass} | FAIL=${fail}`);process.exitCode=fail?1:0;
