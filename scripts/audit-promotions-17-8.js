require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ejs = require('ejs');
const db = require('../config/database');

const ROOT = path.join(__dirname, '..');
const checks = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function pass(name, detail = '') {
  checks.push({ name, ok: true, detail });
  console.log(`✅ PASS — ${name}`);
  if (detail) console.log(`   ${detail}`);
}

function fail(name, detail = '') {
  checks.push({ name, ok: false, detail });
  console.log(`❌ FAIL — ${name}`);
  if (detail) console.log(`   ${detail}`);
}

function test(name, ok, detail = '') {
  return ok ? pass(name, detail) : fail(name, detail);
}

function nodeCheck(rel) {
  const full = path.join(ROOT, rel);
  const r = spawnSync(process.execPath, ['--check', full], { encoding: 'utf8' });
  return { ok: r.status === 0, error: (r.stderr || r.stdout || '').trim() };
}

async function tableExists(name) {
  const [rows] = await db.pool.execute(
    `SELECT COUNT(*) total FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?`,
    [name]
  );
  return Number(rows[0]?.total || 0) === 1;
}

async function columnExists(table, column) {
  const [rows] = await db.pool.execute(
    `SELECT COUNT(*) total FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?`,
    [table, column]
  );
  return Number(rows[0]?.total || 0) === 1;
}

(async () => {
  console.log('='.repeat(82));
  console.log(' TIOPTIOP — 17.8 — AUDIT FINAL PROMOTIONS & CODES PROMO');
  console.log(' Mode sûr : lecture du code + lecture SQL uniquement. Aucune donnée métier modifiée.');
  console.log('='.repeat(82));

  let dbReachable = false;

  try {
    const promotion = read('models/promotion.model.js');
    const order = read('models/order.model.js');
    const payment = read('services/payment.service.js');
    const refund = read('services/refund.service.js');
    const loyalty = read('models/loyalty.model.js');
    const loyaltyCard = read('models/loyalty-card.model.js');
    const cartController = read('controllers/client/cart.controller.js');
    const cartRoutes = read('routes/client/cart.routes.js');
    const checkoutController = read('controllers/client/checkout.controller.js');
    const adminController = read('controllers/admin/promotion.controller.js');
    const cartJs = read('public/js/cart.js');
    const checkoutJs = read('public/js/checkout.js');
    const adminView = read('views/admin/catalog/promotions.ejs');
    const cartView = read('views/client/orders/cart.ejs');
    const checkoutView = read('views/client/orders/checkout.ejs');

    test(
      'A — Types PERCENT / FIXED / FREE_DELIVERY',
      promotion.includes("type === 'PERCENT'") &&
      promotion.includes("type === 'FIXED'") &&
      promotion.includes("type === 'FREE_DELIVERY'") &&
      /Math\.min\(eligibleSubtotal,\s*Math\.round\(eligibleSubtotal \* value \/ 100\)\)/.test(promotion) &&
      /discountAmount\s*=\s*Math\.min\(eligibleSubtotal,\s*value\)/.test(promotion) &&
      /freeDelivery\s*=\s*true/.test(promotion),
      'Réductions calculées côté serveur et plafonnées au montant éligible.'
    );

    test(
      'B — Bonus POINTS_MULTIPLIER',
      promotion.includes("type === 'POINTS_MULTIPLIER'") &&
      promotion.includes("pointsMultiplier: type === 'POINTS_MULTIPLIER' ? value : 1") &&
      loyalty.includes("p.discount_type='POINTS_MULTIPLIER'") &&
      loyalty.includes('basePoints * pointsMultiplier') &&
      loyaltyCard.includes("p.discount_type='POINTS_MULTIPLIER'") &&
      loyaltyCard.includes('basePoints*pointsMultiplier'),
      'Le multiplicateur n’abaisse pas le panier et agit sur les points après paiement.'
    );

    test(
      'C — Activation / dates / montant minimum',
      /Number\(promo\.is_active\)\s*!==\s*1/.test(promotion) &&
      promotion.includes('promo.starts_at') &&
      promotion.includes('promo.ends_at') &&
      promotion.includes('promo.minimum_order') &&
      promotion.includes('Montant minimum requis'),
      'La promotion est revalidée selon son état, sa période et le minimum requis.'
    );

    test(
      'D — Audiences ALL / TIOP_PLUS / NEW_CUSTOMERS / SELECTED',
      promotion.includes("promo.audience === 'TIOP_PLUS'") &&
      promotion.includes("promo.audience === 'NEW_CUSTOMERS'") &&
      promotion.includes("promo.audience === 'SELECTED'") &&
      promotion.includes('promotion_selected_users WHERE promotion_id=? AND user_id=?') &&
      promotion.includes("p.audience <> 'SELECTED'"),
      'Les promotions privées sont filtrées dans les offres et revérifiées à l’application.'
    );

    test(
      'E — Sélection clients + recherche dynamique',
      adminController.includes('Promotion.customers()') &&
      adminView.includes('name="selected_user_ids"') &&
      adminView.includes("customerSearch.addEventListener('input'") &&
      adminView.includes("customer-hidden") &&
      adminView.includes("e.preventDefault()") &&
      adminView.includes("normalize('NFD')"),
      'Recherche live nom/email/téléphone, accents normalisés et Entrée neutralisée.'
    );

    test(
      'F — Limites globale et par client',
      promotion.includes('promo.usage_limit') &&
      promotion.includes('promo.usage_limit_per_user') &&
      promotion.includes("IN ('RESERVED','USED')") &&
      adminView.includes('name="usage_limit"') &&
      adminView.includes('name="usage_limit_per_user"'),
      'Les utilisations RELEASED ne consomment plus les quotas.'
    );

    test(
      'G — Revalidation transactionnelle avant création commande',
      /Promotion\.validateCode\([\s\S]*connection[\s\S]*lock\s*:\s*true/.test(order) &&
      order.includes('promotionDiscountAmount') &&
      order.includes('discountAmount += promotionDiscountAmount') &&
      order.includes('INSERT INTO promotion_usages') &&
      order.includes("'RESERVED'"),
      'Le navigateur ne peut pas imposer lui-même le montant de la promotion.'
    );

    test(
      'H — Cycle RESERVED → USED → RELEASED',
      payment.includes('Promotion.markOrderUsageUsed') &&
      promotion.includes("status='USED'") &&
      order.includes("release_reason='ORDER_CANCELLED'") &&
      refund.includes("Promotion.releaseOrderUsage(payment.order_id, 'FULL_REFUND')") &&
      !refund.includes("Promotion.releaseOrderUsage(payment.order_id, 'PARTIAL_REFUND')"),
      'Paiement consomme le quota; annulation/remboursement total le libère; partiel le conserve.'
    );

    test(
      'I — Idempotence promotions / fidélité',
      promotion.includes("WHERE order_id=? AND status='RESERVED'") &&
      promotion.includes("WHERE order_id=? AND status IN ('RESERVED','USED')") &&
      loyalty.includes("transaction_type='EARN'") &&
      loyaltyCard.includes("transaction_type='EARN' LIMIT 1"),
      'Les transitions de statut et crédits de points sont protégés contre les doubles traitements.'
    );

    test(
      'J — Cumul Promo ↔ Tiop+ configurable et sécurisé',
      promotion.includes('allow_loyalty_stack') &&
      adminController.includes('allow_loyalty_stack:') &&
      adminView.includes('Autoriser le cumul avec un avantage Tiop+') &&
      checkoutView.includes('data-allow-loyalty-stack') &&
      checkoutJs.includes('promoAllowsLoyaltyStack') &&
      checkoutJs.includes('radio.disabled = true') &&
      order.includes('Number(promotion.allow_loyalty_stack) !== 1') &&
      order.indexOf('Promotion.validateCode') < order.indexOf('Loyalty.lockCheckoutRedemption'),
      'La promo est appliquée avant Tiop+ et le serveur bloque un cumul interdit.'
    );

    test(
      'K — Appliquer / retirer promo panier et checkout',
      cartController.includes('exports.applyPromotion') &&
      cartController.includes('exports.removePromotion') &&
      cartController.includes('req.session.promoCode = result.code') &&
      cartController.includes('delete req.session.promoCode') &&
      cartRoutes.indexOf('router.delete("/promo"') >= 0 &&
      cartRoutes.indexOf('router.delete("/promo"') < cartRoutes.indexOf('"/:itemId"') &&
      /fetch\("\/panier\/promo"[\s\S]*method:\s*"DELETE"/.test(cartJs) &&
      checkoutController.includes('promoCode') &&
      checkoutJs.includes('checkoutRemovePromoButton'),
      'Les routes spécifiques /promo passent avant /:itemId et la session est réellement nettoyée.'
    );

    const jsFiles = [
      'models/promotion.model.js',
      'models/order.model.js',
      'services/payment.service.js',
      'services/refund.service.js',
      'controllers/admin/promotion.controller.js',
      'controllers/client/cart.controller.js',
      'controllers/client/checkout.controller.js',
      'public/js/cart.js',
      'public/js/checkout.js'
    ];
    const syntaxErrors = jsFiles.map(f => ({ f, ...nodeCheck(f) })).filter(x => !x.ok);
    let ejsOk = true;
    let ejsError = '';
    try {
      [adminView, cartView, checkoutView].forEach(src => ejs.compile(src));
    } catch (e) {
      ejsOk = false;
      ejsError = e.message;
    }
    test(
      'L — Syntaxe JS et templates EJS',
      syntaxErrors.length === 0 && ejsOk,
      syntaxErrors.length ? syntaxErrors.map(x => `${x.f}: ${x.error}`).join(' | ') : (ejsError || 'JS --check OK + EJS compile OK')
    );

    try {
      await db.testConnection();
      dbReachable = true;

      const requiredTables = ['promotions', 'promotion_usages', 'promotion_selected_users'];
      const tableFlags = await Promise.all(requiredTables.map(tableExists));
      const requiredColumns = [
        ['promotions', 'usage_limit'],
        ['promotions', 'usage_limit_per_user'],
        ['promotions', 'allow_loyalty_stack'],
        ['promotion_usages', 'status'],
        ['promotion_usages', 'used_at'],
        ['promotion_usages', 'released_at'],
        ['promotion_usages', 'release_reason']
      ];
      const columnFlags = await Promise.all(requiredColumns.map(([t,c]) => columnExists(t,c)));

      const [uniqueOrderIndex] = await db.pool.execute(`
        SELECT COUNT(*) total
        FROM information_schema.statistics
        WHERE table_schema=DATABASE()
          AND table_name='promotion_usages'
          AND column_name='order_id'
          AND non_unique=0
      `);

      test(
        'M — Schéma SQL 17.2 → 17.7 complet',
        tableFlags.every(Boolean) && columnFlags.every(Boolean) && Number(uniqueOrderIndex[0]?.total || 0) > 0,
        `Tables=${tableFlags.filter(Boolean).length}/${requiredTables.length}, colonnes=${columnFlags.filter(Boolean).length}/${requiredColumns.length}, UNIQUE(order_id)=${Number(uniqueOrderIndex[0]?.total || 0) > 0 ? 'oui' : 'non'}`
      );

      const [orphans] = await db.pool.execute(`
        SELECT COUNT(*) total
        FROM promotion_usages pu
        LEFT JOIN promotions p ON p.id=pu.promotion_id
        LEFT JOIN orders o ON o.id=pu.order_id
        WHERE p.id IS NULL OR o.id IS NULL
      `);
      const [dups] = await db.pool.execute(`
        SELECT COUNT(*) total FROM (
          SELECT order_id, COUNT(*) c
          FROM promotion_usages
          GROUP BY order_id
          HAVING COUNT(*) > 1
        ) x
      `);
      const [badStatuses] = await db.pool.execute(`
        SELECT COUNT(*) total
        FROM promotion_usages
        WHERE COALESCE(status,'USED') NOT IN ('RESERVED','USED','RELEASED')
      `);
      const [releasedMissingDate] = await db.pool.execute(`
        SELECT COUNT(*) total
        FROM promotion_usages
        WHERE status='RELEASED' AND released_at IS NULL
      `);
      const [badSelected] = await db.pool.execute(`
        SELECT COUNT(*) total
        FROM promotion_selected_users psu
        LEFT JOIN promotions p ON p.id=psu.promotion_id
        LEFT JOIN users u ON u.id=psu.user_id
        WHERE p.id IS NULL OR u.id IS NULL
      `);

      const problems = {
        orphelins: Number(orphans[0]?.total || 0),
        doublons_commande: Number(dups[0]?.total || 0),
        statuts_invalides: Number(badStatuses[0]?.total || 0),
        released_sans_date: Number(releasedMissingDate[0]?.total || 0),
        selections_orphelines: Number(badSelected[0]?.total || 0)
      };
      const totalProblems = Object.values(problems).reduce((a,b) => a+b, 0);
      test(
        'N — Cohérence des données promotions',
        totalProblems === 0,
        Object.entries(problems).map(([k,v]) => `${k}=${v}`).join(', ')
      );
    } catch (e) {
      fail('M — Schéma SQL 17.2 → 17.7 complet', `Connexion SQL impossible : ${e.message}`);
      fail('N — Cohérence des données promotions', 'Audit SQL non exécuté car la base est inaccessible.');
    }
  } catch (e) {
    console.error('\n❌ Audit interrompu :', e.stack || e.message);
    process.exitCode = 1;
  } finally {
    const passCount = checks.filter(x => x.ok).length;
    const failCount = checks.filter(x => !x.ok).length;
    console.log('\n' + '='.repeat(82));
    console.log(`RÉSULTAT 17.8 : PASS=${passCount} | FAIL=${failCount}`);
    if (failCount === 0 && passCount === 14) {
      console.log('✅ PHASE 17 — PROMOTIONS & CODES PROMO VALIDÉE.');
      console.log('✅ Aucun correctif métier supplémentaire requis par cet audit.');
    } else {
      console.log('⚠️ Ne pas figer la phase 17 avant correction des FAIL ci-dessus.');
    }
    console.log('='.repeat(82));
    try { await db.pool.end(); } catch (_) {}
    if (failCount > 0 || passCount !== 14) process.exitCode = 1;
  }
})();
