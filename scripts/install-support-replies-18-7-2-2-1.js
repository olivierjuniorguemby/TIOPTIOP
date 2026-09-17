require('dotenv').config();
const db = require('../config/database');

(async () => {
  try {
    const idRows = await db.query(`
      SELECT COLUMN_TYPE, DATA_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'support_messages'
        AND COLUMN_NAME = 'id'
      LIMIT 1
    `);

    if (!idRows.length) {
      throw new Error('support_messages.id introuvable');
    }

    const idType = String(idRows[0].COLUMN_TYPE || '').trim().toLowerCase();
    // COLUMN_TYPE vient du schéma MySQL. On limite néanmoins strictement les types numériques autorisés.
    if (!/^(tinyint|smallint|mediumint|int|integer|bigint)(\(\d+\))?( unsigned)?$/.test(idType)) {
      throw new Error(`Type de support_messages.id non pris en charge: ${idType}`);
    }

    console.log(`INFO - type réel support_messages.id : ${idType}`);

    const replyRows = await db.query(`
      SELECT COLUMN_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'support_messages'
        AND COLUMN_NAME = 'reply_to_message_id'
      LIMIT 1
    `);

    if (!replyRows.length) {
      await db.query(`ALTER TABLE support_messages ADD COLUMN reply_to_message_id ${idType} NULL AFTER message`);
      console.log(`OK - reply_to_message_id créée en ${idType}`);
    } else {
      const replyType = String(replyRows[0].COLUMN_TYPE || '').trim().toLowerCase();
      if (replyType !== idType) {
        await db.query(`ALTER TABLE support_messages MODIFY COLUMN reply_to_message_id ${idType} NULL`);
        console.log(`OK - reply_to_message_id alignée : ${replyType} -> ${idType}`);
      } else {
        console.log(`OK - reply_to_message_id déjà alignée (${idType})`);
      }
    }

    // Nettoyage défensif : aucune valeur orpheline ne doit empêcher la création de la FK.
    const orphanRows = await db.query(`
      SELECT COUNT(*) AS total
      FROM support_messages child
      LEFT JOIN support_messages parent ON parent.id = child.reply_to_message_id
      WHERE child.reply_to_message_id IS NOT NULL
        AND parent.id IS NULL
    `);
    const orphanCount = Number(orphanRows[0] && orphanRows[0].total || 0);
    if (orphanCount > 0) {
      await db.query(`
        UPDATE support_messages child
        LEFT JOIN support_messages parent ON parent.id = child.reply_to_message_id
        SET child.reply_to_message_id = NULL
        WHERE child.reply_to_message_id IS NOT NULL
          AND parent.id IS NULL
      `);
      console.log(`OK - ${orphanCount} référence(s) orpheline(s) remise(s) à NULL`);
    }

    const indexRows = await db.query(`
      SELECT INDEX_NAME
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'support_messages'
        AND COLUMN_NAME = 'reply_to_message_id'
      LIMIT 1
    `);
    if (!indexRows.length) {
      await db.query('ALTER TABLE support_messages ADD INDEX idx_support_messages_reply_to (reply_to_message_id)');
      console.log('OK - index reply_to_message_id ajouté');
    } else {
      console.log(`OK - index reply_to_message_id existe déjà (${indexRows[0].INDEX_NAME})`);
    }

    const fkRows = await db.query(`
      SELECT CONSTRAINT_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'support_messages'
        AND COLUMN_NAME = 'reply_to_message_id'
        AND REFERENCED_TABLE_NAME = 'support_messages'
        AND REFERENCED_COLUMN_NAME = 'id'
      LIMIT 1
    `);

    if (!fkRows.length) {
      await db.query(`
        ALTER TABLE support_messages
        ADD CONSTRAINT fk_support_messages_reply
        FOREIGN KEY (reply_to_message_id)
        REFERENCES support_messages(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
      `);
      console.log('OK - FK auto-référencée ajoutée');
    } else {
      console.log(`OK - FK auto-référencée existe déjà (${fkRows[0].CONSTRAINT_NAME})`);
    }

    console.log('OK - Support 18.7.2.2.1 prêt');
    process.exit(0);
  } catch (e) {
    console.error('ERREUR 18.7.2.2.1:', e);
    process.exit(1);
  }
})();
