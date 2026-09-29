const fs=require('fs');
let pass=0,fail=0;
function check(name,ok){console.log(`${ok?'PASS':'FAIL'} - ${name}`);ok?pass++:fail++;}
const a=fs.readFileSync('controllers/admin/support.controller.js','utf8');
const c=fs.readFileSync('controllers/client/support.controller.js','utf8');
const s=fs.readFileSync('services/notification.service.js','utf8');
const cv=fs.readFileSync('views/client/account/support.ejs','utf8');
const av=fs.readFileSync('views/admin/content/support.ejs','utf8');
check('Admin -> client : notification de réaction sans dépendre de l’auteur du message',a.includes('if(ctx.user_id){try{await NotificationService.supportReactionClient'));
check('Client -> admin : notification de réaction sur tout message du ticket',c.includes("await NotificationService.supportReactionAdmin")&&!c.includes("if(ctx.sender_type==='ADMIN'){try{await NotificationService.supportReactionAdmin"));
check('Lien client contient ticket + message',a.includes('&message=${messageId}'));
check('Lien admin contient ticket + message',c.includes('&message=${messageId}'));
check('Socket notification:new / changed',s.includes("'notification:changed'")&&s.includes("'notification:new'"));
check('Socket Support réaction actualise la conversation client',cv.includes("type==='reaction'")&&cv.includes("syncSupport(type||'socket')"));
check('Navigation client vers ancien message',cv.includes('focusTargetMessage()')&&cv.includes('scrollIntoView'));
check('Navigation admin vers ancien message',av.includes('focusTargetMessageAdmin(id)')&&av.includes('scrollIntoView'));
console.log(`\nRésultat : PASS=${pass} FAIL=${fail}`);process.exitCode=fail?1:0;
