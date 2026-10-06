const { Session } = require('./src/engine');

function run(label, order, script) {
  console.log(`\n${'='.repeat(64)}\n${label}  —  ${order.join(' > ')}\n${'='.repeat(64)}`);
  const s = new Session().chooseOrder(order);
  let w = 0;
  for (const questions of script) {
    for (const q of questions) {
      const r = s.ask(q);
      if (r.error) { console.log(`  [${r.error}] "${q}"`); continue; }
      const flag = r.postureChanged ? `  <<< ${r.postureBefore} -> ${r.postureAfter}` : '';
      console.log(`  [${String(r.remaining).padStart(3)}s left] ${r.bucket.padEnd(20)} "${q}"${flag}`);
    }
    if (++w < script.length) s.advanceWindow();
  }
  const sum = s.summary();
  console.log(`\n  sender-perspective reached: ${sum.senderPerspectiveAskedIn.join(', ') || 'NOBODY'}`);
  console.log(`  generic openers: ${sum.genericOpeners}`);
  for (const b of sum.byWindow) {
    if (!b.source) continue;
    console.log(`  W${b.window} ${b.source.padEnd(14)} opener=${b.openerBucket}  qs=${b.questions}  unused=${b.secondsUnused}s  posture=${b.postureEnd || '-'}`);
  }
  return s;
}

// PATH B — the informed play
run('PATH B', ['terry','ray','ruth'], [
  ['Why does the log exist?','Who reads the log?','Have you ever seen anyone pull it up?','What do you tell them when they call?','How long has this been going?'],
  ['How many claims a day?','Do we send anything back to them?','What is the turnaround from the vendor?','Why do some faxes go to the vendor?'],
  ['Is there anything you catch that nothing else would?','Why do they send it again?','How long is the gap between copies?','Do we send anything back to them?']
]);

// PATH A — cold, generic opener, then the closing question
run('PATH A (closes her)', ['ruth','terry','ray'], [
  ['So what do you do here?','How much of this could the new system handle?','Do you get many repeat claims?','What happens when you are out sick?'],
  ['Why does the log exist?','Who reads the log?'],
  ['How many claims a day?','Do we send anything back to them?']
]);
