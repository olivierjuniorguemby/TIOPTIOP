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
async function syncExpiredCards(){
 await db.query(`UPDATE loyalty_cards SET status='EXPIRED',updated_at=CURRENT_TIMESTAMP WHERE status='ACTIVE' AND expires_at IS NOT NULL AND expires_at<=NOW()`);
}
async function listAll(){await syncExpiredCards();return db.query(`SELECT * FROM loyalty_cards ORDER BY created_at DESC,id DESC`);}
async function changeStatus(id,status,reason,adminUserId){
 const allowed=['ACTIVE','SUSPENDED','EXPIRED','REVOKED']; status=String(status||'').toUpperCase();
 if(!allowed.includes(status))throw new Error('Statut de carte invalide.');
 const c=await db.pool.getConnection();try{await c.beginTransaction();
  const [rows]=await c.execute(`SELECT * FROM loyalty_cards WHERE id=? LIMIT 1 FOR UPDATE`,[Number(id)]);const card=rows[0];if(!card)throw new Error('Carte introuvable.');
  const old=String(card.status||'ACTIVE').toUpperCase();
  if(old===status){await c.commit();return findById(id);}
  if(old==='REVOKED'&&status!=='REVOKED')throw new Error('Une carte révoquée ne peut pas être réactivée.');
  if(status==='ACTIVE'&&card.expires_at&&new Date(card.expires_at)<=new Date())throw new Error('Impossible de réactiver une carte expirée : modifiez d’abord sa date d’expiration.');
  await c.execute(`UPDATE loyalty_cards SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[status,Number(id)]);
  await c.execute(`INSERT INTO loyalty_card_lifecycle_events(card_id,event_type,old_status,new_status,reason,created_by_admin_user_id) VALUES (?,?,?,?,?,?)`,[Number(id),'STATUS_CHANGE',old,status,String(reason||'Changement de statut administratif.').slice(0,255),adminUserId||null]);
  await c.commit();return findById(id);
 }catch(e){try{await c.rollback()}catch(_){}throw e}finally{c.release()}
}
async function listLifecycleEvents(cardId){return db.query(`SELECT * FROM loyalty_card_lifecycle_events WHERE card_id=? ORDER BY created_at DESC,id DESC LIMIT 100`,[Number(cardId)]);}
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


// 16.10.7 — annule une seule fois les points EARN d'une carte physique
// lors d'un remboursement TOTAL. Le solde peut devenir négatif si le client
// a déjà dépensé les points gagnés : cela matérialise une dette fidélité,
// comme pour le portefeuille Tiop+ numérique.
async function reverseFullyRefundedOrderEarn(orderId, reason='FULL_REFUND') {
 const id=Number(orderId);
 if(!Number.isInteger(id)||id<=0)return {reversed:false,reason:'INVALID_ORDER'};
 const c=await db.pool.getConnection();
 try{
  await c.beginTransaction();
  const [earns]=await c.execute(`
   SELECT id,card_id,points FROM loyalty_card_transactions
   WHERE order_id=? AND transaction_type='EARN' AND points>0
   ORDER BY id ASC FOR UPDATE`,[id]);
  if(!earns.length){await c.commit();return {reversed:false,reason:'NO_PHYSICAL_EARN'};}

  let reversedPoints=0;
  let reversedCount=0;
  for(const earn of earns){
   const marker=`ANNULATION_EARN_REFUND:${earn.id}`;
   const [existing]=await c.execute(`
    SELECT id FROM loyalty_card_transactions
    WHERE card_id=? AND order_id=? AND transaction_type='REVERSAL'
      AND description LIKE ? LIMIT 1 FOR UPDATE`,
    [earn.card_id,id,`%${marker}%`]);
   if(existing[0])continue;

   const pts=Math.max(0,Number(earn.points||0));
   if(pts<=0)continue;
   await c.execute(`UPDATE loyalty_cards
                    SET points_balance=points_balance-?,updated_at=CURRENT_TIMESTAMP
                    WHERE id=?`,[pts,earn.card_id]);
   await c.execute(`INSERT INTO loyalty_card_transactions
    (card_id,order_id,transaction_type,points,description,created_by_admin_user_id)
    VALUES (?,?,'REVERSAL',?,?,NULL)`,
    [earn.card_id,id,-pts,`Annulation des points gagnés après remboursement total (${reason}). ${marker}`]);
   reversedPoints+=pts;
   reversedCount++;
  }
  await c.commit();
  if(!reversedCount)return {reversed:true,duplicate:true,points:0};
  return {reversed:true,points:reversedPoints,count:reversedCount};
 }catch(e){try{await c.rollback()}catch(_){}throw e}finally{c.release()}
}


// 16.10.6.2 — remplacement sécurisé d'une carte Tiop+
async function replaceCard(id,{reason='',adminUserId=null}={}){
 const cardId=Number(id);
 if(!Number.isInteger(cardId)||cardId<=0)throw new Error('Carte Tiop+ invalide.');
 const c=await db.pool.getConnection();
 try{
  await c.beginTransaction();
  const [rows]=await c.execute(`SELECT * FROM loyalty_cards WHERE id=? LIMIT 1 FOR UPDATE`,[cardId]);
  const oldCard=rows[0]||null;
  if(!oldCard)throw new Error('Carte Tiop+ introuvable.');
  const oldStatus=String(oldCard.status||'ACTIVE').toUpperCase();
  if(oldStatus==='REVOKED')throw new Error('Une carte déjà révoquée ne peut pas être remplacée.');
  const [already]=await c.execute(`SELECT id,new_card_id FROM loyalty_card_replacements WHERE old_card_id=? LIMIT 1 FOR UPDATE`,[cardId]);
  if(already[0])throw new Error('Cette carte a déjà été remplacée.');

  const publicId=crypto.randomUUID();
  const cardNumber=createCardNumber();
  const balance=Math.trunc(Number(oldCard.points_balance)||0);
  const cleanReason=String(reason||'Remplacement administratif de la carte.').trim().slice(0,255) || 'Remplacement administratif de la carte.';
  const [created]=await c.execute(`INSERT INTO loyalty_cards
   (public_id,card_number,user_id,first_name,last_name,display_name,phone,email,card_type,points_balance,issued_points,expires_at,status,created_by_admin_user_id)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'ACTIVE',?)`,[
    publicId,cardNumber,oldCard.user_id||null,oldCard.first_name||null,oldCard.last_name||null,oldCard.display_name||null,
    oldCard.phone||null,oldCard.email||null,oldCard.card_type||'VIP',balance,0,oldCard.expires_at||null,adminUserId||null
   ]);
  const newCardId=Number(created.insertId);

  await c.execute(`UPDATE loyalty_cards SET points_balance=0,status='REVOKED',updated_at=CURRENT_TIMESTAMP WHERE id=?`,[cardId]);
  await c.execute(`INSERT INTO loyalty_card_replacements(old_card_id,new_card_id,points_transferred,reason,created_by_admin_user_id) VALUES (?,?,?,?,?)`,
   [cardId,newCardId,balance,cleanReason,adminUserId||null]);

  if(balance!==0){
   await c.execute(`INSERT INTO loyalty_card_transactions(card_id,transaction_type,points,description,created_by_admin_user_id) VALUES (?,'ADJUSTMENT',?,?,?)`,
    [cardId,-balance,`Solde transféré vers la carte de remplacement ${cardNumber}.`,adminUserId||null]);
   await c.execute(`INSERT INTO loyalty_card_transactions(card_id,transaction_type,points,description,created_by_admin_user_id) VALUES (?,'ADJUSTMENT',?,?,?)`,
    [newCardId,balance,`Solde transféré depuis la carte remplacée ${oldCard.card_number}.`,adminUserId||null]);
  }

  await c.execute(`INSERT INTO loyalty_card_lifecycle_events(card_id,event_type,old_status,new_status,reason,created_by_admin_user_id) VALUES (?,?,?,?,?,?)`,
   [cardId,'REPLACED_OUT',oldStatus,'REVOKED',`${cleanReason} Nouvelle carte : ${cardNumber}`.slice(0,255),adminUserId||null]);
  await c.execute(`INSERT INTO loyalty_card_lifecycle_events(card_id,event_type,old_status,new_status,reason,created_by_admin_user_id) VALUES (?,?,?,?,?,?)`,
   [newCardId,'REPLACED_IN',null,'ACTIVE',`${cleanReason} Ancienne carte : ${oldCard.card_number}`.slice(0,255),adminUserId||null]);

  await c.commit();
  return findById(newCardId);
 }catch(e){try{await c.rollback()}catch(_){}throw e}finally{c.release()}
}
async function findReplacementByOldCardId(id){
 const rows=await db.query(`SELECT r.*,o.card_number AS old_card_number,n.card_number AS new_card_number,n.public_id AS new_public_id,n.status AS new_status,n.points_balance AS new_points_balance
 FROM loyalty_card_replacements r INNER JOIN loyalty_cards o ON o.id=r.old_card_id INNER JOIN loyalty_cards n ON n.id=r.new_card_id WHERE r.old_card_id=? LIMIT 1`,[Number(id)]);
 return rows[0]||null;
}


// 16.10.6.3 — rattachement d'une carte physique à un compte client Tiop+
async function searchCustomersForLink(term,limit=12){
 const q=String(term||'').trim();
 if(q.length<2)return [];
 const like=`%${q}%`; const n=Math.min(30,Math.max(1,Number(limit)||12));
 return db.query(`SELECT u.id,u.public_id,u.email,u.phone,u.status,u.account_type,
   up.first_name,up.last_name,up.display_name,
   la.points_balance AS account_points_balance,la.tier,la.subscribed_at,
   lc.id AS linked_card_id,lc.card_number AS linked_card_number,lc.status AS linked_card_status
  FROM users u
  LEFT JOIN user_profiles up ON up.user_id=u.id
  INNER JOIN loyalty_accounts la ON la.user_id=u.id
  LEFT JOIN loyalty_cards lc ON lc.user_id=u.id AND lc.status<>'REVOKED'
  WHERE u.account_type='CUSTOMER' AND u.status='ACTIVE'
    AND (u.email LIKE ? OR u.phone LIKE ? OR up.first_name LIKE ? OR up.last_name LIKE ? OR up.display_name LIKE ?)
  ORDER BY up.display_name IS NULL,up.display_name,u.email LIMIT ${n}`,[like,like,like,like,like]);
}
async function linkToCustomer(cardId,userId,{reason='',adminUserId=null}={}){
 const cid=Number(cardId),uid=Number(userId);
 if(!Number.isInteger(cid)||cid<=0||!Number.isInteger(uid)||uid<=0)throw new Error('Carte ou compte client invalide.');
 const c=await db.pool.getConnection();
 try{
  await c.beginTransaction();
  const [cards]=await c.execute(`SELECT * FROM loyalty_cards WHERE id=? LIMIT 1 FOR UPDATE`,[cid]);
  const card=cards[0]; if(!card)throw new Error('Carte Tiop+ introuvable.');
  if(String(card.status||'').toUpperCase()==='REVOKED')throw new Error('Une carte révoquée ne peut pas être rattachée.');
  if(card.user_id){if(Number(card.user_id)===uid){await c.rollback();return findById(cid)}throw new Error('Cette carte est déjà rattachée à un autre compte client.');}
  const [users]=await c.execute(`SELECT u.id,u.email,u.phone,u.status,u.account_type,up.display_name,up.first_name,up.last_name,la.points_balance AS account_points_balance
    FROM users u LEFT JOIN user_profiles up ON up.user_id=u.id INNER JOIN loyalty_accounts la ON la.user_id=u.id
    WHERE u.id=? LIMIT 1 FOR UPDATE`,[uid]);
  const user=users[0]; if(!user||user.account_type!=='CUSTOMER')throw new Error('Compte client Tiop+ introuvable.');
  if(String(user.status||'').toUpperCase()!=='ACTIVE')throw new Error('Le compte client doit être actif.');
  const [other]=await c.execute(`SELECT id,card_number FROM loyalty_cards WHERE user_id=? AND id<>? AND status<>'REVOKED' LIMIT 1 FOR UPDATE`,[uid,cid]);
  if(other[0])throw new Error(`Ce compte est déjà rattaché à la carte ${other[0].card_number}.`);
  const cleanReason=String(reason||'Rattachement de la carte physique au compte client Tiop+.').trim().slice(0,255)||'Rattachement de la carte physique au compte client Tiop+.';
  await c.execute(`UPDATE loyalty_cards SET user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[uid,cid]);
  await c.execute(`INSERT INTO loyalty_card_account_links(card_id,user_id,card_points_at_link,account_points_at_link,reason,created_by_admin_user_id) VALUES (?,?,?,?,?,?)`,
    [cid,uid,Math.trunc(Number(card.points_balance)||0),Math.trunc(Number(user.account_points_balance)||0),cleanReason,adminUserId||null]);
  await c.execute(`INSERT INTO loyalty_card_lifecycle_events(card_id,event_type,old_status,new_status,reason,created_by_admin_user_id) VALUES (?,?,?,?,?,?)`,
    [cid,'ACCOUNT_LINKED',card.status,card.status,`${cleanReason} Compte #${uid} ${user.email||''}`.slice(0,255),adminUserId||null]);
  await c.commit(); return findById(cid);
 }catch(e){try{await c.rollback()}catch(_){}throw e}finally{c.release()}
}
async function getLinkedCustomer(cardId){
 const rows=await db.query(`SELECT u.id,u.public_id,u.email,u.phone,u.status,up.first_name,up.last_name,up.display_name,la.points_balance AS account_points_balance,la.tier,la.subscribed_at
 FROM loyalty_cards lc INNER JOIN users u ON u.id=lc.user_id LEFT JOIN user_profiles up ON up.user_id=u.id LEFT JOIN loyalty_accounts la ON la.user_id=u.id WHERE lc.id=? LIMIT 1`,[Number(cardId)]);
 return rows[0]||null;
}

module.exports={createGuestCard,findById,findByPublicId,findByCardNumber,listAll,listTransactions,updateCard,adjustPoints,searchForPos,awardPaidOrder,listEligibleRewardsForPos,lockRewardForOrder,reserveRewardInTransaction,finalizeOrderRedemption,restoreOrderRedemption,reverseFullyRefundedOrderEarn,syncExpiredCards,changeStatus,listLifecycleEvents,replaceCard,findReplacementByOldCardId,searchCustomersForLink,linkToCustomer,getLinkedCustomer};
