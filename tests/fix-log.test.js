// Progress log on fix cards: vendor tracks, Connor's own entries, and Claude's progress stamps.
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
function grab(n){const i=src.indexOf('function '+n+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
const store={};function load(k,f){return k in store?JSON.parse(JSON.stringify(store[k])):f;}function save(k,v){store[k]=JSON.parse(JSON.stringify(v));}
global.window={};
['localDay','addDays','fixState','setFix','parkFix','syncFixProgress','trackStatus','setTrackStatus','fixLogEntries','addFixLog','deleteFixLog','hasFixLog'].forEach(n=>eval(grab(n).replace(/^function (\w+)/,'global.$1 = function')));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
const t=localDay(), wk=addDays(t,7);
const fix={id:'f',progress:{update:'s1',nextDate:wk,note:'Chase'},tracks:[{name:'3CX',status:'Waiting on them',log:[{date:'2026-10-19',text:'old'},{date:'2026-10-20',text:'first'},{date:'2026-10-20',text:'second'}]},{name:'Gamma',log:[]}]};
window.WPT_PROPOSALS=[fix];
syncFixProgress();
ok(fixState().f.status==='inprogress'&&fixState().f.nextDate===wk&&fixState().f.progressNote==='Chase','progress stamp puts the fix In progress');
setFix('f',{nextDate:addDays(t,3)});syncFixProgress();
ok(fixState().f.nextDate===addDays(t,3),'same stamp does not overwrite your own date');
ok(trackStatus(fix,fix.tracks[0])==='Waiting on them'&&trackStatus(fix,fix.tracks[1])==='To do','track status from Claude, To do by default');
setTrackStatus('f','3CX','Done');ok(trackStatus(fix,fix.tracks[0])==='Done','your status change wins');
const e=fixLogEntries(fix,'3CX').map(x=>x.text).join(',');
ok(e==='second,first,old','entries newest first, later entries on the same day on top');
addFixLog('f','3CX',t,'Chased Paul');
const top=fixLogEntries(fix,'3CX')[0];ok(top.text==='Chased Paul'&&top.mine,'your entry is added and marked as yours');
ok(fixLogEntries(fix,'Gamma').length===0,'each vendor keeps its own log');
deleteFixLog('f','3CX',t,'Chased Paul');ok(!fixLogEntries(fix,'3CX').some(x=>x.mine),'your entry can be deleted');
fix.progress={update:'s2',nextDate:wk,note:'New'};syncFixProgress();
ok(trackStatus(fix,fix.tracks[0])==='Waiting on them'&&fixState().f.progressNote==='New','a newer stamp applies again and Claude statuses take over');
setFix('f',{status:'done'});fix.progress={update:'s3',nextDate:wk};syncFixProgress();
ok(fixState().f.status==='done','a done fix is not pulled back into In progress');
ok(hasFixLog(fix)&&!hasFixLog({id:'z'}),'log shows on fixes with tracks or entries only');
