const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw n;let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
const i0=src.indexOf('var LINK_STOP');const LS=src.slice(i0,src.indexOf(';\n',i0)+1);
const LINK_V=2;let STORE={};function load(k,f){return k in STORE?JSON.parse(JSON.stringify(STORE[k])):f;}function save(k,v){STORE[k]=v;}
function today(){return '2026-10-22';}function shortPath(u){return u.replace(/^https?:\/\/[^\/]+/,'');}
let PROPS=[];function proposals(){return PROPS.concat(load('auto-fixes-rules',[]));}
eval(LS+['norm','autoKey','linkPhrases','phraseAt','linkContext','phraseIn','textHits','linkHit','linkFix','suggestLinks','claimPageTerms','claimFixFor','claimRules','matchCase','ruleFixes','pushClaimReplace'].map(grab).join('\n'));
function updateNav(){}global.window={};
const H='https://westpiertech.com';
/* Topic phrases from a title */
const ph=linkPhrases('Top 10 UCaaS Providers for 2026: The Complete UK Comparison');
ok(ph.indexOf('UCaaS Providers')>-1,'phrases: picks "UCaaS Providers"');
ok(ph.every(p=>!/2026/.test(p)),'phrases: years dropped');
ok(ph.length<=10,'phrases: at most ten searches per page');
/* Finding a spot */
let searched=[];
global.findText=async(q)=>{searched.push(q);return q==='UCaaS Providers'?[
 {post_id:5,title:'Top 10 UCaaS',link:H+'/top-10-ucaas/',type:'post',elementor:false,hits:[{widget:'content',snippet:'all the ucaas providers here'}]},
 {post_id:7,title:'Unified Communications',link:H+'/unified-communications/',type:'page',elementor:true,hits:[{widget:'heading',snippet:'UCaaS Providers'},{widget:'text-editor',snippet:'We compare leading UCaaS providers for UK firms.'}]},
 {post_id:8,title:'Hidden too',link:H+'/hidden/',type:'page',elementor:true,hits:[{widget:'text-editor',snippet:'UCaaS providers'}]}]:[];};
const orphan={title:'Top 10 UCaaS Providers for 2026',link:H+'/top-10-ucaas/'};
(async()=>{
 const f=await suggestLinks(orphan,{[norm(H+'/hidden/')]:1},[]);
 ok(f.length===1&&f[0].pageId===7,'spot found on another page, not the page itself or another hidden page');
 ok(f[0].type==='elementor_swap'&&f[0].anchor==='UCaaS providers'&&f[0].proposed.indexOf('<a href="'+H+'/top-10-ucaas/">UCaaS providers</a>')>-1&&f[0].find.indexOf('UCaaS providers')>-1,'fix links the words exactly as written on the page');
 ok(f[0].parent==='auto-orphans','link fixes live inside the hidden pages card');
 const f2=await suggestLinks(orphan,{},[norm(H+'/unified-communications/')]);
 ok(f2.every(x=>x.pageId!==7),'a skipped spot is not offered again');
 /* Claims: only a fix that removes the claim is offered */
 PROPS=[{id:'auto-h1-contact',type:'elementor_h1',link:H+'/contact/',current:'(no H1 on the live page)',proposed:'The first heading on the page becomes the H1.'}];
 const pg={title:'Contact',link:H+'/contact/',note:'says: west pier telecom · “Contact Us”'};
 ok(claimPageTerms(pg)[0]==='west pier telecom','terms read from older saved checks');
 ok(claimFixFor(pg,{})===null,'the H1 fix is no longer offered for the "West Pier Telecom" claim');
 PROPS.push({id:'x1',type:'elementor_swap',link:H+'/contact/',find:'West Pier Telecom',proposed:'West Pier Technologies'});
 ok(claimFixFor(pg,{}).id==='x1','a phrase swap that removes it is offered');
 /* Type the wording once: saved as a rule, pushed straight away */
 PROPS=[];global.findText=async()=>[{post_id:44,title:'Contact',link:H+'/contact/',type:'page',elementor:true,hits:[{snippet:'West Pier Telecom Ltd'}]}];
 let pushed=null;global.pushFix=async(fx,t)=>{pushed={fx,t};return {before:'West Pier Telecom',after:t,backup:'b1'};};
 const o=await pushClaimReplace(pg,'west pier telecom','West Pier Technologies');
 ok(STORE['claim-rules'][0].replace==='West Pier Technologies','wording saved as a rule for every later audit');
 ok(pushed&&pushed.fx.every===true&&pushed.fx.pageId===44&&pushed.t==='West Pier Technologies','pushed straight away, every spot on the page');
})();
(async()=>{await new Promise(r=>setTimeout(r,50));
 eval(grab('matchCase'));
 ok(matchCase('west pier technologies','West Pier Telecom')==='West Pier Technologies','lower-case wording gets the page\'s capitals');
 ok(matchCase('west pier technologies','WEST PIER TELECOM')==='WEST PIER TECHNOLOGIES','all capitals kept');
 ok(matchCase('West Pier Technologies Ltd','west pier telecom')==='West Pier Technologies Ltd','wording typed with capitals is left as typed');
 STORE={};PROPS=[];global.findText=async()=>[{post_id:44,title:'Contact',link:H+'/contact/',type:'page',elementor:true,hits:[{snippet:'Contact UsWest Pier Telecom LtdMocatta House'}]}];
 let pushed=null;global.pushFix=async(fx,t)=>{pushed={fx,t};return {};};
 await pushClaimReplace({link:H+'/contact/',terms:['west pier telecom']},'west pier telecom','west pier technologies');
 ok(pushed.fx.find==='West Pier Telecom'&&pushed.t==='West Pier Technologies','Contact page: looks for the phrase as written and pushes it with capitals');
})();
(async()=>{await new Promise(r=>setTimeout(r,100));
 const src2=src;eval(grab('pushFix').replace('function pushFix','function pushFix2').replace(/pushFix\(Object/,'pushFix2(Object').replace(/^/, ''));
 STORE={'claim-rules':[{find:'west pier telecom',replace:'west pier technologies'}]};PROPS=[];
 global.findText=async()=>[{post_id:44,title:'Contact',link:H+'/contact/',type:'page',elementor:true,hits:[{snippet:'Contact UsWest Pier Telecom Ltd'}]}];
 const stale={id:'rule-westpiertech-com-contact-west-pier-telecom',batch:'Automatic replacement',find:'west pier telecom',proposed:'west pier technologies',example:false};
 let sent=null;global.hasChecker=()=>false;global.wpFetch=async(u,o)=>{sent=o.body;return {backup:'b'};};global.needsV12=e=>{throw e};global.needsV4=e=>{throw e};
 const ids=(await ruleFixes()).map(f=>f.id);stale.id=ids[0];
 await pushFix2(stale,stale.proposed);
 ok(sent&&sent.find==='West Pier Telecom'&&sent.replace==='West Pier Technologies'&&sent.every===1,'a fix saved before the update is rebuilt before pushing');
})();
(async()=>{await new Promise(r=>setTimeout(r,150));
 ok(phraseIn('some features sit in tiers','Feature')==='','no match inside a longer word');
 ok(phraseIn('Contact UsWest Pier Telecom LtdMocatta','west pier telecom')==='West Pier Telecom','joined-up block text still matches');
 ok(textHits([{hits:[{widget:'google_maps',snippet:'West Pier Telecom'}]}]).length===0,'map widgets do not count as the page saying it');
})();
(async()=>{await new Promise(r=>setTimeout(r,250));
 eval(grab('phraseAt')+grab('linkContext'));
 const LINK_V=2;
 const ph2=linkPhrases('8x8 Feature Matrix with Engage Voice');
 ok(ph2.indexOf('Feature')===-1&&ph2.indexOf('Engage')===-1,'single plain words like "Feature" are never link text');
 ok(linkPhrases('3CX Phone Systems in Brighton').indexOf('3CX')>-1,'product names like 3CX still can be');
 const sn='...for your business, and most buying guides skip straight past them in favour of feature lists. In the industry, what you are';
 const at=phraseAt(sn,'buying guides'),c=linkContext(sn,at,13);
 ok(c.before==='and most '||/most $/.test(c.before),'context: a few words before, from a clean word start ('+JSON.stringify(c.before)+')');
 ok(/^ skip straight past/.test(c.after)&&!/\./.test(c.after),'context: stops at the end of the sentence ('+JSON.stringify(c.after)+')');
 const sn2='Business CommunicationsFeature Comparison Compare 8x8, 3CX';
 const c2=linkContext(sn2,phraseAt(sn2,'Feature Comparison'),18);
 ok(c2.before==='','context: never runs across two blocks of text joined together');
 const f=linkFix({title:'Guide',link:'https://westpiertech.com/g/'},{post_id:3,title:'Post',link:'https://westpiertech.com/p/',type:'post',elementor:true},{snippet:sn},'buying guides');
 ok(f.find===c.before+'buying guides'+c.after&&f.proposed===c.before+'<a href="https://westpiertech.com/g/">buying guides</a>'+c.after&&f.anchor==='buying guides','fix swaps the phrase with its surrounding words, so a repeat elsewhere on the page doesn\'t block it');
})();
