// Historical floor-3 fixtures intentionally preserve the authored narrative/buyer regressions.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const S = require('../lib/scenario.js');
const { buildClosingLesson } = require('../lib/closingLesson.js');

const valid = x => { const v=S.validateAllocation(x, S.LEGACY_THRESHOLDS); assert.equal(v.ok,true,JSON.stringify(v)); return v.allocation; };
const cfg=S.publicConfig();
assert.equal(S.META.minutes,30);
assert.match(S.META.detail.sessionShape, /(?:30|thirty) minutes/);
assert.ok(cfg.lines.find(x=>x.id==='capacity').description.includes('Nobody asks for this')===false);
assert.equal(cfg.lines.find(x=>x.id==='uptime').description,'Backup and redundancy so dispatch survives a bad day.');
assert.equal(cfg.lines.find(x=>x.id==='connect').description,'Gets data back from units in the field automatically.');
assert.equal(cfg.lines.find(x=>x.id==='features').description,'Visible new things the business can point at.');
assert.ok(cfg.reflectionPrompts[0].includes('Dale') && cfg.reflectionPrompts[0].includes('Sam'));
assert.ok(cfg.reflectionDisclosure.includes('class debrief'));
assert.ok(cfg.viewPrompt.includes('___'));

const y1Weak=valid({run:3,uptime:2,capacity:2,connect:0,features:2});
const y1Mid=valid({run:3,uptime:2,capacity:1,connect:1,features:2});
const y1Strong=valid({run:3,uptime:1,capacity:1,connect:2,features:2});
for(const [band,a] of [['weak',y1Weak],['middle',y1Mid],['strong',y1Strong]]){
  const o=S.evaluateYear1(a); assert.equal(o.band,band); assert.ok(o.narrative.length>300); assert.ok(o.narrative.includes('Sam:')); assert.ok(o.year2Intro.length>100);
}
assert.ok(S.evaluateYear1(y1Weak).narrative.includes('two of Sam’s technicians spend a week on roofs'));

const strongA=valid({run:3,uptime:2,capacity:0,connect:2,features:2});
const strongB=valid({run:3,uptime:1,capacity:1,connect:2,features:2});
const midA=valid({run:3,uptime:1,capacity:1,connect:1,features:3});
const midB=valid({run:3,uptime:1,capacity:1,connect:2,features:2});
const weakA=valid({run:3,uptime:0,capacity:3,connect:0,features:3});
const weakB=valid({run:3,uptime:1,capacity:3,connect:1,features:1});
const y2Strong=S.evaluateYear2(strongA,strongB), y2Mid=S.evaluateYear2(midA,midB), y2Weak=S.evaluateYear2(weakA,weakB);
for(const o of [y2Strong.heat,y2Mid.heat,y2Weak.heat]){ assert.ok(o.narrative.length>300); assert.ok(o.narrative.includes('Renata:')); assert.ok(o.narrative.includes('95')); }
for(const o of [y2Strong.competitor,y2Mid.competitor,y2Weak.competitor]){ assert.ok(o.narrative.length>350); assert.ok(o.narrative.includes('Tom:')); assert.ok(o.narrative.includes('eighteen')); assert.ok(o.narrative.includes('Carrolton')); }

const y3StrongA=valid({run:3,uptime:1,capacity:1,connect:3,features:1});
const y3StrongB=valid({run:3,uptime:2,capacity:1,connect:2,features:1});
const noRoomA=valid({run:3,uptime:3,capacity:0,connect:3,features:0});
const noRoomB=valid({run:3,uptime:0,capacity:0,connect:3,features:3});
const pilotA=valid({run:3,uptime:2,capacity:1,connect:2,features:1});
const pilotB=valid({run:3,uptime:1,capacity:1,connect:1,features:3});
const y3WeakA=valid({run:3,uptime:2,capacity:1,connect:1,features:2});
const y3WeakB=valid({run:3,uptime:2,capacity:1,connect:1,features:2});
for(const o of [S.evaluateYear3(y3StrongA,y3StrongB),S.evaluateYear3(noRoomA,noRoomB),S.evaluateYear3(pilotA,pilotB),S.evaluateYear3(y3WeakA,y3WeakB)]){
  assert.ok(o.narrative.length>350); assert.ok(o.narrative.includes('Sam:'));
}
assert.ok(S.evaluateYear3(noRoomA,noRoomB).narrative.includes('three years of fault history and nowhere to put it'));
assert.ok(S.evaluateYear3(y3WeakA,y3WeakB).narrative.includes('Year 1'));

const buyers=S.evaluateBuyers(noRoomA,noRoomB);
assert.ok(!buyers.carrolton.reason.includes('worth sitting with'));
assert.ok(buyers.ridge_hollow.roomLink.includes('Dale'));
assert.ok(buyers.corven.roomLink.includes('Sam'));
const corvenLow=S.evaluateBuyers(y3WeakA,y3WeakB).corven;
assert.equal(corvenLow.interest,'low'); assert.ok(corvenLow.reason.includes('Sam'));

const lesson=buildClosingLesson(midA,midB,S.evaluateAll(midA,midB),S.DEFAULT_THRESHOLDS);
const text=[...lesson.paragraphs,...lesson.yourRun].join(' ');
for(const name of ['Dale','Renata','Tom','Sam']) assert.ok(text.includes(name));
assert.equal(text.includes('That imbalance was intentional'),false);
assert.ok(text.includes('Closest counterfactual:'));
assert.equal((text.match(/Closest counterfactual:/g)||[]).length,1);

const html=fs.readFileSync(path.join(__dirname,'..','public','index.html'),'utf8');
assert.ok(html.includes("const STEPS=['Brief','Room','Position','View'"));
assert.ok(html.includes('case 1:return renderRoom()') && html.includes('case 2:return renderPosition()'));
for(const marker of ['30 MIN','brief-profit','allocationConfirmation','usefulOpeningView','Year 1 committed','year3-stage','timeline-pair','may read it aloud in the debrief','buyer-room-link','$${C.lineMaximum}M annual ceiling reached']) assert.ok(html.includes(marker),marker);
for(const old of ['The first consequence arrives.','You get one more allocation.','Two events resolve in sequence.','You do not get another move.','Return to what you believed before the consequences.']) assert.equal(html.includes(old),false,old);
console.log('RapidSim 03 Increment 2 checks passed.');
