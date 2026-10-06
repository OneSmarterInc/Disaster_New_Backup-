'use strict';

// Student-specific closing interpretation. It only explains outcomes already
// resolved by the scenario engine; it does not add thresholds, scores or bands.
const ORDER = ['run', 'uptime', 'capacity', 'connect', 'features'];
const LABELS = { run:'Run', uptime:'Uptime', capacity:'Capacity', connect:'Connect', features:'Features' };
const PEOPLE = { run:'Dale', uptime:'Renata', connect:'Sam', features:'Tom' };

function amount(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
function cumulative(y1,y2){ const out={}; for(const k of ORDER) out[k]=amount(y1&&y1[k])+amount(y2&&y2[k]); return out; }
function largestLine(c){ let key=ORDER[0]; for(const k of ORDER.slice(1)) if(c[k]>c[key]) key=k; return {key,label:LABELS[key],amount:c[key]}; }
function dollars(n){ return `$${Math.max(0,Number(n)||0)}M`; }

function year3Sentence(c,band){
  if(band==='strong') return `By Year 3, your $${c.connect}M in Connect and $${c.capacity}M in Capacity worked together: Midland had both field history and room to turn predictive service into something it could actually sell.`;
  if(band==='data_no_room') return `By Year 3, your $${c.connect}M in Connect had created the field history, but $${c.capacity}M in Capacity left too little room to run the model reliably at scale.`;
  if(band==='pilot') return `By Year 3, your $${c.connect}M in Connect and $${c.capacity}M in Capacity got Midland to a promising pilot, but not yet to a predictive-service business.`;
  if(band==='weak') return `By Year 3, your $${c.connect}M in Connect had not created enough usable field history for prediction to become a real capability.`;
  return '';
}
function heatSentence(c,band){
  if(band==='strong') return `Your $${c.uptime}M in Uptime meant dispatch held when the heat wave tested it.`;
  if(band==='middle') return `Your $${c.uptime}M in Uptime kept the heat wave from becoming a full breakdown, but the service operation still fell back to manual work.`;
  if(band==='weak') return `Your $${c.uptime}M in Uptime left the service operation exposed when the heat wave arrived.`;
  return '';
}
function competitorSentence(c,band){
  if(band==='strong') return `The same $${c.connect}M Connect investment let Midland answer the competitor from a position of strength.`;
  if(band==='middle') return `The same $${c.connect}M Connect investment got Midland only as far as a limited pilot against the competitor.`;
  if(band==='weak') return `The same $${c.connect}M Connect investment was not enough to answer the competitor quickly.`;
  return '';
}
function buyerSentence(buyers){
  const ridge=buyers&&buyers.ridge_hollow&&buyers.ridge_hollow.interest;
  const corven=buyers&&buyers.corven&&buyers.corven.interest;
  if(!ridge||!corven)return '';
  if(ridge===corven)return `Ridge Hollow and Corven both showed ${ridge} interest, but for different reasons: Ridge Hollow was asking Dale’s question about the spending base while Corven was asking Sam’s question about the connected-data asset.`;
  return `Ridge Hollow showed ${ridge} interest while Corven showed ${corven} interest. Ridge Hollow was asking Dale’s question about the cost base; Corven was asking Sam’s question about the connected-data asset. The portfolio did not change between those judgments; what each buyer valued did.`;
}

function primaryNearMiss(c,y3,heat,competitor,t){
  if(!t)return '';
  const ys=Number(t.year3ConnectStrong), cap=Number(t.year3CapacityStrong), yp=Number(t.year3ConnectPilotMin), hs=Number(t.heatUptimeStrong), hm=Number(t.heatUptimeMiddle), cs=Number(t.competitorConnectStrong), cp=Number(t.competitorConnectPilotMin);
  if(![ys,cap,yp,hs,hm,cs,cp].every(Number.isFinite))return '';
  if(y3==='data_no_room') return `${dollars(cap-c.capacity)} more in Capacity would have turned the working demo into a capability Midland could run at scale.`;
  if(y3==='weak') return `${dollars(Math.max(0,yp-c.connect))} more in Connect would have reached the Year 3 pilot.`;
  if(y3==='pilot') return `${dollars(Math.max(0,ys-c.connect))} more in Connect would have moved Midland out of the pilot; with Capacity at ${dollars(c.capacity)}, the next outcome would have been ${c.capacity>=cap?'the full predictive-service capability':'data without room to run it'}.`;
  if(competitor==='weak') return `${dollars(Math.max(0,cp-c.connect))} more in Connect would have given Midland a credible competitor pilot.`;
  if(competitor==='middle') return `${dollars(Math.max(0,cs-c.connect))} more in Connect would have let Midland match the competitor outright.`;
  if(heat==='weak') return `${dollars(Math.max(0,hm-c.uptime))} more in Uptime would have avoided the four-day dispatch outage.`;
  if(heat==='middle') return `${dollars(Math.max(0,hs-c.uptime))} more in Uptime would have kept dispatch fully online.`;
  const candidates=[
    {n:c.capacity-cap+1,text:`${dollars(c.capacity-cap+1)} less in Capacity would have left the same field history without enough room to run reliably.`},
    {n:c.connect-cs+1,text:`${dollars(c.connect-cs+1)} less in Connect would have reduced Midland’s competitor response to a pilot.`},
    {n:c.uptime-hs+1,text:`${dollars(c.uptime-hs+1)} less in Uptime would have pushed the heat wave into the degraded-dispatch outcome.`}
  ].filter(x=>Number.isFinite(x.n)&&x.n>0).sort((a,b)=>a.n-b.n);
  return candidates[0]?.text||'';
}

function tradeSentence(c,t){
  if(!t)return '';
  const hs=Number(t.heatUptimeStrong), cp=Number(t.competitorConnectPilotMin), ys=Number(t.year3ConnectStrong), cap=Number(t.year3CapacityStrong);
  if(Number.isFinite(hs)&&Number.isFinite(cp)&&c.uptime>=2*hs&&c.connect<cp){
    return `Renata’s Uptime line received $${c.uptime}M — at least twice the level that held dispatch in the heat wave — while Sam’s Connect line received $${c.connect}M. The extra resilience came with less field visibility.`;
  }
  if(Number.isFinite(ys)&&Number.isFinite(cap)&&c.connect>=ys&&c.capacity<cap){
    return `Sam’s Connect line received $${c.connect}M while Capacity received $${c.capacity}M. Midland bought the field history and not enough room to use it at scale.`;
  }
  if(c.features>=4&&c.connect<=2){
    return `Tom’s Features line received $${c.features}M while Sam’s Connect line received $${c.connect}M. Midland bought more that people could point at and less of the field visibility needed to respond later.`;
  }
  if(c.run>=8){
    return `Dale’s Run line received $${c.run}M of the two-year $${2 * Number(t.budgetPerYear ?? 9)}M total. Keeping today’s systems funded that heavily left correspondingly less room for capabilities that only paid off when later events arrived.`;
  }
  const hi=ORDER.reduce((a,k)=>c[k]>c[a]?k:a,ORDER[0]);
  const lo=ORDER.reduce((a,k)=>c[k]<c[a]?k:a,ORDER[0]);
  if(c[hi]-c[lo]>=3){
    const hip=PEOPLE[hi]?`${PEOPLE[hi]}’s ${LABELS[hi]} line`:`${LABELS[hi]}`;
    const lop=PEOPLE[lo]?`${PEOPLE[lo]}’s ${LABELS[lo]} line`:`${LABELS[lo]} — the line with no advocate`;
    return `${hip} received $${c[hi]}M while ${lop} received $${c[lo]}M. That spread is the opportunity cost the room’s arguments were competing to create.`;
  }
  return 'Your cumulative portfolio stayed relatively balanced. That kept several options alive, but it also meant no single argument from the room dominated the two-year spend.';
}

function buildClosingLesson(y1,y2,outcomes,thresholds){
  const c=cumulative(y1,y2), top=largestLine(c);
  const y3=outcomes&&outcomes.year3&&outcomes.year3.band;
  const heat=outcomes&&outcomes.year2&&outcomes.year2.heat&&outcomes.year2.heat.band;
  const competitor=outcomes&&outcomes.year2&&outcomes.year2.competitor&&outcomes.year2.competitor.band;
  const buyers=outcomes&&outcomes.buyers;
  const near=primaryNearMiss(c,y3,heat,competitor,thresholds);
  const trade=tradeSentence(c,thresholds);
  const yourRun=[
    [year3Sentence(c,y3), near?`Closest counterfactual: ${near}`:''].filter(Boolean).join(' '),
    [`Your largest cumulative commitment was ${top.label} at $${top.amount}M.`,trade].filter(Boolean).join(' '),
    [heatSentence(c,heat),competitorSentence(c,competitor)].filter(Boolean).join(' '),
    buyerSentence(buyers)
  ].filter(Boolean);
  return {
    title:'What this run was teaching you',
    paragraphs:[
      'You spent two years making choices before you knew which consequences would matter. That is the work of architecture. It is not predicting the future. It is deciding which capabilities Midland will already have when the future arrives.',
      'Every million you put into Run, Uptime, Capacity, Connect, or Features was also a million you did not put somewhere else. Dale was right that Run consumed money without producing something new. Renata was right that her trucks and technicians were stretched. Tom was right that the board needed something visible. Sam was right that the machines already knew more than Midland could hear. The hard part was seeing the whole company while each person was correctly defending only one part of it.',
      'Capacity had no advocate. Connect did. Features were visible. Run and Uptime had immediate operational arguments. Foundations get starved precisely because nobody is asking for them yet, while the visible and urgent work arrives with a person attached.',
      'The three buyers were the final reminder that value depends on who is looking. You did not control which future arrived or what an eventual buyer would care about. You controlled whether Midland had built enough real capability that more than one future could still work.'
    ],
    yourRun,
    carryOut:'You never controlled which future arrived. You controlled what Midland was ready for when it did.'
  };
}
module.exports={buildClosingLesson};
