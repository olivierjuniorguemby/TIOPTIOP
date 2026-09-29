const fs=require('fs');
const checks=[
 ['Contexte réaction Support','models/support.model.js','reactionContext'],
 ['Upsert notification réaction','models/notification.model.js','upsertSupportReaction'],
 ['Notification réaction client','services/notification.service.js','supportReactionClient'],
 ['Notification réaction admin','services/notification.service.js','supportReactionAdmin'],
 ['Admin vers client','controllers/admin/support.controller.js','supportReactionClient'],
 ['Client vers admin','controllers/client/support.controller.js','supportReactionAdmin'],
 ['Type SUPPORT_REACTION','models/notification.model.js','SUPPORT_REACTION'],
 ['Modification sans doublon','models/notification.model.js','UPDATE notifications SET title=']
];
let pass=0;for(const [name,file,needle] of checks){const ok=fs.readFileSync(file,'utf8').includes(needle);console.log(`${ok?'PASS':'FAIL'} - ${name}`);if(ok)pass++;}console.log(`\nRésultat : PASS=${pass} FAIL=${checks.length-pass}`);process.exit(pass===checks.length?0:1);
