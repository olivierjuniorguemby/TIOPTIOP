require('dotenv').config();
const db = require('../config/database');

const targetAmount = Number(process.argv[2] || 150000);

function section(title) {
  console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`);
}

(async () => {
  try {
    section(`DIAGNOSTIC TIOP+ — paiements autour de ${targetAmount.toLocaleString('fr-FR')} XAF`);

    const settings = await db.query(`
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key='loyalty.config'
      LIMIT 1
    `);
    console.log('Configuration fidélité :', settings[0] || '(absente => valeurs par défaut)');

    const payments = await db.query(`
      SELECT
        p.id AS payment_id,
        p.order_id,
        p.amount AS payment_amount,
        p.status AS payment_status,
        p.method,
        p.provider,
        p.created_at AS payment_created_at,
        o.reference,
        o.total_amount AS order_total,
        o.status AS order_status,
        l.card_id,
        lc.public_id AS card_public_id,
        lc.card_number,
        lc.display_name,
        lc.points_balance,
        lc.status AS card_status,
        lc.expires_at
      FROM payments p
      INNER JOIN orders o ON o.id=p.order_id
      LEFT JOIN loyalty_card_order_links l ON l.order_id=o.id
      LEFT JOIN loyalty_cards lc ON lc.id=l.card_id
      WHERE ABS(CAST(p.amount AS DECIMAL(15,2)) - ?) <= 1
         OR ABS(CAST(o.total_amount AS DECIMAL(15,2)) - ?) <= 1
      ORDER BY p.id DESC
      LIMIT 30
    `, [targetAmount, targetAmount]);

    section('1. Paiements / commandes trouvés');
    if (!payments.length) {
      console.log(`Aucun paiement ni total de commande trouvé autour de ${targetAmount} XAF.`);
      console.log('Relance possible avec un autre montant : node scripts/diagnostic-loyalty-card-150k.js 149000');
      return;
    }
    console.table(payments);

    for (const p of payments) {
      section(`2. Commande #${p.order_id} — paiement #${p.payment_id} — ${p.reference || ''}`);

      const tx = await db.query(`
        SELECT id,card_id,order_id,transaction_type,points,description,created_at
        FROM loyalty_card_transactions
        WHERE order_id=?
        ORDER BY id ASC
      `, [p.order_id]);
      console.log('Mouvements carte physique :');
      console.table(tx);

      const events = await db.query(`
        SELECT id,event_type,description,created_at
        FROM payment_events
        WHERE payment_id=?
        ORDER BY id ASC
      `, [p.payment_id]);
      console.log('Événements paiement :');
      console.table(events);

      let reason = 'ELIGIBLE_AU_CREDIT';
      if (!p.card_id) reason = 'NO_PHYSICAL_CARD — aucune liaison loyalty_card_order_links';
      else if (String(p.payment_status || '').toUpperCase() !== 'PAID') reason = `PAYMENT_NOT_PAID — statut=${p.payment_status}`;
      else if (String(p.card_status || '').toUpperCase() !== 'ACTIVE') reason = `CARD_NOT_ACTIVE — statut=${p.card_status}`;
      else if (p.expires_at && new Date(p.expires_at) <= new Date()) reason = `CARD_NOT_ACTIVE — carte expirée le ${p.expires_at}`;
      else if (tx.some(x => x.transaction_type === 'EARN')) reason = 'ALREADY_CREDITED — mouvement EARN déjà présent';

      console.log('\nDiagnostic structurel :', reason);
      if (reason === 'ELIGIBLE_AU_CREDIT') {
        console.log('La commande possède la liaison carte + paiement PAID et aucun EARN : le problème se situe dans l’appel/retour de awardPaidOrder() ou la configuration fidélité.');
      }
    }
  } catch (e) {
    console.error('\n❌ Diagnostic impossible :', e.message);
    console.error(e);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
