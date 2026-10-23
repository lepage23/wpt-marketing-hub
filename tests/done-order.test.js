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
