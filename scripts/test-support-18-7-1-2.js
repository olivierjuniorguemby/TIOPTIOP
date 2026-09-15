const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'); let pass=0,fail=0;
function check(name,file,tests){const s=fs.readFileSync(path.join(root,file),'utf8');const ok=tests.every(x=>typeof x==='string'?s.includes(x):x.test(s));console.log((ok?'PASS':'FAIL')+' - '+name);ok?pass++:fail++;}
check('client sans sélection automatique','controllers/client/support.controller.js',["const selectedId=Number(req.query.ticket)||0;"]);
check('admin sans sélection automatique','controllers/admin/support.controller.js',["const selectedId=Number(req.query.ticket)||0;"]);
check('état vide client','views/client/account/support.ejs',['sd-chat-illustration','Vos conversations Support']);
check('état vide admin','views/admin/content/support.ejs',['as-chat-illustration','Centre de conversations']);
check('typing flottant client','views/client/account/support.ejs',['.typing-indicator{position:absolute','.sd-compose{position:relative}']);
check('typing flottant admin','views/admin/content/support.ejs',['.typing-indicator{position:absolute','.as-compose{position:relative}']);
check('typing liste client','views/client/account/support.ejs',['sd-list-typing','row?.querySelector']);
check('typing liste admin','views/admin/content/support.ejs',['as-list-typing','row?.querySelector']);
check('typing diffusé au compte client','realtime/support-realtime.js',['support:user:','rooms.push']);
check('typing diffusé aux admins','realtime/support-realtime.js',["rooms.push('support:admins')"]);
check('URL client uniquement au clic','views/client/account/support.ejs',['history.replaceState(null,\'\',`/compte/demandes?ticket=${id}`)']);
check('URL admin uniquement au clic','views/admin/content/support.ejs',['history.replaceState(null,\'\',`/admin/support?ticket=${id}`)']);
console.log(`\nRÉSULTAT 18.7.1.2 : PASS=${pass} | FAIL=${fail}`);process.exitCode=fail?1:0;
