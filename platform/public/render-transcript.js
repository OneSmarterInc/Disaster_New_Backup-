(() => {
'use strict';
// Browser port of the generic Sim+ envelope renderer.

// Reference renderer for the instructor transcript view.
//
// Consumes ONLY the envelope and an optional resolver. It has no access
// to the engine, the contracts, or the phrasing bank — that is the
// point. If this renders a useful debrief screen, the envelope carries
// enough, and the platform can build the real surface against the same
// contract.
//
// Resolver is optional by design. Without one the timeline renders
// without answer text, which is a legitimate deployment (transcript
// store separated from sim content) rather than a degraded one.

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function renderSession(env, resolve) {
  const byPhase = env.phases.map(function (p) {
    return { phase: p, events: env.events.filter(function (e) { return e.phase === p.id; }) };
  });

  const irreversible = {};
  env.transitions.forEach(function (t) {
    if (t.kind === 'irreversible') irreversible[t.ordinal] = t;
  });
  const gates = {};
  env.transitions.forEach(function (t) { if (t.kind === 'gate') gates[t.ordinal] = t; });

  const phasesHtml = byPhase.map(function (grp) {
    const total = grp.events.reduce(function (a, e) { return a + e.cost.amount; }, 0);
    const budget = grp.events.length
      ? grp.events[0].cost.amount + grp.events[0].cost.remaining : 0;

    const ledger = budget
      ? '<div class="ledger">' + grp.events.map(function (e) {
          const cls = 'seg' +
            (e.classification === 'GENERIC_DESCRIPTIVE' ? ' generic' : '') +
            (irreversible[e.ordinal] ? ' closed' : '') +
            (gates[e.ordinal] ? ' gate' : '');
          return '<div class="' + cls + '" style="width:' +
            (e.cost.amount / budget * 100) + '%" title="' +
            esc(e.classificationLabel) + ' · ' + e.cost.amount + 's"></div>';
        }).join('') +
        '<div class="seg unused" style="width:' + ((budget - total) / budget * 100) + '%"></div>' +
        '</div>' : '';

    const rows = grp.events.map(function (e) {
      const irr = irreversible[e.ordinal];
      const gate = gates[e.ordinal];
      const answer = resolve ? resolve(e.outputRef) : null;
      // A repeat ask returns a different line. The instructor has to see
      // WHICH line was delivered, or they will credit the participant
      // with something they never heard.
      const variant = Number(String(e.outputRef).split(':').pop());
      return '<div class="ev' + (irr ? ' irr' : gate ? ' gate' : '') + '">' +
        '<div class="ev-h"><span class="ord">' + e.ordinal + '</span>' +
        '<span class="cls">' + esc(e.classificationLabel) + '</span>' +
        (variant > 0 ? '<span class="var">reply ' + (variant + 1) + ' of this kind</span>' : '') +
        '<span class="cost">' + e.cost.amount + 's · ' + e.cost.remaining + ' left</span></div>' +
        '<div class="q">' + esc(e.input) + '</div>' +
        (answer ? '<div class="a">' + esc(answer) + '</div>'
                : '<div class="a noresolve">[' + esc(e.outputRef) + ']</div>') +
        (irr ? '<div class="flag">' + esc(irr.label) + ' — and nothing after this point could recover it.</div>' : '') +
        (gate ? '<div class="flag gateflag">' + esc(gate.label) + '</div>' : '') +
        '</div>';
    }).join('');

    return '<section><h2>' + esc(grp.phase.label) + '</h2>' + ledger + rows + '</section>';
  }).join('');

  const held = env.reachability.filter(function (r) { return r.held; });
  const missed = env.reachability.filter(function (r) { return !r.held; });

  const reach =
    '<ul class="reach">' +
    held.map(function (r) {
      return '<li class="has">' + esc(r.label) +
        '<span class="at">at ' + r.heldAt + '</span></li>';
    }).join('') +
    missed.map(function (r) {
      const why = r.blockedBy === 'irreversible-transition'
        ? 'behind a closed door'
        : r.blockedBy === 'actor-not-visited' ? 'source never seen' : 'never asked';
      return '<li class="not">' + esc(r.label) +
        '<span class="at">' + why + '</span></li>';
    }).join('') + '</ul>';

  const arts = env.outcome.artifacts.map(function (a) {
    return '<div class="art"><div class="art-l">' + esc(a.label) + '</div>' +
      '<div class="art-v">' + esc(a.value) + '</div></div>';
  }).join('');

  return '<article class="session sev-' + esc(env.outcome.severity) + '">' +
    '<header>' +
      '<div class="who">' + esc((env.participant && env.participant.displayName) || 'Unnamed participant') + '</div>' +
      '<div class="meta">' + esc(env.simId) + ' v' + esc(env.simVersion) +
        ' · ' + esc(env.path.join(' → ')) + '</div>' +
      '<div class="outcome"><b>' + esc(env.outcome.summary) + '</b>' +
        '<p>' + esc(env.outcome.detail) + '</p></div>' +
    '</header>' +
    phasesHtml +
    '<section><h2>What was there</h2>' + reach +
      '<p class="note">' + held.length + ' of ' + env.reachability.length +
      ' reached. This is not a score — it is what to ask them about.</p></section>' +
    '<section><h2>What they filed</h2>' + arts + '</section>' +
    '</article>';
}

const CSS = `
:root{--paper:#E6E7E1;--card:#FBFBF8;--ink:#1C1E18;--carbon:#5A6152;--rule:#C6C8BE;
--spend:#2F4858;--generic:#94795B;--stamp:#7A2E22;--ok:#3D5A45;}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);
font-family:"Newsreader",Georgia,serif;font-size:16px;line-height:1.55}
.wrap{max-width:1180px;margin:0 auto;padding:24px 20px 70px}
.mast{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.14em;
text-transform:uppercase;color:var(--carbon);border-bottom:1px solid var(--rule);
padding-bottom:10px;margin-bottom:22px}
.cols{display:flex;gap:22px;align-items:flex-start}
.session{flex:1;min-width:0;background:var(--card);border:1px solid var(--rule);padding:20px}
header .who{font-size:24px;margin-bottom:3px}
header .meta{font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--carbon);
letter-spacing:.05em;margin-bottom:14px}
.outcome{border-left:3px solid var(--rule);padding:10px 0 10px 13px;margin-bottom:6px}
.sev-harm .outcome{border-left-color:var(--stamp)}
.sev-harm .outcome b{color:var(--stamp)}
.outcome p{margin:6px 0 0;font-size:15px;color:var(--carbon)}
h2{font-family:"IBM Plex Mono",monospace;font-size:10.5px;font-weight:600;letter-spacing:.16em;
text-transform:uppercase;color:var(--carbon);margin:26px 0 10px;padding-bottom:5px;
border-bottom:1px solid var(--rule)}
.ledger{display:flex;height:22px;border:1px solid var(--rule);margin-bottom:14px;overflow:hidden}
.seg{background:var(--spend);border-right:1px solid var(--card)}
.seg.generic{background:var(--generic)}
.seg.closed{background:var(--stamp)}
.seg.gate{background:var(--ok)}
.seg.unused{background:transparent}
.ev{border-left:2px solid var(--rule);padding-left:12px;margin-bottom:16px}
.ev.irr{border-left-color:var(--stamp)}
.ev.gate{border-left-color:var(--ok)}
.ev-h{font-family:"IBM Plex Mono",monospace;font-size:9.5px;letter-spacing:.09em;
text-transform:uppercase;color:var(--carbon);display:flex;gap:9px;flex-wrap:wrap;margin-bottom:5px}
.ord{color:var(--rule)}
.var{color:var(--stamp)}
.cost{margin-left:auto}
.q{font-family:"IBM Plex Mono",monospace;font-size:12px;color:var(--carbon);margin-bottom:6px}
.q::before{content:"› ";color:var(--rule)}
.a{font-size:15.5px;line-height:1.55;white-space:pre-wrap}
.a.noresolve{font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--rule)}
.flag{font-family:"IBM Plex Mono",monospace;font-size:10.5px;color:var(--stamp);
margin-top:7px;letter-spacing:.03em}
.flag.gateflag{color:var(--ok)}
ul.reach{list-style:none;padding:0;margin:0 0 10px;font-size:14.5px}
ul.reach li{padding:5px 0 5px 22px;position:relative;border-bottom:1px solid var(--rule);
display:flex;gap:10px;align-items:baseline}
ul.reach li::before{position:absolute;left:0;font-family:"IBM Plex Mono",monospace;font-size:11px}
li.has::before{content:"✓";color:var(--ok)}
li.not::before{content:"—";color:var(--rule)}
li.not{color:var(--carbon)}
.at{margin-left:auto;font-family:"IBM Plex Mono",monospace;font-size:9.5px;
letter-spacing:.07em;text-transform:uppercase;color:var(--rule);white-space:nowrap}
.note{font-family:"IBM Plex Mono",monospace;font-size:10.5px;color:var(--carbon)}
.art{margin-bottom:11px}
.art-l{font-family:"IBM Plex Mono",monospace;font-size:9.5px;letter-spacing:.1em;
text-transform:uppercase;color:var(--carbon)}
.art-v{font-size:15px}
@media(max-width:900px){.cols{flex-direction:column}}
`;

/** One page, one or two sessions. Two renders the comparison view. */
function renderPage(envelopes, resolve) {
  const list = Array.isArray(envelopes) ? envelopes : [envelopes];
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Transcript — ' + esc(list[0].simId) + '</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&' +
    'family=Newsreader:opsz,wght@6..72,300;6..72,400&display=swap" rel="stylesheet">' +
    '<style>' + CSS + '</style></head><body><div class="wrap">' +
    '<div class="mast">Instructor transcript' +
      (list.length > 1 ? ' · comparison' : '') +
      ' · rendered from the envelope only</div>' +
    '<div class="cols">' + list.map(function (e) { return renderSession(e, resolve); }).join('') +
    '</div></div></body></html>';
}

window.FacultyTranscriptRenderer = { renderPage, renderSession };

})();