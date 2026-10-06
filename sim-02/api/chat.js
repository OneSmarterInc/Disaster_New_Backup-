// Generates one character's line. The contract, the knowledge set and the
// prohibitions are assembled here and never leave the server.
const { checkAccess, requireKey, anthropic, body } = require('../lib/guard.js');
const S = require('../lib/scenario.js');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!checkAccess(req, res)) return;
  const key = requireKey(res); if (!key) return;

  const b = body(req);
  const id = String(b.character || '');
  const phase = parseInt(b.phase, 10);
  const message = String(b.message || '').slice(0, 2000);
  const priv = b.channel !== 'room';

  if (!S.CAST[id]) return res.status(400).json({ error: 'unknown character' });
  if (!(phase >= 0 && phase < S.PHASES.length)) return res.status(400).json({ error: 'bad phase' });
  if (!message) return res.status(400).json({ error: 'empty message' });

  const room = Array.isArray(b.room) ? b.room.slice(-14) : [];
  const thread = Array.isArray(b.thread) ? b.thread.slice(-12) : [];

  const roomText = room.map(m => `${m.who === 'you' ? 'VP of Operations' : (S.CAST[m.who] ? S.CAST[m.who].name : m.who)}: ${m.text}`).join('\n');

  const messages = [
    { role: 'user', content: `Room transcript so far:\n${roomText || '(nothing yet)'}\n\n---` },
    { role: 'assistant', content: 'Understood. I am on the bridge.' }
  ];
  thread.forEach(m => messages.push({
    role: m.who === 'you' ? 'user' : 'assistant',
    content: String(m.text || '').slice(0, 2000)
  }));
  messages.push({
    role: 'user',
    content: (priv ? '[Privately, just the two of you] ' : '[On the bridge, in front of everyone] ') + message
  });

  try {
    let text = await anthropic(key, { system: S.systemPromptFor(id, phase), messages, max_tokens: 320 });
    text = (text || '').replace(/^"|"$/g, '').replace(/\*/g, '').trim();
    // Did the graded disclosure actually come out? Detected here rather than in
    // the client, because the markers are scenario content and must not ship to
    // a browser. Tier three only — tier two touches the same subject, so these
    // are deliberately tight and undercount rather than overcount.
    const ladder = id === S.LADDER.character && S.LADDER.re.test(text);
    return res.status(200).json({ text, ladder });
  } catch (e) {
    console.error('chat failure', e.status || '', e.message);
    // Fall back to a prepared line rather than dead-ending the student.
    return res.status(200).json({ text: S.fallbackFor(id, message, phase), scripted: true });
  }
};
