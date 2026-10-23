// Done lists the newest first, and every state change is time-stamped.
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
function grab(n){const i=src.indexOf('function '+n+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
let store={};function fixState(){return store;}function save(k,v){store=v;}
eval(grab('setFix'));eval(grab('fixTime'));eval(grab('newestFirst'));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
setFix('a',{status:'pushed',pushedAt:'22 Oct 2026, 18:15'});
ok(typeof store.a.ts==='number','a push is time-stamped');
store.old={status:'pushed',pushedAt:'21 Oct 2026, 09:00'};
store.mid={status:'done',doneAt:'22 Oct 2026, 08:00'};
const list=newestFirst([{id:'old'},{id:'mid'},{id:'a'}],store).map(p=>p.id);
ok(list.join()==='a,mid,old','newest first, older cards sorted by their shown date');
ok(fixTime({status:'undone',undoneAt:'23 Oct 2026, 07:12',pushedAt:'1 Jan 2026, 00:00'})===Date.parse('23 Oct 2026 07:12'),'an undo uses the undo time');
// Claude can send a failed fix back to Waiting from GitHub, once per stamp.
const fs2=require('fs');let mem={};
function load(k,f){return k in mem?JSON.parse(JSON.stringify(mem[k])):f;} function save2(k,v){mem[k]=JSON.parse(JSON.stringify(v));}
const src2=src.replace(/save\(/g,'save2(');
function grab2(n){const i=src2.indexOf('function '+n+'(');let d=0,j=src2.indexOf('{',i);for(let k=j;k<src2.length;k++){if(src2[k]=='{')d++;else if(src2[k]=='}'){d--;if(!d)return src2.slice(i,k+1);}}}
global.window={WPT_PROPOSALS:[{id:'x',reopen:'s1',reopenNote:'Undo broke it'}]};
eval(grab2('applyReopens'));
mem['fix-state']={x:{status:'undone',ts:5,backup:'b1'}};
let st=applyReopens(load('fix-state',{}));
ok(!st.x.status&&st.x.reopened&&st.x.reopenNote==='Undo broke it'&&st.x.history[0].backup==='b1','failed fix goes back to Waiting with the reason, history kept');
mem['fix-state'].x={status:'pushed',ts:9};
st=applyReopens(load('fix-state',{}));
ok(st.x.status==='pushed','same stamp is not applied twice, so a new push stays in Done');
// Every reject is written to the change log.
let logged=[];global.logChange=e=>logged.push(e);global.typeLabel=()=>'H1 colour repair';
eval(grab('rejectFix').replace(/^function (\w+)/,'global.$1 = function'));
store={};rejectFix({id:'r',pageTitle:'8x8',link:'u',issue:'Heading invisible'});
ok(store.r.status==='rejected'&&typeof store.r.ts==='number'&&logged[0].action.indexOf('Moved to Not doing')===0,'reject is time-stamped and logged');
