const fs=require('fs');
let pass=0,fail=0;
function t(name,ok){console.log(`${ok?'PASS':'FAIL'} — ${name}`);ok?pass++:fail++;}
function r(f){return fs.readFileSync(f,'utf8');}
const m=r('models/promotion.model.js'), a=r('controllers/admin/promotion.controller.js'), o=r('models/order.model.js'), v=r('views/admin/catalog/promotions.ejs'), c=r('views/client/orders/checkout.ejs'), j=r('public/js/checkout.js'), i=r('scripts/install-promotions-stacking-17-7.js');
t('A colonne installable',i.includes('allow_loyalty_stack')&&i.includes('DEFAULT 1'));
t('B create persiste règle',m.includes('allow_loyalty_stack,starts_at'));
t('C update persiste règle',m.includes('allow_loyalty_stack=?'));
t('D admin normalise règle',a.includes('allow_loyalty_stack:'));
t('E admin affiche option cumul',v.includes('Autoriser le cumul avec un avantage Tiop+'));
t('F édition recharge valeur',v.includes('p.allow_loyalty_stack'));
t('G checkout expose règle',c.includes('data-allow-loyalty-stack'));
t('H checkout informe non-cumul',c.includes('n’est pas cumulable avec un avantage Tiop+'));
t('I JS lit règle',j.includes('promoAllowsLoyaltyStack'));
t('J JS désactive récompenses',j.includes('radio.disabled = true'));
t('K serveur bloque contournement',o.includes('Number(promotion.allow_loyalty_stack) !== 1'));
t('L ordre promo puis Tiop+ conservé',o.indexOf('Promotion.validateCode') < o.indexOf('Loyalty.lockCheckoutRedemption'));
console.log(`\nRÉSULTAT 17.7 : PASS=${pass} | FAIL=${fail}`);
console.log(fail?'❌ 17.7 à corriger.':'✅ 17.7 prête pour validation fonctionnelle.');
process.exitCode=fail?1:0;
