const db = require('../config/database');

const STATUS = ['NEW','IN_PROGRESS','WAITING_CUSTOMER','RESOLVED','CLOSED'];
const CATEGORY = ['ORDER','DELIVERY','PAYMENT','REFUND','TIOP_PLUS','ACCOUNT','RESTAURANT','OTHER'];

function cleanCategory(v){
  const map={commande:'ORDER',livraison:'DELIVERY',paiement:'PAYMENT',remboursement:'REFUND',tiopplus:'TIOP_PLUS',compte:'ACCOUNT',restaurant:'RESTAURANT',autre:'OTHER'};
  const c=map[String(v||'').toLowerCase()] || String(v||'').toUpperCase();
  return CATEGORY.includes(c)?c:'OTHER';
}

exports.cleanCategory=cleanCategory;
exports.statuses=STATUS;

exports.findOrderForUser=async(reference,userId)=>{
  if(!reference) return null;
  return (await db.query('SELECT id,reference FROM orders WHERE reference=? AND user_id=? LIMIT 1',[String(reference).trim(),userId]))[0]||null;
};

exports.createTicket=async({userId,orderId,subject,category,message,attachmentUrl=null})=>{
  const connection=await db.pool.getConnection();
  try{
    await connection.beginTransaction();
    const [r]=await connection.execute(`INSERT INTO support_tickets(reference,user_id,order_id,subject,category,priority,status) VALUES('',?,?,?,?, 'NORMAL','NEW')`,[userId,orderId||null,String(subject).slice(0,180),cleanCategory(category)]);
    const id=Number(r.insertId);
    const reference=`SUP-${String(1000+id)}`;
    await connection.execute('UPDATE support_tickets SET reference=? WHERE id=?',[reference,id]);
    await connection.execute(`INSERT INTO support_messages(ticket_id,sender_type,sender_user_id,message,attachment_url) VALUES(?,'CUSTOMER',?,?,?)`,[id,userId,String(message).trim(),attachmentUrl||null]);
    await connection.commit();
    return {id,reference};
  }catch(e){await connection.rollback();throw e;}finally{connection.release();}
};

exports.listAdmin=async()=>db.query(`
 SELECT t.*,u.email AS customer_email,COALESCE(NULLIF(up.display_name,''),NULLIF(CONCAT_WS(' ',up.first_name,up.last_name),''),u.email,CONCAT('Client #',u.id)) AS customer_name,
 o.reference AS order_reference,a.name AS assigned_admin_name,
 (SELECT message FROM support_messages sm WHERE sm.ticket_id=t.id ORDER BY sm.created_at ASC,sm.id ASC LIMIT 1) AS first_message
 FROM support_tickets t
 LEFT JOIN users u ON u.id=t.user_id LEFT JOIN user_profiles up ON up.user_id=u.id
 LEFT JOIN orders o ON o.id=t.order_id LEFT JOIN admin_users a ON a.id=t.assigned_admin_user_id
 ORDER BY FIELD(t.status,'NEW','IN_PROGRESS','WAITING_CUSTOMER','RESOLVED','CLOSED'),t.updated_at DESC,t.id DESC`);

exports.stats=async()=> (await db.query(`SELECT COUNT(*) total,SUM(status='NEW') new_count,SUM(status='IN_PROGRESS') in_progress_count,SUM(status='WAITING_CUSTOMER') waiting_count,SUM(status='RESOLVED') resolved_count,SUM(status='CLOSED') closed_count FROM support_tickets`))[0];
exports.messages=async(ticketId)=>db.query(`SELECT sm.*,COALESCE(a.name,COALESCE(NULLIF(up.display_name,''),CONCAT_WS(' ',up.first_name,up.last_name),u.email)) sender_name FROM support_messages sm LEFT JOIN admin_users a ON a.id=sm.sender_admin_user_id LEFT JOIN users u ON u.id=sm.sender_user_id LEFT JOIN user_profiles up ON up.user_id=u.id WHERE sm.ticket_id=? ORDER BY sm.created_at,sm.id`,[ticketId]);
exports.findById=async id=>(await db.query('SELECT * FROM support_tickets WHERE id=? LIMIT 1',[id]))[0]||null;
exports.replyAdmin=async({ticketId,adminId,status,message,attachmentUrl=null})=>{
  if(!STATUS.includes(status)) throw new Error('Statut support invalide.');
  const connection=await db.pool.getConnection();
  try{
    await connection.beginTransaction();
    const [rows]=await connection.execute('SELECT id FROM support_tickets WHERE id=? FOR UPDATE',[ticketId]);
    if(!rows.length){const e=new Error('Ticket introuvable.');e.statusCode=404;throw e;}
    await connection.execute('UPDATE support_tickets SET status=?,assigned_admin_user_id=COALESCE(assigned_admin_user_id,?) WHERE id=?',[status,adminId||null,ticketId]);
    const text=String(message||'').trim();
    if(text || attachmentUrl) await connection.execute(`INSERT INTO support_messages(ticket_id,sender_type,sender_admin_user_id,message,attachment_url) VALUES(?,'ADMIN',?,?,?)`,[ticketId,adminId||null,text,attachmentUrl||null]);
    await connection.commit();
  }catch(e){await connection.rollback();throw e;}finally{connection.release();}
};

exports.listForUser=async userId=>db.query(`
 SELECT t.*,o.reference AS order_reference,
 (SELECT message FROM support_messages sm WHERE sm.ticket_id=t.id ORDER BY sm.created_at ASC,sm.id ASC LIMIT 1) AS first_message,
 (SELECT created_at FROM support_messages sm WHERE sm.ticket_id=t.id ORDER BY sm.created_at DESC,sm.id DESC LIMIT 1) AS last_message_at,
 (SELECT sender_type FROM support_messages sm WHERE sm.ticket_id=t.id ORDER BY sm.created_at DESC,sm.id DESC LIMIT 1) AS last_sender_type
 FROM support_tickets t LEFT JOIN orders o ON o.id=t.order_id
 WHERE t.user_id=? ORDER BY t.updated_at DESC,t.id DESC`,[userId]);

exports.findForUser=async(id,userId)=>(await db.query(`
 SELECT t.*,o.reference AS order_reference
 FROM support_tickets t LEFT JOIN orders o ON o.id=t.order_id
 WHERE t.id=? AND t.user_id=? LIMIT 1`,[id,userId]))[0]||null;

exports.replyCustomer=async({ticketId,userId,message,attachmentUrl=null})=>{
 const text=String(message||'').trim();
 if(!text && !attachmentUrl){const e=new Error('Votre message est vide.');e.statusCode=400;throw e;}
 const connection=await db.pool.getConnection();
 try{
  await connection.beginTransaction();
  const [rows]=await connection.execute('SELECT id,status FROM support_tickets WHERE id=? AND user_id=? FOR UPDATE',[ticketId,userId]);
  if(!rows.length){const e=new Error('Ticket introuvable.');e.statusCode=404;throw e;}
  if(rows[0].status==='CLOSED'){const e=new Error('Ce ticket est fermé.');e.statusCode=400;throw e;}
  await connection.execute(`INSERT INTO support_messages(ticket_id,sender_type,sender_user_id,message,attachment_url) VALUES(?,'CUSTOMER',?,?,?)`,[ticketId,userId,text,attachmentUrl||null]);
  await connection.execute(`UPDATE support_tickets SET status=CASE WHEN status IN ('RESOLVED','WAITING_CUSTOMER') THEN 'IN_PROGRESS' ELSE status END WHERE id=?`,[ticketId]);
  await connection.commit();
 }catch(e){await connection.rollback();throw e;}finally{connection.release();}
};
