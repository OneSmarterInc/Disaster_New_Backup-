// Adjudicates the conversational route to the Day 2 branch. The action route
// sets the flag directly and never comes here.
//
// Runs once at the close of each of the first two moments, over that moment's
// bridge and private transcripts. One narrow question, deliberately: did the VP
// instruct anyone to stop the scheduled re-index, or to preserve the index as it
// stands. Two lines have to be drawn explicitly because both are common:
// a question is not an instruction, and holding something else is not holding
// this.
const { checkAccess, requireKey, anthropic, body } = require('../lib/guard.js');
const S = require('../lib/scenario.js');


// ---------------------------------------------------------------------------
// Obvious cases are decided here, without asking a model. Two reasons: it costs
// nothing and it cannot fail, and it means an outage can never turn a question
// into an instruction. The model is only consulted when this is unsure, and if
// that call fails we fall back to this verdict rather than to a blanket default
// in either direction.
// ---------------------------------------------------------------------------

// The thing that has to be held. Holding anything else is not this.
const SUBJECT = /\b(re-?index|reindex|rebuild|ingest\w*|nightly job|overnight job|the job|that job|02:?00|two a\.?m|library sync|the index|index state|snapshot)\b/i;

// Asking about it.
const INTERROGATIVE = /^\s*(should|shall|could|can|would|do|does|did|is|are|what|when|how|why|who|any chance|is there)\b/i;

// Telling someone to do it.
const IMPERATIVE = /\b(hold|stop|pause|freeze|halt|delay|postpone|suspend|cancel|preserve|snapshot|keep)\b/i;
const DIRECTIVE = /\b(don'?t let|do not let|make sure .*(doesn'?t|does not) run|i want .*(held|stopped|paused)|let'?s (hold|stop|pause|freeze)|we'?re (holding|stopping|pausing)|hold off on (the )?(re-?index|rebuild|job|ingest))\b/i;

function localVerdict(text) {
  const t = String(text || '').trim();
  if (!t) return { decided: true, held: false, quote: '' };

  const sentences = t.split(/(?<=[.!?])\s+|\n+/).map(x => x.trim()).filter(Boolean);

  // Every sentence is examined before returning anything negative. Someone who
  // wonders aloud and then decides — "Should we hold that job? Hold it." — has
  // instructed a hold, and stopping at the question would lose it.
  let sawQuestion = false;
  for (const sentence of sentences) {
    if (!SUBJECT.test(sentence)) continue;                 // not about the job at all

    const asks = /\?\s*$/.test(sentence) || INTERROGATIVE.test(sentence);
    if (asks) { sawQuestion = true; continue; }

    if (DIRECTIVE.test(sentence) || IMPERATIVE.test(sentence)) {
      return { decided: true, held: true, quote: sentence.slice(0, 300) };
    }
  }
  // Only a question about it, and nothing that told anyone to do anything.
  if (sawQuestion) return { decided: true, held: false, quote: '' };
  return { decided: false };
}

const SYSTEM = `You are deciding one narrow question about a transcript from an incident call.

THE QUESTION: did the VP of Customer Operations instruct anyone to hold, delay, pause, freeze or otherwise stop the scheduled overnight re-index of the document library — or to preserve, snapshot, image or otherwise keep the index in its current state before that job runs?

Two lines you must draw, because both are common in these transcripts:

1. A QUESTION IS NOT AN INSTRUCTION. "What happens if we re-index?", "Does the job run tonight?", "Could we hold it?" are all false. Wondering aloud is false. Asking someone's opinion about holding it is false. Only an instruction, a decision, or a clear request to act counts.

2. HOLDING SOMETHING ELSE IS NOT HOLDING THIS. "Let's hold off on notifying the customers", "hold the statement", "pause the outreach", "don't publish anything yet" are all false. The hold has to be about the re-index, the ingestion job, the nightly job, the library sync, or preserving the index or its current contents.

Anything ambiguous is false. If they merely agreed with someone else's suggestion in a way that clearly settles it — "yes, do that" straight after a character offers to hold the job — that is true.

Reply as JSON only, no markdown fences:
{"held": true|false, "quote": "the exact sentence you matched on, or empty string"}`;

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!checkAccess(req, res)) return;

  const b = body(req);
  const phase = parseInt(b.phase, 10);
  if (!(phase === 0 || phase === 1)) {
    // Nothing to decide anywhere else.
    return res.status(200).json({ held: false, quote: '' });
  }

  const lines = [];
  const add = (label, arr) => {
    if (!Array.isArray(arr) || !arr.length) return;
    lines.push(`--- ${label} ---`);
    arr.slice(-40).forEach(m => {
      if (!m || m.who === 'system') return;
      const who = m.who === 'you' ? 'VP OF CUSTOMER OPERATIONS' : String(m.who).toUpperCase();
      lines.push(`${who}: ${String(m.text || '').slice(0, 1200)}`);
    });
  };
  add('on the call, everyone present', b.room);
  Object.entries(b.threads || {}).forEach(([who, msgs]) => add(`privately with ${who}`, msgs));

  const transcript = lines.join('\n').slice(0, 24000);
  if (!transcript.trim()) return res.status(200).json({ held: false, quote: '' });

  // Only what the VP actually said can be an instruction from the VP.
  const saidByVp = []
    .concat(Array.isArray(b.room) ? b.room : [])
    .concat(...Object.values(b.threads || {}).filter(Array.isArray))
    .filter(m => m && m.who === 'you')
    .map(m => String(m.text || ''));

  let local = { decided: false };
  for (const line of saidByVp) {
    const v = localVerdict(line);
    if (v.decided && v.held) { local = v; break; }        // an instruction settles it
    if (v.decided && !local.decided) local = v;            // a plain question, provisionally
  }
  if (local.decided && local.held) {
    return res.status(200).json({ held: true, quote: local.quote, decidedLocally: true });
  }

  const key = requireKey(res); if (!key) return;

  try {
    const raw = await anthropic(key, {
      system: SYSTEM, max_tokens: 200,
      messages: [{ role: 'user', content: transcript }]
    });
    const j = JSON.parse(String(raw).replace(/```json|```/g, '').trim());
    return res.status(200).json({
      held: !!j.held,
      quote: typeof j.quote === 'string' ? j.quote.slice(0, 300) : ''
    });
  } catch (e) {
    // Fall back to what was decided locally rather than to a blanket default.
    // Defaulting to held would mean an outage turns a question into an
    // instruction and both branches end the same way; defaulting to not-held
    // would mean a real instruction is ignored and the sim looks broken to
    // someone who did the right thing. The local pass has already caught the
    // clear cases in both directions, so this only affects the genuinely
    // ambiguous, where not-held is the honest answer.
    console.error('branch classifier failed, using local verdict:', e.message);
    return res.status(200).json({
      held: !!(local.decided && local.held),
      quote: local.quote || '',
      degraded: true
    });
  }
};
