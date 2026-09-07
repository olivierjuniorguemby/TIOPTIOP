const Promotion=require('../../models/promotion.model');
function nullableNumber(v){ return v===''||v==null?null:Number(v); }
function date(v){ return v?String(v).replace('T',' ').slice(0,19):null; }
function normalize(body,file,current={}){
 const allowed=['PERCENT','FIXED','FREE_DELIVERY','POINTS_MULTIPLIER'];
 const audiences=['ALL','TIOP_PLUS','NEW_CUSTOMERS','SELECTED'];
 return {name:String(body.name||'').trim(),code:String(body.code||'').trim().toUpperCase()||null,description:String(body.description||'').trim()||null,image_url:file?`/uploads/promotions/${file.filename}`:(current.image_url||null),discount_type:allowed.includes(body.discount_type)?body.discount_type:'PERCENT',discount_value:Number(body.discount_value||0),minimum_order:nullableNumber(body.minimum_order),audience:audiences.includes(body.audience)?body.audience:'ALL',usage_limit:nullableNumber(body.usage_limit),usage_limit_per_user:nullableNumber(body.usage_limit_per_user),starts_at:date(body.starts_at),ends_at:date(body.ends_at),is_active:body.is_active==='1'||body.is_active==='on'?1:0};
}
function categoryIds(body){const x=body.category_ids; return (Array.isArray(x)?x:(x?[x]:[])).map(Number).filter(Number.isInteger);}
exports.index=async(req,res,next)=>{try{const filters={q:req.query.q||'',type:req.query.type||'',status:req.query.status||'',audience:req.query.audience||'',category:req.query.category||''};const [promotions,stats,categories]=await Promise.all([Promotion.list(filters),Promotion.stats(),Promotion.categories()]);for(const p of promotions)p.category_ids=await Promotion.categoryIds(p.id);res.render('admin/catalog/promotions',{title:'Promotions',layout:'layouts/admin',promotions,stats,categories,filters,saved:req.query.saved,deleted:req.query.deleted});}catch(e){next(e)}};
exports.create=async(req,res,next)=>{try{const d=normalize(req.body,req.file);if(!d.name)return res.status(400).send('Nom obligatoire.');const id=await Promotion.create(d);await Promotion.saveCategories(id,categoryIds(req.body));res.redirect('/admin/promotions?saved=1');}catch(e){next(e)}};
exports.update=async(req,res,next)=>{try{const id=Number(req.params.id),cur=await Promotion.findById(id);if(!cur)return res.status(404).send('Promotion introuvable.');const d=normalize(req.body,req.file,cur);await Promotion.update(id,d);await Promotion.saveCategories(id,categoryIds(req.body));res.redirect('/admin/promotions?saved=1');}catch(e){next(e)}};
exports.remove=async(req,res,next)=>{try{await Promotion.remove(Number(req.params.id));res.redirect('/admin/promotions?deleted=1');}catch(e){next(e)}};
