const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');const d=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
function grab(n){const i=src.indexOf('function '+n+'(');let dd=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')dd++;else if(src[k]=='}'){dd--;if(!dd)return src.slice(i,k+1);}}}
eval(grab('buildGa4Fixes'));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
ok(buildGa4Fixes(d).length===0,'healthy data (leads counted, 42% engagement): no false alarms');
const n=JSON.parse(JSON.stringify(d)); n.totals.keyEvents=0; n.events=[{eventName:'form_submit',eventCount:9,keyEvents:0},{eventName:'page_view',eventCount:900,keyEvents:0}];
let f=buildGa4Fixes(n); ok(f[0].id==='ga4-no-leads'&&f[0].priority==='critical'&&f[0].pages.length===1&&/form_submit/.test(f[0].pages[0].title),'no leads: critical fix naming the form event to switch on');
n.events=[{eventName:'page_view',eventCount:900,keyEvents:0}]; f=buildGa4Fixes(n); ok(/thank-you/.test(f[0].steps.join(' ')),'no form event at all: thank-you page route suggested');
const o=JSON.parse(JSON.stringify(d)); o.organic_landing=[{landingPage:'/zoom/',sessions:80,keyEvents:0,engagementRate:0.5}]; o.landing=[{landingPage:'/avaya/',sessions:120,keyEvents:1,engagementRate:0.2}];
f=buildGa4Fixes(o); ok(f.some(x=>x.id==='ga4-organic-noleads-zoom'&&x.category==='Leads'),'Google visitors but no enquiries flagged');
ok(f.some(x=>x.id==='ga4-bounce-avaya'&&/20% of 120/.test(x.issue)),'low engagement flagged');
ok(buildGa4Fixes({configured:false}).length===0,'not connected: nothing');
