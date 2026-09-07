require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const checks = [];
function check(name, ok, detail) { checks.push({name,ok,detail}); console.log(`${ok?'✅ PASS':'❌ FAIL'} — ${name}`); if(detail) console.log(`   ${detail}`); }

(async()=>{
  console.log('='.repeat(72));
  console.log(' TIOPTIOP — 17.3 — AUDIT SÉCURITÉ PROMOTIONS / CHECKOUT');
  console.log(' Mode sûr : lecture DB + analyse code, aucune donnée métier modifiée.');
  console.log('='.repeat(72));
  try {
    const promo = read('models/promotion.model.js');
    const order = read('models/order.model.js');
    const cartCtl = read('controllers/client/cart.controller.js');
    const checkoutCtl = read('controllers/client/checkout.controller.js');
    const cartJs = read('public/js/cart.js');
    const checkoutJs = read('public/js/checkout.js');
    const checkoutView = read('views/client/orders/checkout.ejs');

    check('A — Validation serveur du code', /async function validateCode/.test(promo) && /WHERE code=\?/.test(promo), 'Le code n’est pas accepté sur la seule foi du navigateur.');
    check('B — Dates / activation / minimum', /is_active/.test(promo) && /starts_at/.test(promo) && /ends_at/.test(promo) && /minimum_order/.test(promo));
    check('C — Audience / limites', /TIOP_PLUS/.test(promo) && /NEW_CUSTOMERS/.test(promo) && /usage_limit_per_user/.test(promo));
    check('D — Catégories éligibles', /promotion_categories/.test(promo) && /eligibleSubtotal/.test(promo));
    check('E — Recalcul transactionnel à la création', /Promotion\.validateCode\([\s\S]*connection[\s\S]*lock:true/.test(order), 'La promotion est revalidée sous transaction avant INSERT de la commande.');
    check('F — Montants calculés côté serveur', /promotionDiscountAmount/.test(order) && /discountAmount \+= promotionDiscountAmount/.test(order) && /deliveryFee = 0/.test(order));
    check('G — Traçabilité usage ↔ commande', /INSERT INTO promotion_usages/.test(order) && /promo_code/.test(order));
    check('H — Checkout transmet le code au modèle', /promoCode/.test(checkoutCtl) && /Order\.createFromCart/.test(checkoutCtl));
    check('I — Retirer depuis le panier', /method:'DELETE'/.test(cartJs) && /removePromotion/.test(cartCtl));
    check('J — Retirer depuis le checkout', /checkoutRemovePromoButton/.test(checkoutJs) && /checkoutRemovePromoButton/.test(checkoutView));

    const [orphans] = await db.pool.execute(`SELECT COUNT(*) total FROM promotion_usages pu LEFT JOIN promotions p ON p.id=pu.promotion_id LEFT JOIN orders o ON o.id=pu.order_id WHERE p.id IS NULL OR o.id IS NULL`);
    check('K — Aucun usage promo orphelin', Number(orphans[0]?.total||0)===0, `Orphelins=${Number(orphans[0]?.total||0)}`);
    const [dups] = await db.pool.execute(`SELECT COUNT(*) total FROM (SELECT order_id,COUNT(*) c FROM promotion_usages GROUP BY order_id HAVING COUNT(*)>1) x`);
    check('L — Aucun double usage par commande', Number(dups[0]?.total||0)===0, `Doublons=${Number(dups[0]?.total||0)}`);
  } catch(e) {
    console.error('❌ Audit interrompu :', e.message); process.exitCode=1;
  } finally {
    const pass=checks.filter(x=>x.ok).length, fail=checks.filter(x=>!x.ok).length;
    console.log('='.repeat(72));
    console.log(`RÉSULTAT 17.3 : PASS=${pass} | FAIL=${fail}`);
    console.log(fail?'⚠️ Ne pas valider 17.3 avant correction.':'✅ 17.3 prête pour validation fonctionnelle.');
    console.log('='.repeat(72));
    await db.pool.end();
  }
})();
