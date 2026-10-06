// DOM smoke test: student page walks through intro, lobby, play, decision, reveal against the real API handlers.
process.env.LAUNCH_SECRET='s';process.env.FACULTY_CODES='T:f';process.env.ACCESS_CODE='open';
process.env.KV_REST_API_URL='m';process.env.KV_REST_API_TOKEN='m';
const path=require('path'),fs=require('fs'),assert=require('assert');
const SIM=path.resolve(__dirname,'..');
const db={sess:{},p:{},run:{}};const S=v=>v==null?'':JSON.stringify(v);
const mem={configured:()=>true,async getSession(c){return db.sess[c]?JSON.parse(db.sess[c]):null},async putSession(c,o){db.sess[c]=S(o);return o},
async compareAndSetSession(c,a,b){if((db.sess[c]||'')!==S(a))return false;db.sess[c]=S(b);return true},
async getParticipants(c){return Object.fromEntries(Object.entries(db.p[c]||{}).map(([k,v])=>[k,JSON.parse(v)]))},
async getParticipant(c,i){const v=(db.p[c]||{})[i];return v?JSON.parse(v):null},async getRun(c,i){const v=(db.run[c]||{})[i];return v?JSON.parse(v):null},
async compareAndSetParticipant(c,i,a,b){db.p[c]||={};if((db.p[c][i]||'')!==S(a))return false;db.p[c][i]=S(b);return true},
async getRuns(c){return Object.fromEntries(Object.entries(db.run[c]||{}).map(([k,v])=>[k,JSON.parse(v)]))},
async compareAndSetRun(c,i,a,b){db.run[c]||={};if((db.run[c][i]||'')!==S(a))return false;db.run[c][i]=S(b);return true}};
require.cache[path.join(SIM,'lib/store.js')]={id:'s',filename:'s',loaded:true,exports:mem};
const session=require(path.join(SIM,'api/session.js')),config=require(path.join(SIM,'api/config.js'));
let clock=1e9;session._now=()=>clock;
function call(h,method,body,headers){return new Promise(r=>{const res={c:200,status(n){this.c=n;return this},setHeader(){},json(v){r({status:this.c,body:v})},end(){r({status:this.c,body:null})}};h({method,headers,body},res)})}

module.exports={session,config,call,fs,path,assert,SIM,getClock:()=>clock,addClock:n=>{clock+=n}};
