// Progress & change log: snapshots, health score, before/after percentages, change counts.
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error('missing '+n);let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
function grabVar(n){const i=src.indexOf('var '+n+' =');return src.slice(i,src.indexOf('];',i)+2);}
eval(grabVar('PROGRESS_CHECKS')+'\n'+src.slice(src.indexOf('var COUNTED_CHANGE'),src.indexOf('\n',src.indexOf('var COUNTED_CHANGE')))+'\n'+src.slice(src.indexOf('var MONTHS'),src.indexOf('\n',src.indexOf('var MONTHS')))+'\n'+
  ['aiGscHistory','aiGscLatest','logDate','avgSpeed','buildSnapshot','delta','metricRows','changesBetween','pageMoves','fmtVal'].map(grab).join('\n'));
function load(k,d){return d}
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
const pg=(link,issues)=>({link,title:link,issues});
const before={when:'12 Oct 2026, 09:00',pages:[pg('/a',['Thin content (120 words)','No meta description']),pg('/b',['No H1','2 images missing alt text']),pg('/c',[]),{link:'/old',title:'old',redirectTo:'/c',issues:[]}]};
const after={pages:[pg('/a',['Thin content (180 words)']),pg('/b',[]),pg('/c',[]),pg('/d',['No H2 subheadings'])]};
const kw=[{pos:'14'},{pos:'6'},{_ex:true,pos:'1'},{pos:''}], ai=[{named:'Yes'},{named:'No'},{named:'Not checked'}];
const psi={withDesktop:true,pages:{x:{perf:40},y:{perf:60},z:{error:'x'}},desktop:{x:{perf:90}}};
const a=buildSnapshot(before,'2026-10-12',kw,ai,null), b=buildSnapshot(after,'2026-10-19',kw,ai,psi);
ok(a.pages===3,'redirects are left out of the page count');
ok(a.issues===4&&a.clear===1,'counts issues and clear pages');
ok(a.counts.thin===1&&a.counts.noDesc===1&&a.counts.h1===1&&a.counts.noAlt===1,'each issue lands in the right check');
ok(a.score===Math.round((1-4/(3*12))*1000)/10,'health score is the share of checks passed: '+a.score+'%');
ok(b.score>a.score,'score rises when issues are fixed');
ok(a.kwTracked===2&&a.kwAvg===10&&a.kwTop10===1,'keywords: skips examples and blanks, averages positions');
ok(a.aiChecked===2&&a.aiNamed===1,'AI visibility: only checked answers count');
ok(b.speedMobile===50&&b.speedDesktop===90&&a.speedMobile===null,'speed averages skip failed pages');
let d=delta(25,11,true);ok(d.cls==='up'&&d.pct==='56% better'&&d.txt==='-14','fewer issues reads as better');
d=delta(50,56,true);ok(d.cls==='down'&&d.pct==='12% worse','more issues reads as worse');
d=delta(66.7,80.6,false,' pts');ok(d.cls==='up'&&d.txt==='+13.9 pts','score change in points');
ok(delta(3,3,true).txt==='no change'&&delta(0,2,true).pct==='worse'&&delta(null,2).pct==='–','no change, from zero, and missing values');
ok(metricRows(a,b).length===3+12+6,'scorecard lists every measure, including Google AI impressions');
ok(logDate({when:'19 Oct 2026, 14:30'})==='2026-10-19'&&logDate({when:'3 Sept 2026, 09:05'})==='2026-09-03'&&logDate({date:'2026-01-02',when:'x'})==='2026-01-02','reads old change log dates');
const log=[{action:'Pushed live',date:'2026-10-15'},{action:'Undone',date:'2026-10-16'},{action:'Image fixed',when:'19 Oct 2026, 10:00'},{action:'Pushed live',date:'2026-10-12'},{action:'Marked done (already sorted)',date:'2026-10-14'},{action:'Pushed live',date:'2026-10-20'}];
ok(changesBetween(log,a,b)===2,'counts real changes after the start date up to the end date');
const m=pageMoves(a,b);ok(m[0].link==='/b'&&m[0].d===-2&&m[m.length-1].isNew,'biggest improvement first, new pages last');
ok(/id: "progress", label: "Progress & change log"/.test(src)&&src.indexOf('id: "progress"')>src.indexOf('id: "fixes"'),'tab sits under Fix queue');
ok(/recordSnapshot\(audit\); drawAudit/.test(src),'every audit saves a snapshot');
ok(!/main\.appendChild\(plan\);\n\s*renderChangeLog/.test(src),'change log no longer on Website & SEO');
