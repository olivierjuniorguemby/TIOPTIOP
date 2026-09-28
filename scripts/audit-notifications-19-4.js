const fs=require('fs');
const checks=[
 ['checkout -> admin', 'controllers/client/checkout.controller.js','ORDER_NEW'],
 ['checkout destination admin','controllers/client/checkout.controller.js','/admin/commandes/'],
 ['order status -> client','controllers/admin/order.controller.js','ORDER_STATUS'],
 ['order client destination','controllers/admin/order.controller.js','/commande/${encodeURIComponent(result.reference)}/suivi'],
 ['new support -> admin','controllers/client/support.controller.js','SUPPORT_NEW'],
 ['client support reply -> admin','controllers/client/support.controller.js','Nouvelle réponse client'],
 ['admin support reply -> client','controllers/admin/support.controller.js','Nouvelle réponse du support'],
 ['support status -> client','controllers/admin/support.controller.js','SUPPORT_STATUS'],
 ['client feed target','controllers/client/notification.controller.js','target_url:targetOf(n)'],
 ['dropdown target','views/partials/notification-bell.ejs','data-target='],
 ['dropdown navigation','views/partials/notification-bell.ejs','window.location.assign(target)'],
 ['socket service','services/notification.service.js',"emit('notification:new'"]
];
let pass=0,fail=0;for(const [name,file,needle] of checks){const ok=fs.existsSync(file)&&fs.readFileSync(file,'utf8').includes(needle);console.log(`${ok?'PASS':'FAIL'} - ${name}`);ok?pass++:fail++;}console.log(`\nRÉSULTAT 19.4 : PASS=${pass} | FAIL=${fail}`);process.exitCode=fail?1:0;
