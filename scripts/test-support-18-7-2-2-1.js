require('dotenv').config();
const db = require('../config/database');

(async () => {
  let pass = 0, fail = 0;
  const check = (ok, label, detail='') => {
    if (ok) { pass++; console.log(`PASS - ${label}`); }
    else { fail++; console.log(`FAIL - ${label}${detail ? ' : ' + detail : ''}`); }
  };
  try {
    const cols = await db.query(`SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='support_messages' AND COLUMN_NAME IN ('id','reply_to_message_id')`);
    const id = cols.find(x=>x.COLUMN_NAME==='id');
    const reply = cols.find(x=>x.COLUMN_NAME==='reply_to_message_id');
    check(!!id, 'support_messages.id existe');
    check(!!reply, 'reply_to_message_id existe');
    check(!!id && !!reply && String(id.COLUMN_TYPE).toLowerCase()===String(reply.COLUMN_TYPE).toLowerCase(), 'types id/reply_to_message_id identiques', `${id&&id.COLUMN_TYPE} / ${reply&&reply.COLUMN_TYPE}`);
    check(!!reply && reply.IS_NULLABLE==='YES', 'reply_to_message_id nullable');

    const idx = await db.query(`SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='support_messages' AND COLUMN_NAME='reply_to_message_id'`);
    check(idx.length>0, 'index reply_to_message_id présent');

    const fk = await db.query(`SELECT CONSTRAINT_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='support_messages' AND COLUMN_NAME='reply_to_message_id' AND REFERENCED_TABLE_NAME='support_messages' AND REFERENCED_COLUMN_NAME='id'`);
    check(fk.length>0, 'FK auto-référencée réellement présente');

    const rules = await db.query(`SELECT DELETE_RULE,UPDATE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='support_messages' AND REFERENCED_TABLE_NAME='support_messages' AND CONSTRAINT_NAME=?`, [fk[0] && fk[0].CONSTRAINT_NAME || '']);
    check(rules.length>0 && rules[0].DELETE_RULE==='SET NULL', 'FK ON DELETE SET NULL');

    const orphan = await db.query(`SELECT COUNT(*) AS total FROM support_messages c LEFT JOIN support_messages p ON p.id=c.reply_to_message_id WHERE c.reply_to_message_id IS NOT NULL AND p.id IS NULL`);
    check(Number(orphan[0].total)===0, 'aucune réponse orpheline');

    const count = await db.query('SELECT COUNT(*) AS total FROM support_messages');
    check(Number(count[0].total)>=0, 'messages existants accessibles');

    console.log(`\nRÉSULTAT 18.7.2.2.1 : PASS=${pass} | FAIL=${fail}`);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.error('ERREUR AUDIT 18.7.2.2.1:', e);
    process.exit(1);
  }
})();
