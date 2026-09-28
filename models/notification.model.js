const db = require('../config/database');

function recipientWhere(scope, userId) {
  return scope === 'ADMIN' ? { sql: 'user_id IS NULL', params: [] } : { sql: 'user_id = ?', params: [Number(userId)] };
}

exports.summary = async (scope, userId) => {
  const w = recipientWhere(scope, userId);
  const rows = await db.query(`SELECT COUNT(*) total, SUM(read_at IS NULL) unread, SUM(read_at IS NOT NULL) read_count, SUM(DATE(created_at)=CURDATE()) today FROM notifications WHERE ${w.sql} AND channel='IN_APP'`, w.params);
  const r = rows[0] || {};
  return { total:Number(r.total||0), unread:Number(r.unread||0), read:Number(r.read_count||0), today:Number(r.today||0) };
};

exports.recent = async (scope, userId, limit=6) => {
  const w = recipientWhere(scope, userId);
  const safeLimit = Math.max(1, Math.min(20, Number(limit)||6));
  return db.query(`SELECT id, notification_type, title, body, payload, read_at, sent_at, created_at FROM notifications WHERE ${w.sql} AND channel='IN_APP' ORDER BY created_at DESC, id DESC LIMIT ${safeLimit}`, w.params);
};

exports.markRead = async (scope, userId, id) => {
  const w = recipientWhere(scope, userId);
  const result = await db.query(`UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=? AND ${w.sql} AND channel='IN_APP'`, [Number(id), ...w.params]);
  return Number(result.affectedRows||0) > 0;
};

exports.markAllRead = async (scope, userId) => {
  const w = recipientWhere(scope, userId);
  const result = await db.query(`UPDATE notifications SET read_at=NOW() WHERE ${w.sql} AND channel='IN_APP' AND read_at IS NULL`, w.params);
  return Number(result.affectedRows||0);
};

exports.create = async ({userId=null, type, title, body, payload=null}) => {
  const result = await db.query(`INSERT INTO notifications (user_id,channel,notification_type,title,body,payload,sent_at) VALUES (?,'IN_APP',?,?,?,?,NOW())`, [userId ? Number(userId) : null, String(type||'SYSTEM').slice(0,60), String(title||'Notification').slice(0,180), String(body||''), payload ? JSON.stringify(payload) : null]);
  return Number(result.insertId);
};

exports.listForUser = async (userId, { filter='ALL', search='', limit=100 } = {}) => {
  const params = [Number(userId)];
  const clauses = ["user_id = ?", "channel='IN_APP'"];
  const f = String(filter || 'ALL').toUpperCase();
  if (f === 'UNREAD') clauses.push('read_at IS NULL');
  else if (f !== 'ALL') {
    const map = {
      ORDERS: ['ORDER','COMMANDE','DELIVERY','LIVRAISON'],
      PAYMENTS: ['PAYMENT','PAY','REFUND','REMBOURSEMENT'],
      SUPPORT: ['SUPPORT','TICKET'],
      LOYALTY: ['LOYALTY','TIOP'],
      PROMOTIONS: ['PROMO','PROMOTION']
    };
    const words = map[f] || [];
    if (words.length) {
      clauses.push('(' + words.map(()=> 'UPPER(notification_type) LIKE ?').join(' OR ') + ')');
      params.push(...words.map(x=>`%${x}%`));
    }
  }
  const q = String(search || '').trim();
  if (q) {
    clauses.push('(title LIKE ? OR body LIKE ? OR notification_type LIKE ?)');
    params.push(`%${q}%`,`%${q}%`,`%${q}%`);
  }
  const safeLimit=Math.max(1,Math.min(250,Number(limit)||100));
  return db.query(`SELECT id,notification_type,title,body,payload,read_at,sent_at,created_at FROM notifications WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC,id DESC LIMIT ${safeLimit}`,params);
};

exports.markUnread = async (userId,id) => {
  const result=await db.query("UPDATE notifications SET read_at=NULL WHERE id=? AND user_id=? AND channel='IN_APP'",[Number(id),Number(userId)]);
  return Number(result.affectedRows||0)>0;
};


exports.listForAdmin = async ({ filter='ALL', search='', limit=200 } = {}) => {
  const params = [];
  const clauses = ["user_id IS NULL", "channel='IN_APP'"];
  const f = String(filter || 'ALL').toUpperCase();
  const map = {
    ORDERS: ['ORDER','COMMANDE','DELIVERY','LIVRAISON'],
    PAYMENTS: ['PAYMENT','PAY','REFUND','REMBOURSEMENT'],
    SUPPORT: ['SUPPORT','TICKET'],
    STOCKS: ['STOCK','INVENTORY'],
    APPLICATIONS: ['APPLICATION','CANDIDATURE','JOB']
  };
  if (f === 'UNREAD') clauses.push('read_at IS NULL');
  else if (f !== 'ALL' && map[f]) {
    clauses.push('(' + map[f].map(()=> 'UPPER(notification_type) LIKE ?').join(' OR ') + ')');
    params.push(...map[f].map(x=>`%${x}%`));
  }
  const q=String(search||'').trim();
  if(q){ clauses.push('(title LIKE ? OR body LIKE ? OR notification_type LIKE ?)'); params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  const safeLimit=Math.max(1,Math.min(500,Number(limit)||200));
  return db.query(`SELECT id,notification_type,title,body,payload,read_at,sent_at,created_at FROM notifications WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC,id DESC LIMIT ${safeLimit}`,params);
};

exports.markAdminUnread = async id => {
  const result=await db.query("UPDATE notifications SET read_at=NULL WHERE id=? AND user_id IS NULL AND channel='IN_APP'",[Number(id)]);
  return Number(result.affectedRows||0)>0;
};
