const fs=require('fs');
const html=fs.readFileSync('public/index.html','utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
const mk=()=>({ style:{}, dataset:{}, classList:{add(){},remove(){},toggle(){},contains(){return false}},
  appendChild(){}, insertAdjacentHTML(){}, addEventListener(){}, removeEventListener(){},
  querySelector(){return mk()}, querySelectorAll(){return []}, remove(){}, focus(){}, scrollIntoView(){},
  setAttribute(){}, getAttribute(){return null}, get firstElementChild(){return mk()}, set innerHTML(v){}, get innerHTML(){return ''},
  set textContent(v){}, get textContent(){return ''}, children:[], value:'', onclick:null });
global.location={ search:'', href:'', hash:'', pathname:'/' };
global.document={ getElementById:()=>mk(), createElement:()=>mk(), querySelector:()=>mk(), querySelectorAll:()=>[],
  addEventListener(){}, body:mk(), documentElement:mk(), createTextNode:()=>mk(), title:'' };
global.window={ location:global.location, addEventListener(){}, matchMedia:()=>({matches:false,addEventListener(){}}), scrollTo(){}, history:{replaceState(){}} };
global.history={replaceState(){}};
global.navigator={ userAgent:'node' };
global.fetch=async()=>({ ok:true, status:200, json:async()=>({}) });
global.atob=(s)=>Buffer.from(s,'base64').toString('binary');
global.Blob=class{constructor(){}};
global.URL={ createObjectURL:()=>'blob:', revokeObjectURL(){} };
try { new Function(scripts.join('\n;\n'))(); console.log('client boots clean against a stubbed DOM'); }
catch(e){ console.log('BOOT FAILURE: '+e.message); }
