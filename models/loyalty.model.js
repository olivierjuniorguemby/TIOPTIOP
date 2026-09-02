const crypto = require('crypto');
const db = require('../config/database');

async function getConfig() {
  const rows = await db.query(`SELECT setting_value FROM system_settings WHERE setting_key='loyalty.config' LIMIT 1`);
  let value = rows[0]?.setting_value || {};
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = {}; } }
  return { enabled: value.enabled !== 0, pointsPer1000Xaf: Number(value.points_per_1000_xaf || 10) };
}

async function findAccount(userId) {
  const rows = await db.query(`
    SELECT la.user_id, la.points_balance, la.tier, la.subscribed_at, la.updated_at,
           u.public_id, u.email, u.phone,
           up.first_name, up.last_name, up.display_name
    FROM loyalty_accounts la
    JOIN users u ON u.id=la.user_id
    LEFT JOIN user_profiles up ON up.user_id=u.id
    WHERE la.user_id=? LIMIT 1`, [userId]);
  return rows[0] || null;
}

async function subscribe(userId) {
  await db.query(`
    INSERT INTO loyalty_accounts (user_id, points_balance, tier, subscribed_at)
    VALUES (?,0,'TIOP_PLUS',NOW())
    ON DUPLICATE KEY UPDATE
      subscribed_at=COALESCE(subscribed_at,NOW()),
      tier=CASE WHEN subscribed_at IS NULL THEN 'TIOP_PLUS' ELSE tier END`, [userId]);
  return findAccount(userId);
}

async function awardPaidOrder(paymentId) {
  const id = Number(paymentId);
  if (!Number.isInteger(id) || id <= 0) return { credited: false, reason: 'INVALID_PAYMENT' };

  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(`
      SELECT p.id AS payment_id, p.order_id, p.amount, p.currency, p.status, p.paid_at,
             o.user_id, o.reference
      FROM payments p
      INNER JOIN orders o ON o.id=p.order_id
      WHERE p.id=? LIMIT 1 FOR UPDATE`, [id]);
    const payment = rows[0] || null;

    if (!payment || payment.status !== 'PAID') {
      await connection.rollback();
      return { credited: false, reason: 'PAYMENT_NOT_PAID' };
    }
    if (!payment.user_id) {
      await connection.rollback();
      return { credited: false, reason: 'GUEST_ORDER' };
    }

    // Verrouille le compte fidélité : deux confirmations concurrentes ne peuvent
    // jamais créditer deux fois la même commande.
    const [accounts] = await connection.execute(`
      SELECT user_id, points_balance, subscribed_at
      FROM loyalty_accounts WHERE user_id=? LIMIT 1 FOR UPDATE`, [payment.user_id]);
    const account = accounts[0] || null;
    if (!account || !account.subscribed_at) {
      await connection.rollback();
      return { credited: false, reason: 'NOT_SUBSCRIBED' };
    }

    // Pas de crédit rétroactif pour une commande payée avant l'adhésion Tiop+.
    if (payment.paid_at && new Date(account.subscribed_at) > new Date(payment.paid_at)) {
      await connection.rollback();
      return { credited: false, reason: 'PAID_BEFORE_SUBSCRIPTION' };
    }

    const [existing] = await connection.execute(`
      SELECT id, points FROM loyalty_transactions
      WHERE user_id=? AND order_id=? AND transaction_type='EARN'
      LIMIT 1`, [payment.user_id, payment.order_id]);
    if (existing[0]) {
      await connection.commit();
      return { credited: false, duplicate: true, reason: 'ALREADY_CREDITED', points: Number(existing[0].points || 0) };
    }

    const [settings] = await connection.execute(`
      SELECT setting_value FROM system_settings
      WHERE setting_key='loyalty.config' LIMIT 1`);
    let cfg = settings[0]?.setting_value || {};
    if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg); } catch { cfg = {}; } }
    if (cfg.enabled === 0 || cfg.enabled === false) {
      await connection.rollback();
      return { credited: false, reason: 'LOYALTY_DISABLED' };
    }

    const rate = Math.max(0, Number(cfg.points_per_1000_xaf || 10));
    const amount = Math.max(0, Number(payment.amount || 0));
    const points = Math.floor(amount / 1000) * rate;
    if (!Number.isFinite(points) || points <= 0) {
      await connection.rollback();
      return { credited: false, reason: 'NO_ELIGIBLE_POINTS' };
    }

    await connection.execute(`
      INSERT INTO loyalty_transactions
        (user_id, order_id, reward_id, transaction_type, points, description)
      VALUES (?, ?, NULL, 'EARN', ?, ?)`, [
        payment.user_id,
        payment.order_id,
        points,
        `Points Tiop+ gagnés après paiement de la commande ${payment.reference}.`
      ]);

    await connection.execute(`
      UPDATE loyalty_accounts
      SET points_balance=points_balance+?, updated_at=CURRENT_TIMESTAMP
      WHERE user_id=?`, [points, payment.user_id]);

    await connection.commit();
    return { credited: true, points, userId: payment.user_id, orderId: payment.order_id };
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    throw error;
  } finally {
    connection.release();
  }
}


async function listRewards({ includeInactive = false } = {}) {
  const where = includeInactive ? '' : 'WHERE is_active=1';
  return db.query(`
    SELECT id, name, description, image_url, points_cost, reward_type,
           reward_value, reward_product_id, is_active
    FROM loyalty_rewards
    ${where}
    ORDER BY is_active DESC, points_cost ASC, id DESC`);
}

async function findReward(id) {
  const rows = await db.query(`SELECT * FROM loyalty_rewards WHERE id=? LIMIT 1`, [id]);
  return rows[0] || null;
}

async function createReward(data) {
  const result = await db.query(`
    INSERT INTO loyalty_rewards
      (name, description, image_url, points_cost, reward_type, reward_value, reward_product_id, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
      data.name, data.description, data.image_url, data.points_cost,
      data.reward_type, data.reward_value, data.reward_product_id || null, data.is_active ? 1 : 0
    ]);
  return findReward(result.insertId);
}

async function updateReward(id, data) {
  await db.query(`
    UPDATE loyalty_rewards
    SET name=?, description=?, image_url=?, points_cost=?, reward_type=?, reward_value=?, reward_product_id=?, is_active=?
    WHERE id=?`, [
      data.name, data.description, data.image_url, data.points_cost,
      data.reward_type, data.reward_value, data.reward_product_id || null, data.is_active ? 1 : 0, id
    ]);
  return findReward(id);
}

async function deleteReward(id) {
  return db.query(`DELETE FROM loyalty_rewards WHERE id=?`, [id]);
}


async function ensureRedemptionsTable() {
  /*
   * 16.9 — définition de référence du schéma Tiop+.
   *
   * IMPORTANT :
   * CREATE TABLE IF NOT EXISTS ne migre pas une ancienne table.
   * Le script scripts/harden-loyalty-16-9.js est fourni pour mettre à niveau
   * une base déjà existante. Ici, on garantit surtout qu'une installation
   * neuve crée directement le schéma final utilisé par 16.5 → 16.8.
   */
  await db.query(`
    CREATE TABLE IF NOT EXISTS loyalty_redemptions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      public_id CHAR(36) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      reward_id BIGINT UNSIGNED NOT NULL,
      order_id BIGINT UNSIGNED NULL,
      points_cost INT UNSIGNED NOT NULL,
      reward_type ENUM('PRODUCT','DISCOUNT','FREE_DELIVERY','COUPON') NOT NULL,
      reward_value DECIMAL(12,2) NULL,
      status ENUM('AVAILABLE','RESERVED','USED','CANCELLED','EXPIRED') NOT NULL DEFAULT 'AVAILABLE',
      request_key VARCHAR(100) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      used_at DATETIME NULL,
      expires_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_loyalty_redemptions_public_id (public_id),
      UNIQUE KEY uq_loyalty_redemptions_request_key (request_key),
      KEY idx_loyalty_redemptions_user_status (user_id, status),
      KEY idx_loyalty_redemptions_reward (reward_id),
      KEY idx_loyalty_redemptions_order (order_id),
      CONSTRAINT fk_loyalty_redemptions_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_loyalty_redemptions_reward
        FOREIGN KEY (reward_id) REFERENCES loyalty_rewards(id) ON DELETE RESTRICT,
      CONSTRAINT fk_loyalty_redemptions_order
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS loyalty_redemption_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      redemption_id BIGINT UNSIGNED NOT NULL,
      order_id BIGINT UNSIGNED NULL,
      event_type VARCHAR(80) NOT NULL,
      from_status VARCHAR(30) NULL,
      to_status VARCHAR(30) NULL,
      note TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_loyalty_redemption_events_redemption (redemption_id, id),
      KEY idx_loyalty_redemption_events_order (order_id, id),
      CONSTRAINT fk_loyalty_redemption_events_redemption
        FOREIGN KEY (redemption_id) REFERENCES loyalty_redemptions(id) ON DELETE CASCADE,
      CONSTRAINT fk_loyalty_redemption_events_order
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function listAvailableRedemptions(userId) {
  await ensureRedemptionsTable();
  return db.query(`
    SELECT lr.id, lr.public_id, lr.points_cost, lr.reward_type, lr.reward_value,
           lr.status, lr.created_at, lr.expires_at,
           r.name, r.description, r.image_url, r.reward_product_id,
           p.name AS reward_product_name
    FROM loyalty_redemptions lr
    INNER JOIN loyalty_rewards r ON r.id=lr.reward_id
    LEFT JOIN products p ON p.id=r.reward_product_id
    WHERE lr.user_id=? AND lr.status='AVAILABLE'
      AND (lr.expires_at IS NULL OR lr.expires_at > NOW())
    ORDER BY lr.created_at DESC, lr.id DESC`, [userId]);
}

async function redeemReward(userId, rewardId, requestKey) {
  const uid = Number(userId);
  const rid = Number(rewardId);
  const key = String(requestKey || '').trim();
  if (!Number.isInteger(uid) || uid <= 0) return { redeemed:false, reason:'INVALID_USER' };
  if (!Number.isInteger(rid) || rid <= 0) return { redeemed:false, reason:'INVALID_REWARD' };
  if (!key || key.length > 100) return { redeemed:false, reason:'INVALID_REQUEST' };

  await ensureRedemptionsTable();
  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();

    const [previous] = await connection.execute(`
      SELECT id, public_id, reward_id, points_cost, status
      FROM loyalty_redemptions WHERE request_key=? LIMIT 1 FOR UPDATE`, [key]);
    if (previous[0]) {
      await connection.commit();
      return { redeemed:true, duplicate:true, redemption:previous[0] };
    }

    const [accounts] = await connection.execute(`
      SELECT user_id, points_balance, subscribed_at
      FROM loyalty_accounts WHERE user_id=? LIMIT 1 FOR UPDATE`, [uid]);
    const account = accounts[0] || null;
    if (!account || !account.subscribed_at) {
      await connection.rollback();
      return { redeemed:false, reason:'NOT_SUBSCRIBED' };
    }

    const [rewards] = await connection.execute(`
      SELECT id, name, description, points_cost, reward_type, reward_value, is_active
      FROM loyalty_rewards WHERE id=? LIMIT 1 FOR UPDATE`, [rid]);
    const reward = rewards[0] || null;
    if (!reward || Number(reward.is_active) !== 1) {
      await connection.rollback();
      return { redeemed:false, reason:'REWARD_UNAVAILABLE' };
    }

    const cost = Number(reward.points_cost || 0);
    const balance = Number(account.points_balance || 0);
    if (!Number.isFinite(cost) || cost <= 0) {
      await connection.rollback();
      return { redeemed:false, reason:'INVALID_COST' };
    }
    if (balance < cost) {
      await connection.rollback();
      return { redeemed:false, reason:'INSUFFICIENT_POINTS', balance, cost };
    }

    const publicId = crypto.randomUUID();
    await connection.execute(`
      INSERT INTO loyalty_redemptions
        (public_id, user_id, reward_id, points_cost, reward_type, reward_value, status, request_key, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, DATE_ADD(NOW(), INTERVAL 90 DAY))`, [
        publicId, uid, rid, cost, reward.reward_type, reward.reward_value, key
      ]);

    await connection.execute(`
      INSERT INTO loyalty_transactions
        (user_id, order_id, reward_id, transaction_type, points, description)
      VALUES (?, NULL, ?, 'SPEND', ?, ?)`, [
        uid, rid, -cost, `Échange Tiop+ : ${reward.name}.`
      ]);

    await connection.execute(`
      UPDATE loyalty_accounts
      SET points_balance=points_balance-?, updated_at=CURRENT_TIMESTAMP
      WHERE user_id=?`, [cost, uid]);

    await connection.commit();
    return {
      redeemed:true,
      duplicate:false,
      redemption:{ public_id:publicId, reward_id:rid, points_cost:cost, status:'AVAILABLE' },
      reward,
      newBalance: balance - cost
    };
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    if (error && error.code === 'ER_DUP_ENTRY') {
      const rows = await db.query(`SELECT * FROM loyalty_redemptions WHERE request_key=? LIMIT 1`, [key]);
      if (rows[0]) return { redeemed:true, duplicate:true, redemption:rows[0] };
    }
    throw error;
  } finally {
    connection.release();
  }
}


/* =========================================================
   16.6 — AVANTAGE TIOP+ AU CHECKOUT
========================================================= */
async function lockCheckoutRedemption(connection, userId, publicId) {
  const token = String(publicId || '').trim();
  if (!token) return null;

  const [rows] = await connection.execute(`
    SELECT lr.id, lr.public_id, lr.user_id, lr.reward_id, lr.points_cost,
           lr.reward_type, lr.reward_value, lr.status, lr.expires_at,
           r.name, r.description, r.reward_product_id, r.is_active,
           p.name AS reward_product_name, p.price AS reward_product_price,
           p.currency AS reward_product_currency, p.is_active AS reward_product_active
    FROM loyalty_redemptions lr
    INNER JOIN loyalty_rewards r ON r.id=lr.reward_id
    LEFT JOIN products p ON p.id=r.reward_product_id
    WHERE lr.public_id=? AND lr.user_id=?
    LIMIT 1 FOR UPDATE`, [token, Number(userId)]);

  const redemption = rows[0] || null;
  if (!redemption) throw new Error('Avantage Tiop+ introuvable.');
  if (redemption.status !== 'AVAILABLE') throw new Error('Cet avantage Tiop+ a déjà été utilisé ou n’est plus disponible.');
  if (redemption.expires_at && new Date(redemption.expires_at) <= new Date()) throw new Error('Cet avantage Tiop+ a expiré.');
  return redemption;
}

async function addRedemptionLifecycleEvent(connection, redemptionId, orderId, eventType, fromStatus, toStatus, note = null) {
  await connection.execute(`
    INSERT INTO loyalty_redemption_events
      (redemption_id, order_id, event_type, from_status, to_status, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [redemptionId, orderId || null, eventType, fromStatus || null, toStatus || null, note || null]);
}

// 16.7 — A la création de la commande, l'avantage est RESERVE et non consommé.
// Il ne peut donc pas être utilisé sur une seconde commande pendant le paiement.
async function reserveRedemptionInTransaction(connection, redemptionId, orderId) {
  const [result] = await connection.execute(`
    UPDATE loyalty_redemptions
    SET status='RESERVED', used_at=NULL, order_id=?
    WHERE id=? AND status='AVAILABLE'`, [orderId, redemptionId]);
  if (result.affectedRows !== 1) throw new Error('Impossible de réserver l’avantage Tiop+.');
  await addRedemptionLifecycleEvent(connection, redemptionId, orderId, 'RESERVED_FOR_ORDER', 'AVAILABLE', 'RESERVED', 'Avantage réservé lors de la création de la commande.');
}

// Compatibilité avec le nom introduit en 16.6.
async function markRedemptionUsedInTransaction(connection, redemptionId, orderId) {
  return reserveRedemptionInTransaction(connection, redemptionId, orderId);
}

async function finalizeOrderRedemption(orderId, reason = 'PAYMENT_CONFIRMED') {
  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(`
      SELECT id, status FROM loyalty_redemptions
      WHERE order_id=? LIMIT 1 FOR UPDATE`, [Number(orderId)]);
    const redemption = rows[0];
    if (!redemption) { await connection.commit(); return { finalized:false, reason:'NO_REDEMPTION' }; }
    if (redemption.status === 'USED') { await connection.commit(); return { finalized:true, duplicate:true }; }
    if (redemption.status !== 'RESERVED') { await connection.commit(); return { finalized:false, reason:'NOT_RESERVED', status:redemption.status }; }
    const [result] = await connection.execute(`
      UPDATE loyalty_redemptions SET status='USED', used_at=NOW()
      WHERE id=? AND status='RESERVED'`, [redemption.id]);
    if (result.affectedRows !== 1) throw new Error('Finalisation concurrente de l’avantage Tiop+.');
    await addRedemptionLifecycleEvent(connection, redemption.id, Number(orderId), 'CONSUMED', 'RESERVED', 'USED', reason);
    await connection.commit();
    return { finalized:true, redemptionId:redemption.id };
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    throw error;
  } finally { connection.release(); }
}

async function releaseOrderRedemption(orderId, reason = 'ORDER_CANCELLED') {
  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(`
      SELECT id, status FROM loyalty_redemptions
      WHERE order_id=? LIMIT 1 FOR UPDATE`, [Number(orderId)]);
    const redemption = rows[0];
    if (!redemption) { await connection.commit(); return { released:false, reason:'NO_REDEMPTION' }; }
    if (redemption.status === 'AVAILABLE' && !redemption.order_id) { await connection.commit(); return { released:true, duplicate:true }; }
    // Un avantage déjà définitivement consommé n'est pas recrédité par une simple annulation tardive/remboursement.
    if (redemption.status !== 'RESERVED') { await connection.commit(); return { released:false, reason:'NOT_RESERVED', status:redemption.status }; }
    const [result] = await connection.execute(`
      UPDATE loyalty_redemptions
      SET status='AVAILABLE', used_at=NULL, order_id=NULL
      WHERE id=? AND status='RESERVED'`, [redemption.id]);
    if (result.affectedRows !== 1) throw new Error('Restauration concurrente de l’avantage Tiop+.');
    await addRedemptionLifecycleEvent(connection, redemption.id, Number(orderId), 'RELEASED', 'RESERVED', 'AVAILABLE', reason);
    await connection.commit();
    return { released:true, redemptionId:redemption.id };
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    throw error;
  } finally { connection.release(); }
}


/* =========================================================
   16.8 — REMBOURSEMENT TOTAL & TIOP+
   - compense les points EARN de la commande
   - restitue l'avantage USED de la commande
   - idempotent : un remboursement/retry ne compense jamais 2 fois
========================================================= */
async function reverseFullyRefundedOrder(orderId, reason = 'FULL_REFUND') {
  const oid = Number(orderId);
  if (!Number.isInteger(oid) || oid <= 0) {
    return { reversed:false, reason:'INVALID_ORDER' };
  }

  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();

    const [orders] = await connection.execute(`
      SELECT id, user_id, reference
      FROM orders
      WHERE id=? LIMIT 1 FOR UPDATE`, [oid]);
    const order = orders[0] || null;

    if (!order || !order.user_id) {
      await connection.commit();
      return { reversed:false, reason: order ? 'GUEST_ORDER' : 'ORDER_NOT_FOUND' };
    }

    const [earns] = await connection.execute(`
      SELECT id, points
      FROM loyalty_transactions
      WHERE user_id=? AND order_id=? AND transaction_type='EARN'
      ORDER BY id ASC`, [order.user_id, oid]);

    const earnedPoints = earns.reduce((sum, row) => sum + Math.max(0, Number(row.points || 0)), 0);
    let pointsReversed = 0;

    if (earnedPoints > 0) {
      const marker = `REFUND_EARN_REVERSAL:${oid}`;
      const [existingAdjustments] = await connection.execute(`
        SELECT id, points
        FROM loyalty_transactions
        WHERE user_id=? AND order_id=? AND transaction_type='ADJUSTMENT'
          AND description LIKE ?
        LIMIT 1 FOR UPDATE`, [order.user_id, oid, `${marker}%`]);

      if (!existingAdjustments[0]) {
        const [accounts] = await connection.execute(`
          SELECT user_id, points_balance
          FROM loyalty_accounts
          WHERE user_id=? LIMIT 1 FOR UPDATE`, [order.user_id]);

        if (accounts[0]) {
          await connection.execute(`
            INSERT INTO loyalty_transactions
              (user_id, order_id, reward_id, transaction_type, points, description)
            VALUES (?, ?, NULL, 'ADJUSTMENT', ?, ?)`, [
              order.user_id,
              oid,
              -earnedPoints,
              `${marker} — Compensation des points gagnés après remboursement total de la commande ${order.reference || '#' + oid}.`
            ]);

          await connection.execute(`
            UPDATE loyalty_accounts
            SET points_balance=points_balance-?, updated_at=CURRENT_TIMESTAMP
            WHERE user_id=?`, [earnedPoints, order.user_id]);

          pointsReversed = earnedPoints;
        }
      }
    }

    const [redemptions] = await connection.execute(`
      SELECT id, status
      FROM loyalty_redemptions
      WHERE order_id=?
      ORDER BY id ASC
      FOR UPDATE`, [oid]);

    let restoredRedemptions = 0;
    for (const redemption of redemptions) {
      if (redemption.status !== 'USED') continue;

      const [result] = await connection.execute(`
        UPDATE loyalty_redemptions
        SET status='AVAILABLE', used_at=NULL, order_id=NULL
        WHERE id=? AND status='USED'`, [redemption.id]);

      if (result.affectedRows === 1) {
        await addRedemptionLifecycleEvent(
          connection,
          redemption.id,
          oid,
          'RESTORED_AFTER_REFUND',
          'USED',
          'AVAILABLE',
          reason
        );
        restoredRedemptions++;
      }
    }

    await connection.commit();
    return {
      reversed:true,
      orderId:oid,
      userId:Number(order.user_id),
      earnedPoints,
      pointsReversed,
      restoredRedemptions
    };
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { getConfig, findAccount, subscribe, awardPaidOrder, listRewards, findReward, createReward, updateReward, deleteReward, ensureRedemptionsTable, listAvailableRedemptions, redeemReward, lockCheckoutRedemption, markRedemptionUsedInTransaction, reserveRedemptionInTransaction, finalizeOrderRedemption, releaseOrderRedemption, reverseFullyRefundedOrder };
