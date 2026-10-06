/* SIM03 faculty workspace. Live data only; no embedded student examples. */
(function(global){
'use strict';
const bandLabel=value=>({strong:'Strong',middle:'Middle',pilot:'Pilot',weak:'Limited',data_no_room:'Data without room to run it'}[value]||value||'Not reached');
function recordsFrom(snapshot){
 const people=Object.values(snapshot.participants||{}).filter(Boolean);
 const groups=new Map(), runs=Object.values(snapshot.runs||{}).filter(Boolean);
 const individual=snapshot.session.mode==='individual';
 for(const p of people){const id=individual?`individual:${p.id}`:p.groupId;if(!id)continue;if(!groups.has(id))groups.set(id,{id,name:individual?p.name:(p.teamLabel||id.replace(/^team:/,'')),people:[]});groups.get(id).people.push(p);}
 for(const r of runs){if(!groups.has(r.runId))groups.set(r.runId,{id:r.runId,name:r.teamLabel||r.runId.replace(/^(team|individual):/,''),people:[]});}
 return [...groups.values()].map(g=>{
  const r=runs.find(x=>x.runId===g.id)||{};
  g.people.sort((a,b)=>String(a.name).localeCompare(String(b.name))||String(a.id).localeCompare(String(b.id)));
  const lead=g.people.find(p=>p.isCaptain),runner=g.people.find(p=>p.id===r.runnerId)||lead|| (individual?g.people[0]:null);
  const reflection=r.reflections?.[r.completedBy]||r.reflections?.[r.runnerId]||r.reflections?.[runner?.id]||{};
  const done=!!r.done||(!individual&&Number(r.phase||0)>=3);
  const status=done?'submitted':(Number(r.phase||0)>0||r.strategicView||r.year1||r.year2||Number(r.screen||0)>0)?'progress':'waiting';
  const timestamp=done?(r.completedAt||r.updatedAt):null;
  const submittedAt=timestamp?new Date(timestamp).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}):'';
  const o=r.outcomes||{};
  return {...g,individual,status,leadId:lead?.id||null,runnerId:runner?.id||null,lead:lead?.name||'Not selected',runner:runner?.name||'Not selected',members:g.people.map(p=>p.name),submittedAt,strategicView:r.strategicView||'',reflection1:r.reflection1||reflection.reflection1||'',reflection2:r.reflection2||reflection.reflection2||'',year1:r.year1||null,year2:r.year2||null,outcomes:o,result:o.year3?{band:o.year3.band,buyers:Object.fromEntries(['carrolton','ridge_hollow','corven'].map(k=>[k,o.buyers?.[k]?.interest||'']))}:null};
 }).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true})||a.id.localeCompare(b.id));
}
function create(root,options){
 let cfg=options,page=options.state.session.state==='lobby'?'manage':'results',actionBusy=false,lastData='',lastManage='',pendingPaint=false;
 const draft={teamCount:'',newTeamName:'',newTeamMember:''};
 root.innerHTML="<svg xmlns=\"http://www.w3.org/2000/svg\" style=\"display:none\" aria-hidden=\"true\">\n<symbol id=\"i-grid\" viewBox=\"0 0 24 24\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.5\"/></symbol>\n<symbol id=\"i-check\" viewBox=\"0 0 24 24\"><path d=\"m5 12 4 4L19 6\"/></symbol>\n<symbol id=\"i-circle-check\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"m8 12 3 3 5-6\"/></symbol>\n<symbol id=\"i-users\" viewBox=\"0 0 24 24\"><path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"/></symbol>\n<symbol id=\"i-clock\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/></symbol>\n<symbol id=\"i-file\" viewBox=\"0 0 24 24\"><path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6M8 13h8m-8 4h5\"/></symbol>\n<symbol id=\"i-download\" viewBox=\"0 0 24 24\"><path d=\"M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4\"/></symbol>\n<symbol id=\"i-compare\" viewBox=\"0 0 24 24\"><rect x=\"3\" y=\"4\" width=\"7\" height=\"16\" rx=\"1.5\"/><rect x=\"14\" y=\"4\" width=\"7\" height=\"16\" rx=\"1.5\"/></symbol>\n<symbol id=\"i-search\" viewBox=\"0 0 24 24\"><circle cx=\"10.5\" cy=\"10.5\" r=\"6.5\"/><path d=\"m16 16 5 5\"/></symbol>\n<symbol id=\"i-chevron\" viewBox=\"0 0 24 24\"><path d=\"m9 5 7 7-7 7\"/></symbol>\n<symbol id=\"i-left\" viewBox=\"0 0 24 24\"><path d=\"m14 6-6 6 6 6\"/></symbol>\n<symbol id=\"i-right\" viewBox=\"0 0 24 24\"><path d=\"m10 6 6 6-6 6\"/></symbol>\n<symbol id=\"i-printer\" viewBox=\"0 0 24 24\"><path d=\"M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\"/><path d=\"M6 14h12v8H6zM18 12h.01\"/></symbol>\n<symbol id=\"i-info\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11v6m0-10h.01\"/></symbol>\n<symbol id=\"i-sliders\" viewBox=\"0 0 24 24\"><path d=\"M4 6h16M4 12h16M4 18h16\"/><rect x=\"7\" y=\"4\" width=\"3\" height=\"4\" fill=\"currentColor\" stroke=\"none\" rx=\"1\"/><rect x=\"15\" y=\"10\" width=\"3\" height=\"4\" fill=\"currentColor\" stroke=\"none\" rx=\"1\"/><rect x=\"9\" y=\"16\" width=\"3\" height=\"4\" fill=\"currentColor\" stroke=\"none\" rx=\"1\"/></symbol>\n<symbol id=\"i-flag\" viewBox=\"0 0 24 24\"><path d=\"M4 22V3m0 1c5-5 10 5 16 0v11c-6 5-11-5-16 0\"/></symbol>\n<symbol id=\"i-close\" viewBox=\"0 0 24 24\"><path d=\"m6 6 12 12M18 6 6 18\"/></symbol>\n<symbol id=\"i-shield\" viewBox=\"0 0 24 24\"><path d=\"M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z\"/><path d=\"m8 12 3 3 5-6\"/></symbol>\n</svg><div class=\"fw-session-head\"><div><p class=\"eyebrow\">Midland Equipment · SIM03</p><h2 id=\"fw-session-name\"></h2><p id=\"fw-session-state\" class=\"section-description\"></p></div><div class=\"fw-header-actions\"><button class=\"btn\" id=\"fw-refresh\">Refresh students</button><a class=\"btn\" id=\"courseAccess\" target=\"_blank\" rel=\"noopener\">Course access</a></div></div>\n<div id=\"faculty-error\" role=\"alert\"></div><div id=\"fw-error\" role=\"alert\" hidden></div>\n<nav class=\"fw-nav\" aria-label=\"Session workspace\"><button class=\"btn\" data-view=\"manage\" id=\"manage-tab\">Manage session</button><button class=\"btn\" data-view=\"results\" id=\"results-tab\">Team results</button></nav>\n<section id=\"manage-view\" aria-labelledby=\"manage-title\"><div id=\"manage-content\"></div><details class=\"advanced fw-advanced\" id=\"fw-advanced\"><summary>Advanced settings and instructor notes</summary><div id=\"fw-advanced-content\"></div></details></section>\n<section id=\"results-view\"> <div class=\"page-heading\">\n  <div><h1 id=\"results-title\">Team results</h1><p class=\"subtitle\">Every team, one shared result. Choose a team to read its responses.</p></div>\n  <div class=\"heading-actions\"><button class=\"btn\" id=\"compare-btn\"><svg class=\"icon icon-sm\" aria-hidden=\"true\"><use href=\"#i-compare\"/></svg>Compare teams</button><button class=\"btn btn-primary\" id=\"export-btn\" title=\"Export all saved team records as CSV\"><svg class=\"icon icon-sm\" aria-hidden=\"true\"><use href=\"#i-download\"/></svg>Export responses</button></div>\n </div>\n <section class=\"stats\" aria-label=\"Session summary\">\n  <div class=\"stat\"><span class=\"stat-icon\"><svg class=\"icon\" aria-hidden=\"true\"><use href=\"#i-users\"/></svg></span><div><div class=\"stat-number\" id=\"total-stat\">0</div><div class=\"stat-label\">Total teams</div></div></div>\n  <div class=\"stat\"><span class=\"stat-icon green\"><svg class=\"icon\" aria-hidden=\"true\"><use href=\"#i-circle-check\"/></svg></span><div><div class=\"stat-number\" id=\"submitted-stat\">0</div><div class=\"stat-label\">Submitted</div></div></div>\n  <div class=\"stat\"><span class=\"stat-icon amber\"><svg class=\"icon\" aria-hidden=\"true\"><use href=\"#i-clock\"/></svg></span><div><div class=\"stat-number\" id=\"progress-stat\">0</div><div class=\"stat-label\">In progress</div></div></div>\n  <div class=\"stat\"><span class=\"stat-icon\"><svg class=\"icon\" aria-hidden=\"true\"><use href=\"#i-file\"/></svg></span><div><div class=\"stat-number\" id=\"waiting-stat\">0</div><div class=\"stat-label\">Not started</div></div></div>\n </section>\n <div class=\"workspace\">\n  <aside class=\"team-sidebar\" aria-label=\"Choose a team\">\n   <div class=\"sidebar-top\">\n    <div class=\"sidebar-title\"><h2>Teams</h2><span class=\"count\" id=\"visible-count\">0</span></div>\n    <div class=\"search-field\"><svg class=\"icon icon-sm\" aria-hidden=\"true\"><use href=\"#i-search\"/></svg><label class=\"sr-only\" for=\"team-search\">Search by team or student name</label><input type=\"search\" id=\"team-search\" placeholder=\"Search team or student…\" autocomplete=\"off\" spellcheck=\"false\"><button class=\"search-clear\" id=\"clear-search\" aria-label=\"Clear search\" hidden><svg class=\"icon icon-sm\" aria-hidden=\"true\"><use href=\"#i-close\"/></svg></button></div>\n    <div class=\"filter-row\" role=\"group\" aria-label=\"Filter teams by submission status\"><button class=\"filter\" data-filter=\"all\" aria-pressed=\"true\">All</button><button class=\"filter\" data-filter=\"submitted\" aria-pressed=\"false\">Submitted</button><button class=\"filter\" data-filter=\"pending\" aria-pressed=\"false\">Pending</button></div>\n   </div>\n   <button class=\"btn fw-all\" id=\"all-teams-btn\">All team results</button><div class=\"team-list\" id=\"team-list\"></div>\n   <div class=\"list-footer\"><svg class=\"icon icon-sm\" aria-hidden=\"true\"><use href=\"#i-users\"/></svg>One shared response per team</div>\n  </aside>\n  <section class=\"response-panel\" aria-labelledby=\"response-heading\">\n   <div class=\"response-header\" id=\"response-header\"></div>\n   <div class=\"tabs\" role=\"tablist\" aria-label=\"Team response sections\" id=\"response-tabs\">\n    <button class=\"tab\" id=\"tab-answers\" role=\"tab\" aria-selected=\"true\" aria-controls=\"response-content\" data-tab=\"answers\" tabindex=\"0\"><svg class=\"icon icon-sm\" aria-hidden=\"true\"><use href=\"#i-file\"/></svg>Written answers <span class=\"tab-count\" id=\"answer-count\">3</span></button>\n    <button class=\"tab\" id=\"tab-decisions\" role=\"tab\" aria-selected=\"false\" aria-controls=\"response-content\" data-tab=\"decisions\" tabindex=\"-1\"><svg class=\"icon icon-sm\" aria-hidden=\"true\"><use href=\"#i-sliders\"/></svg>Decisions</button>\n    <button class=\"tab\" id=\"tab-outcomes\" role=\"tab\" aria-selected=\"false\" aria-controls=\"response-content\" data-tab=\"outcomes\" tabindex=\"-1\"><svg class=\"icon icon-sm\" aria-hidden=\"true\"><use href=\"#i-flag\"/></svg>Outcomes</button>\n   </div>\n   <div class=\"panel-body\" id=\"response-content\" role=\"tabpanel\" aria-labelledby=\"tab-answers\" tabindex=\"0\"></div>\n   <div class=\"panel-footer\" id=\"response-footer\"></div>\n  </section>\n </div>\n \n<details id=\"fw-debrief\" class=\"fw-advanced\"><summary>Class debrief charts (optional)</summary><div class=\"legacy-debrief\" id=\"fw-debrief-content\"></div><button class=\"btn\" id=\"fw-present\">Present debrief</button></details></section>\n<div id=\"fw-startbar\" class=\"fw-startbar\"></div>\n<dialog id=\"compare-dialog\" aria-labelledby=\"compare-heading\" aria-describedby=\"compare-description\">\n <div class=\"dialog-header\"><div><h2 id=\"compare-heading\">Compare team answers</h2><p id=\"compare-description\">The same question, two teams. Only submitted teams are shown.</p></div><button class=\"icon-button\" id=\"close-compare\" aria-label=\"Close comparison\"><svg class=\"icon\" aria-hidden=\"true\"><use href=\"#i-close\"/></svg></button></div>\n <div class=\"dialog-body\"><div class=\"compare-toolbar\" role=\"group\" aria-label=\"Choose a question to compare\"><button class=\"compare-filter\" data-question=\"0\" aria-pressed=\"true\">Opening view</button><button class=\"compare-filter\" data-question=\"1\" aria-pressed=\"false\">Reflection 1</button><button class=\"compare-filter\" data-question=\"2\" aria-pressed=\"false\">Reflection 2</button></div><div class=\"compare-question\" id=\"compare-question\"></div><div class=\"compare-grid\"><section class=\"compare-card\"><div class=\"compare-card-top\"><label for=\"compare-left\">First team</label><select id=\"compare-left\"></select><div class=\"compare-student\" id=\"compare-members-left\"></div></div><p class=\"compare-answer\" id=\"compare-answer-left\"></p></section><section class=\"compare-card\"><div class=\"compare-card-top\"><label for=\"compare-right\">Second team</label><select id=\"compare-right\"></select><div class=\"compare-student\" id=\"compare-members-right\"></div></div><p class=\"compare-answer\" id=\"compare-answer-right\"></p></section></div></div>\n <div class=\"dialog-footer\">Saved team responses · No score, ranking, or automated judgment.</div>\n</dialog>\n<div id=\"toast\" class=\"toast\" role=\"status\" hidden></div>\n<div id=\"announcer\" class=\"sr-only\" role=\"status\" aria-live=\"polite\" aria-atomic=\"true\"></div>\n<div id=\"print-sheet\" class=\"print-sheet\"></div>\n";


const QUESTIONS = [
 {label:'Opening view', key:'strategicView', prompt:'Midland should become a company that can ___ for customers by ___.', followup:''},
 {label:'Reflection 1', key:'reflection1', prompt:'Which of Dale, Renata, Tom, or Sam did you overrule most?', followup:'After seeing Year 3, would you make the same call? Why or why not?'},
 {label:'Reflection 2', key:'reflection2', prompt:'If you could change one Year 1 million after seeing Year 3, where would it move and why?', followup:''}
];
let TEAMS = [];
const LINES = [
 ['run','Run','Keep existing systems running'],
 ['uptime','Uptime','Protect dispatch and availability'],
 ['capacity','Capacity','Create processing headroom'],
 ['connect','Connect','Bring back data from field units'],
 ['features','Features','Deliver visible new capabilities']
];
const state={selected:'all',filter:'all',query:'',tab:'answers',compareQuestion:0,compareLeft:null,compareRight:null};
const $=id=>root.querySelector(`#${id}`);
const icon=(name,cls='')=>`<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusLabel=status=>({submitted:'Submitted',progress:'In progress',waiting:'Not started'}[status]||status);
const selectedTeam=()=>TEAMS.find(t=>t.id===state.selected)||null;
const visibleTeams=()=>TEAMS.filter(t=>(state.filter==='all'||(state.filter==='submitted'?t.status==='submitted':t.status!=='submitted'))&&(`${t.name} ${t.members.join(' ')} ${t.lead} ${t.runner}`).toLocaleLowerCase().includes(state.query.toLocaleLowerCase()));
const answerCount=t=>QUESTIONS.filter(q=>Boolean(t[q.key]?.trim())).length;
const total=a=>a?LINES.reduce((n,[key])=>n+(a[key]||0),0):null;
const badge=t=>`<span class="badge ${t.status}">${icon(t.status==='submitted'?'check':t.status==='progress'?'clock':'file','icon-sm')}${statusLabel(t.status)}</span>`;
function announce(text){$('announcer').textContent=text;}
function showToast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>$('toast').hidden=true,4300);}
function renderList(){
 const visible=visibleTeams();
 $('visible-count').textContent=visible.length;
 $('clear-search').hidden=!$('team-search').value;
 root.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===state.filter)));
 $('team-list').innerHTML=visible.length?visible.map(t=>`<button class="team-item" data-team="${esc(t.id)}" aria-pressed="${state.selected===t.id}" aria-label="${esc(t.name)}, ${esc(t.members.join(' and '))}, ${statusLabel(t.status)}"><span class="team-line"><span class="team-name">${esc(t.name)}</span>${state.selected===t.id?`<span class="selected-mark">${icon('chevron','icon-sm')}</span>`:''}</span><span class="team-members" style="display:block">${esc(t.members.join(' · '))}</span><span class="team-status ${t.status}"><span class="status-dot"></span>${statusLabel(t.status)}</span></button>`).join(''):'<p class="empty-list">No matching teams.<br>Try another name or clear the filters.</p>';
}
function renderHeader(t){
 if(!t){$('response-header').innerHTML='<h2 id="response-heading" tabindex="-1">All team results</h2>';$('response-tabs').hidden=true;return;}
 const identity=t.people.map(person=>{ const name=person.name;
  const role=t.individual?'Student':person?.id===t.leadId&&person?.id===t.runnerId?'Lead & runner':person?.id===t.leadId?'Team lead':person?.id===t.runnerId?'Selected runner':'Member';
  return `<span class="member-chip"><span class="member-avatar" aria-hidden="true">${esc(name.slice(0,1))}</span><span>${esc(name)} <span class="member-role">${role}</span></span>`;
 }).join('');
 const time=t.status==='submitted'?`Submitted by ${esc(t.runner)} · ${esc(t.submittedAt)}`:t.status==='progress'?'Saved work · Final response not submitted':'Waiting for the runner to start';
 const note=t.individual?'This is the student’s individual run.':t.status==='submitted'?'One submission for the whole team. All members share this result.':'Only the selected runner completes and submits the shared team response.';
 $('response-header').innerHTML=`<div class="team-header-line"><div><div class="heading-with-badge"><h2 id="response-heading" tabindex="-1">${esc(t.name)}</h2>${badge(t)}</div><p class="submitted-time">${time}</p></div><button class="btn btn-quiet" id="print-btn" aria-label="Print all sections for ${esc(t.name)}" title="Print this team’s answers, decisions, and outcomes">${icon('printer','icon-sm')}<span class="print-label">Print team</span></button></div><div class="team-identity">${identity}</div><p class="shared-note">${icon('users','icon-sm')}${note}</p>`;
 $('response-tabs').hidden=false;
 $('answer-count').textContent=answerCount(t);
 $('print-btn').onclick=()=>{buildPrintSheet();window.print();};
}
function emptyPanel(title,description,clear=false){return `<div class="empty-panel"><div class="empty-icon">${icon('file','icon-lg')}</div><h3>${esc(title)}</h3><p>${esc(description)}</p>${clear?'<button class="btn" id="reset-filters">Clear search and filters</button>':''}</div>`;}
function renderAnswers(t){
 if(t.status==='waiting')return emptyPanel('No response yet',`${t.runner} has not started the simulation. The team’s answers will appear here after they are saved. Other members do not need to submit separately.`);
 return `${t.status==='progress'?`<div class="work-in-progress">${icon('clock','icon-sm')}<span><strong>This team is still playing.</strong> The opening view is saved work, not a final submission. Reflections are not yet submitted.</span></div>`:''}<div class="panel-intro"><span>${icon('file','icon-sm')}${answerCount(t)} of 3 written answers ${t.status==='submitted'?'submitted':'saved'}</span><span class="sample-tag">SAVED RESPONSES</span></div>${QUESTIONS.map((q,i)=>`<article class="response-block"><div class="question-kicker"><span class="question-number">0${i+1}</span><span class="question-label">${q.label}</span></div><h3 class="question-title">${esc(q.prompt)}</h3>${q.followup?`<p class="question-followup">${esc(q.followup)}</p>`:''}<p class="answer-text ${!t[q.key]?'pending':''}">${esc(t[q.key]||(t.status==='submitted'?'No response was recorded for this shared run. No additional member submission is required.':'Not submitted yet.'))}</p></article>`).join('')}`;
}
function renderDecisions(t){
 if(!t.year1&&!t.year2)return emptyPanel('No decisions saved yet','The annual allocations will appear here once the runner commits them.');
 const val=(a,key)=>a?`$${a[key]}M`:'—';
 return `<div class="section-heading"><h3>Annual budget allocations</h3></div><p class="section-description">What the team committed in each decision year.</p><div class="budget-note">${icon('info','icon-sm')}Each year has a $9M budget. There is no new allocation in Year 3.</div><div class="table-wrap"><table class="decision-table"><caption class="sr-only">${esc(t.name)} budget allocations in millions of dollars</caption><thead><tr><th scope="col">Investment area</th><th class="numeric" scope="col">Year 1</th><th class="numeric" scope="col">Year 2</th></tr></thead><tbody>${LINES.map(([key,label,desc])=>`<tr><td><strong>${label}</strong><span class="line-description">${desc}</span></td><td class="numeric">${val(t.year1,key)}</td><td class="numeric">${val(t.year2,key)}</td></tr>`).join('')}</tbody><tfoot><tr><td>Total allocated</td><td class="numeric">${t.year1?`$${total(t.year1)}M`:'—'}</td><td class="numeric">${t.year2?`$${total(t.year2)}M`:'—'}</td></tr></tfoot></table></div><p class="table-note">${!t.year2?'Year 2 has not been committed. A dash means “not submitted,” not zero.':'Both annual allocations are shown exactly as committed.'}</p><p class="table-note">Allocations belong to the team’s shared run, not to separate attempts by each member.</p>`;
}
function renderOutcomes(t){
 const o=t.outcomes||{};
 if(!Object.keys(o).length)return emptyPanel('No outcomes recorded yet','Outcomes appear here as the runner reaches them. Other team members do not need to submit separately.');
 const y3=o.year3;
 const events=[['Year 1 · Customer reporting',o.year1],['Year 2 · Heat wave',o.year2?.heat],['Year 2 · Competitor response',o.year2?.competitor]].filter(([,v])=>v);
 return `${y3?`<div class="result-banner"><span class="result-icon">${icon('flag')}</span><div><div class="eyebrow">Year 3 · ${esc(bandLabel(y3.band))}</div><h3>${esc(y3.title)}</h3><p>${esc(y3.narrative)}</p></div></div>`:'<p class="budget-note">Year 3 has not been reached yet. Earlier outcomes are shown below.</p>'}<h3>What happened along the way</h3><div class="event-list">${events.map(([label,v])=>`<div class="event-row"><div><strong>${esc(label)} · ${esc(v.title)}</strong><p>${esc(v.narrative)}</p></div><span class="outcome-chip">${esc(bandLabel(v.band))}</span></div>`).join('')}</div>${o.buyers?`<h3>Buyer interest</h3><div class="buyer-list">${['carrolton','ridge_hollow','corven'].map(k=>o.buyers[k]).filter(Boolean).map(b=>`<div class="buyer-row"><div><strong>${esc(b.name)}</strong><small>${esc(b.reason)}</small></div><span class="outcome-chip">${esc(b.interest)}</span></div>`).join('')}</div>`:''}<p class="table-note">These are the saved simulation outcomes, not a score, ranking or winner.</p>`;
}
function renderContent(){
 const t=selectedTeam();
 root.querySelectorAll('[data-tab]').forEach(b=>{const active=b.dataset.tab===state.tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
 $('response-content').setAttribute('aria-labelledby',`tab-${state.tab}`);
 $('response-content').innerHTML=state.selected==='all'?renderOverview():!t?emptyPanel('No matching teams','Try a different team or student name, or clear your filters.',true):state.tab==='answers'?renderAnswers(t):state.tab==='decisions'?renderDecisions(t):renderOutcomes(t);
 const reset=$('reset-filters');if(reset)reset.onclick=resetFilters;
 buildPrintSheet();
}
function renderFooter(){
 const teams=visibleTeams(),index=teams.findIndex(t=>t.id===state.selected);
 $('response-footer').hidden=!teams.length||state.selected==='all';
 $('response-footer').innerHTML=`<span class="footer-position">Team ${index+1} of ${teams.length}${state.filter!=='all'||state.query?' matching':''}</span><div class="pager"><button class="btn btn-quiet" id="previous-team" ${index<=0?'disabled':''}>${icon('left','icon-sm')}Previous</button><button class="btn" id="next-team" ${index>=teams.length-1?'disabled':''}>Next team${icon('right','icon-sm')}</button></div>`;
 $('previous-team').onclick=()=>selectTeam(teams[index-1]?.id,true);
 $('next-team').onclick=()=>selectTeam(teams[index+1]?.id,true);
}
function renderAll(){const teams=visibleTeams();if(state.selected!=='all'&&!teams.some(t=>t.id===state.selected))state.selected=teams[0]?.id||null;renderList();renderHeader(selectedTeam());renderContent();renderFooter();}
function selectTeam(id,focus=false){if(!TEAMS.some(t=>t.id===id))return;state.selected=id;renderAll();announce(`${selectedTeam().name} selected. ${statusLabel(selectedTeam().status)}. ${state.tab==='answers'?'Written answers':state.tab} displayed.`);if(focus)$('response-heading').focus({preventScroll:true});}
function resetFilters(){state.filter='all';state.query='';$('team-search').value='';renderAll();$('team-search').focus();announce('Search and filters cleared. All teams shown.');}
$('team-list').addEventListener('click',event=>{const b=event.target.closest('[data-team]');if(b)selectTeam(b.dataset.team);});
$('team-search').addEventListener('input',()=>{state.query=$('team-search').value.trim();renderAll();announce(`${visibleTeams().length} matching teams.`);});
$('clear-search').onclick=()=>{$('team-search').value='';state.query='';renderAll();$('team-search').focus();announce('Search cleared.');};
root.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;renderAll();announce(`${visibleTeams().length} teams shown with ${b.textContent.toLowerCase()} filter.`);});
function switchTab(tab,focus=false){state.tab=tab;renderContent();if(focus)$(`tab-${tab}`).focus();announce(`${tab==='answers'?'Written answers':tab} displayed for ${selectedTeam()?.name||'the selected team'}.`);}
root.querySelectorAll('[data-tab]').forEach(b=>{
 b.onclick=()=>switchTab(b.dataset.tab);
 b.onkeydown=event=>{const tabs=['answers','decisions','outcomes'];let index=tabs.indexOf(state.tab);if(event.key==='ArrowRight')index=(index+1)%3;else if(event.key==='ArrowLeft')index=(index+2)%3;else if(event.key==='Home')index=0;else if(event.key==='End')index=2;else return;event.preventDefault();switchTab(tabs[index],true);};
});
// A single team record is exported once. Members do not create duplicate response rows.
function csvCell(value){let text=String(value??'');if(/^[=+\-@\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}
function makeCsv(){
 const columns=['Team','Status','Team lead','Selected runner','Members','Submitted at','Opening view','Reflection 1','Reflection 2',...LINES.map(([,l])=>'Year 1 '+l+' ($M)'),...LINES.map(([,l])=>'Year 2 '+l+' ($M)'),'Year 3 band','Carrolton interest','Ridge Hollow interest','Corven interest','Session'];
 const rows=TEAMS.map(t=>[t.name,statusLabel(t.status),t.lead,t.runner,t.members.join('; '),t.submittedAt||'',t.strategicView,t.reflection1,t.reflection2,...LINES.map(([key])=>t.year1?.[key]??''),...LINES.map(([key])=>t.year2?.[key]??''),t.result?.band||'',t.result?.buyers.carrolton||'',t.result?.buyers.ridge_hollow||'',t.result?.buyers.corven||'',cfg.state.session.code]);
 return '\uFEFF'+[columns,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');
}
$('export-btn').onclick=()=>{const blob=new Blob([makeCsv()],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`SIM03_${cfg.state.session.code}_team_responses.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast(`Exported ${TEAMS.length} records. One row per shared run.`);};
// Comparison: native, readable selects. A team cannot be compared with itself.
const completedTeams=()=>TEAMS.filter(t=>t.status==='submitted');
function fillCompareSelects(){for(const side of ['left','right']){const chosen=state[side==='left'?'compareLeft':'compareRight'];const opposite=state[side==='left'?'compareRight':'compareLeft'];$(`compare-${side}`).innerHTML=completedTeams().map(t=>`<option value="${esc(t.id)}" ${t.id===chosen?'selected':''} ${t.id===opposite?'disabled':''}>${esc(t.name)} · ${esc(t.members.join(' & '))}</option>`).join('');}}
function renderComparison(){const q=QUESTIONS[state.compareQuestion];$('compare-question').innerHTML=`<h3>${esc(q.prompt)}</h3>${q.followup?`<p>${esc(q.followup)}</p>`:''}`;root.querySelectorAll('[data-question]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.question)===state.compareQuestion)));fillCompareSelects();for(const side of ['left','right']){const t=TEAMS.find(t=>t.id===state[side==='left'?'compareLeft':'compareRight']);$(`compare-answer-${side}`).textContent=t?.[q.key]||'No response recorded.';$(`compare-members-${side}`).textContent=t?`Submitted by ${t.runner} for ${t.members.join(' and ')}`:'No team available';}}
$('compare-btn').onclick=()=>{
 const submitted=completedTeams();if(submitted.length<2){showToast('Two submitted teams are needed for comparison.');return;}
 state.compareLeft=selectedTeam()?.status==='submitted'?state.selected:submitted[0].id;
 state.compareRight=submitted.find(t=>t.id!==state.compareLeft).id;renderComparison();$('compare-dialog').showModal();
};
$('close-compare').onclick=()=>$('compare-dialog').close();
$('compare-dialog').addEventListener('click',event=>{if(event.target!==$('compare-dialog'))return;const r=$('compare-dialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('compare-dialog').close();});
root.querySelectorAll('[data-question]').forEach(b=>b.onclick=()=>{state.compareQuestion=Number(b.dataset.question);renderComparison();});
for(const side of ['left','right'])$(`compare-${side}`).onchange=()=>{state[side==='left'?'compareLeft':'compareRight']=$(`compare-${side}`).value;renderComparison();};
function buildPrintSheet(){const selected=selectedTeam(),list=selected?[selected]:TEAMS;$('print-sheet').innerHTML=list.map(t=>`<article><p class="eyebrow">RapidSims · SIM03 · Faculty report</p><h1>${esc(cfg.state.session.name)} — ${esc(t.name)}</h1><p class="print-meta">Session ${esc(cfg.state.session.code)} · ${statusLabel(t.status)}<br>Members: ${esc(t.members.join(', '))}<br>Team lead: ${esc(t.lead)} · Runner: ${esc(t.runner)}${t.submittedAt?`<br>Submitted: ${esc(t.submittedAt)}`:''}</p><section class="print-section"><h2>Written answers</h2>${QUESTIONS.map(q=>`<div class="print-card"><h3>${esc(q.prompt)}</h3>${q.followup?`<p>${esc(q.followup)}</p>`:''}<p style="white-space:pre-wrap">${esc(t[q.key]||'No response recorded.')}</p></div>`).join('')}</section><section class="print-section"><h2>Decisions</h2>${renderDecisions(t)}</section><section class="print-section"><h2>Outcomes</h2>${renderOutcomes(t)}</section></article>`).join('');}
window.addEventListener('beforeprint',buildPrintSheet);

function allowedPeople(){
 const all=Object.values(cfg.state.participants||{}).filter(Boolean);
 const allowed=cfg.roster?.available?new Set(cfg.roster.students.filter(p=>p.accessReleased===true).map(p=>p.participantId)):null;
 return all.filter(p=>!allowed||allowed.has(p.id)).sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}
function setupStatus(){
 const s=cfg.state.session,people=allowedPeople();
 if(s.mode!=='team')return {ready:true,message:'Ready to start',detail:'Each student will run the simulation individually.'};
 if(s.platformAuth&&s.courseId&&!cfg.roster)return {ready:false,message:'Loading approved students',detail:'The course list is being checked. You do not need to ask students to start the simulation.'};
 if(s.platformAuth&&s.courseId&&(!cfg.roster?.available||cfg.rosterError))return {ready:false,message:'Refresh the approved student list',detail:cfg.rosterError||'Course approval could not be checked. Existing results are still available.'};
 const approved=new Set(people.map(p=>p.id));
 const inactive=Object.values(cfg.state.participants||{}).filter(p=>p?.groupId&&!approved.has(p.id));
 if(inactive.length)return {ready:false,message:'Review students without course access',detail:'Unassign students whose approval was removed, or restore access on the course page.'};
 if(!people.length)return {ready:false,message:s.platformAuth?'Approve students on the course page':'Share the session link',detail:s.platformAuth?'Approved names will appear here automatically. No student needs to click Start sim first.':'Students join with the session link, then you can create teams.'};
 const unassigned=people.filter(p=>!p.groupId);
 if(unassigned.length)return {ready:false,message:`Assign ${unassigned.length} student${unassigned.length===1?'':'s'} to a team`,detail:'Use Auto split teams, or assign students individually below.'};
 const groups=TEAMS.filter(t=>t.people.length);
 const noLead=groups.filter(t=>!t.leadId);
 if(noLead.length)return {ready:false,message:`Choose a team lead for ${noLead.map(t=>t.name).join(', ')}`,detail:'Every team needs one lead. The lead runs by default and may select another team member.'};
 return {ready:true,message:'Teams are ready',detail:`${people.length} students assigned across ${groups.length} teams. Each team has one runner. Students do not need to open the simulation before you start.`};
}
function renderOverview(){
 const list=visibleTeams();
 if(!TEAMS.length)return emptyPanel('No team results yet',cfg.state.session.mode==='team'?'Create teams in Manage session. Every team will appear here, including teams that have not started.':'Students will appear here once they join this individual session.');
 if(!list.length)return emptyPanel('No matching teams','Clear the filters or search for another team or student name.',true);
 return `<p class="section-description">Select a team to read its full answers, decisions and outcomes. Each shared run appears once.</p><div class="table-wrap"><table class="decision-table fw-overview"><thead><tr><th>Team / students</th><th>Status</th><th>Year 3 outcome</th><th><span class="sr-only">Open result</span></th></tr></thead><tbody>${list.map(t=>`<tr><td><strong>${esc(t.name)}</strong><span class="line-description">${esc(t.members.join(' · ')||'Saved run')}</span></td><td>${badge(t)}</td><td>${esc(bandLabel(t.result?.band))}</td><td><button class="btn" data-open-team="${esc(t.id)}" aria-label="View ${esc(t.name)} result">View</button></td></tr>`).join('')}</tbody></table></div><p class="table-note">Not started and In progress are submission statuses, not grades.</p><button class="btn" id="print-all">${icon('printer','icon-sm')}Print all results</button>`;
}
function renderManage(){
 const s=cfg.state.session,people=allowedPeople(),groups=TEAMS.filter(t=>t.people.length),editable=s.state!=='closed';
 const openDetails=[...root.querySelectorAll('#manage-content details[open]')].map(d=>d.id);
 const signature=JSON.stringify([s,people,groups.map(t=>[t.id,t.leadId,t.runnerId,t.people]),cfg.roster,cfg.rosterError]);
 if(signature===lastManage)return;
 if(root.contains(document.activeElement)&&/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)&&document.activeElement.closest('#manage-content')&&!document.activeElement.readOnly&&!document.activeElement.disabled){pendingPaint=true;return;}
 lastManage=signature;pendingPaint=false;
 const unassigned=people.filter(p=>!p.groupId),allowed=new Set(people.map(p=>p.id));
 const n=people.length,suggested=n<=1?1:Math.min(n,Math.max(2,Math.ceil(n/4)));
 const choices=(current)=>groups.filter(g=>g.id!==current).map(g=>`<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('');
 const moveRow=(p,inside)=>`<div class="fw-person" data-person-id="${esc(p.id)}"><div><strong>${esc(p.name)}</strong><small>${!allowed.has(p.id)?'Course access no longer approved':p.joinedAt?'Opened the simulation':'Approved · not opened yet'}</small></div><label class="sr-only" for="move-${esc(p.id)}">Assign ${esc(p.name)} to team</label><select id="move-${esc(p.id)}" class="fw-move" data-pid="${esc(p.id)}" ${!editable||actionBusy?'disabled':''}><option value="">${inside?'Move student…':'Assign to team…'}</option>${choices(p.groupId)}${inside?'<option value="__unassigned__">Unassign</option>':''}</select></div>`;
 $('manage-content').innerHTML=`<h1 id="manage-title">${s.state==='lobby'?'Prepare your session':'Manage session'}</h1><p class="subtitle">${s.mode==='team'?'Approve students → Create teams → Choose runners → Start session':'Share the link, then start the individual session when your class is ready.'}</p><section class="fw-share fw-card"><div><h3>Student session link</h3><p class="section-description">${s.mode==='team'?'Students open their existing team assignment. Only the selected runner can play and submit.':'Share this link with your students.'}</p></div><div class="fw-link"><label class="sr-only" for="join">Student session link</label><input id="join" readonly value="${esc(s.joinUrl||cfg.joinUrl)}"><button class="btn" id="copy">Copy link</button></div><p class="table-note">Session code <strong>${esc(s.code)}</strong></p></section>
 ${s.mode==='team'?`<section class="fw-card"><div class="fw-section-head"><div><h2>Team setup</h2><p class="section-description">${n} ${s.platformAuth?'approved':'joined'} students available. ${s.platformAuth?'Opening the simulation is not required for grouping.':''}</p></div><span class="badge waiting">${groups.length} teams</span></div>${s.state==='lobby'?`<div class="fw-split"><div class="fw-field"><label for="teamCount">Number of teams</label><input id="teamCount" type="number" min="1" max="${Math.max(1,n)}" value="${esc(draft.teamCount||suggested)}"></div><button class="btn btn-primary" id="autoSplit" ${!n||actionBusy||!!cfg.rosterError?'disabled':''}>Auto split teams</button></div><p class="table-note">Auto split uses all approved students. Existing teams are changed only when you choose to split again.</p>`:'<p class="table-note">The session has started. Existing teams and saved work are kept; use individual assignments for any late arrivals.</p>'}
 ${unassigned.length?`<div class="fw-unassigned"><h3>Unassigned students · ${unassigned.length}</h3>${unassigned.map(p=>moveRow(p,false)).join('')}</div>`:''}
 <div class="fw-team-grid">${groups.map(t=>`<article class="fw-team-card" data-group="${esc(t.id)}"><div class="fw-section-head"><h3>${esc(t.name)}</h3><button class="btn btn-quiet fw-rename" data-gid="${esc(t.id)}" data-label="${esc(t.name)}" ${!editable?'disabled':''}>Rename</button></div><div class="fw-field"><label for="lead-${esc(t.id)}">Team lead (default runner)</label><select class="team-lead fw-lead" id="lead-${esc(t.id)}" data-gid="${esc(t.id)}" ${!editable||actionBusy?'disabled':''}><option value="" ${!t.leadId?'selected':''}>Choose team lead</option>${t.people.map(p=>`<option value="${esc(p.id)}" ${p.id===t.leadId?'selected':''} ${!allowed.has(p.id)?'disabled':''}>${esc(p.name)}</option>`).join('')}</select><p class="table-note">Current runner: <strong>${esc(t.runner)}</strong>. Other members participate with this person and share the result.</p></div>${t.people.map(p=>moveRow(p,true)).join('')}</article>`).join('')}</div>
 ${editable?`<details id="fw-manual-team" class="fw-manual"><summary>Create a team manually</summary><div class="fw-split"><div class="fw-field"><label for="newTeamName">Team name</label><input id="newTeamName" maxlength="40" value="${esc(draft.newTeamName)}" placeholder="For example, Team 3"></div><div class="fw-field"><label for="newTeamMember">First student</label><select id="newTeamMember"><option value="">Choose a student</option>${unassigned.map(p=>`<option value="${esc(p.id)}" ${p.id===draft.newTeamMember?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div><button class="btn" id="createTeam" ${!unassigned.length||actionBusy?'disabled':''}>Create team</button></div></details>`:''}</section>`:`<section class="fw-card"><h2>Individual play</h2><p>Every student owns their own run. Team assignment and runner selection are not needed.</p></section>`}`;
 for(const id of openDetails){const d=$(id);if(d)d.open=true;}
}
function renderStart(){
 const s=cfg.state.session,ready=setupStatus();$('fw-startbar').hidden=page!=='manage';
 const buttons=s.state==='lobby'?`<button class="btn btn-primary" id="start-session" data-session-control="start" ${!ready.ready||actionBusy?'disabled':''}>${actionBusy?'Saving…':'Start session →'}</button>`:s.state==='running'?`<button class="btn btn-primary" data-session-control="${s.paused?'resume':'pause'}" ${actionBusy?'disabled':''}>${s.paused?'Resume session':'Pause session'}</button><button class="btn" data-view="results">View all team results</button><button class="btn fw-close" data-session-control="close" ${actionBusy?'disabled':''}>Close session</button>`:'<button class="btn btn-primary" data-view="results">View all team results</button>';
 $('fw-startbar').innerHTML=`<div class="fw-start-inner"><div><strong>${esc(s.state==='lobby'?ready.message:s.state==='closed'?'Session closed':s.paused?'Session paused':'Session running')}</strong><p>${esc(s.state==='lobby'?ready.detail:s.state==='closed'?'All saved responses and outcomes are available in Team results.':'Each team has one runner. All members share the same result.')}</p></div><div class="fw-start-actions">${buttons}</div></div>`;
}
function paintPage(){
 $('manage-view').hidden=page!=='manage';$('results-view').hidden=page!=='results';
 root.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-current',b.dataset.view===page?'page':'false'));
 renderStart();if(page==='manage')renderManage();
}
async function perform(action,success){
 if(actionBusy)return;actionBusy=true;renderStart();$('fw-error').hidden=true;delete $('fw-error').dataset.source;
 try{
  await action();await cfg.refresh();if(success)showToast(success);
 }catch(error){$('fw-error').textContent=error.message||'The action could not be saved. Please try again.';$('fw-error').hidden=false;}
 finally{actionBusy=false;lastManage='';paintPage();}
}
root.addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.view){page=b.dataset.view;paintPage();return;}
 if(b.dataset.openTeam){selectTeam(b.dataset.openTeam,true);return;}
 if(b.id==='all-teams-btn'){state.selected='all';renderAll();return;}
 if(b.id==='copy'){const input=$('join');navigator.clipboard?.writeText(input.value).then(()=>showToast('Student session link copied.')).catch(()=>{input.select();showToast('Select and copy the highlighted session link.');});if(!navigator.clipboard){input.select();showToast('Select and copy the highlighted session link.');}return;}
 if(b.id==='autoSplit'){
  const people=allowedPeople(),n=Number($('teamCount').value);
  if(!Number.isInteger(n)||n<1||n>people.length){showToast(`Choose between 1 and ${people.length} teams.`);return;}
  if(people.some(p=>p.groupId)&&!window.confirm('Split the approved students again? This changes their current team assignments.'))return;
  const assign={};people.forEach((p,i)=>assign[p.id]=`Team ${(i%n)+1}`);
  perform(()=>cfg.api({action:'group',code:cfg.state.session.code,assign}),'Teams created. Choose each team lead, then use Start session below.');return;
 }
 if(b.id==='createTeam'){
  const name=$('newTeamName').value.trim(),id=$('newTeamMember').value;
  if(!name||!id){showToast('Enter a team name and choose its first student.');return;}
  if(TEAMS.some(t=>t.name.toLowerCase()===name.toLowerCase())){showToast('That team name is already in use.');return;}
  perform(async()=>{await cfg.api({action:'group',code:cfg.state.session.code,assign:{[id]:name}});draft.newTeamName='';draft.newTeamMember='';},'Team created.');return;
 }
 if(b.classList.contains('fw-rename')){const label=window.prompt('Team name',b.dataset.label);if(!label?.trim())return;perform(()=>cfg.api({action:'rename_team',code:cfg.state.session.code,groupId:b.dataset.gid,teamLabel:label.trim()}),'Team renamed.');return;}
 if(b.dataset.sessionControl){
  const set=b.dataset.sessionControl;if(set==='close'&&!window.confirm('Close this session? Students will no longer be able to play. Saved results will remain available.'))return;
  perform(async()=>{await cfg.api({action:'control',code:cfg.state.session.code,set});if(set==='start'||set==='close')page='results';},set==='start'?'Session started—team runners can now begin.':set==='close'?'Session closed. All saved team results are available.':set==='pause'?'Session paused.':'Session resumed.');return;
 }
 if(b.id==='fw-refresh')perform(()=>cfg.refreshRoster(),'Approved student list refreshed.');
 if(b.id==='saveCal')perform(()=>{const thresholds={};root.querySelectorAll('.th').forEach(x=>thresholds[x.dataset.k]=Number(x.value));return cfg.api({action:'calibrate',code:cfg.state.session.code,thresholds});},'Session settings saved.');
 if(b.id==='export')$('export-btn').click();
 if(b.id==='fw-present')cfg.present();
 if(b.classList.contains('buyer-run')){cfg.selectDebrief('left',b.dataset.run);$('fw-debrief-content').innerHTML=cfg.debrief();}
 if(b.id==='print-all'){buildPrintSheet();window.print();}
});
root.addEventListener('input',event=>{if(Object.hasOwn(draft,event.target.id))draft[event.target.id]=event.target.value;});
root.addEventListener('change',event=>{
 const el=event.target;
 if(Object.hasOwn(draft,el.id))draft[el.id]=el.value;
 if(el.classList.contains('fw-lead')&&el.value)perform(()=>cfg.api({action:'set_captain',code:cfg.state.session.code,participantId:el.value}),'Team lead updated.');
 if(el.classList.contains('fw-move')&&el.value)perform(()=>cfg.api({action:'group',code:cfg.state.session.code,assign:{[el.dataset.pid]:el.value}}),'Team assignment saved.');
 if(el.id==='as'||el.id==='bs'){cfg.selectDebrief(el.id==='as'?'left':'right',el.value);$('fw-debrief-content').innerHTML=cfg.debrief();}
});
root.addEventListener('focusout',()=>{if(pendingPaint)setTimeout(()=>{renderManage();renderStart();},0);});
$('fw-advanced').addEventListener('toggle',()=>{if($('fw-advanced').open&&!$('fw-advanced-content').innerHTML)$('fw-advanced-content').innerHTML=cfg.advanced();});
$('fw-debrief').addEventListener('toggle',()=>{if($('fw-debrief').open)$('fw-debrief-content').innerHTML=cfg.debrief();});
$('compare-dialog').addEventListener('close',()=>{lastData='';update(cfg);$('compare-btn').focus();});
function update(options){
 cfg=options;const s=cfg.state.session;
 root.querySelectorAll('#fw-advanced-content .th, #fw-advanced-content #saveCal').forEach(el=>el.disabled=s.state!=='lobby'||actionBusy);
 TEAMS=recordsFrom(cfg.state);
 if(cfg.state.responsePrompts){const p=cfg.state.responsePrompts;QUESTIONS[0].prompt=p.opening;QUESTIONS[1].prompt=p.reflections[0];QUESTIONS[2].prompt=p.reflections[1];QUESTIONS[1].followup=p.followups?.[0]||'';}
 $('fw-session-name').textContent=s.name;
 $('fw-session-state').textContent=`Session ${s.code} · ${s.mode==='team'?'Team mode':'Individual mode'} · ${s.state==='lobby'?'Not started':s.state==='closed'?'Closed':s.paused?'Paused':'Running'}`;
 $('courseAccess').hidden=!cfg.courseUrl;$('courseAccess').href=cfg.courseUrl||'#';const waiting=cfg.roster?.students?.filter(p=>!p.accessReleased).length||0;$('courseAccess').textContent=waiting?`Course access (${waiting} waiting)`:'Course access';
 $('fw-refresh').hidden=!s.platformAuth||!s.courseId;$('fw-refresh').disabled=actionBusy;
 $('fw-refresh').textContent=cfg.rosterError?'Retry student list':'Refresh students';
 $('results-title').textContent=s.mode==='team'?'Team results':'Student results';$('results-tab').textContent=s.mode==='team'?'Team results':'Student results';root.querySelector('.stat-label').textContent=s.mode==='team'?'Total teams':'Total students';root.querySelector('#results-view .subtitle').textContent=s.mode==='team'?'Every team, one shared result. Choose a team to read its responses.':'Each student has their own result. Choose a student to read their responses.';
 $('total-stat').textContent=TEAMS.length;$('submitted-stat').textContent=TEAMS.filter(t=>t.status==='submitted').length;
 $('progress-stat').textContent=TEAMS.filter(t=>t.status==='progress').length;$('waiting-stat').textContent=TEAMS.filter(t=>t.status==='waiting').length;
 $('compare-btn').disabled=completedTeams().length<2;$('export-btn').disabled=!TEAMS.length;
 const signature=JSON.stringify(TEAMS);
 if(signature!==lastData&&!$('compare-dialog').open){lastData=signature;renderAll();}
 if(!cfg.rosterError&&$('fw-error').dataset.source==='roster'){$('fw-error').hidden=true;delete $('fw-error').dataset.source;}
 if(cfg.rosterError){$('fw-error').dataset.source='roster';$('fw-error').textContent=`Student list: ${cfg.rosterError} Saved team results remain available.`;$('fw-error').hidden=false;}
 paintPage();
 // Do not recreate open advanced settings, comparison selects, or debrief controls on polling.
}
return {code:cfg.state.session.code,update,dispose(){window.removeEventListener('beforeprint',buildPrintSheet);clearTimeout(showToast.timer);}};

}
let instance=null,instanceRoot=null;
global.MidlandFaculty={recordsFrom,render(options){let root=options.root.querySelector("#faculty-workspace");if(!root){options.root.innerHTML='<div id="faculty-workspace"></div>';root=options.root.firstElementChild;}if(instanceRoot!==root||instance?.code!==options.state.session.code){instance?.dispose();instance=create(root,options);instanceRoot=root;}instance.update(options);}};
})(typeof window!=="undefined"?window:globalThis);
