const Notification = require('../../models/notification.model');

function payloadOf(value){ if(!value)return {}; if(typeof value==='object')return value; try{return JSON.parse(value)}catch(_){return {}} }
function targetOf(n){
  const p=payloadOf(n.payload), raw=p.admin_url||p.adminUrl||p.url||p.href||p.link||p.target_url||p.targetUrl;
  if(typeof raw==='string' && raw.startsWith('/admin/') && !raw.startsWith('//')) return raw;
  if(p.ticketId||p.ticket_id) return `/admin/support?ticket=${encodeURIComponent(p.ticketId||p.ticket_id)}`;
  if(p.orderId||p.order_id) return '/admin/commandes';
  const t=String(n.notification_type||'').toUpperCase();
  if(/SUPPORT|TICKET/.test(t)) return '/admin/support';
  if(/PAY|REFUND|REMBOURSEMENT/.test(t)) return '/admin/paiements';
  if(/ORDER|COMMANDE|DELIVERY|LIVRAISON/.test(t)) return '/admin/commandes';
  if(/STOCK|INVENTORY/.test(t)) return '/admin/produits';
  if(/APPLICATION|CANDIDATURE|JOB/.test(t)) return '/admin/candidatures';
  return null;
}
const enrich=items=>items.map(n=>({...n,target_url:targetOf(n)}));
exports.feed = async (_req,res,next)=>{try{res.json({ok:true,summary:await Notification.summary('ADMIN'),items:enrich(await Notification.recent('ADMIN',null,6))});}catch(e){next(e)}};
exports.list = async (req,res,next)=>{try{const filter=String(req.query.filter||'ALL').toUpperCase(),search=String(req.query.q||'').trim();const [items,summary]=await Promise.all([Notification.listForAdmin({filter,search}),Notification.summary('ADMIN')]);res.json({ok:true,summary,items:enrich(items)});}catch(e){next(e)}};
exports.page = async (req,res,next)=>{try{const [items,summary]=await Promise.all([Notification.listForAdmin(),Notification.summary('ADMIN')]);res.render('admin/system/notifications',{title:'Notifications',layout:'layouts/admin',items:enrich(items),summary});}catch(e){next(e)}};
exports.read = async (req,res,next)=>{try{await Notification.markRead('ADMIN',null,req.params.id);res.json({ok:true,summary:await Notification.summary('ADMIN')});}catch(e){next(e)}};
exports.unread = async (req,res,next)=>{try{await Notification.markAdminUnread(req.params.id);res.json({ok:true,summary:await Notification.summary('ADMIN')});}catch(e){next(e)}};
exports.readAll = async (_req,res,next)=>{try{await Notification.markAllRead('ADMIN');res.json({ok:true,summary:await Notification.summary('ADMIN')});}catch(e){next(e)}};
