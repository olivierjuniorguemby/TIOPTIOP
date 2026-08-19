const bcrypt=require("bcryptjs");
const db=require("../config/database");
(async()=>{
 const email=String(process.argv[2]||"").trim().toLowerCase();
 const password=String(process.argv[3]||"");
 if(!email||password.length<8){console.log('Usage: node scripts/set-user-password.js "email" "MotDePasse123!"');process.exit(1);}
 const rows=await db.query("SELECT id,email,account_type FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1",[email]);
 const u=rows[0]; if(!u){console.error("Utilisateur introuvable");process.exit(1);}
 if(u.account_type!=="CUSTOMER"){console.error("Pas un compte client");process.exit(1);}
 const hash=await bcrypt.hash(password,12);
 await db.query("UPDATE users SET password_hash=?,status='ACTIVE' WHERE id=?",[hash,u.id]);
 console.log("Mot de passe défini pour",u.email,"- hash length",hash.length);
})().catch(e=>{console.error(e);process.exit(1);});
