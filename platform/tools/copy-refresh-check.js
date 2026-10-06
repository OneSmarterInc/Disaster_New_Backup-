#!/usr/bin/env node
// A rewrite in a simulation must reach the whole catalogue page. It used to
// reach the parts stored as detail and stop, so a description could sit there
// for days saying something its author had already deleted.
const DB = { sims:{ s1:{ id:'s1', title:'Old title', tagline:'Old line', description:'Old situation.',
  detail:{ tangle:'Old tangle.', _edited:['tagline'] }, launch_url:'https://x', minutes:20 } } };
require.cache[require.resolve(require('path').join(__dirname,'../lib/db.js'))]={exports:{
  sql: () => (st, ...v) => {
    const q = st.join('?').replace(/\s+/g,' ').trim();
    if (q.startsWith('SELECT * FROM sims WHERE id')) return Promise.resolve([DB.sims[v[0]]]);
    if (q.startsWith('SELECT coalesce(max(number)')) return Promise.resolve([{ n: 0 }]);
    const m = q.match(/UPDATE sims SET (\w+)/);
    if (m) { DB.sims[v[1]][m[1]] = m[1]==='detail' ? JSON.parse(v[0]) : v[0]; return Promise.resolve([]); }
    return Promise.resolve([]);
  }, id:p=>p, joinCode:()=>'X' }};
process.env.LAUNCH_SECRET='shared';
const register = require(require('path').join(__dirname,'../api/register.js'));
const { signBack } = require(require('path').join(__dirname,'../../sim/lib/launch.js'));

new Promise(res => {
  const r = { _c:200, status(c){this._c=c;return this;}, json(d){res(d);}, setHeader(){}, end(){res({});} };
  register({ method:'POST', headers:{}, body:{ token: signBack({ kind:'register', sim:'s1',
    title:'New title', tagline:'New line', description:'New situation.',
    launchUrl:'https://x', minutes:20, exp: Date.now()+60000,
    detail:{ tangle:'New tangle.' } }) } }, r);
}).then(() => {
  const s = DB.sims.s1;
  console.log('  title       :', s.title,       '  (the simulation\'s — refreshed)');
  console.log('  one line    :', s.tagline,     '  (the administrator rewrote this — kept)');
  console.log('  situation   :', s.description, '  (the simulation\'s — refreshed)');
  console.log('  what is hard:', s.detail.tangle, '  (refreshed as before)');
});
