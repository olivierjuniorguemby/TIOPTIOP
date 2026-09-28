const Notification = require('../../models/notification.model');
const uid = req => Number(req.session.user.id);
exports.feed = async (req,res,next)=>{try{const items=await Notification.recent('USER',uid(req),6);res.json({ok:true,summary:await Notification.summary('USER',uid(req)),items:items.map(n=>({...n,target_url:targetOf(n)}))});}catch(e){next(e)}};
exports.read = async (req,res,next)=>{try{await Notification.markRead('USER',uid(req),req.params.id);res.json({ok:true,summary:await Notification.summary('USER',uid(req))});}catch(e){next(e)}};
exports.readAll = async (req,res,next)=>{try{await Notification.markAllRead('USER',uid(req));res.json({ok:true,summary:await Notification.summary('USER',uid(req))});}catch(e){next(e)}};

function payloadOf(value){
  if(!value) return {};
  if(typeof value==='object') return value;
  try{return JSON.parse(value)}catch(_){return {}}
}
function targetOf(n){
  const p=payloadOf(n.payload);
  const raw=p.url||p.href||p.link||p.target_url||p.targetUrl;
  if(typeof raw==='string' && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  if(p.ticketId||p.ticket_id) return `/compte/demandes?ticket=${encodeURIComponent(p.ticketId||p.ticket_id)}`;
  if(p.orderId||p.order_id) return `/commandes/${encodeURIComponent(p.orderId||p.order_id)}`;
  const t=String(n.notification_type||'').toUpperCase();
  if(/SUPPORT|TICKET/.test(t)) return '/compte/demandes';
  if(/LOYALTY|TIOP/.test(t)) return '/tiopplus';
  if(/PAY|REFUND/.test(t)) return '/paiements-client';
  if(/ORDER|COMMANDE|DELIVERY/.test(t)) return '/commandes';
  if(/PROMO/.test(t)) return '/offres';
  return null;
}
exports.page = async (req,res,next)=>{try{
  const userId=uid(req), filter=String(req.query.filter||'ALL').toUpperCase(), search=String(req.query.q||'').trim();
  const [items,summary]=await Promise.all([Notification.listForUser(userId,{filter,search,limit:150}),Notification.summary('USER',userId)]);
  const enriched=items.map(n=>({...n,target_url:targetOf(n)}));
  res.render('client/account/notifications',{title:'Mes notifications',layout:'layouts/client',items:enriched,summary,filter,search});
}catch(e){next(e)}};
exports.unread = async(req,res,next)=>{try{await Notification.markUnread(uid(req),req.params.id);res.json({ok:true,summary:await Notification.summary('USER',uid(req))});}catch(e){next(e)}};
