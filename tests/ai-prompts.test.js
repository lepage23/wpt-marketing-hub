// AI visibility prompts: copied in once, your edits kept, ten a week, all covered every three weeks.
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
function grab(n){const i=src.indexOf('function '+n+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
const store={};function load(k,f){return k in store?JSON.parse(JSON.stringify(store[k])):f;}function save(k,v){store[k]=JSON.parse(JSON.stringify(v));}let n=0;function uid(){return 'u'+(n++);}
const window={};eval(grab('syncAiPrompts'));eval(grab('isoWeek'));eval(grab('aiWeekPrompts'));
global.window={};require(require('path').resolve(process.argv[3]));window.WPT_AI_PROMPTS=global.window.WPT_AI_PROMPTS;
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
let rows=syncAiPrompts();
ok(rows.length===30,'all 30 prompts load');
ok(rows.every(r=>r.active==='Yes'),'every prompt starts active');
store['ai-prompts'][0].q='Edited prompt';syncAiPrompts();
ok(store['ai-prompts'][0].q==='Edited prompt'&&store['ai-prompts'].length===30,'your edit is kept and nothing is added twice');
store['ai-prompts'].splice(1,1);syncAiPrompts();
ok(store['ai-prompts'].length===29,'a deleted prompt does not come back');
ok(isoWeek(new Date(2026,9,20))===43,'20 Oct 2026 is week 43');
ok(isoWeek(new Date(2027,0,1))===53,'1 Jan 2027 is week 53 of 2026');
rows=syncAiPrompts().map(r=>r);store['ai-prompts']=rows;
const all=load('ai-prompts');all.splice(1,0,{_id:'x',n:2,q:'Back',group:'Local',page:'',active:'Yes'});
const seenAll={};[0,1,2].forEach(w=>{const r=aiWeekPrompts(all,new Date(2026,9,20+7*w));ok(r.list.length===10,'week '+r.week+' has 10 prompts');r.list.forEach(p=>seenAll[p.n]=1);});
ok(Object.keys(seenAll).length===30,'three weeks in a row cover all 30');
all[0].active='No';
ok(aiWeekPrompts(all,new Date(2026,9,20)).total===29,'an inactive prompt is skipped');
