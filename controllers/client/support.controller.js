const fs = require('fs');
const Support = require('../../models/support.model');

function attachmentUrl(file){
  return file ? `/uploads/support/${file.filename}` : null;
}
function cleanup(file){
  if(file?.path) fs.unlink(file.path,()=>{});
}

exports.contact=(req,res)=>res.render('client/content/contact',{title:'Contact',layout:'layouts/client',created:req.query.created||'',error:req.query.error||'',formUser:req.session?.user||null});

exports.create=async(req,res,next)=>{
 try{
  const user=req.session?.user;
  if(!user){cleanup(req.file);return res.redirect('/connexion?returnTo=%2Fcontact');}
  const message=String(req.body.message||'').trim();
  if(!message){cleanup(req.file);return res.redirect('/contact?error=message');}
  const category=Support.cleanCategory(req.body.subject);
  const labels={ORDER:'Commande',DELIVERY:'Livraison',PAYMENT:'Paiement',REFUND:'Remboursement',TIOP_PLUS:'Tiop+',ACCOUNT:'Mon compte',RESTAURANT:'Restaurant',OTHER:'Autre demande'};
  let order=null;
  if(String(req.body.orderReference||'').trim()){
    order=await Support.findOrderForUser(req.body.orderReference,user.id);
    if(!order){cleanup(req.file);return res.redirect('/contact?error=order');}
  }
  const ticket=await Support.createTicket({userId:Number(user.id),orderId:order?.id||null,subject:labels[category],category,message,attachmentUrl:attachmentUrl(req.file)});
  return res.redirect('/contact?created='+encodeURIComponent(ticket.reference));
 }catch(e){cleanup(req.file);next(e);}
};

exports.account=async(req,res,next)=>{
 try{
  const userId=Number(req.session.user.id);
  const tickets=await Support.listForUser(userId);
  for(const t of tickets)t.messages=await Support.messages(t.id);
  const counts={all:tickets.length,open:0,inProgress:0,resolved:0,closed:0};
  tickets.forEach(t=>{if(t.status==='NEW')counts.open++;if(['IN_PROGRESS','WAITING_CUSTOMER'].includes(t.status))counts.inProgress++;if(t.status==='RESOLVED')counts.resolved++;if(t.status==='CLOSED')counts.closed++;});
  res.render('client/account/support',{title:'Mes demandes',layout:'layouts/client',tickets,counts,selectedId:Number(req.query.ticket)||Number(tickets[0]?.id)||0,sent:req.query.sent||''});
 }catch(e){next(e);}
};

exports.replyCustomer=async(req,res,next)=>{
 try{
  const ticketId=Number(req.params.id);
  const ticket=await Support.findForUser(ticketId,Number(req.session.user.id));
  if(!ticket){cleanup(req.file);const e=new Error('Ticket support introuvable.');e.statusCode=404;throw e;}
  await Support.replyCustomer({ticketId,userId:Number(req.session.user.id),message:req.body.message,attachmentUrl:attachmentUrl(req.file)});
  res.redirect('/compte/demandes?ticket='+ticketId+'&sent=1');
 }catch(e){cleanup(req.file);next(e);}
};
