const Notification = require('../models/notification.model');
async function createAndEmit(io, data, room) {
  const id = await Notification.create(data);
  if (io && room) io.to(room).emit('notification:new', { id });
  return id;
}
exports.client = (io, userId, data) => createAndEmit(io, { ...data, userId }, `notifications:user:${Number(userId)}`);
exports.admin = (io, data) => createAndEmit(io, { ...data, userId:null }, 'notifications:admins');
exports.changedClient = (io,userId)=>io?.to(`notifications:user:${Number(userId)}`).emit('notification:changed');
exports.changedAdmin = io=>io?.to('notifications:admins').emit('notification:changed');


async function supportReaction(io,{scope,userId=null,ticketId,messageId,reference,reactorType,reactorId,emoji,url}){
  const targetScope=scope==='ADMIN'?'ADMIN':'CLIENT';
  const result=await Notification.upsertSupportReaction({scope:targetScope,userId,ticketId,messageId,reactorType,reactorId,emoji,title:'Nouvelle réaction',body:`Une réaction ${emoji} a été ajoutée sur ${reference}.`,payload:{ticketId:Number(ticketId),messageId:Number(messageId),reference,reactorType,reactorId:Number(reactorId),emoji,url}});
  const room=targetScope==='ADMIN'?'notifications:admins':`notifications:user:${Number(userId)}`;
  io?.to(room).emit(result.updated?'notification:changed':'notification:new',{id:result.id});
  return result;
}
exports.supportReactionClient=(io,userId,data)=>supportReaction(io,{...data,scope:'CLIENT',userId});
exports.supportReactionAdmin=(io,data)=>supportReaction(io,{...data,scope:'ADMIN'});


// 19.4.1 — permet aux services provider (Stripe/MTN/réconciliation) d'émettre
// sans dépendre d'un objet req Express.
let runtimeIo = null;
exports.setIo = io => { runtimeIo = io || null; };
exports.getIo = () => runtimeIo;

async function businessEvent({userId=null,type,title,body,payload={},eventKey,admin=false,io=null}){
  const socket = io || runtimeIo;
  const result = await Notification.upsertBusinessEvent({userId:admin?null:userId,type,title,body,payload,eventKey});
  const room = admin ? 'notifications:admins' : `notifications:user:${Number(userId)}`;
  socket?.to(room).emit(result.updated?'notification:changed':'notification:new',{id:result.id});
  return result;
}
exports.businessClient=(userId,data,io=null)=>businessEvent({...data,userId,io});
exports.businessAdmin=(data,io=null)=>businessEvent({...data,admin:true,io});

exports.paymentEvent = async ({paymentId,status,metadata=null}) => {
  const db=require('../config/database');
  const rows=await db.query(`SELECT p.id,p.amount,p.currency,p.method,p.provider,o.id order_id,o.reference order_reference,o.user_id FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.id=? LIMIT 1`,[Number(paymentId)]);
  const p=rows[0]; if(!p) return null;
  const normalized=String(status||'').toUpperCase();
  const payload={paymentId:Number(p.id),orderId:Number(p.order_id),reference:p.order_reference,status:normalized,method:p.method,provider:p.provider,url:`/compte/commandes/${encodeURIComponent(p.order_reference)}`,metadata};
  if(normalized==='PAID'){
    // 19.4.1 — le client est informé de son encaissement.
    // L'admin est également informé uniquement pour les paiements externes
    // confirmés par Stripe ou MTN MoMo. Les espèces/POS locales ne génèrent
    // pas cette alerte afin d'éviter une notification admin redondante.
    let clientNotification=null;
    if(p.user_id){
      clientNotification=await exports.businessClient(Number(p.user_id),{type:'PAYMENT_PAID',title:'Paiement confirmé',body:`Le paiement de la commande ${p.order_reference} a été confirmé.`,payload,eventKey:`payment:${p.id}:paid`});
    }

    const method=String(p.method||'').toUpperCase();
    const provider=String(p.provider||'').toUpperCase();
    const isStripe=method==='CARD' || provider.includes('STRIPE');
    const isMtnMomo=method==='MOBILE_MONEY' || provider.includes('MTN');

    if(isStripe || isMtnMomo){
      const channel=isStripe?'Stripe':'MTN MoMo';
      await exports.businessAdmin({
        type:'PAYMENT_PAID',
        title:'Paiement confirmé',
        body:`Le paiement ${channel} de ${p.order_reference} a été confirmé.`,
        payload:{...payload,channel,url:`/admin/paiements/${p.id}`},
        eventKey:`admin:payment:${p.id}:paid`
      });
    }
    return clientNotification;
  }
  if(normalized==='FAILED'){
    if(p.user_id) await exports.businessClient(Number(p.user_id),{type:'PAYMENT_FAILED',title:'Paiement non abouti',body:`Le paiement de la commande ${p.order_reference} n’a pas abouti.`,payload,eventKey:`payment:${p.id}:failed`});
    return exports.businessAdmin({type:'PAYMENT_FAILED',title:'Paiement en échec',body:`Le paiement de ${p.order_reference} nécessite une vérification.`,payload:{...payload,url:`/admin/paiements/${p.id}`},eventKey:`admin:payment:${p.id}:failed`});
  }
  return null;
};

exports.loyaltyPointsEarned = async ({paymentId,points}) => {
  const db=require('../config/database');
  const rows=await db.query(`SELECT o.user_id,o.reference,p.order_id FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.id=? LIMIT 1`,[Number(paymentId)]);
  const x=rows[0]; if(!x?.user_id || !(Number(points)>0)) return null;
  return exports.businessClient(Number(x.user_id),{type:'LOYALTY_POINTS_EARNED',title:'Points Tiop+ gagnés ⭐',body:`Vous avez gagné ${Number(points)} point(s) Tiop+ avec la commande ${x.reference}.`,payload:{paymentId:Number(paymentId),orderId:Number(x.order_id),reference:x.reference,points:Number(points),url:'/compte/fidelite'},eventKey:`loyalty:payment:${Number(paymentId)}:earned`});
};


exports.loyaltyRewardUsed = async ({orderId,reason='PAYMENT_CONFIRMED'}) => {
  const db=require('../config/database');
  const rows=await db.query('SELECT id,user_id,reference FROM orders WHERE id=? LIMIT 1',[Number(orderId)]);
  const o=rows[0]; if(!o?.user_id) return null;
  return exports.businessClient(Number(o.user_id),{type:'LOYALTY_REWARD_USED',title:'Avantage Tiop+ utilisé ⭐',body:`Votre avantage Tiop+ a été validé sur la commande ${o.reference}.`,payload:{orderId:Number(o.id),reference:o.reference,reason,url:'/compte/fidelite'},eventKey:`loyalty:order:${Number(o.id)}:reward-used`});
};
