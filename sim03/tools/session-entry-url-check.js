const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = name => fs.readFileSync(path.join(__dirname,'../public',name),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const token=Buffer.from(JSON.stringify({sub:'student',role:'student',name:'Student'})).toString('base64url')+'.signature';
function context(search,hash,pathname='/sim03/index.html') {
  const element={focus(){},addEventListener(){}};
  const storage={getItem:()=>null,setItem(){},removeItem(){}};
  return {URLSearchParams,atob,document:{getElementById:()=>element},sessionStorage:storage,localStorage:storage,history:{replaceState(){}},location:{pathname,search,hash,replace(url){this.target=url}}};
}
for(const [search,hash] of [
  ['?session=ABCDE','#lt='+encodeURIComponent(token)],
  ['?session=ABCDE&lt='+encodeURIComponent(token),''],
  ['?session=ABCDE&course=course-a','#lt='+encodeURIComponent(token)],
  ['?session=ABCDE','#code=access&lt='+encodeURIComponent(token)]
]) {
  const c=context(search,hash);
  const values=vm.runInNewContext(script('index.html').split('let C=null;')[0]+';({LAUNCH_TOKEN,INITIAL_SESSION})',c);
  assert.equal(values.LAUNCH_TOKEN,token,'session query must not be appended to the signed token');
  assert.equal(values.INITIAL_SESSION,'ABCDE');
  const launch=context(search,hash,'/sim03/launch.html');
  vm.runInNewContext(script('launch.html'),launch);
  const url=new URL(launch.location.target,'https://sim.test');
  assert.equal(url.pathname,'/sim03/index.html');
  assert.equal(url.searchParams.get('session'),'ABCDE');
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('lt'),token);
  const faculty=context(search,hash,'/sim03/instructor.html');
  assert.equal(vm.runInNewContext(script('instructor.html').split('const savedCode=')[0]+';LT',faculty),token);
}
const lookalike=context('?session=ABCDE&notlt=untrusted','');
assert.equal(vm.runInNewContext(script('index.html').split('let C=null;')[0]+';LAUNCH_TOKEN',lookalike),null);
console.log('Sim03 entry URL checks passed: separate query/hash parsing, session retention, and no token suffix contamination.');
