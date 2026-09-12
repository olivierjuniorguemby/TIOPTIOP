const fs = require('fs');
const path = require('path');

const MAX_FILES = 5;
const allowed = {
  '.jpg':['image/jpeg'], '.jpeg':['image/jpeg'], '.png':['image/png'], '.webp':['image/webp'], '.avif':['image/avif'],
  '.pdf':['application/pdf'], '.doc':['application/msword','application/octet-stream'],
  '.docx':['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/zip','application/octet-stream'],
  '.txt':['text/plain','application/octet-stream'], '.mp4':['video/mp4','application/octet-stream']
};

function sniff(buffer, ext){
  if(ext==='.jpg'||ext==='.jpeg') return buffer.length>=3 && buffer[0]===0xff && buffer[1]===0xd8 && buffer[2]===0xff;
  if(ext==='.png') return buffer.length>=8 && buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if(ext==='.webp') return buffer.length>=12 && buffer.subarray(0,4).toString()==='RIFF' && buffer.subarray(8,12).toString()==='WEBP';
  if(ext==='.avif') return buffer.length>=12 && buffer.subarray(4,8).toString()==='ftyp' && ['avif','avis'].includes(buffer.subarray(8,12).toString());
  if(ext==='.pdf') return buffer.subarray(0,5).toString()==='%PDF-';
  if(ext==='.docx') return buffer.length>=4 && buffer[0]===0x50 && buffer[1]===0x4b;
  if(ext==='.doc') return buffer.length>=8 && buffer.subarray(0,8).equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]));
  if(ext==='.txt') return !buffer.includes(0x00);
  if(ext==='.mp4') return buffer.length>=12 && buffer.subarray(4,8).toString()==='ftyp';
  return false;
}

async function validateUploadedFiles(files=[], options={}){
  if(files.length>MAX_FILES) throw Object.assign(new Error(`Maximum ${MAX_FILES} pièces jointes par message.`),{statusCode:400});
  for(const file of files){
    const ext=path.extname(file.originalname||'').toLowerCase();
    if(ext==='.mp4' && !options.allowVideo) throw Object.assign(new Error('Les vidéos MP4 sont réservées au support.'),{statusCode:400});
    if(!allowed[ext] || !allowed[ext].includes(file.mimetype)) throw Object.assign(new Error(`Fichier non autorisé : ${file.originalname}`),{statusCode:400});
    const fh=await fs.promises.open(file.path,'r');
    const buf=Buffer.alloc(64); const {bytesRead}=await fh.read(buf,0,64,0); await fh.close();
    if(!sniff(buf.subarray(0,bytesRead),ext)) throw Object.assign(new Error(`Contenu du fichier invalide : ${file.originalname}`),{statusCode:400});
  }
}
function cleanupFiles(files=[]){ for(const f of files) if(f?.path) fs.unlink(f.path,()=>{}); }
function normalizeFiles(files=[]){ return files.map(f=>({originalName:String(f.originalname||'fichier').slice(0,255),storedName:f.filename,mimeType:f.mimetype,size:Number(f.size||0)})); }
module.exports={MAX_FILES,allowed,validateUploadedFiles,cleanupFiles,normalizeFiles};
