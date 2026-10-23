// Fix queue In progress: parked until the next action date, then back at the top of Waiting.
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
function grab(n){const i=src.indexOf('function '+n+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
const store={};function load(k,f){return k in store?JSON.parse(JSON.stringify(store[k])):f;}function save(k,v){store[k]=JSON.parse(JSON.stringify(v));}
['localDay','addDays','fmtDay','isParkedFix','isDueBackFix','isOpenFix','cardState','sortFixGroup','fixState','applyReopens','fixTime','setFix','parkFix','unparkFix'].forEach(n=>eval(grab(n).replace(/^function (\w+)/,'global.$1 = function')));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
const t=localDay(), tom=addDays(t,1), yest=addDays(t,-1);
ok(addDays('2026-10-31',1)==='2026-11-01','addDays crosses a month');
ok(/Tue/.test(fmtDay('2026-10-20'))&&/20/.test(fmtDay('2026-10-20')),'date shows as a short UK day');
ok(isOpenFix(undefined)&&isOpenFix({}),'a new fix is waiting');
parkFix('a',tom,'Chase Matt');
ok(isParkedFix(fixState().a)&&!isOpenFix(fixState().a),'parked with a future date: In progress, not waiting');
ok(fixState().a.progressNote==='Chase Matt'&&fixState().a.progressSince===t,'note and start date saved');
setFix('a',{nextDate:t});
ok(isDueBackFix(fixState().a)&&isOpenFix(fixState().a),'on the date it comes back to waiting');
setFix('a',{nextDate:yest});
ok(isOpenFix(fixState().a),'past dates also come back');
ok(!('status' in cardState(fixState().a))&&fixState().a.status==='inprogress','card sees it as open, stored state unchanged');
parkFix('a',addDays(t,5),'');
ok(fixState().a.progressSince===t,'changing the date keeps the start date');
setFix('b',{status:'done'});ok(!isOpenFix(fixState().b)&&!isParkedFix(fixState().b),'done fixes are neither');
const s={x:{status:'inprogress',nextDate:yest},y:{status:'inprogress',nextDate:t}};
const order=sortFixGroup([{id:'n1'},{id:'y'},{id:'n2'},{id:'x'}],s,'waiting').map(p=>p.id).join(',');
ok(order==='x,y,n1,n2','due-back fixes go to the top, oldest date first, rest keep their order');
unparkFix('a');ok(isOpenFix(fixState().a)&&!fixState().a.nextDate,'back in the queue now clears the date');
