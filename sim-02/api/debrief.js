// The whole debrief, including the resolution. None of this exists in the
// browser until the student has finished all three decisions.
const { checkAccess, requireKey, anthropic, body } = require('../lib/guard.js');
const { reportCompletion } = require('../lib/launch.js');
const S = require('../lib/scenario.js');

const EVIDENCE = [
  "Hour 1: one customer, one written answer giving 260°C against a published 230°C; a superseded revision is still in the document library; support engineer notes that spec escalations dried up at the start of Q3 and is talked past; scope unknown.",
  "Hour 7: 41 conversations touched the affected product family in 90 days, 9 of them rating or compatibility questions answered without escalation; 9 of 11 families hold superseded revisions; the platform records what was said but not which document was retrieved; the index is rebuilt from the library nightly.",
  "Day 2: the library is corrected; the customer's counsel has asked what the system told their engineer; whether that question can be answered depends on whether the index state was preserved."
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
  const ladderEarnedAt = (b.ladderEarnedAt === null || b.ladderEarnedAt === undefined)
    ? null : parseInt(b.ladderEarnedAt, 10);
  const ladderPrivate = !!b.ladderPrivate;
  const preservedAt = (b.preservedAt === null || b.preservedAt === undefined)
    ? null : parseInt(b.preservedAt, 10);
  const preserved = !!b.preserved || preservedAt !== null;
  const preservedByTalk = !!b.preservedByTalk;
  const preservedQuote = typeof b.preservedQuote === 'string' ? b.preservedQuote.slice(0, 300) : '';
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
    const usr = `The incident: at Hour 1 the document explanation was strongest and complete on its own terms. At Hour 7 the scope landed — nine rating questions answered without escalation — and the platform owner's account of a Q3 routing change became harder to leave alone. By the second morning the customer's counsel was asking what the system told their engineer, and whether that was answerable depended on a decision about a scheduled job the night before.

Ground truth, which the student could not know: ${S.GROUND_TRUTH.detail}

Their arc:
${arcText}`;
    arc = await anthropic(key, { system: sys, max_tokens: 420, messages: [{ role: 'user', content: usr }] });
  } catch (e) { console.error('arc failure', e.message); }

  // --- disclosure ladder branch ---
  const LADDER_INTRO = "Devin told you the routing had been tuned in Q3, which was true and told you almost nothing. Underneath it was something he would rather not have said out loud: he moved the threshold himself, against a deflection number on a dashboard, and nobody reviewed it because nothing required anyone to. Whether you got that out of him, and when, is the single best measure of how you ran this.";
  const PRESERVE_INTRO = "The index Relay searches is rebuilt from the document library every night at two. Correcting the library and preserving the evidence of what it used to hold are the same action pointed in opposite directions, and only one person on that call had any reason to mention it.";
  let ladder;
  if (ladderEarnedAt === 0) {
    ladder = { tone: 'ok', text: `You got it at Hour 1${ladderPrivate ? ', and you took him aside to do it' : ', in front of the people it embarrassed'}. Almost nobody does. That admission was available from the first minute and it required a question that already understood what it was looking for — not "did anything change", but what the change was for. From that moment you were not reasoning about a document error, you were reasoning about why a question stopped reaching a person. Everything that arrived later confirmed something you already knew.` };
  } else if (ladderEarnedAt === 1) {
    ladder = { tone: '', text: `You got it at Hour 7, once the scope was on the table and nine other conversations were in the room. That is information arriving because the numbers forced it, not because you went and found it. Worth asking what you would have done differently with those six hours.` };
  } else if (ladderEarnedAt === 2) {
    ladder = { tone: '', text: `It reached you on the second morning, too late to have changed anything you decided. The threshold had been sitting there since week three of Q3, and it was answerable on the first question anyone asked him.` };
  } else {
    ladder = { tone: '', text: `You never got it. He would have told you — he tells anyone who asks a question sharp enough to deserve it, and he would have told you privately for less. "Did anything change on your side?" is not that question. "What was the change made for?" is. The difference between those two sentences is most of what separates people who run these well from people who preside over them.` };
  }

  // --- preservation branch ---
  let preservation;
  if (preservedAt === 0) {
    preservation = { tone: 'ok', text: `You moved to preserve the index at Hour 1, before anyone had mentioned that anything ran on a schedule. Nobody in that room volunteered it and the person who knew was junior enough not to be asked. When counsel wrote asking what your system told their engineer, you could answer. That is the sharpest single thing available in this exercise.` };
  } else if (preservedAt === 1) {
    preservation = { tone: 'ok', text: `You held the index at Hour 7, which was in time. The evidence survived and the question counsel asked was answerable. Worth noticing what it took to get there — either you asked how content reached Relay, or somebody told you what the fastest fix would cost.` };
  } else if (preserved) {
    preservation = { tone: '', text: `You preserved the index state, which was the right instinct.` };
  } else {
    preservation = { tone: '', text: `The rebuild ran at four minutes past two and nobody stopped it. Not a decision anyone made — a scheduled job doing what it does, while the person who wanted it to run was being entirely competent. What it cost was narrow and specific: the customer's counsel asked what your system told their engineer, and the honest answer became that you cannot say. Notice that this is also the version where both exposed people are more comfortable, and that nobody arranged that.` };
  }

  // How the hold came about is worth saying back. Someone who never chose it as
  // an action, and simply told a person to stop the job, should see that it
  // counted — and see the sentence it counted on.
  if (preserved && preservedByTalk) {
    preservation.text += preservedQuote
      ? ` You never recorded it as an action. You said it: “${preservedQuote}” — and that was enough, because it was an instruction rather than a question about one.`
      : ` You never recorded it as an action. You said it in conversation, and that was enough.`;
  }

  // If they came from the platform, tell it they finished. The metrics are this
  // sim's own choosing — the platform stores them without interpreting them.
  // Awaited deliberately. A serverless function can be frozen the moment the
  // response is sent, so a fire-and-forget request may never leave the machine.
  if (req.launch) {
    const readingAtEnd = label(S.READINGS, positions[positions.length - 1].reading);
    const firedAndIgnored = verdicts.filter(v => v.verdict && !v.ok).length;
    await reportCompletion({
      launch: req.launch,
      summary: `Finished all three decisions. Final reading: ${readingAtEnd}.`,
      metrics: {
        'Final reading': readingAtEnd,
        'Sequencing': anyIrreversibleEarly ? 'Acted irreversibly before Day 2' : 'Kept options open',
        'Threshold disclosure': ladderEarnedAt === null ? 'Never obtained'
          : (S.PHASES[ladderEarnedAt] ? S.PHASES[ladderEarnedAt].label : 'Obtained')
            + (ladderPrivate ? ' (privately)' : ''),
        'Index preserved': preservedAt === null ? 'No'
          : (S.PHASES[preservedAt] ? S.PHASES[preservedAt].label : 'Yes'),
        'Went off the bridge': privateCount,
        'Tripwires not acted on': firedAndIgnored
      }
    });
  }

  return res.status(200).json({
    resolution: {
      headline: 'It was <em>both</em>.',
      paras: [
        "Revision C really was in the index, because the nightly job takes everything in the library folder and never reads the status field. Joanna was right about her part and right that it was fixable in one run. Separately, the routing threshold really had moved in week three of Q3, against a deflection target, and rating questions sat close enough to the boundary that they stopped reaching an engineer. Devin was right that the setting behaved exactly as documented.",
        "Neither one produces this on its own. Revision C had been in the index since the day Relay went live, and for six months a human caught things like it. The threshold change alone would have sent more questions to an assistant that answered them correctly. It took both, and each of the two people who could see one half found the other half more persuasive.",
        "So the question was never which of them to believe. Anyone who committed hard to one reading was wrong in a way that mattered, and anyone who hedged without a plan for either branch wasn't right either — they just avoided being caught."
      ]
    },
    verdicts,
    arc,
    ladder: Object.assign({ intro: LADDER_INTRO }, ladder),
    preservation: Object.assign({ intro: PRESERVE_INTRO }, preservation),
    fork: { path, cells: S.FORK },
    privateCount
  });
};
