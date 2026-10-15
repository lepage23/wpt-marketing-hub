const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');const d=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw n;let dd=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')dd++;else if(src[k]=='}'){dd--;if(!dd)return src.slice(i,k+1);}}}
const store={};const load=(k,f)=>k in store?JSON.parse(store[k]):f;const save=(k,v)=>store[k]=JSON.stringify(v);const esc=s=>String(s);
eval(['norm','shortPath','gscUrl','perfData','perfByPage','perfLine','buildSearchFixes','pctChange'].map(grab).join('\n'));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
save('search-perf',d);
const by=perfByPage();
ok(by['westpiertech.com/8x8'].clicks===56&&by['westpiertech.com/8x8'].prevClicks===28,'page numbers keyed by address, with previous period');
ok(/56 clicks · 1680 impressions|56 clicks · 1400 impressions/.test(perfLine('https://westpiertech.com/8x8/')),'fix cards show Google numbers: '+perfLine('https://westpiertech.com/8x8/').replace(/<[^>]+>/g,''));
let f=buildSearchFixes(d);const id=x=>f.find(o=>o.id.startsWith(x));
ok(id('gsc-near-westpiertech-com-8x8')&&id('gsc-near-westpiertech-com-8x8').priority==='high','8x8 at position 8 with 1400 impressions: high-priority near page one');
ok(id('gsc-near-westpiertech-com-3cx')&&/position 15/.test(id('gsc-near-westpiertech-com-3cx').pages[0].note),'3CX at position 15 flagged');
ok(!f.some(o=>/^gsc-ctr/.test(o.id))&&!f.some(o=>/^gsc-drop/.test(o.id)),'no false click-rate or drop alarms');
// edge cases
const d2=JSON.parse(JSON.stringify(d));
d2.pages.push({page:'/zoom/',clicks:'1',impressions:'400',position:'4.2'});d2.pages_prev.push({page:'/zoom/',clicks:'30',impressions:'500'});
d2.queries.push({query:'8x8 partner uk',page:'/8x8-brighton/',clicks:'0',impressions:'600',position:'9'});
f=buildSearchFixes(d2);
ok(f.some(o=>o.id==='gsc-ctr-westpiertech-com-zoom'),'page one with 0.25% click rate gets a title/description fix');
ok(f.some(o=>o.id==='gsc-drop-westpiertech-com-zoom'&&/30 to 1/.test(o.issue)),'clicks drop from 30 to 1 flagged');
ok(f.some(o=>/^gsc-split-8x8-partner-uk/.test(o.id)&&o.pages.length===2),'two pages splitting one search flagged');
ok(f.every(o=>o.steps.length&&o.why&&o.priority&&o.category==='Content'&&o.type==='manual'),'every fix complete');
ok(buildSearchFixes(null).length===0&&buildSearchFixes({tables:{}}).length===0,'no data, no fixes, no crash');
