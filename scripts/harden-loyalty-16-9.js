require("dotenv").config();

const db = require("../config/database");

async function columnExists(table, column) {
  const [rows] = await db.pool.execute(`
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    LIMIT 1`, [table, column]);
  return rows.length > 0;
}

async function indexExists(table, indexName) {
  const [rows] = await db.pool.execute(`
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND INDEX_NAME = ?
    LIMIT 1`, [table, indexName]);
  return rows.length > 0;
}

async function constraintExists(table, constraintName) {
  const [rows] = await db.pool.execute(`
    SELECT 1
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND CONSTRAINT_NAME = ?
    LIMIT 1`, [table, constraintName]);
  return rows.length > 0;
}

async function tableExists(table) {
  const [rows] = await db.pool.execute(`
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    LIMIT 1`, [table]);
  return rows.length > 0;
}

async function main() {
  console.log("============================================================");
  console.log(" TIOPTIOP — 16.9 — DURCISSEMENT FINAL TIOP+");
  console.log(" Schéma / idempotence / cycle de vie");
  console.log("============================================================");

  // Une installation ancienne peut ne pas contenir ces éléments introduits
  // progressivement pendant 16.5 → 16.8.
  if (!(await columnExists("loyalty_rewards", "reward_product_id"))) {
    await db.pool.execute(`
      ALTER TABLE loyalty_rewards
      ADD COLUMN reward_product_id BIGINT UNSIGNED NULL AFTER reward_value`);
    console.log("✅ loyalty_rewards.reward_product_id ajouté");
  } else {
    console.log("✅ loyalty_rewards.reward_product_id déjà présent");
  }

  if (!(await indexExists("loyalty_rewards", "idx_loyalty_rewards_product"))) {
    await db.pool.execute(`
      ALTER TABLE loyalty_rewards
      ADD INDEX idx_loyalty_rewards_product (reward_product_id)`);
    console.log("✅ Index reward_product_id ajouté");
  }

  if (!(await constraintExists("loyalty_rewards", "fk_loyalty_rewards_product"))) {
    await db.pool.execute(`
      ALTER TABLE loyalty_rewards
      ADD CONSTRAINT fk_loyalty_rewards_product
      FOREIGN KEY (reward_product_id) REFERENCES products(id)
      ON DELETE SET NULL`);
    console.log("✅ FK reward_product_id ajoutée");
  }

  if (!(await tableExists("loyalty_redemptions"))) {
    await db.pool.execute(`
      CREATE TABLE loyalty_redemptions (
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
        KEY idx_loyalty_redemptions_user_status (user_id,status),
        KEY idx_loyalty_redemptions_reward (reward_id),
        KEY idx_loyalty_redemptions_order (order_id),
        CONSTRAINT fk_loyalty_redemptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_loyalty_redemptions_reward FOREIGN KEY (reward_id) REFERENCES loyalty_rewards(id) ON DELETE RESTRICT,
        CONSTRAINT fk_loyalty_redemptions_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    console.log("✅ loyalty_redemptions créée");
  } else {
    if (!(await columnExists("loyalty_redemptions", "order_id"))) {
      await db.pool.execute(`
        ALTER TABLE loyalty_redemptions
        ADD COLUMN order_id BIGINT UNSIGNED NULL AFTER reward_id`);
      console.log("✅ loyalty_redemptions.order_id ajouté");
    }

    // RESERVED est indispensable au cycle AVAILABLE -> RESERVED -> USED.
    // MODIFY est volontairement idempotent.
    await db.pool.execute(`
      ALTER TABLE loyalty_redemptions
      MODIFY COLUMN status
      ENUM('AVAILABLE','RESERVED','USED','CANCELLED','EXPIRED')
      NOT NULL DEFAULT 'AVAILABLE'`);
    console.log("✅ ENUM loyalty_redemptions.status normalisé");

    if (!(await indexExists("loyalty_redemptions", "idx_loyalty_redemptions_order"))) {
      await db.pool.execute(`
        ALTER TABLE loyalty_redemptions
        ADD INDEX idx_loyalty_redemptions_order (order_id)`);
      console.log("✅ Index order_id ajouté");
    }

    if (!(await constraintExists("loyalty_redemptions", "fk_loyalty_redemptions_order"))) {
      await db.pool.execute(`
        ALTER TABLE loyalty_redemptions
        ADD CONSTRAINT fk_loyalty_redemptions_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE SET NULL`);
      console.log("✅ FK order_id ajoutée");
    }
  }

  await db.pool.execute(`
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
      KEY idx_loyalty_redemption_events_redemption (redemption_id,id),
      KEY idx_loyalty_redemption_events_order (order_id,id),
      CONSTRAINT fk_loyalty_redemption_events_redemption
        FOREIGN KEY (redemption_id) REFERENCES loyalty_redemptions(id) ON DELETE CASCADE,
      CONSTRAINT fk_loyalty_redemption_events_order
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log("✅ loyalty_redemption_events disponible");

  // 16.9 — reprise des soldes historiques antérieurs au ledger Tiop+.
  // On ne touche qu'aux comptes qui n'ont AUCUNE transaction : leur solde
  // existait avant la mise en place de loyalty_transactions. Le solde stocké
  // reste inchangé ; on crée seulement l'écriture d'ouverture correspondante.
  const [legacyAccounts] = await db.pool.execute(`
    SELECT la.user_id, la.points_balance
    FROM loyalty_accounts la
    LEFT JOIN loyalty_transactions lt ON lt.user_id = la.user_id
    GROUP BY la.user_id, la.points_balance
    HAVING COUNT(lt.id) = 0 AND la.points_balance <> 0
    ORDER BY la.user_id`);

  if (!legacyAccounts.length) {
    console.log("✅ Aucun solde historique Tiop+ à reprendre");
  } else {
    const connection = await db.pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const account of legacyAccounts) {
        const [locked] = await connection.execute(`
          SELECT la.user_id, la.points_balance
          FROM loyalty_accounts la
          WHERE la.user_id = ?
          FOR UPDATE`, [account.user_id]);

        if (!locked.length) continue;

        const [countRows] = await connection.execute(`
          SELECT COUNT(*) AS transaction_count
          FROM loyalty_transactions
          WHERE user_id = ?`, [account.user_id]);

        // Idempotence/concurrence : une autre exécution a peut-être déjà créé
        // l'écriture entre la détection initiale et le verrouillage du compte.
        if (Number(countRows[0].transaction_count) !== 0) continue;

        const openingBalance = Number(locked[0].points_balance || 0);
        if (openingBalance === 0) continue;

        await connection.execute(`
          INSERT INTO loyalty_transactions
            (user_id, order_id, reward_id, transaction_type, points, description, created_at)
          VALUES (?, NULL, NULL, 'ADJUSTMENT', ?, 'LEGACY_OPENING_BALANCE_16_9', NOW())`,
          [account.user_id, openingBalance]);

        console.log(`✅ Solde historique repris — user #${account.user_id}: ${openingBalance} point(s)`);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  console.log("------------------------------------------------------------");
  console.log("✅ Durcissement 16.9 terminé.");
  console.log("   Lancez : node scripts/audit-loyalty-16-9.js");
}

main()
  .catch(error => {
    console.error("❌ ERREUR DURCISSEMENT 16.9 :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.pool.end();
  });
