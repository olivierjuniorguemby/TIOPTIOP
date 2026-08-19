const bcrypt=require("bcryptjs");
const User=require("../models/user.model");
(async()=>{
 const email=String(process.argv[2]||"").trim().toLowerCase(); const password=String(process.argv[3]||"");
 if(!email||!password){console.log('Usage: node scripts/check-user-password.js "email" "MotDePasse"');process.exit(1);}
 const u=await User.findByEmail(email); if(!u){console.log("Utilisateur introuvable");return;}
 console.log({id:u.id,email:u.email,status:u.status,type:u.account_type,hash_length:String(u.password_hash||"").length});
 if(!u.password_hash||u.password_hash.length!==60){console.log("Hash bcrypt invalide / placeholder");return;}
 console.log("Mot de passe correct :",await bcrypt.compare(password,u.password_hash));
})().catch(e=>{console.error(e);process.exit(1);});
