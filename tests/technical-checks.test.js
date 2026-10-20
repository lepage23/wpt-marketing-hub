const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');const fx=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw n;let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
function grabVar(n){const m=src.match(new RegExp('var '+n+' = [^;]*;'));return m[0];}
const store={};const load=(k,f)=>k in store?JSON.parse(store[k]):f;const save=(k,v)=>store[k]=JSON.stringify(v);
eval(['norm','shortPath','copyLive','isRedirect','liveIssues','applyLive','liveOnlyRow','robotsBlocks','titleWords','overlap','indexable','pageRef','buildAutoFixes','storeAutoFixes','fixState','setFix','proposals','syncFixProgress','parkFix','localDay'].map(grab).join('\n')+'\n'+['PRI_ORDER','AI_BOTS','STOP','API_ONLY_ISSUE'].map(grabVar).join('\n'));
global.window={WPT_PROPOSALS:[]};
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
const live={};fx.check.forEach(r=>{if(r.url)live[norm(r.url)]=r;});
const pages=[{title:'8x8',link:'https://westpiertech.com/8x8/',type:'Page',metaDesc:'',issues:[]},{title:'3CX Brighton',link:'https://westpiertech.com/3cx-brighton/',type:'Page',metaDesc:'',issues:[]}];
applyLive(pages,live);
const home=liveOnlyRow('https://westpiertech.com/',{url:'https://westpiertech.com/',status:200,title:'Home',description:'Home page description that is long enough to pass the seventy character check easily ok',h1:['Home'],h2:2,words:500,links_all:['https://westpiertech.com/zoom/'],links_content:[],schema:[],ms:2500});
pages.push(home);
const status={};Object.keys(live).forEach(k=>status[k]={status:live[k].status,location:live[k].location||''});
status[norm('https://westpiertech.com/3cx/')]={status:404};status[norm('https://westpiertech.com/business-phone-systems/3cx/brighton/')]={status:301,location:'https://westpiertech.com/x/'};
const audit={pages,siteData:fx.site,status};
const fixes=buildAutoFixes(audit);const ids=fixes.map(f=>f.id);
const has=(id)=>fixes.find(f=>f.id===id);
ok(has('auto-robots-ai')&&/GPTBot/.test(has('auto-robots-ai').issue)&&!/ClaudeBot/.test(has('auto-robots-ai').issue),'GPTBot block found, others allowed');
ok(!has('auto-robots-blocks-all')&&!has('auto-robots-sitemap'),'no false alarm on robots.txt');
ok(has('auto-sitemap-bad')&&has('auto-sitemap-bad').pages.some(p=>/3cx-brighton/.test(p.link)),'redirected page in sitemap flagged');
ok(has('auto-llms')&&has('auto-verify-bing')&&!has('auto-verify-google')===false,'llms and Bing flagged (home has no tags)');
ok(ids.some(i=>/auto-variant-https-www/.test(i)),'302 on www flagged');
ok(ids.some(i=>/auto-variant-http-www/.test(i)),'http://www hopping via www flagged');
ok(!ids.some(i=>i==='auto-variant-http-westpiertech-com'),'correct http redirect not flagged');
ok(has('auto-redirect-temp')&&has('auto-redirect-chain'),'302 rule and chain flagged');
ok(has('auto-noindex-westpiertech-com-8x8'),'noindex page gets its own dismissable fix');
ok(has('auto-links-broken')&&/3cx/.test(has('auto-links-broken').pages[0].note),'broken link found on a live page');
ok(has('auto-schema-org'),'home missing Organisation schema');
ok(has('auto-slow')&&has('auto-slow').pages[0].link==='https://westpiertech.com/','slow home flagged');
ok(fixes.every(f=>f.steps&&f.steps.length&&f.why&&f.priority&&f.category),'every fix has steps, why, priority, area');
// done-then-still-found reopens
setFix('auto-llms',{status:'done',doneTs:1});storeAutoFixes(fixes,Date.now());ok(!fixState()['auto-llms'].status&&fixState()['auto-llms'].reopened,'fix marked done but still found is reopened');
console.log(fixes.length+' fixes: '+ids.join(', '));
