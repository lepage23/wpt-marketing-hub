// Weekly tasks on the main page reset every Monday and tick themselves off.
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
function grab(n){const i=src.indexOf('function '+n+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
['weekStart','weeklyState'].forEach(n=>eval(grab(n).replace(/^function (\w+)/,'global.$1 = function')));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
const at=s=>new Date(s).getTime(), task=last=>({last:()=>last});
const fri=at('2026-10-23T14:00:00'), sun=at('2026-10-25T20:00:00'), mon=at('2026-10-26T09:00:00');
ok(weekStart(fri).getDate()===19&&weekStart(sun).getDate()===19&&weekStart(mon).getDate()===26,'weeks start on Monday, Sunday belongs to the week before');
ok(weeklyState(task(null),fri).label==='Not done yet'&&!weeklyState(task(null),fri).done,'never done shows as to do');
ok(weeklyState(task(at('2026-10-20T10:00:00')),fri).done,'done on Tuesday counts for the week');
ok(!weeklyState(task(at('2026-10-20T10:00:00')),mon).done&&weeklyState(task(at('2026-10-20T10:00:00')),mon).label==='Due this week','resets on Monday');
const s=weeklyState(task(at('2026-10-10T10:00:00')),mon);ok(!s.done&&s.late,'flags a missed week');
ok(/id: "ai-gsc"/.test(src)&&/aiGscLatest\(\)/.test(src.slice(src.indexOf('var WEEKLY_TASKS'),src.indexOf('function weeklyState'))),'the Google AI export is a weekly task, ticked off by an import');
