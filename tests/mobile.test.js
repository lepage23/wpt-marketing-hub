const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');const raw=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
function grab(n){const i=src.indexOf('function '+n+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
function grabVar(n){return src.match(new RegExp('var '+n+' = [^\\n]*;'))[0];}
eval(['shortPath','summarisePsi','failOf','fileName','buildMobileFixes'].map(grab).join('\n')+'\n'+grabVar('PSI_SKIP'));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
const r=summarisePsi(raw);
ok(r.perf===34&&r.a11y===82&&r.seo===92&&r.version==='13.0.1','scores read from a Lighthouse 13 response');
ok(r.lcp===6100&&Math.abs(r.cls-0.31)<1e-9,'lab LCP and CLS read');
ok(r.field&&r.field.lcp.cat==='SLOW'&&r.field.inp.cat==='FAST','real-visitor data read when present');
ok(!r.fails.some(f=>/largest-contentful-paint|cumulative-layout-shift|is-crawlable|viewport-insight|final-screenshot/.test(f.id)),'passing checks and raw metrics not treated as problems');
const noField=summarisePsi(Object.assign({},raw,{loadingExperience:undefined}));ok(noField.field===null,'works with no real-visitor data (it is being retired)');
const f=buildMobileFixes({pages:{'https://westpiertech.com/':r,'https://westpiertech.com/zoom/':{error:'timeout'}}});const id=x=>f.find(o=>o.id===x);
ok(id('mob-squashed')&&id('mob-squashed').pages[0].title==='engineer-van.jpg'&&/0.71/.test(id('mob-squashed').pages[0].note),'squashed engineer photo found, with its shape');
ok(id('mob-images')&&id('mob-images').pages.length===1&&/801 KB/.test(id('mob-images').pages[0].note),'heavy image flagged, tiny saving ignored');
ok(id('mob-slow')&&id('mob-cwv-field')&&id('mob-cls').priority==='high'&&id('mob-tap')&&id('mob-contrast')&&id('mob-a11y'),'slow, real-visitor, jumping, tap, contrast and accessibility fixes made');
ok(!id('mob-viewport'),'no false viewport alarm');
ok(f.every(o=>o.category==='Mobile'&&o.steps.length&&o.why),'all filed under Mobile with steps');
