'use strict';
const fs=require('node:fs');const path=require('node:path');
async function prepare(req,res,origin){
 const url=new URL(req.url,origin);req.query=Object.fromEntries(url.searchParams);
 let size=0;const chunks=[];
 for await(const chunk of req){size+=chunk.length;if(size>2*1024*1024)throw Object.assign(new Error('Body too large'),{status:413});chunks.push(chunk);}
 try{req.body=size?JSON.parse(Buffer.concat(chunks).toString('utf8')):{}}catch{throw Object.assign(new Error('Invalid JSON'),{status:400});}
 res.status=code=>{res.statusCode=code;return res};
 res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return res};
 res.send=data=>{res.end(data);return res};
 res.redirect=(code,target)=>{if(target===undefined){target=code;code=302;}res.writeHead(code,{Location:target});res.end();};
}
function file(req,res,root,relative){
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 const target=path.resolve(root,relative);
 if(!target.startsWith(path.resolve(root)+path.sep)||relative.split(/[\\/]/).some(x=>x.startsWith('.'))||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);return res.end('Not found');}
 const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.ico':'image/x-icon','.txt':'text/plain'};
 res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');res.end(req.method==='HEAD'?undefined:fs.readFileSync(target));
}
function failure(res,error){if(!res.headersSent)res.writeHead(error.status||500,{'Content-Type':'application/json'});if(!res.writableEnded)res.end(JSON.stringify({error:error.message}));}
module.exports={prepare,file,failure};
