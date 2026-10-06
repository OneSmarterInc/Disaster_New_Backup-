// The whole debrief, including the resolution. None of this exists in the
// browser until the student has finished all three decisions.
const { checkAccess, requireKey, anthropic, body } = require('../lib/guard.js');
const { reportCompletion } = require('../lib/launch.js');
const S = require('../lib/scenario.js');

const EVIDENCE = [
  "Hour 4: three volumes corrupt, all on SAN-03; array logging read errors 8 days; open unapplied firmware advisory FW-2231; zero security alerts; on-call engineer raises intrusion and is talked down.",
  "Hour 20: CRM-DB corrupt on SAN-07 — separate array, rack and power, no shared controllers; backup agent runs on both hosts and is a plausible innocent vector; security coverage on that segment was quietly reduced in Q3; only checksum-clean restore point is 19 hours old.",
  "Day 3: three backup catalog jobs modified 19 days ago by svc-bkp-legacy, dormant since 2019; vendor maintenance window overlaps that date; no new corruption since isolation; still unresolved."
];

const label = (arr, id) => { const x = arr.find(a => a.id === id); return x ? x.label : id; };

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!checkAccess(req, res)) return;
  const key = requireKey(res); if (!key) return;

  const b = body(req);
  const positions = Array.isArray(b.positions) ? b.positions.slice(0, 3) : [];
  if (positions.length !== S.PHASES.length) {
    return res.status(400).json({ error: 'incomplete run' });
  }
  const coverageEarnedAt = (b.coverageEarnedAt === null || b.coverageEarnedAt === undefined)
    ? null : parseInt(b.coverageEarnedAt, 10);
  const coveragePrivate = !!b.coveragePrivate;
  const privateCount = parseInt(b.privateCount, 10) || 0;

  const anyIrreversibleEarly = positions.slice(0, 2).some(p => {
    const a = S.ACTIONS.find(x => x.id === p.action); return a && a.reversibility === 'irreversible';
  });
  const path = anyIrreversibleEarly ? 'irreversible' : 'reversible';

  // --- per-decision tripwire verdicts ---
  const verdicts = [];
  for (const p of positions) {
    const later = EVIDENCE.slice(p.phase + 1);
    const tripwire = String(p.tripwire || '').slice(0, 600);
    try {
      if (!later.length) {
        const sys = `You are assessing whether a stated tripwire is usable at all. A good tripwire names something specific that could observably happen or not happen, so the person would know it when they saw it. A bad one asks for proof, certainty or "more evidence" — conditions that can never be checked and so never fire.
Reply as JSON only, no markdown fences: {"usable": true|false, "verdict": "one or two sentences, second person, addressed to the student"}
Nothing came after this moment to test it against, so judge only its construction. If it could never fire, say so plainly and say what would have made it fire.`;
        const raw = await anthropic(key, { system: sys, max_tokens: 300, messages: [{ role: 'user', content:
          `Tripwire, set at ${S.PHASES[p.phase].label}, the final decision point: "${tripwire}"\nTheir reading: ${label(S.READINGS, p.reading)}\nTheir action: ${label(S.ACTIONS, p.action)}` }] });
        const j = JSON.parse(raw.replace(/```json|```/g, '').trim());
        verdicts.push({ phase: p.phase, ok: !!j.usable, verdict: j.verdict });
      } else {
        const nextPos = positions.find(x => x.phase === p.phase + 1);
        const sys = `You are evaluating a student's incident-management decision. Be direct, specific and fair. Never flatter.
Judge two things:
1) Did the evidence that arrived AFTER the student's stated tripwire actually satisfy that tripwire?
2) If it did, did the student then change course, or did they carry on?
Reply as JSON only, no markdown fences: {"fired": true|false, "changed": true|false, "verdict": "one or two sentences, second person, addressed to the student"}
If the tripwire fired and they did not change course, say so plainly — that is the most useful thing you can tell them. If the tripwire was too vague to ever fire, say that instead.`;
        const usr = `Student's tripwire, set at ${S.PHASES[p.phase].label}: "${tripwire}"
Their action at that moment: ${label(S.ACTIONS, p.action)}
Their reading at that moment: ${label(S.READINGS, p.reading)}

Evidence that arrived afterwards:
${later.join('\n')}

${nextPos ? `At the next moment they read it as "${label(S.READINGS, nextPos.reading)}" and did: ${label(S.ACTIONS, nextPos.action)}` : 'There was no later decision recorded.'}`;
        const raw = await anthropic(key, { system: sys, max_tokens: 350, messages: [{ role: 'user', content: usr }] });
        const j = JSON.parse(raw.replace(/```json|```/g, '').trim());
        verdicts.push({ phase: p.phase, ok: !!(j.fired && j.changed), verdict: j.verdict });
      }
    } catch (e) {
      console.error('verdict failure', e.message);
      verdicts.push({ phase: p.phase, ok: false, verdict: null });
    }
  }

  // --- whole-arc synthesis ---
  let arc = null;
  try {
    const arcText = positions.map(p =>
      `${S.PHASES[p.phase].label}: read "${label(S.READINGS, p.reading)}", did "${label(S.ACTIONS, p.action)}" (${(S.ACTIONS.find(a => a.id === p.action) || {}).reversibility}), tripwire "${String(p.tripwire || '').slice(0, 400)}"`).join('\n');
    const sys = `You are writing the closing judgement of a debrief for a decision-making exercise. You have the student's whole arc, not one moment of it.
Say, in 3-5 sentences of plain second-person prose: whether their reading moved as evidence arrived or stayed fixed; whether their irreversible actions came before or after their reversible ones; and whether their tripwires got sharper or vaguer as the incident went on.
Be specific and unsparing but not unkind, and do not flatter. If they did something well, say it once and plainly. No headings, no lists, no preamble. Do not restate the facts of the incident back to them.`;
    const usr = `The incident: at Hour 4 the mundane hardware reading was strongest. At Hour 20 corruption crossed to hardware sharing no path with the first array, and the security lead disclosed her detection coverage on that segment had been cut. By Day 3 a dormant service account was found to have modified backup jobs 19 days earlier, still unresolved.

Ground truth, which the student could not know: ${S.GROUND_TRUTH.detail}

Their arc:
${arcText}`;
    arc = await anthropic(key, { system: sys, max_tokens: 420, messages: [{ role: 'user', content: usr }] });
  } catch (e) { console.error('arc failure', e.message); }

  // --- coverage branch ---
  let coverage;
  if (coverageEarnedAt === 0) {
    coverage = { tone: 'ok', text: `You got it at Hour 4${coveragePrivate ? ', and you took her aside to do it' : ', on the bridge, in front of the people it embarrassed'}. Almost nobody does. That admission was available all night and it required a question that already understood what it was looking for — not "are we secure", but where the silence was worth less. From that moment you weren't reasoning from her reassurance, you were reasoning from the shape of what she couldn't see. When corruption turned up on a second array sixteen hours later, you were the only person in the room who wasn't surprised.` };
  } else if (coverageEarnedAt === 1) {
    coverage = { tone: '', text: `You got it at Hour 20 — but by then she was volunteering it, because a second array had lit up and withholding it would have been indefensible. That's information arriving because events forced it, not because you went and found it. Worth asking what you'd have done differently with those sixteen hours.` };
  } else if (coverageEarnedAt === 2) {
    coverage = { tone: '', text: `It reached you on Day 3, which is to say far too late to have changed anything you decided. The gap existed from the first minute of this incident.` };
  } else {
    coverage = { tone: '', text: `You never got it. She would have told you — she tells anyone who asks a question sharp enough to deserve it, and she'd have told you privately for less. "How's your coverage?" isn't that question. "Where would you not have seen it?" is. The difference between those two sentences is most of what separates people who run incidents well from people who preside over them.` };
  }

  // If they came from the platform, tell it they finished. The metrics are this
  // sim's own choosing — the platform stores them without interpreting them.
  // Awaited deliberately. A serverless function can be frozen the moment the
  // response is sent, so a fire-and-forget request may never leave the machine.
  // The wait is one round trip and the student is reading the debrief anyway.
  if (req.launch) {
    const readingAtEnd = label(S.READINGS, positions[positions.length - 1].reading);
    const firedAndIgnored = verdicts.filter(v => v.verdict && !v.ok).length;
    await reportCompletion({
      launch: req.launch,
      summary: `Finished all three decisions. Final reading: ${readingAtEnd}.`,
      metrics: {
        'Final reading': readingAtEnd,
        'Sequencing': anyIrreversibleEarly ? 'Acted irreversibly before Day 3' : 'Kept options open',
        'Coverage admission': coverageEarnedAt === null ? 'Never obtained'
          : (S.PHASES[coverageEarnedAt] ? S.PHASES[coverageEarnedAt].label : 'Obtained')
            + (coveragePrivate ? ' (privately)' : ''),
        'Went off the bridge': privateCount,
        'Tripwires not acted on': firedAndIgnored
      }
    });
  }

  return res.status(200).json({
    // Framing for the coverage section. Held here because it names what Sophia
    // was carrying, and the client is readable before anyone has played.
    coverageIntro: "Sophia told you at Hour 4 that nothing had alerted, and she was careful to say that meant her tooling hadn't seen anything rather than that nothing was there. Underneath that was something she'd rather not have said out loud: the Q3 review cut her detection on one segment, she objected, she was overruled. Whether you got that out of her, and when, is the single best measure of how you ran this incident.",
    resolution: {
      headline: 'It was <em>both</em>.',
      paras: [
        "A real FW-2231 firmware fault corrupted the volumes on SAN-03. That part of Kate's read was correct, and she was right to press it. Separately, someone had been resident in the estate for about three weeks, saw the incident window open, and used it. The modified catalog jobs were theirs.",
        "So the question was never which of them to believe. Anyone who committed hard to one reading was wrong in a way that mattered, and anyone who hedged without a plan for either branch wasn't right either — they just avoided being caught."
      ]
    },
    verdicts,
    arc,
    coverage,
    fork: { path, cells: S.FORK },
    privateCount
  });
};
