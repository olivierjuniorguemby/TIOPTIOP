const crypto = require('crypto');
const db = require('../config/database');
function createCardNumber(){return `TT-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;}
async function createGuestCard({firstName='',lastName='',displayName='',phone=null,email=null,points=0,expiresAt=null,cardType='VIP',adminUserId=null}){
 const publicId=crypto.randomUUID(),cardNumber=createCardNumber(),initialPoints=Math.max(0,Math.trunc(Number(points)||0));
 const result=await db.query(`INSERT INTO loyalty_cards (public_id,card_number,user_id,first_name,last_name,display_name,phone,email,card_type,points_balance,issued_points,expires_at,status,created_by_admin_user_id) VALUES (?,?,NULL,?,?,?,?,?,?,?,?,?,'ACTIVE',?)`,[publicId,cardNumber,firstName||null,lastName||null,displayName||null,phone||null,email||null,cardType,initialPoints,initialPoints,expiresAt||null,adminUserId||null]);
 if(initialPoints>0)await db.query(`INSERT INTO loyalty_card_transactions(card_id,transaction_type,points,description,created_by_admin_user_id) VALUES (?,'ADJUSTMENT',?,'Solde initial de la carte Tiop+.',?)`,[result.insertId,initialPoints,adminUserId||null]);
 return findById(result.insertId);
}
async function findById(id){const rows=await db.query(`SELECT * FROM loyalty_cards WHERE id=? LIMIT 1`,[Number(id)]);return rows[0]||null;}
async function findByPublicId(publicId){const rows=await db.query(`SELECT * FROM loyalty_cards WHERE public_id=? LIMIT 1`,[String(publicId||'')]);return rows[0]||null;}
async function findByCardNumber(cardNumber){const rows=await db.query(`SELECT * FROM loyalty_cards WHERE card_number=? LIMIT 1`,[String(cardNumber||'').trim().toUpperCase()]);return rows[0]||null;}
async function listAll(){return db.query(`SELECT * FROM loyalty_cards ORDER BY created_at DESC,id DESC`);}
async function listTransactions(cardId){return db.query(`SELECT * FROM loyalty_card_transactions WHERE card_id=? ORDER BY created_at DESC,id DESC LIMIT 100`,[Number(cardId)]);}
async function updateCard(id,d){await db.query(`UPDATE loyalty_cards SET first_name=?,last_name=?,display_name=?,phone=?,email=?,card_type=?,expires_at=?,status=? WHERE id=?`,[d.firstName||null,d.lastName||null,d.displayName||null,d.phone||null,d.email||null,d.cardType||'VIP',d.expiresAt||null,d.status||'ACTIVE',Number(id)]);return findById(id);}
async function adjustPoints(id,delta,description,adminUserId){delta=Math.trunc(Number(delta)||0);if(!delta)return findById(id);const c=await db.pool.getConnection();try{await c.beginTransaction();const [rows]=await c.execute(`SELECT * FROM loyalty_cards WHERE id=? FOR UPDATE`,[Number(id)]);if(!rows[0])throw new Error('Carte introuvable.');await c.execute(`UPDATE loyalty_cards SET points_balance=points_balance+? WHERE id=?`,[delta,Number(id)]);await c.execute(`INSERT INTO loyalty_card_transactions(card_id,transaction_type,points,description,created_by_admin_user_id) VALUES (?,'ADJUSTMENT',?,?,?)`,[Number(id),delta,String(description||'Ajustement administratif.').slice(0,255),adminUserId||null]);await c.commit();return findById(id);}catch(e){await c.rollback();throw e}finally{c.release();}}
async function searchForPos(term, limit=10) {
  const q=String(term||'').trim();
  if(q.length<2) return [];
  const like=`%${q}%`;
  const max=Math.min(20,Math.max(1,Number(limit)||10));
  return db.query(`SELECT * FROM loyalty_cards
    WHERE card_number LIKE ? OR display_name LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ?
    ORDER BY updated_at DESC, id DESC LIMIT ${max}`,[like,like,like,like,like,like]);
}

async function awardPaidOrder(paymentId) {
 const id=Number(paymentId);
 if(!Number.isInteger(id)||id<=0)return {credited:false,reason:'INVALID_PAYMENT'};
 const c=await db.pool.getConnection();
 try{
  await c.beginTransaction();
  const [rows]=await c.execute(`
   SELECT p.id AS payment_id,p.order_id,p.amount,p.status,o.reference,
          l.card_id,lc.status AS card_status,lc.expires_at
   FROM payments p
   INNER JOIN orders o ON o.id=p.order_id
   INNER JOIN loyalty_card_order_links l ON l.order_id=o.id
   INNER JOIN loyalty_cards lc ON lc.id=l.card_id
   WHERE p.id=? LIMIT 1 FOR UPDATE`,[id]);
  const x=rows[0]||null;
  if(!x){await c.rollback();return {credited:false,reason:'NO_PHYSICAL_CARD'};}
  if(String(x.status||'')!=='PAID'){await c.rollback();return {credited:false,reason:'PAYMENT_NOT_PAID'};}
  if(String(x.card_status||'ACTIVE').toUpperCase()!=='ACTIVE'||(x.expires_at&&new Date(x.expires_at)<=new Date())){
   await c.rollback();return {credited:false,reason:'CARD_NOT_ACTIVE'};
  }
  const [existing]=await c.execute(`SELECT id,points FROM loyalty_card_transactions WHERE card_id=? AND order_id=? AND transaction_type='EARN' LIMIT 1`,[x.card_id,x.order_id]);
  if(existing[0]){await c.commit();return {credited:false,duplicate:true,reason:'ALREADY_CREDITED',points:Number(existing[0].points||0),cardId:Number(x.card_id)};}
  const [settings]=await c.execute(`SELECT setting_value FROM system_settings WHERE setting_key='loyalty.config' LIMIT 1`);
  let cfg=settings[0]?.setting_value||{};
  if(typeof cfg==='string'){try{cfg=JSON.parse(cfg)}catch{cfg={}}}
  if(cfg.enabled===0||cfg.enabled===false){await c.rollback();return {credited:false,reason:'LOYALTY_DISABLED'};}
  const rate=Math.max(0,Number(cfg.points_per_1000_xaf||10));
  const amount=Math.max(0,Number(x.amount||0));
  const points=Math.floor(amount/1000)*rate;
  if(!Number.isFinite(points)||points<=0){await c.rollback();return {credited:false,reason:'NO_ELIGIBLE_POINTS'};}
  await c.execute(`UPDATE loyalty_cards SET points_balance=points_balance+?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[points,x.card_id]);
  await c.execute(`INSERT INTO loyalty_card_transactions (card_id,order_id,transaction_type,points,description,created_by_admin_user_id) VALUES (?,?,'EARN',?,?,NULL)`,
   [x.card_id,x.order_id,points,`Points Tiop+ gagnés après paiement de la commande ${x.reference}.`]);
  await c.commit();
  return {credited:true,points,cardId:Number(x.card_id),orderId:Number(x.order_id)};
 }catch(e){try{await c.rollback()}catch(_){}throw e}finally{c.release()}
}


async function listEligibleRewardsForPos(publicId) {
 const rows=await db.query(`
  SELECT lc.id AS card_id,lc.points_balance,lc.status,lc.expires_at,
         r.id,r.name,r.description,r.image_url,r.points_cost,r.reward_type,r.reward_value,
         r.reward_product_id,p.name AS reward_product_name,p.is_active AS reward_product_active
  FROM loyalty_cards lc
  CROSS JOIN loyalty_rewards r
  LEFT JOIN products p ON p.id=r.reward_product_id
  WHERE lc.public_id=? AND lc.status='ACTIVE' AND (lc.expires_at IS NULL OR lc.expires_at>NOW())
    AND r.is_active=1
  ORDER BY r.points_cost ASC,r.id ASC`,[String(publicId||'')]);
 return rows.map(x=>({...x,eligible:Number(x.points_balance||0)>=Number(x.points_cost||0)}));
}
async function lockRewardForOrder(connection, cardPublicId, rewardId) {
 const [cards]=await connection.execute(`SELECT * FROM loyalty_cards WHERE public_id=? LIMIT 1 FOR UPDATE`,[String(cardPublicId||'')]);
 const card=cards[0]||null;
 if(!card)throw Object.assign(new Error('Carte Tiop+ physique introuvable.'),{code:'POS_LOYALTY_CARD_NOT_FOUND'});
 if(String(card.status||'').toUpperCase()!=='ACTIVE'||(card.expires_at&&new Date(card.expires_at)<=new Date()))
  throw Object.assign(new Error('Cette carte Tiop+ n’est pas utilisable.'),{code:'POS_LOYALTY_CARD_NOT_ACTIVE'});
 const [rewards]=await connection.execute(`
  SELECT r.*,p.name AS reward_product_name,p.is_active AS reward_product_active
  FROM loyalty_rewards r LEFT JOIN products p ON p.id=r.reward_product_id
  WHERE r.id=? LIMIT 1 FOR UPDATE`,[Number(rewardId)]);
 const reward=rewards[0]||null;
 if(!reward||Number(reward.is_active)!==1)throw Object.assign(new Error('Récompense Tiop+ indisponible.'),{code:'POS_LOYALTY_REWARD_UNAVAILABLE'});
 const cost=Number(reward.points_cost||0);
 if(cost<=0||Number(card.points_balance||0)<cost)throw Object.assign(new Error(`Solde insuffisant : ${Number(card.points_balance||0)} pts disponibles, ${cost} pts requis.`),{code:'POS_LOYALTY_POINTS_INSUFFICIENT'});
 return {card,reward,cost};
}
async function reserveRewardInTransaction(connection,{card,reward,cost,orderId,adminUserId=null}) {
 const crypto=require('crypto'); const publicId=crypto.randomUUID();
 const [u]=await connection.execute(`UPDATE loyalty_cards SET points_balance=points_balance-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND points_balance>=?`,[cost,card.id,cost]);
 if(u.affectedRows!==1)throw Object.assign(new Error('Solde Tiop+ insuffisant.'),{code:'POS_LOYALTY_POINTS_INSUFFICIENT'});
 await connection.execute(`
  INSERT INTO loyalty_card_redemptions(public_id,card_id,reward_id,order_id,points_cost,reward_type,reward_value,status)
  VALUES (?,?,?,?,?,?,?,'RESERVED')`,
  [publicId,card.id,reward.id,orderId,cost,reward.reward_type,reward.reward_value]);
 await connection.execute(`
  INSERT INTO loyalty_card_transactions(card_id,order_id,transaction_type,points,description,created_by_admin_user_id)
  VALUES (?,?,'SPEND',?,?,?)`,
  [card.id,orderId,-cost,`Récompense Tiop+ réservée : ${reward.name}.`,adminUserId||null]);
 return {publicId,pointsCost:cost,rewardType:reward.reward_type,rewardName:reward.name};
}
async function finalizeOrderRedemption(orderId) {
 const c=await db.pool.getConnection(); try{await c.beginTransaction();
  const [r]=await c.execute(`SELECT id,status FROM loyalty_card_redemptions WHERE order_id=? LIMIT 1 FOR UPDATE`,[Number(orderId)]);
  const x=r[0]; if(!x){await c.commit();return {finalized:false,reason:'NO_CARD_REDEMPTION'};}
  if(x.status==='USED'){await c.commit();return {finalized:true,duplicate:true};}
  if(x.status!=='RESERVED'){await c.commit();return {finalized:false,reason:'NOT_RESERVED',status:x.status};}
  await c.execute(`UPDATE loyalty_card_redemptions SET status='USED',used_at=NOW() WHERE id=?`,[x.id]);
  await c.commit(); return {finalized:true,redemptionId:x.id};
 }catch(e){try{await c.rollback()}catch(_){}throw e}finally{c.release()}
}
async function restoreOrderRedemption(orderId, reason='ORDER_CANCELLED') {
 const c=await db.pool.getConnection(); try{await c.beginTransaction();
  const [r]=await c.execute(`SELECT * FROM loyalty_card_redemptions WHERE order_id=? LIMIT 1 FOR UPDATE`,[Number(orderId)]);
  const x=r[0]; if(!x){await c.commit();return {restored:false,reason:'NO_CARD_REDEMPTION'};}
  if(x.status==='RESTORED'){await c.commit();return {restored:true,duplicate:true,points:Number(x.points_cost)};}
  if(!['RESERVED','USED'].includes(x.status)){await c.commit();return {restored:false,reason:'INVALID_STATUS'};}
  await c.execute(`UPDATE loyalty_cards SET points_balance=points_balance+?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[x.points_cost,x.card_id]);
  await c.execute(`UPDATE loyalty_card_redemptions SET status='RESTORED',restored_at=NOW() WHERE id=?`,[x.id]);
  await c.execute(`INSERT INTO loyalty_card_transactions(card_id,order_id,transaction_type,points,description,created_by_admin_user_id) VALUES (?,?,'REVERSAL',?,?,NULL)`,
   [x.card_id,x.order_id,x.points_cost,`Restitution récompense Tiop+ : ${reason}.`]);
  await c.commit(); return {restored:true,points:Number(x.points_cost),cardId:Number(x.card_id)};
 }catch(e){try{await c.rollback()}catch(_){}throw e}finally{c.release()}
}

module.exports={createGuestCard,findById,findByPublicId,findByCardNumber,listAll,listTransactions,updateCard,adjustPoints,searchForPos,awardPaidOrder,listEligibleRewardsForPos,lockRewardForOrder,reserveRewardInTransaction,finalizeOrderRedemption,restoreOrderRedemption};
