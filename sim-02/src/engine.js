const app = document.getElementById('app');
const el = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const S = {
  screen: 'brief',        // brief | play | debrief
  phase: 0,               // 0..2
  channel: 'room',        // 'room' | character id
  threads: { room: [] },  // channel -> [{who,text}]
  positions: [],          // per phase {reading, action, tripwire}
  busy: false,
  playing: false,
  pending: [],
  skip: false,
  askedDevinThreshold: false,
  ladderEarnedAt: null,
  ladderEarnedPrivately: false,
  preserved: false,
  preservedAt: null,
  preservedByTalk: false,
  preservedQuote: '',
  rolledBack: false,
  privateOpened: {},
  briefStep: 0,
  composerOpen: true,
  debrief: null,
  draft: { reading: null, action: null, tripwire: '' }
};
CAST_ORDER.forEach(id => S.threads[id] = []);

const nameOf = (w) => w === 'you' ? 'You' : w === 'system' ? '' : w === 'alan' ? 'Alan Voss' : (CAST[w] ? CAST[w].name : w);
const hueOf  = (w) => w === 'alan' ? 'var(--alan)' : w === 'you' ? 'var(--amber)' : (CAST[w] ? CAST[w].hue : 'var(--sys)');
const roleOf = (w) => w === 'alan' ? 'Chief Commercial Officer' : (CAST[w] ? CAST[w].role : '');

// ---------- agent prompts ----------



let LAST_ERROR = null;
let OFFLINE = false;
let NEEDS_CODE = false;
let BAD_LAUNCH = false;
let ACCESS_CODE = (function () {
  const m = (location.hash + location.search).match(/code=([^&]+)/);
  if (m) return decodeURIComponent(m[1]);
  return null;
})();

// A launch token from the platform. It says who is playing and in what capacity,
// and stands in for the access code entirely.
let LAUNCH = null;
let LAUNCH_TOKEN = (function () {
  const m = (location.hash + location.search).match(/lt=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
})();
if (LAUNCH_TOKEN) {
  try {
    LAUNCH = JSON.parse(atob(LAUNCH_TOKEN.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
  } catch (e) { LAUNCH = null; }
}
// Tidy the address bar either way, so a token or code isn't sitting in it.
if (LAUNCH_TOKEN || ACCESS_CODE) {
  const keep = new URLSearchParams(location.search);
  keep.delete('lt'); keep.delete('code');
  const q = keep.toString();
  history.replaceState(null, '', location.pathname + (q ? '?' + q : ''));
}

// Where this simulation is being served from. Its own deployment answers at the
// root; behind the platform's domain it sits under /sim01 or /sim02, and every
// request has to carry that prefix or it lands on the platform instead.
const BASE = (location.pathname.match(/^\/sim\d+/) || [''])[0];

async function api(path, payload) {
  let r;
  try {
    r = await fetch(BASE + path, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' },
        LAUNCH_TOKEN ? { 'x-launch-token': LAUNCH_TOKEN }
                     : (ACCESS_CODE ? { 'x-access-code': ACCESS_CODE } : {})),
      body: JSON.stringify(payload)
    });
  } catch (e) {
    LAST_ERROR = 'Could not reach the server. Check your connection and try again.';
    throw new Error(LAST_ERROR);
  }
  if (r.status === 401) {
    let why = '';
    try { why = (await r.json()).error || ''; } catch (e) { why = ''; }
    if (why === 'launch_token_invalid') {
      // Arrived from the platform but the sim wouldn't accept the handover.
      // Almost always a mismatched or missing shared secret between the two.
      BAD_LAUNCH = true;
      NEEDS_CODE = false;
      LAST_ERROR = 'This sim did not accept the link you arrived on. It may have expired — go back and start it again from your course. If it keeps happening, the two systems are not sharing the same launch secret.';
    } else {
      NEEDS_CODE = true;
      LAST_ERROR = 'This sim needs an access code. Enter the one you were given.';
    }
    throw new Error(LAST_ERROR);
  }
  if (!r.ok) {
    let m = '';
    try { m = (await r.json()).error || ''; } catch (e) { m = ''; }
    LAST_ERROR = `Server error ${r.status}. ${String(m).slice(0, 200)}`;
    throw new Error(LAST_ERROR);
  }
  return r.json();
}

async function loadInit() {
  const d = await api('/api/scene', { init: true });
  CAST = d.cast; CAST_ORDER = d.castOrder; CAST_INTRO = d.intro;
  ACTIONS = d.actions; READINGS = d.readings;
  PHASES = d.labels.map(l => Object.assign({ telemetry: [], beats: [], prompts: [], task: '', heading: '' }, l));
  CAST_ORDER.forEach(id => { if (!S.threads[id]) S.threads[id] = []; });
}

async function loadScene(phase) {
  const d = await api('/api/scene', { phase,
    state: { preserved: S.preserved, preservedAt: S.preservedAt, rolledBack: S.rolledBack },
    positions: S.positions.map(p => ({ phase: p.phase, action: p.action })) });
  PHASES[phase] = Object.assign(PHASES[phase] || {}, d.scene);
  return PHASES[phase];
}

async function askCharacter(id, message, channel) {
  const d = await api('/api/chat', {
    character: id, phase: S.phase, channel, message,
    room: S.threads.room.slice(-14).map(m => ({ who: m.who, text: m.text })),
    thread: (S.threads[channel] || []).slice(-12).map(m => ({ who: m.who, text: m.text }))
  });
  if (d.scripted) { OFFLINE = true; refreshCog(); }
  return { text: d.text || '', ladder: !!d.ladder };
}


// Two ways to end up scripted: the bridge stopped answering, or somebody chose
// it. The first wants a banner explaining what happened; the second does not,
// because a deliberate choice presented as a failure reads as a crash.
function goOffline(chosen) {
  if (OFFLINE) return;
  OFFLINE = true;
  refreshCog();
  if (!chosen) showBanner();
}

function showBanner() {
  if (document.getElementById('keybar')) return;
  const needCode = NEEDS_CODE && !BAD_LAUNCH;
  const bar = el(`<div id="keybar" style="position:fixed;left:0;right:0;bottom:0;z-index:60;border-top:1px solid var(--alert);background:#1A1420;padding:12px 18px">
    <div style="max-width:1100px;margin:0 auto">
      <div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-bottom:7px">
        <span style="font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--alert)">${needCode ? 'Access code needed' : 'Bridge unreachable'}</span>
        <span style="font-size:13px;color:#C4C1B9;line-height:1.5">${needCode
          ? 'Enter the code you were given and the characters will come live.'
          : 'The server didn\'t answer. Anything you\'ve already done is still here.'}</span>
      </div>
      <div style="font-family:var(--mono);font-size:11px;color:var(--dimmer);margin-bottom:9px;line-height:1.5" id="kb-err">${esc(LAST_ERROR || '')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input id="keyin" type="text" placeholder="access code" value="${esc(ACCESS_CODE || '')}"
          style="flex:1;min-width:200px;background:var(--night);border:1px solid var(--line2);padding:8px 11px;font-family:var(--mono);font-size:12px">
        <button class="btn pri" id="keyset">Try again</button>
        <button class="btn" id="keyhide">Dismiss</button>
      </div>
    </div>
  </div>`);
  document.body.appendChild(bar);
  bar.querySelector('#keyhide').onclick = () => bar.remove();
  bar.querySelector('#keyset').onclick = async () => {
    const v = bar.querySelector('#keyin').value.trim();
    ACCESS_CODE = v || null;
    const btn = bar.querySelector('#keyset');
    btn.textContent = 'Checking…'; btn.disabled = true;
    try {
      await api('/api/scene', { init: true });
      OFFLINE = false; NEEDS_CODE = false; LAST_ERROR = null;
      bar.remove();
      refreshCog();
      if (!CAST_ORDER.length) { await loadInit(); render(); }
    } catch (e) {
      const err = bar.querySelector('#kb-err');
      if (err) err.textContent = LAST_ERROR || 'Still failing.';
      btn.textContent = 'Try again'; btn.disabled = false;
    }
  };
}

// who answers in the room
function responders(text) {
  const t = text.toLowerCase();
  const named = CAST_ORDER.filter(id => t.includes(CAST[id].name.split(' ')[0].toLowerCase()));
  if (named.length) return named.slice(0, 2);
  const score = { joanna: 0, devin: 0, grant: 0, nadia: 0 };
  const hit = (re, id, n) => { if (re.test(t)) score[id] += (n || 1); };
  hit(/document|datasheet|revision|rev [cd]|supersed|library|withdraw|retire|publish|effective date|change note|elastomer|230|260|rating/, 'joanna', 2);
  hit(/relay|platform|threshold|routing|escalat|log|conversation|retriev|index|re-?index|rebuild|configur|setting|deflect|assistant|query|ninety|90 ?day/, 'devin', 2);
  // tier-two probes: these belong to the platform owner even when phrased obliquely
  hit(/not saying|aren'?t you saying|holding back|what am i missing|what.{0,12}made for|who (approved|reviewed|signed)|measur|target|drop(ped)? the ball|off the record|between us|anything change on your side/, 'devin', 3);
  hit(/vendor|trellis|contract|liab|roadmap|product|warn us|should the platform|guidance|other customers/, 'grant', 2);
  hit(/queue|escalations|noticed|quiet|support|application engineer|who answers|what do you see|how (does|do) content|how does relay know|ingest|nightly|overnight/, 'nadia', 2);

  // Conversational continuity: an unaddressed follow-up usually belongs to whoever
  // just spoke. Without this, "what aren't you saying" lands on the wrong person.
  const lastSpeaker = [...S.threads.room].reverse().find(m => m.who !== 'you' && m.who !== 'system' && CAST[m.who]);
  if (lastSpeaker) score[lastSpeaker.who] += 1.5;

  const ranked = CAST_ORDER.filter(id => score[id] > 0).sort((a, b) => score[b] - score[a]);
  if (!ranked.length) return ['joanna', 'devin'];
  // A second voice only joins on a real topic match, not on continuity alone.
  const out = [ranked[0]];
  if (ranked[1] && score[ranked[1]] >= 2) out.push(ranked[1]);
  return out;
}

// ---------- rendering ----------
function railHTML() {
  const cards = CAST_ORDER.map(id => {
    const c = CAST[id];
    return `<button class="who ${S.channel === id ? 'on' : ''}" data-ch="${id}">
      <div class="who-top">
        <div class="av" style="color:${c.hue};border-color:${c.hue}55">${c.initials}</div>
        <div><div class="who-name">${c.name}</div><div class="who-role">${c.role}</div></div>
      </div>
      <div class="who-meta">
        <div class="expo">
          <div class="track"></div>
          <div class="bar hw" style="width:${c.exposure.content / 2}%"></div>
          <div class="bar br" style="width:${c.exposure.supervision / 2}%"></div>
          <div class="mid"></div>
        </div>
        <div class="expo-key"><span>Stale document</span><span>Not escalated</span></div>
        <div class="who-note">${c.exposureNote}</div>
      </div>
    </button>`;
  }).join('');
  return `<nav class="rail">
    <h2>The room</h2>
    <button class="who ${S.channel === 'room' ? 'on' : ''}" data-ch="room">
      <div class="who-top"><div class="av" style="color:var(--sys);border-color:#5E908955">⌘</div>
      <div><div class="who-name">Incident bridge</div><div class="who-role">Everyone is listening</div></div></div>
    </button>
    ${cards}
    <div class="rail-note"><b>The bar is who each answer indicts.</b> Both of these people are competent and honest. Neither can fully separate what they think from what it would cost them to be wrong.</div>
  </nav>`;
}

function msgHTML(m) {
  if (m.who === 'system') return `<div class="msg sys"><div class="tx">${esc(m.text)}</div></div>`;
  if (m.who === 'you') return `<div class="msg you"><div class="body"><div class="nm">You</div><div class="tx">${esc(m.text)}</div></div></div>`;
  const ini = m.who === 'alan' ? 'AV' : (CAST[m.who] ? CAST[m.who].initials : '··');
  return `<div class="msg">
    <div class="av" style="color:${hueOf(m.who)};border-color:${hueOf(m.who)}55">${ini}</div>
    <div class="body"><div class="nm" style="color:${hueOf(m.who)}">${esc(nameOf(m.who))}</div>
    <div class="tx">${esc(m.text)}</div></div></div>`;
}

function playHTML() {
  const ph = PHASES[S.phase];
  const priv = S.channel !== 'room';
  const c = priv ? CAST[S.channel] : null;
  const thread = S.threads[S.channel];
  const pills = PHASES.map((p, i) =>
    `<span class="phase-pill ${i === S.phase ? 'on' : (i < S.phase ? 'done' : '')}">${p.label}</span>`).join('');

  return `
  <header>
    <div class="brand"><h1>What Did It Tell Them?</h1><div class="sub">Calder Sealing Systems · customer incident</div></div>
    <div class="phases">${pills}</div>
    <div class="clock"><span class="t">${ph.clock}</span><span class="d">${ph.day}</span></div>
  </header>
  <main>
    ${railHTML()}
    <section class="stage">
      <div class="chan">
        ${priv
          ? `<span class="priv mono">Private</span><span class="lab">One to one with ${esc(c.name)} — the room can't hear this</span>
             <button class="back" data-ch="room">← Back to the bridge</button>`
          : `<span class="lab">Incident bridge · ${esc(ph.heading)}</span>
             ${S.playing ? '' : '<button class="back" id="commit-open">Record position &amp; advance →</button>'}`}
      </div>
      <div class="stream" id="stream"><div class="stream-in" id="streamIn">
        ${priv ? '' : `<div class="task"><div class="tl2">Your job</div><div class="tt">${esc(ph.task)}</div></div>
        <div class="tele"><h3>Telemetry</h3><ul>${ph.telemetry.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`}
        ${thread.map(msgHTML).join('')}
        ${priv && thread.length === 0 ? `<div class="msg sys"><div class="tx">You pull ${esc(c.name.split(' ')[0])} off the bridge</div></div>` : ''}
        <div id="typing"></div>
      </div></div>
      <div class="composer"><div class="composer-in">
        <div class="crow">
          <textarea id="input" rows="1" ${S.playing ? 'disabled' : ''} placeholder="${S.playing
            ? 'The bridge is talking…'
            : (priv ? `Say anything to ${esc(c.name.split(' ')[0])} — the room can't hear you` : 'Type anything you\'d actually ask this room…')}"></textarea>
          <button class="btn" id="send" ${S.playing ? 'disabled' : ''}>Send</button>
          <button class="cmp-toggle ${S.composerOpen ? '' : 'shut'}" id="cmp-toggle"
            title="${S.composerOpen ? 'Collapse this panel' : 'Show examples and guidance'}"
            aria-label="${S.composerOpen ? 'Collapse' : 'Expand'}">⌄</button>
        </div>
        <div id="cmp-extra" style="display:${S.composerOpen ? 'block' : 'none'}">
        ${(!S.playing && !priv && S.threads.room.filter(m => m.who === 'you').length < 1)
          ? `<div class="chips-lab">Your own words work best · click to borrow an example</div>
             <div class="chips">${(ph.prompts || []).map(q => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>`
          : ''}
        ${(!S.playing && priv && S.threads[S.channel].length === 0)
          ? `<div class="chips-lab">Examples · or say whatever you like</div>
             <div class="chips">
               <button class="chip" data-q="Off the bridge — what aren't you saying in front of the others?">Off the bridge — what aren't you saying in front of the others?</button>
               <button class="chip" data-q="What would you be worried about if this weren't your call to defend?">What would you be worried about if this weren't your call to defend?</button>
             </div>`
          : ''}
        ${(!S.playing && !priv)
          ? `<div class="commit-line">Ask everything you need to first — recording <b>moves the incident on</b> and this hour won't come back.</div>`
          : ''}
        </div>
        <div class="chint">
          <span class="h" style="${S.composerOpen ? '' : 'display:none'}">${S.playing
            ? 'You joined at 09:40. Catching up on what you missed.'
            : (priv
              ? 'What would they say here that they wouldn\'t say on the bridge?'
              : 'Pick a name from the room panel to take them aside — they say different things off the bridge.')}</span>
          ${S.playing
            ? `<button class="btn" id="skip">Skip ahead</button>`
            : `<button class="btn pri" id="commit-open2">Record position · ${esc(ph.label)}</button>`}
        </div>
      </div></div>
    </section>
  </main>`;
}

function render() {
  if (inSession()) {
    if (SESSION.paused && S.screen === 'play') renderPausedOverlay(); else clearPausedOverlay();
  }
  if (S.screen === 'join')   return renderJoin();
  if (S.screen === 'lobby')  return renderLobby();
  if (S.screen === 'held')   { if (inSession() && SESSION.revealed) { S.screen = 'debrief'; loadDebrief(); return; } return renderHeld(); }
  if (S.screen === 'brief') return renderBrief();
  if (S.screen === 'debrief') return renderDebrief(S.debrief);
  app.innerHTML = playHTML();
  wirePlay();
  const s = document.getElementById('stream');
  if (s) s.scrollTop = s.scrollHeight;
  if (S.playing && S.pending.length) runBeats();
}

function wirePlay() {
  app.querySelectorAll('[data-ch]').forEach(b => {
    if (S.playing) { b.style.opacity = '.45'; b.style.cursor = 'not-allowed'; return; }
    b.onclick = () => {
      S.channel = b.dataset.ch;
      if (S.channel !== 'room') S.privateOpened[S.channel] = true;
      render();
    };
  });
  const sk = document.getElementById('skip');
  if (sk) sk.onclick = () => { S.skip = true; };
  const ct = document.getElementById('cmp-toggle');
  if (ct) ct.onclick = () => { S.composerOpen = !S.composerOpen; render(); };
  app.querySelectorAll('.chip').forEach(c => c.onclick = () => {
    const ta = document.getElementById('input');
    if (!ta || S.busy) return;
    ta.value = c.dataset.q;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  });
  const ta = document.getElementById('input');
  const send = document.getElementById('send');
  const co = document.getElementById('commit-open'), co2 = document.getElementById('commit-open2');
  if (co) co.onclick = openCommit;
  if (co2) co2.onclick = openCommit;
  if (ta && !S.playing) {
    ta.focus();
    ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 150) + 'px'; };
    ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } };
  }
  if (send) send.onclick = doSend;
}

function push(ch, who, text) { S.threads[ch].push({ who, text }); }

function showTyping(who) {
  const t = document.getElementById('typing');
  if (!t) return;
  t.innerHTML = `<div class="typing">${esc(nameOf(who))} is typing<i>.</i><i>.</i><i>.</i></div>`;
  const s = document.getElementById('stream'); if (s) s.scrollTop = s.scrollHeight;
}
function appendLive(m) {
  const c = document.getElementById('streamIn');
  const t = document.getElementById('typing');
  if (c && t) c.insertBefore(el(msgHTML(m)), t);
  const s = document.getElementById('stream'); if (s) s.scrollTop = s.scrollHeight;
}
function clearTyping() { const t = document.getElementById('typing'); if (t) t.innerHTML = ''; }

async function doSend() {
  if (S.busy) return;
  const ta = document.getElementById('input');
  const text = (ta.value || '').trim();
  if (!text) return;
  S.busy = true;
  ta.value = ''; ta.style.height = 'auto';
  document.getElementById('send').disabled = true;

  const ch = S.channel;
  push(ch, 'you', text);
  appendLive({ who: 'you', text });


  try {
    const ids = ch === 'room' ? responders(text) : [ch];
    for (const id of ids) {
      showTyping(id);
      const said = await askCharacter(id, text, ch);
      let line = (said.text || '').replace(/^"|"$/g, '').replace(/\*/g, '').trim();
      // The server tells us whether the graded disclosure came out; the markers
      // themselves are scenario content and stay out of this file.
      if (said.ladder) {
        if (S.ladderEarnedAt === null) {   // phase 0 is falsy — must test for null
          S.ladderEarnedAt = S.phase;
          S.ladderEarnedPrivately = (ch !== 'room');
        }
        S.askedDevinThreshold = true;
      }
      clearTyping();
      if (line) { push(ch, id, line); appendLive({ who: id, text: line }); }
    }
  } catch (e) {
    clearTyping();
    showBanner();
    const fb = { who: 'system', text: 'The bridge dropped out — see the note at the bottom of the screen.' };
    push(ch, 'system', fb.text); appendLive(fb);
  }
  S.busy = false;
  const sb = document.getElementById('send'); if (sb) sb.disabled = false;
  const t2 = document.getElementById('input'); if (t2) t2.focus();
}

// ---------- commitment ----------
const GUIDE = {
  what: `<p><b>Submitting this ends the current moment.</b> The clock jumps forward, new evidence lands, and you cannot come back and ask anyone anything about this hour again. Say what you need to say on the bridge first.</p>
    <p>This is your position on the record, not a quiz answer. You're being asked to say what you believe <b>while you still don't know</b> — which is the only time it costs anything to say it.</p>
    <p>It locks when you submit. You can't come back and tidy it up once the next evidence arrives, and that's deliberate: the whole point is to capture the reasoning you had at the time rather than the reasoning you wish you'd had.</p>
    <p>Nothing here is scored right or wrong. What gets read back to you at the end is whether your three positions hang together.</p>`,
  reading: `<p><b>What we're looking for:</b> a position you're willing to be wrong about, stated plainly.</p>
    <p>"Genuinely undetermined" is a legitimate answer and sometimes the honest one. But it only counts as thinking if the action you pair it with keeps both branches alive. Undetermined plus an irreversible action isn't caution — it's a guess wearing a hedge.</p>`,
  action: `<p><b>What we're looking for:</b> one action, because in a real hour you get one.</p>
    <p>We're not watching which option you pick. Every one of these has been the right call in a real incident somewhere. We're watching the <b>order</b> you take them in across the three moments — specifically whether the things you can't take back come before or after the things you can.</p>
    <p>The reversible / irreversible tag on each option is doing real work. Read it.</p>`,
  tripwire: `<p><b>What we're looking for:</b> something specific enough that you'd recognise it the moment it happened, and that could actually happen in the next day or two.</p>
    <p>Most people write a tripwire that can never fire, because it asks for proof rather than for a signal. Here's the difference, using a completely different situation so it doesn't tip you off about this one:</p>
    <div class="ex bad"><span class="tag">Can never fire</span>"If I get evidence the supplier is in trouble."</div>
    <div class="ex good"><span class="tag">Will fire, or won't</span>"If their Q3 shipment slips more than a week without them raising it first."</div>
    <p>The strongest tripwires name a <b>person</b> rather than a system: what would you need to hear from someone that <b>costs them something to say</b>? People are the sensor that fires earliest, and the one nobody thinks to install.</p>`
};

function guideBlock(key) {
  return `<div class="guide" id="g-${key}" style="display:none">${GUIDE[key]}</div>`;
}
function labelRow(key, text) {
  return `<div class="lblrow"><label>${text}</label><button class="ibtn" data-g="${key}" type="button" aria-label="What's expected here">i</button></div>`;
}

function openCommit() {
  S.draft = { reading: null, action: null, tripwire: '' };
  const ph = PHASES[S.phase];
  const first = S.positions.length === 0;
  const sheet = el(`<div class="scrim"><div class="sheet">
    <div class="eyebrow">${esc(ph.label)} · ${esc(ph.day)} ${esc(ph.clock)}</div>
    <div class="lblrow" style="margin:7px 0 8px">
      <h2 style="margin:0">Record your position</h2>
      <button class="ibtn ${first ? 'on' : ''}" data-g="what" type="button" aria-label="What is this">i</button>
    </div>
    <p class="lede">Three things, and the third one matters most.</p>
    <div style="border-left:2px solid var(--amber);padding:9px 13px;margin:0 0 20px;background:rgba(240,166,60,.06);font-size:13.5px;line-height:1.55;color:#D8D4CA">
      This locks when you submit, and it <b>moves the incident forward</b> — you won't be able to question anyone about this moment again. Finish on the bridge before you commit.
    </div>
    <div class="guide" id="g-what" style="display:${first ? 'block' : 'none'}">${GUIDE.what}</div>

    <div class="field">
      ${labelRow('reading', 'What you think is happening')}
      ${guideBlock('reading')}
      <div class="opts" id="f-read">${READINGS.map(r =>
        `<button class="opt" data-r="${r.id}"><span class="dot"></span><span class="ol">${esc(r.label)}</span></button>`).join('')}</div>
    </div>

    <div class="field">
      ${labelRow('action', 'The one action you take now')}
      ${guideBlock('action')}
      <div class="help">Every option here is defensible. They differ in whether you can take them back.</div>
      <div class="opts" id="f-act">${ACTIONS.map(a =>
        `<button class="opt" data-a="${a.id}"><span class="dot"></span><span>
          <span class="ol">${esc(a.label)}<span class="rev ${a.reversibility === 'reversible' ? 'r' : 'i'}">${a.reversibility}</span></span>
          <span class="on2">${esc(a.note)}</span></span></button>`).join('')}</div>
    </div>

    <div class="field">
      ${labelRow('tripwire', 'What would change your mind')}
      ${guideBlock('tripwire')}
      <div class="help">One sentence. Be specific enough that you'd know it when you saw it.</div>
      <textarea class="tw" id="f-tw" placeholder="I would change my reading if…"></textarea>
    </div>

    <div class="sheet-foot">
      <button class="btn" id="c-cancel">Not yet</button>
      <button class="btn pri" id="c-save">Lock it in &amp; move on</button>
    </div>
  </div></div>`);
  document.body.appendChild(sheet);

  sheet.querySelectorAll('.ibtn').forEach(b => b.onclick = () => {
    const g = sheet.querySelector('#g-' + b.dataset.g);
    const open = g.style.display !== 'none';
    g.style.display = open ? 'none' : 'block';
    b.classList.toggle('on', !open);
  });
  sheet.querySelectorAll('#f-read .opt').forEach(b => b.onclick = () => {
    S.draft.reading = b.dataset.r;
    sheet.querySelectorAll('#f-read .opt').forEach(x => x.classList.toggle('on', x === b));
  });
  sheet.querySelectorAll('#f-act .opt').forEach(b => b.onclick = () => {
    S.draft.action = b.dataset.a;
    sheet.querySelectorAll('#f-act .opt').forEach(x => x.classList.toggle('on', x === b));
  });
  sheet.querySelector('#c-cancel').onclick = () => sheet.remove();
  sheet.querySelector('#c-save').onclick = () => {
    const tw = sheet.querySelector('#f-tw').value.trim();
    if (!S.draft.reading || !S.draft.action || tw.length < 8) {
      const f = sheet.querySelector('.sheet-foot');
      if (!f.querySelector('.warn')) f.insertAdjacentHTML('afterbegin',
        '<span class="warn" style="color:var(--devin);font-size:13px;margin-right:auto;align-self:center">All three, including the tripwire.</span>');
      return;
    }
    S.positions.push({ phase: S.phase, reading: S.draft.reading, action: S.draft.action, tripwire: tw });
    if (S.draft.action === 'preserve' && S.preservedAt === null) { S.preserved = true; S.preservedAt = S.phase; }
    if (S.draft.action === 'rollback') S.rolledBack = true;
    sheet.remove();
    advance();
  };
}

// The action route sets the flag directly. This covers the other way in:
// telling someone, in conversation, to stop the job.
async function classifyHold() {
  if (S.phase > 1 || S.preserved) return;
  const threads = {};
  CAST_ORDER.forEach(id => { if ((S.threads[id] || []).length) threads[id] = S.threads[id]; });
  try {
    const d = await api('/api/classify', { phase: S.phase, room: S.threads.room, threads });
    if (d.held) {
      S.preserved = true;
      S.preservedByTalk = true;
      S.preservedQuote = d.quote || '';
      if (S.preservedAt === null) S.preservedAt = S.phase;
    }
  } catch (e) { /* the run continues; scene state simply stays as it was */ }
}

async function advance() {
  if (S.phase >= PHASES.length - 1) {
    await classifyHold();
    pushPosition(true);
    if (inSession() && SESSION.holdReveal && !SESSION.revealed) { S.screen = 'held'; render(); return; }
    S.screen = 'debrief'; render(); loadDebrief(); return;
  }
  await classifyHold();
  S.phase++;
  S.channel = 'room';
  pushPosition(false);
  await seedPhase();
  render();
}

async function seedPhase() {
  const ph = await loadScene(S.phase);
  S.pending = (ph.beats || []).slice();
  S.playing = true;
  S.skip = false;
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

async function runBeats() {
  if (!S.playing) return;
  while (S.pending.length) {
    const b = S.pending.shift();
    if (S.skip || REDUCED) {
      push('room', b.who, b.text);
      appendLive(b);
      continue;
    }
    if (b.who !== 'system' && b.who !== 'you') {
      showTyping(b.who);
      // longer lines take longer to "type", capped so nobody waits around
      await wait(Math.min(2200, 700 + b.text.length * 9));
      clearTyping();
    } else {
      await wait(500);
    }
    push('room', b.who, b.text);
    appendLive(b);
    await wait(450);
  }
  clearTyping();
  S.playing = false;
  S.skip = false;
  render();
}

// ---------- transcript export ----------
function buildTranscript() {
  const L = [];
  L.push('RAPID SIM 02 — WHAT DID IT TELL THEM?');
  L.push('Calder Sealing Systems · run exported ' + new Date().toISOString());
  L.push('Characters: ' + (OFFLINE ? 'scripted fallback' : 'live'));
  L.push('');
  L.push('='.repeat(60));
  L.push('INCIDENT BRIDGE');
  L.push('='.repeat(60));
  S.threads.room.forEach(m => {
    if (m.who === 'system') L.push('\n-- ' + m.text + ' --\n');
    else L.push((m.who === 'you' ? 'VP OF CUSTOMER OPERATIONS' : nameOf(m.who).toUpperCase()) + ': ' + m.text + '\n');
  });
  CAST_ORDER.forEach(id => {
    if (!S.threads[id].length) return;
    L.push('');
    L.push('='.repeat(60));
    L.push('PRIVATE — ' + CAST[id].name.toUpperCase() + ' (the room could not hear this)');
    L.push('='.repeat(60));
    S.threads[id].forEach(m => {
      if (m.who === 'system') return;
      L.push((m.who === 'you' ? 'VP OF CUSTOMER OPERATIONS' : nameOf(m.who).toUpperCase()) + ': ' + m.text + '\n');
    });
  });
  L.push('');
  L.push('='.repeat(60));
  L.push('POSITIONS RECORDED');
  L.push('='.repeat(60));
  S.positions.forEach(p => {
    const a = ACTIONS.find(x => x.id === p.action), r = READINGS.find(x => x.id === p.reading);
    L.push('');
    L.push(PHASES[p.phase].label + ' · ' + PHASES[p.phase].day + ' ' + PHASES[p.phase].clock);
    L.push('  Read:     ' + r.label);
    L.push('  Did:      ' + a.label + '  [' + a.reversibility + ']');
    L.push('  Tripwire: ' + p.tripwire);
  });
  L.push('');
  L.push('Threshold disclosure obtained: ' + (S.ladderEarnedAt === null ? 'never'
    : PHASES[S.ladderEarnedAt].label + (S.ladderEarnedPrivately ? ' (privately)' : ' (in the room)')));
  L.push('Index state preserved: ' + (S.preservedAt === null ? 'no'
    : PHASES[S.preservedAt].label + (S.preservedByTalk ? ' (instructed in conversation)' : ' (recorded as an action)')));
  if (S.preservedQuote) L.push('  on the strength of: "' + S.preservedQuote + '"');
  L.push('Private conversations opened: ' + Object.keys(S.privateOpened).length);
  return L.join('\n');
}

function downloadTranscript() {
  const blob = new Blob([buildTranscript()], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rapid-sim-02-transcript.txt';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}



// ---------- facilitated session ----------
const SESSION = {
  code: (location.search.match(/[?&]s=([A-Za-z0-9]+)/) || [])[1] || null,
  participantId: null,
  name: null,
  groupId: null,
  mates: [],
  state: null,       // lobby | running | closed
  paused: false,
  revealed: false,
  holdReveal: true,
  poll: null
};
const inSession = () => !!SESSION.code;

async function sessionApi(payload) {
  return api('/api/session', Object.assign({ code: SESSION.code }, payload));
}

async function sessionPoll() {
  if (!inSession() || !SESSION.participantId) return;
  try {
    const d = await sessionApi({ action: 'state', participantId: SESSION.participantId });
    const wasPaused = SESSION.paused, wasState = SESSION.state, wasRevealed = SESSION.revealed;
    SESSION.state = d.session.state;
    SESSION.paused = d.session.paused;
    SESSION.revealed = d.session.revealed;
    SESSION.holdReveal = d.session.holdReveal;
    if (d.me) { SESSION.groupId = d.me.groupId; }
    SESSION.mates = d.mates || [];
    // re-render on any state change that affects what the student sees
    if (SESSION.paused !== wasPaused || SESSION.state !== wasState || SESSION.revealed !== wasRevealed) render();
    if (S.screen === 'lobby' && SESSION.state === 'running' && SESSION.groupId) {
      S.screen = 'brief'; S.briefStep = 0; render();
    }
  } catch (e) { /* transient — keep playing */ }
}

async function pushPosition(done) {
  if (!inSession() || !SESSION.groupId) return;
  try {
    await sessionApi({
      action: 'submit', groupId: SESSION.groupId, participantId: SESSION.participantId,
      positions: S.positions, phase: S.phase, done: !!done,
      ladderEarnedAt: S.ladderEarnedAt, privateCount: Object.keys(S.privateOpened).length
    });
  } catch (e) { /* the run continues regardless */ }
}

function renderJoin() {
  app.innerHTML = `<div class="doc"><div class="doc-in">
    <div class="eyebrow">Session ${esc(SESSION.code)}</div>
    <h1>Join the <em>session</em></h1>
    <p>Type the name your facilitator will recognise. If you're working as a group on one screen, put all your names in — you'll be listed together.</p>
    <div style="display:flex;gap:9px;flex-wrap:wrap;margin:22px 0 8px">
      <input id="jn" type="text" placeholder="e.g. Anita, Marcus and Lee"
        style="flex:1;min-width:240px;background:var(--night);border:1px solid var(--line2);padding:12px 14px;font-size:15px;font-family:var(--serif)">
      <button class="btn pri" id="jgo" style="padding:12px 24px">Join</button>
    </div>
    <div id="jerr" style="color:var(--alert);font-size:14px"></div>
    <p style="color:var(--dimmer);font-size:14px;margin-top:18px">While the session runs we hold your name, which group you are in, and how far you have got. Nothing else, and the whole session deletes itself after two days.</p>
  </div></div>`;
  const go = async () => {
    const n = document.getElementById('jn').value.trim();
    if (!n) return;
    const b = document.getElementById('jgo'); b.disabled = true; b.textContent = 'Joining…';
    try {
      const d = await sessionApi({ action: 'join', name: n, participantId: SESSION.participantId });
      SESSION.participantId = d.participantId;
      SESSION.name = n;
      S.screen = 'lobby';
      render();
      if (!SESSION.poll) SESSION.poll = setInterval(sessionPoll, 4000);
      sessionPoll();
    } catch (e) {
      document.getElementById('jerr').textContent =
        (e.message || '').includes('no_such_session') ? "That session code isn't live. Check with your facilitator." : (LAST_ERROR || e.message);
      b.disabled = false; b.textContent = 'Join';
    }
  };
  document.getElementById('jgo').onclick = go;
  document.getElementById('jn').onkeydown = e => { if (e.key === 'Enter') go(); };
  document.getElementById('jn').focus();
}

function renderLobby() {
  const grouped = !!SESSION.groupId;
  app.innerHTML = `<div class="doc"><div class="doc-in">
    <div class="eyebrow">Session ${esc(SESSION.code)} · you're in</div>
    <h1>${grouped ? esc(SESSION.groupId) : 'Waiting for the room'}</h1>
    ${grouped
      ? `<p>You're with <b>${esc(SESSION.mates.join(', ') || SESSION.name)}</b>. One screen between you — whoever is driving should keep this tab open and not reload it.</p>
         <p>The incident starts when your facilitator starts it.</p>`
      : `<p>You're joined as <b>${esc(SESSION.name)}</b>. Your facilitator is still putting people into groups.</p>`}
    <p style="color:var(--dimmer);font-size:14px;margin-top:22px">Don't close or reload this tab — there's no save, and reloading loses your run.</p>
  </div></div>`;
}

function renderHeld() {
  app.innerHTML = `<div class="doc"><div class="doc-in">
    <div class="eyebrow">Day 2 · positions locked</div>
    <h1>That's your <em>three</em>.</h1>
    <p>You've committed to everything you're going to commit to. Your facilitator is holding the debrief until the room has talked — which is deliberate, because the conversation is better while nobody knows who was right.</p>
    <p>While you wait: what's the one question you wish you'd asked, and who would you have asked it of?</p>
    <p style="color:var(--dimmer);font-size:14px;margin-top:26px">This page will move on by itself. Don't reload it.</p>
  </div></div>`;
}

function renderPausedOverlay() {
  if (document.getElementById('pausebar')) return;
  const bar = el(`<div id="pausebar" style="position:fixed;inset:0;z-index:70;background:rgba(6,10,18,.9);display:grid;place-items:center;padding:24px">
    <div style="max-width:460px;text-align:center">
      <div class="eyebrow" style="margin-bottom:10px">The facilitator has frozen the clock</div>
      <div style="font-size:30px;font-weight:300;letter-spacing:-.02em;margin-bottom:12px">Hold on.</div>
      <p style="color:#CFCCC4;font-size:16px;line-height:1.6">Nothing is lost and the incident hasn't moved. Talk to the room — this will lift on its own.</p>
    </div>
  </div>`);
  document.body.appendChild(bar);
}
function clearPausedOverlay() { const b = document.getElementById('pausebar'); if (b) b.remove(); }

// ---------- help: mechanics only ----------
const FAQ = [
  ['Am I choosing from those example questions?',
   'No. The box takes anything you type. The examples underneath are only there if you\'re stuck — your own words usually get better answers.'],
  ['How do I talk to someone privately?',
   'Click their name in the room panel on the left. That opens a one-to-one the rest of the room can\'t hear, and people say different things there. Use the link at the top to come back.'],
  ['What happens when I record a position?',
   'It locks, and the incident moves to the next moment. You can\'t come back to this hour or edit what you wrote, so ask everything you want to ask first.'],
  ['When should I record it, then?',
   'When you\'ve stopped learning things — not when you feel certain. Certainty isn\'t coming, and those parts are in service while you wait for it.'],
  ['What does reversible mean?',
   'An action you could undo, or that only costs you time. Irreversible ones can\'t be taken back. Which you pick matters less than the order you do them in.'],
  ['Can I come back to this later?',
   'No. There\'s no save — closing or reloading the tab loses the run. At the end you can download a transcript of everything.']
];

function openHelp() {
  if (document.querySelector('.scrim.help')) return;
  const sheet = el(`<div class="scrim help"><div class="sheet" style="max-width:600px">
    <div class="eyebrow">How this works</div>
    <h2>Questions about the exercise</h2>
    <p class="lede">This answers questions about how the sim works. It knows nothing about the incident itself — for that, ask the people on the bridge.</p>
    <div id="faq">${FAQ.map((f, i) => `<button class="faq-q" data-i="${i}">${esc(f[0])}</button>`).join('')}</div>
    <div id="faq-a" class="faq-a" style="display:none"></div>
    <div class="field" style="margin-top:22px;margin-bottom:8px">
      <label>Something else</label>
      <div style="display:flex;gap:8px">
        <input id="hq" type="text" placeholder="Ask about how the exercise works…"
          style="flex:1;background:var(--night);border:1px solid var(--line2);padding:10px 12px;font-size:14px;font-family:var(--serif)">
        <button class="btn pri" id="hgo">Ask</button>
      </div>
      <div id="hans" class="faq-a" style="display:none;margin-top:11px"></div>
    </div>
    <div class="sheet-foot"><button class="btn" id="hclose">Back to the bridge</button></div>
  </div></div>`);
  document.body.appendChild(sheet);

  const ansBox = sheet.querySelector('#faq-a');
  sheet.querySelectorAll('.faq-q').forEach(b => b.onclick = () => {
    sheet.querySelectorAll('.faq-q').forEach(x => x.classList.toggle('on', x === b));
    ansBox.style.display = 'block';
    ansBox.textContent = FAQ[+b.dataset.i][1];
  });
  sheet.querySelector('#hclose').onclick = () => sheet.remove();

  const ask = async () => {
    const inp = sheet.querySelector('#hq');
    const q = inp.value.trim();
    if (!q) return;
    const out = sheet.querySelector('#hans');
    const btn = sheet.querySelector('#hgo');
    btn.disabled = true; btn.textContent = '…';
    out.style.display = 'block';
    out.textContent = 'Thinking…';
    try {
      const d = await api('/api/help', { question: q });
      out.textContent = d.text || '';
    } catch (e) {
      out.textContent = "Couldn't reach the help service. Try one of the questions above.";
    }
    btn.disabled = false; btn.textContent = 'Ask';
  };
  sheet.querySelector('#hgo').onclick = ask;
  sheet.querySelector('#hq').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); ask(); } };
  sheet.querySelector('#hq').focus();
}

function mountHelp() {
  if (document.getElementById('helpbtn')) return;
  const b = el(`<button id="helpbtn" aria-label="How this works" title="How this works" style="
    position:fixed;top:11px;right:49px;z-index:55;width:30px;height:30px;
    border:1px solid var(--line2);background:rgba(14,21,36,.85);color:var(--dim);
    font-family:var(--mono);font-size:13px;line-height:1;display:grid;place-items:center">?</button>`);
  document.body.appendChild(b);
  b.onclick = openHelp;
}

// ---------- settings ----------
function connStatus() {
  if (OFFLINE) return { t: 'Scripted', c: 'var(--alert)' };
  return { t: 'Live', c: 'var(--sys)' };
}

function mountSettings() {
  if (document.getElementById('cog')) return;
  const cog = el(`<button id="cog" aria-label="Settings" style="
    position:fixed;top:11px;right:13px;z-index:55;width:30px;height:30px;
    border:1px solid var(--line2);background:rgba(14,21,36,.85);color:var(--dim);
    font-family:var(--mono);font-size:13px;line-height:1;display:grid;place-items:center">⚙</button>`);
  document.body.appendChild(cog);
  cog.onclick = openSettings;
  refreshCog();
}

function refreshCog() {
  const cog = document.getElementById('cog');
  if (!cog) return;
  const s = connStatus();
  cog.style.borderColor = OFFLINE ? 'var(--alert)' : 'var(--line2)';
  cog.style.color = OFFLINE ? 'var(--alert)' : 'var(--dim)';
  cog.title = 'Settings · characters: ' + s.t;
}

function openSettings() {
  if (document.querySelector('.scrim.settings')) return;
  const s = connStatus();
  const sheet = el(`<div class="scrim settings"><div class="sheet" style="max-width:560px">
    <div class="eyebrow">Settings</div>
    <h2>Characters</h2>
    <p class="lede">The four people on the bridge are generated live on the server. If it can't be reached, they fall back to a small bank of prepared lines — the sim still runs through, but they can't answer anything unanticipated.</p>

    <div class="field">
      <label>Status</label>
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:9px">
        <span style="width:8px;height:8px;border-radius:50%;background:${s.c};flex:none"></span>
        <span style="font-family:var(--mono);font-size:12.5px;color:${s.c};letter-spacing:.06em">${s.t}</span>
      </div>
      ${LAST_ERROR ? `<div style="font-family:var(--mono);font-size:11px;color:var(--dimmer);line-height:1.55;border-left:2px solid var(--line2);padding-left:11px">${esc(LAST_ERROR)}</div>` : ''}
    </div>

    <div class="field">
      ${labelRow('code', 'Access code')}
      <div class="guide" id="g-code" style="display:none">
        <p>If this sim was hosted for you, you were given a code. It's checked on the server; the API key stays there and never reaches your browser.</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input id="ac" type="text" placeholder="access code" value="${esc(ACCESS_CODE || '')}"
          style="flex:1;min-width:180px;background:var(--night);border:1px solid var(--line2);padding:10px 12px;font-family:var(--mono);font-size:12px">
        <button class="btn pri" id="ac-go">Use code</button>
      </div>
      <div id="sk-msg" style="font-size:13px;margin-top:9px;line-height:1.5"></div>
    </div>

    <div class="sheet-foot">
      <button class="btn" id="sk-export" style="margin-right:auto">Export transcript</button>
      <button class="btn" id="sk-scripted">Force scripted mode</button>
      <button class="btn" id="sk-close">Close</button>
    </div>
  </div></div>`);
  document.body.appendChild(sheet);

  sheet.querySelectorAll('.ibtn').forEach(b => b.onclick = () => {
    const g = sheet.querySelector('#g-' + b.dataset.g);
    const open = g.style.display !== 'none';
    g.style.display = open ? 'none' : 'block';
    b.classList.toggle('on', !open);
  });
  sheet.querySelector('#sk-close').onclick = () => sheet.remove();
  sheet.querySelector('#sk-export').onclick = downloadTranscript;
  sheet.querySelector('#ac-go').onclick = async () => {
    const v = sheet.querySelector('#ac').value.trim();
    ACCESS_CODE = v || null;
    const b = sheet.querySelector('#ac-go'); b.textContent = 'Checking…'; b.disabled = true;
    const say = (t, c) => { const m = sheet.querySelector('#sk-msg'); if (m) { m.textContent = t; m.style.color = c; } };
    say('', 'var(--dim)');
    try {
      await api('/api/scene', { init: true });
      OFFLINE = false; LAST_ERROR = null; NEEDS_CODE = false;
      const bar = document.getElementById('keybar'); if (bar) bar.remove();
      say('Connected. The characters are live.', 'var(--sys)');
      refreshCog();
      if (!CAST_ORDER.length) { await loadInit(); sheet.remove(); render(); }
    } catch (e) {
      say(LAST_ERROR || 'Failed.', 'var(--alert)');
    }
    b.textContent = 'Use code'; b.disabled = false;
  };
  sheet.querySelector('#sk-scripted').onclick = () => { goOffline(true); sheet.remove(); refreshCog(); };
}

// ---------- opening: story → the room → the rules ----------
function topOfDoc(){ const d = app.querySelector('.doc'); if (d) d.scrollTop = 0; }

function renderBrief() {
  const step = S.briefStep || 0;
  if (step === 0) return briefStory();
  if (step === 1) return briefRoom();
  return briefRules();
}

function briefStory() {
  app.innerHTML = `<div class="doc"><div class="doc-in">
    <div class="eyebrow">Flexee RapidSim 02 · about twenty minutes</div>
    <h1>What did it <em>tell</em> them?</h1>
    <p>Calder Sealing Systems makes high-temperature gaskets and seals for industrial equipment — about three hundred customers, most of them building machinery that runs hot and can't leak. Nine months ago Calder put an AI assistant called Relay in front of inbound customer technical questions. It answers what it can and passes the rest to an application engineer.</p>
    <p><b>You are the VP of Customer Operations.</b> Relay reports to you. So does the decision at the end of this.</p>
    <p>Here's how this morning arrived.</p>

    <div class="tl">
      <div class="tl-row"><div class="tl-time">6 weeks ago</div><div class="tl-text">An engineer at Ridgeline Compression asks Relay whether the CS-7400 will hold at continuous service temperature. Relay answers <b>260°C</b>, in writing, in about four seconds. Nobody at Calder ever sees the exchange, which is the entire point of having it.</div></div>
      <div class="tl-row"><div class="tl-time">Since</div><div class="tl-text">Ridgeline builds the seal into gas compression packages and ships them to their own customers. The published continuous rating on the current datasheet is <b>230°C</b>.</div></div>
      <div class="tl-row"><div class="tl-time">08:20</div><div class="tl-text">Ridgeline's engineer emails the Relay transcript to his account manager with one line above it: <b>"Is this number right?"</b> It is not.</div></div>
      <div class="tl-row now"><div class="tl-time">09:40</div><div class="tl-text">You join a call that started forty minutes ago, where four people already have opinions, and where the first thing you'll be asked is what to tell the customer.</div></div>
    </div>

    <p>You are walking in on the middle of something. That's not an accident of the design — it's the job. Almost nobody senior arrives at the start, and the assumptions the room made in the first forty minutes are the ones you'll have to notice and undo.</p>

    <div class="center"><button class="btn pri" id="nx" style="padding:13px 28px">Who's on the call →</button></div>
  </div></div>`;
  document.getElementById('nx').onclick = () => { S.briefStep = 1; render(); topOfDoc(); };
}

function briefRoom() {
  const cards = CAST_ORDER.map(id => {
    const c = CAST[id], x = CAST_INTRO[id];
    return `<div class="castcard">
      <div class="ch">
        <div class="av" style="color:${c.hue};border-color:${c.hue}55">${c.initials}</div>
        <div><div class="cn">${c.name}</div><div class="cr">${c.role}</div></div>
      </div>
      <div class="cw">${x.why}</div>
      <div class="expo">
        <div class="track"></div>
        <div class="bar hw" style="width:${c.exposure.content / 2}%"></div>
        <div class="bar br" style="width:${c.exposure.supervision / 2}%"></div>
        <div class="mid"></div>
      </div>
      <div class="expo-key"><span>Stale document</span><span>Not escalated</span></div>
      <div class="cl">${x.lose}</div>
    </div>`;
  }).join('');

  app.innerHTML = `<div class="doc"><div class="doc-in">
    <div class="eyebrow">09:40 · four people already talking</div>
    <h1>The room</h1>
    <p>Everyone here is competent and nobody is lying to you. Read what each of them stands to lose, because it's going to shape what they tell you this morning — and it will do that without any of them noticing it happening.</p>
    <div class="castgrid">${cards}</div>
    <p>There's a fifth voice: <b>Alan Voss</b>, the Chief Commercial Officer, who owns the customer relationship and has Ridgeline's commercial lead waiting on a call. He makes no technical decision. He wants one sentence he can say.</p>
    <div class="center"><button class="btn pri" id="nx" style="padding:13px 28px">One more thing before you join →</button></div>
  </div></div>`;
  document.getElementById('nx').onclick = () => { S.briefStep = 2; render(); topOfDoc(); };
}

function briefRules() {
  app.innerHTML = `<div class="doc"><div class="doc-in">
    <div class="eyebrow">The thing you're actually being tested on</div>
    <h1>Two stories, and each one <em>blames</em> somebody</h1>
    <p>By the time you join, one explanation is already in the room. A superseded revision of the datasheet is still sitting in the document library, so Relay retrieved a real number from a real document and reported it accurately. That story ends this evening with a re-index.</p>
    <p>The other explanation is that the question should never have gone to Relay at all. A continuous rating question is exactly the kind of thing an application engineer used to answer, and at some point it stopped reaching one. That story has a governance conversation attached to it.</p>
    <p>Each explanation indicts a different person on that call. You just read who. So you'll be taking expert judgment from two people whose exposure runs in opposite directions, and both of them will find the reading that doesn't end with their name on it more persuasive than they otherwise would. That isn't a character flaw. It's what happens to anyone under threat, and it will happen to you too.</p>
    <p><b>And the fastest fix destroys the evidence.</b> Relay searches an index that's rebuilt from the library on a schedule. Correct the library, and what Relay was actually serving six weeks ago stops existing — at the same moment a customer's lawyer starts asking what your system told their engineer. Meanwhile every hour you wait is another hour of parts going into service against a number you now know is wrong.</p>
    <p>We're telling you upfront because this isn't a test of whether you notice. It's a test of what you do about it. One warning: discounting for interest is not the same as ignoring the interested party. The person with the most to lose may still be right, and dismissing them for being exposed is its own way of getting this wrong.</p>

    <h3>How it runs</h3>
    <p>Three moments — Hour 1, Hour 7, and the following morning. Between them you can question anyone on the call, and you can pull any of them aside into a private channel the others can't hear. Nobody in that room knows the full answer, because at Hour 1 nobody would.</p>
    <p>At each moment you record a position: <b>what you think is happening</b>, <b>the one action you're taking now</b>, and <b>the evidence that would change your mind</b>. Ask everything you want to ask before you do it, because recording moves things forward and you can't return to that hour. All three come back to you at the end.</p>
    <p>So when do you commit? Not when you feel certain — certainty isn't coming, and you can wait all day for it while parts ship. Commit when you've stopped learning things. If the last two answers haven't changed your read, you have what this hour is going to give you.</p>

    <div class="center"><button class="btn pri" id="go" style="padding:14px 30px">Join the call · 09:40</button></div>
  </div></div>`;
  document.getElementById('go').onclick = async () => {
    const btn = document.getElementById('go');
    btn.textContent = 'Connecting…'; btn.disabled = true;
    try {
      await seedPhase();
      S.screen = 'play'; S.phase = 0; render(); topOfDoc();
    } catch (e) {
      btn.textContent = 'Join the call · 09:40'; btn.disabled = false;
      showBanner();
    }
  };
}


// ---------- debrief ----------
// The resolution, the verdicts and the fork all come from the server. Nothing
// about the ending exists in this file.
function renderDebrief(D) {
  if (!D) {
    app.innerHTML = `<div class="doc"><div class="doc-in">
      <div class="eyebrow">Debrief</div><h1>Working out how that went…</h1>
      <p>Reading back your three positions against what actually arrived. This takes a few seconds.</p>
    </div></div>`;
    return;
  }
  const rows = S.positions.map(p => {
    const ph = PHASES[p.phase];
    const act = ACTIONS.find(a => a.id === p.action);
    const rd = READINGS.find(r => r.id === p.reading);
    const v = (D.verdicts || []).find(x => x.phase === p.phase);
    return `<div class="card">
      <div class="ct">${esc(ph.label)} · ${esc(ph.day)} ${esc(ph.clock)}</div>
      <p><b>Read:</b> ${esc(rd.label)}</p>
      <p><b>Did:</b> ${esc(act.label)} <span class="rev ${act.reversibility === 'reversible' ? 'r' : 'i'}">${act.reversibility}</span></p>
      <p><b>Tripwire:</b> <em>${esc(p.tripwire)}</em></p>
      ${v && v.verdict ? `<div class="verdict ${v.ok ? 'ok' : ''}">${esc(v.verdict)}</div>` : ''}
    </div>`;
  }).join('');

  const path = D.fork.path, C = D.fork.cells;
  const priv = D.privateCount;

  app.innerHTML = `<div class="doc"><div class="doc-in">
    <div class="eyebrow">Debrief · hold until the room has committed</div>
    <h1>${D.resolution.headline}</h1>
    ${D.resolution.paras.map(t => `<p>${esc(t)}</p>`).join('')}

    <div class="rule"></div>
    <h3>What you committed to</h3>
    ${rows}

    <div class="rule"></div>
    <h3>Where your first two moves landed you</h3>
    <p>You took ${path === 'irreversible' ? 'an irreversible action before Day 2' : 'only reversible actions until you knew more'}. Here is that choice against both worlds — the one you were in, and the one you couldn't rule out.</p>
    <div class="fork">
      <div class="cell ${path === 'reversible' ? 'ghost' : ''}"><h4>Reversible first · document only</h4><p>${esc(C.reversible.content)}</p></div>
      <div class="cell ${path === 'reversible' ? 'hit' : ''}"><h4>Reversible first · both true ${path === 'reversible' ? '· what happened' : ''}</h4><p>${esc(C.reversible.both)}</p></div>
      <div class="cell ${path === 'irreversible' ? 'ghost' : ''}"><h4>Acted early · document only</h4><p>${esc(C.irreversible.content)}</p></div>
      <div class="cell ${path === 'irreversible' ? 'hit' : ''}"><h4>Acted early · both true ${path === 'irreversible' ? '· what happened' : ''}</h4><p>${esc(C.irreversible.both)}</p></div>
    </div>
    <p>The amber cell is the world you were actually in. The one beside it, outlined, is the luck you didn't get — same decision, different world. Only the top row survives both columns, and that's the whole lesson. It isn't about datasheets.</p>

    <div class="rule"></div>
    <h3>The sentence that decided it</h3>
    <p>${esc(D.ladder.intro || '')}</p>
    <p class="verdict ${D.ladder.tone}" style="font-size:15.5px">${esc(D.ladder.text)}</p>
    <div class="rule"></div>
    <h3>The clock nobody mentioned</h3>
    <p>${esc(D.preservation.intro || '')}</p>
    <p class="verdict ${D.preservation.tone}" style="font-size:15.5px">${esc(D.preservation.text)}</p>
    <p>${priv
      ? `You went off the call ${priv === 1 ? 'once' : priv === 2 ? 'twice' : priv + ' times'}. People say different things when the room isn't listening, and knowing when to take someone off the bridge is most of this job.`
      : 'You never took anyone aside. Everything you heard, you heard in front of the people it would cost. That is the single cheapest thing you left on the table.'}</p>

    ${D.arc ? `<div class="rule"></div><h3>Taken together</h3><p>${esc(D.arc)}</p>` : ''}

    <div class="rule"></div>
    <h3>Carry this forward</h3>
    <p>Download the transcript before you close this. It has everything said today, including whatever you got out of people privately, and your three positions in your own words. That's the thing worth keeping — not because anyone will collect it, but because reading your first position back in a fortnight is a different experience from remembering it.</p>
    <p>The transferable part isn't about any of this one's specifics. It's that when you receive expert judgment from someone with a stake in the conclusion, you don't discard it and you don't swallow it — you ask what they'd have to say that costs them, and you sequence your own actions so the ones you can't take back come last.</p>

    <div class="center" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
      <button class="btn pri" id="dl" style="padding:13px 26px">Download your transcript</button>
      <button class="btn" id="again" style="padding:13px 26px">Run it again</button>
    </div>
    <p style="text-align:center;font-size:13px;color:var(--dimmer);margin-top:14px">Everything said, including the private conversations, plus your three positions. Nothing is kept once you close this page.</p>
  </div></div>`;
  document.getElementById('again').onclick = () => location.reload();
  document.getElementById('dl').onclick = downloadTranscript;
}

async function loadDebrief() {
  try {
    const d = await api('/api/debrief', {
      positions: S.positions,
      ladderEarnedAt: S.ladderEarnedAt,
      ladderPrivate: S.ladderEarnedPrivately,
      preserved: S.preserved, preservedAt: S.preservedAt, rolledBack: S.rolledBack,
      preservedByTalk: S.preservedByTalk, preservedQuote: S.preservedQuote,
      privateCount: Object.keys(S.privateOpened).length
    });
    S.debrief = d;
    renderDebrief(d);
  } catch (e) {
    showBanner();
    app.innerHTML = `<div class="doc"><div class="doc-in">
      <div class="eyebrow">Debrief</div><h1>Couldn't reach the server</h1>
      <p>Your three positions are still here and you can download them. Reload and the debrief should come through.</p>
      <div class="center"><button class="btn pri" id="dl" style="padding:13px 26px">Download your transcript</button></div>
    </div></div>`;
    const d2 = document.getElementById('dl'); if (d2) d2.onclick = downloadTranscript;
  }
}

mountSettings();
mountHelp();

(async function boot() {
  // A facilitator arrives either to play it themselves or to run a session with
  // a class. The platform says which; only the second belongs in the console.
  if (LAUNCH && (LAUNCH.role === 'faculty' || LAUNCH.role === 'faculty_preview')
      && LAUNCH.mode === 'session') {
    location.replace(BASE + '/faculty.html?lt=' + encodeURIComponent(LAUNCH_TOKEN));
    return;
  }
  app.innerHTML = `<div class="doc"><div class="doc-in">
    <div class="eyebrow">Flexee RapidSim 02</div>
    <h1>What did it <em>tell them</em>?</h1>
    <p style="color:var(--dimmer)">Opening the bridge…</p>
  </div></div>`;
  try {
    await loadInit();
    if (inSession()) {
      S.screen = 'join';
      render();
      if (!SESSION.poll) SESSION.poll = setInterval(sessionPoll, 4000);
    } else {
      render();
    }
  } catch (e) {
    showBanner();
    app.innerHTML = BAD_LAUNCH
      ? `<div class="doc"><div class="doc-in">
          <div class="eyebrow">Flexee RapidSim 02</div>
          <h1>That link wasn't <em>accepted</em></h1>
          <p>${esc(LAST_ERROR || '')}</p>
          <p style="color:var(--dimmer);font-size:14px">Nothing is lost — go back to your course and press Start again.</p>
        </div></div>`
      : NEEDS_CODE
      ? `<div class="doc"><div class="doc-in">
          <div class="eyebrow">Flexee RapidSim 02</div>
          <h1>You'll need an <em>access code</em></h1>
          <p>Your instructor was given one. Enter it at the bottom of this page and the sim will start.</p>
          <p style="color:var(--dimmer);font-size:14px">Nothing is wrong — this just isn't open to the public.</p>
        </div></div>`
      : `<div class="doc"><div class="doc-in">
          <div class="eyebrow">Flexee RapidSim 02</div>
          <h1>Can't reach the server</h1>
          <p>${esc(LAST_ERROR || 'Unknown error.')}</p>
          <div class="center"><button class="btn pri" id="retry" style="padding:13px 26px">Try again</button></div>
        </div></div>`;
    const r = document.getElementById('retry');
    if (r) r.onclick = () => location.reload();
  }
})();
