const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw n;let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
const store={};const load=(k,f)=>k in store?JSON.parse(store[k]):f;const save=(k,v)=>store[k]=JSON.stringify(v);const stripHtml=s=>s;
const SEO_KEYS={rankmath:{title:"rank_math_title",desc:"rank_math_description"}};
global.btoa=s=>Buffer.from(s).toString('base64');
const LIVE={'westpiertech.com/3cx-brighton':{status:301,location:'/business-phone-systems/3cx/brighton/'},
 'westpiertech.com/business-phone-systems/3cx/brighton':{status:200,title:'3CX Phone Systems in Brighton | West Pier Technologies',description:'West Pier Technologies helps businesses in Brighton.',words:900,h2:4,noindex:false},
 'westpiertech.com/technology':{status:200,title:'Technology',description:'',words:640,h2:0,noindex:false},
 'westpiertech.com/8x8':{status:200,title:'8x8',description:'',words:700,h2:3}};
const meta={rank_math_description:''};let posted=0;
global.fetch=async(url,o={})=>{if(url.includes('/wpt-hub/v1/check')){const b=JSON.parse(o.body);return {ok:true,status:200,json:async()=>b.urls.map(u=>Object.assign({url:u},LIVE[u.replace(/^https?:\/\//,'').replace(/\/$/,'')]||{status:404}))};}
 const u=new URL(url);if(u.searchParams.get('slug'))return {ok:true,status:200,json:async()=>[{id:5,link:'https://westpiertech.com/'+u.searchParams.get('slug')+'/'}]};
 if(o.method==='POST'){posted++;Object.assign(meta,JSON.parse(o.body).meta);}return {ok:true,status:200,json:async()=>({id:5,meta})};};
const daysAgo=()=>'2000-01-01';
eval(['wpAuth','wpBase','wpFetch','metaKey','countOnce','resolveId','norm','hasChecker','checkUrls','isRedirect','shortPath','liveIssues','copyLive','applyLive','liveOnlyRow','pushFix'].map(grab).join('\n')+'\nvar API_ONLY_ISSUE = /^(Thin content|No (custom )?meta description|Meta description (too long|short)|Title tag over|No H2)/;');
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
(async()=>{save('wp-auth',{site:'https://westpiertech.com',user:'u',pass:'p',ok:true,checker:true,seo:'rankmath',metaReady:true});
 const pages=[{title:'3CX Brighton',link:'https://westpiertech.com/3cx-brighton/',metaDesc:'',issues:['No custom meta description']},
  {title:'Technology',link:'https://westpiertech.com/technology/',words:193,metaDesc:'',issues:['Thin content (193 words)','No custom meta description','No H2 subheadings','4 images missing alt text']}];
 const live=await checkUrls(pages.map(p=>p.link));
 const targets=applyLive(pages,live);
 ok(pages[0].redirectTo==='https://westpiertech.com/business-phone-systems/3cx/brighton/'&&pages[0].issues.length===0,'redirected page skipped with target');
 ok(targets.length===1,'redirect target queued for checking');
 ok(pages[1].words===640&&!pages[1].issues.some(i=>/Thin/.test(i))&&pages[1].issues.includes('4 images missing alt text')&&pages[1].issues.includes('No meta description'),'live word count replaces API guess, other issues kept');
 const live2=await checkUrls(targets);const row=liveOnlyRow(targets[0],live2[norm(targets[0])]);
 ok(row.liveOnly&&row.words===900&&row.metaDesc.startsWith('West Pier')&&!row.issues.includes('No meta description'),'Matt\'s live page audited with its real description');
 try{await pushFix({id:'x',type:'meta_description',postType:'pages',pageId:0,link:'https://westpiertech.com/3cx-brighton/'},'new');ok(false,'guard')}catch(e){ok(/redirects to/.test(e.message)&&posted===0,'push to redirected page blocked, nothing changed')}
 const r=await pushFix({id:'y',type:'meta_description',postType:'pages',pageId:0,link:'https://westpiertech.com/8x8/'},'8x8 desc');ok(r.pageId===5&&meta.rank_math_description==='8x8 desc','normal page still pushes');
})();
