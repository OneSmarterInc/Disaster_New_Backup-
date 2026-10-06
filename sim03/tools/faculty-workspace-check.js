const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/faculty-workspace.js'),'utf8');
const context={};vm.createContext(context);vm.runInContext(source,context);
const records=context.MidlandFaculty.recordsFrom;
const snap={session:{mode:'team'},participants:{
 a:{id:'a',name:'Same Name',groupId:'team:one',teamLabel:'Team 1',isCaptain:true,joinedAt:null},
 b:{id:'b',name:'Same Name',groupId:'team:one',teamLabel:'Team 1',isCaptain:false,joinedAt:99},
 c:{id:'c',name:'Not started',groupId:'team:two',teamLabel:'Team 2',isCaptain:true},
 d:{id:'d',name:'Unassigned',groupId:null}},runs:{'team:one':{runId:'team:one',runnerId:'b',completedBy:'b',phase:3,done:false,strategicView:'Saved opening',year1:{run:3,uptime:2,capacity:1,connect:3,features:0},reflections:{a:{reflection1:'Do not use observer response'},b:{reflection1:'Runner response',reflection2:'Saved second response'}},outcomes:{year3:{band:'strong',narrative:'Saved server narrative'},buyers:{carrolton:{interest:'qualified'}}}}}};
let list=records(snap);
assert.equal(list.length,2,'one result per team, not per student');
assert.equal(list[0].runnerId,'b','same-name accounts keep separate roles');
assert.equal(list[0].status,'submitted','legacy completed team phase remains complete');
assert.equal(list[0].reflection1,'Runner response','show the completed runner reflection, never another member draft');
assert.equal(list[0].result.buyers.carrolton,'qualified','do not substitute prototype buyer levels');
assert.equal(list[0].outcomes.year3.narrative,'Saved server narrative');
assert.equal(list[1].status,'waiting','teams without runs still appear');
assert.equal(list[1].year1,null,'missing allocations are not fabricated zeros');
snap.runs.orphan={runId:'team:orphan',done:true};list=records(snap);
assert.equal(list.length,3,'saved result is not lost when its roster no longer has members');
assert.equal(list.find(x=>x.id==='team:orphan').status,'submitted');
const solo=records({session:{mode:'individual'},participants:{a:{id:'a',name:'Student'}},runs:{'individual:a':{runId:'individual:a',phase:3,done:false,reflection1:'Own answer'}}});
assert.equal(solo[0].status,'progress','team legacy completion rule must not auto-complete individual play');
assert.equal(solo[0].reflection1,'Own answer');
for(const marker of ['All team results','Start session →','data-session-control','Opening the simulation is not required for grouping','recordsFrom(cfg.state)','cfg.refreshRoster()','fw-startbar','compare-dialog','No response was recorded for this shared run'])assert(source.includes(marker),marker);
for(const marker of ['FICTIONAL RESPONSES','SIM03_DEMO','const TEAMS = [','Predictive service ready'])assert(!source.includes(marker),'prototype sample leaked: '+marker);
const html=fs.readFileSync(path.join(__dirname,'../public/instructor.html'),'utf8');
assert(html.includes('window.MidlandFaculty.render('));assert(html.includes('faculty-workspace.js?v=20260911'));
console.log('Faculty workspace checks passed (team/individual adapters, role IDs, saved narratives, legacy results, empty states and live integration).');
