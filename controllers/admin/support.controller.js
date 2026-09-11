const fs = require('fs');
const Support=require('../../models/support.model');
function attachmentUrl(file){return file?`/uploads/support/${file.filename}`:null;}
function cleanup(file){if(file?.path) fs.unlink(file.path,()=>{});}
exports.index=async(req,res,next)=>{try{const [tickets,stats]=await Promise.all([Support.listAdmin(),Support.stats()]);for(const t of tickets)t.messages=await Support.messages(t.id);res.render('admin/content/support',{title:'Support',layout:'layouts/admin',tickets,stats,saved:req.query.saved||''});}catch(e){next(e)}};
exports.reply=async(req,res,next)=>{try{await Support.replyAdmin({ticketId:Number(req.params.id),adminId:Number(req.session?.admin?.id)||null,status:String(req.body.status||'IN_PROGRESS'),message:req.body.response||'',attachmentUrl:attachmentUrl(req.file)});res.redirect('/admin/support?saved=1#ticket-'+Number(req.params.id));}catch(e){cleanup(req.file);next(e)}};
