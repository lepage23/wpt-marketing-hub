// Progress bar maths: percentage, time left and how it's worded.
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
function grab(n){const i=src.indexOf('function '+n+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
eval(['fmtDur','progressText'].map(grab).join('\n'));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
ok(fmtDur(45000)==='45 sec'&&fmtDur(380000)==='6 min 20 sec'&&fmtDur(1500000)==='25 min'&&fmtDur(4000000)==='1 hr 6 min','times read naturally');
let p=progressText(0,120,0,11000,0);ok(p.pct===0&&Math.round(p.left/1000)===1320,'before anything finishes: guess of 11 sec a page for 120 pages');
p=progressText(30,120,0,11000,300000);ok(p.pct===25&&Math.round(p.left/1000)===900,'after 30 pages in 5 min: uses the real pace, 15 min left');
p=progressText(120,120,0,11000,600000);ok(p.pct===100&&p.left===0,'finished: 100%, nothing left');
ok(/mine && box\.firstElementChild !== mine/.test(src),'bar stops when a result or error replaces it');
ok((src.match(/makeProgress\(/g)||[]).length>=4,'used by the audit, mobile check and display check');
