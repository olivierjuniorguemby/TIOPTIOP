const fs=require('fs'); const path=require('path');
let pass=0,fail=0;
function check(name,ok){console.log(`${ok?'PASS':'FAIL'} - ${name}`);ok?pass++:fail++;}
function read(f){return fs.readFileSync(path.join(__dirname,'..',f),'utf8');}
const ns=read('services/notification.service.js'), nm=read('models/notification.model.js'), ps=read('services/payment.service.js'), pc=read('controllers/admin/payment.controller.js'), pos=read('controllers/admin/pos.controller.js'), co=read('controllers/client/checkout.controller.js'), app=read('app.js');
check('Socket.IO injectable dans les services provider',app.includes('notification.service").setIo(io)')&&ns.includes('exports.setIo'));
check('idempotence notifications métier par eventKey',nm.includes('upsertBusinessEvent')&&nm.includes('$.eventKey'));
check('paiement confirmé -> client',ps.includes('paymentEvent({paymentId:payment.id,status:"PAID"'));
check('paiement échoué -> client/admin',ps.includes('paymentEvent({paymentId:payment.id,status:"FAILED"')&&ns.includes('admin:payment:'));
check('points Tiop+ gagnés -> client',ps.includes('loyaltyPointsEarned')&&ns.includes('LOYALTY_POINTS_EARNED'));
check('avantage Tiop+ utilisé -> client',ps.includes('loyaltyRewardUsed')&&ns.includes('LOYALTY_REWARD_USED'));
check('promotion appliquée -> client',co.includes('PROMOTION_APPLIED')&&co.includes('promotion:order:'));
check('Stripe refund -> client',pc.includes('Refund Stripe')&&pc.includes('notifyRefund'));
check('MTN refund pending -> client',pc.includes('Refund MTN pending'));
check('MTN refund confirmé -> client',pc.includes('Refund MTN confirmé'));
check('MTN refund annulé -> client',pc.includes('Refund MTN annulé'));
check('CASH refund -> client',pc.includes('Refund espèces'));
check('CASH paiement -> client',pc.includes('Encaissement CASH'));
check('CASH points Tiop+ -> client',pc.includes('Points CASH'));
check('POS compte client -> notification',pos.includes('POS_ORDER_CREATED')&&pos.includes('customer.mode === "ACCOUNT"'));
check('POS invité non ciblé comme client',pos.includes('customer.userId'));
check('liens paiement/remboursement internes client',ns.includes('/compte/commandes/'));
check('émission temps réel notification:new/changed',ns.includes("notification:changed")&&ns.includes("notification:new"));
console.log(`\nRÉSULTAT 19.4.1 : PASS=${pass} | FAIL=${fail}`); process.exitCode=fail?1:0;
