const fs=require('fs');
const src=fs.readFileSync(process.argv[2],'utf8');
function grab(name){const i=src.indexOf('function '+name+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
const store={};const load=(k,f)=>k in store?JSON.parse(store[k]):f;const save=(k,v)=>store[k]=JSON.stringify(v);
const stripHtml=s=>String(s).replace(/<[^>]+>/g,'');global.btoa=s=>Buffer.from(s).toString('base64');
let page={id:77,status:'publish'},redirectOnDraft=true,calls=[];
global.fetch=async(url,o={})=>{const body=o.body?JSON.parse(o.body):null;calls.push(url.replace(/\?.*/,''));
 const J=v=>({ok:true,status:200,json:async()=>v});
 if(/\/wp\/v2\/pages\?slug=/.test(url))return J(/8x8-brighton/.test(url)?[{id:77,link:'https://westpiertech.com/8x8-brighton/'}]:[]);
 if(/\/wp\/v2\/posts\?slug=/.test(url))return J([{id:88,link:'https://westpiertech.com/old-post/'}]);
 if(/\/wp\/v2\/(pages|posts)\/\d+/.test(url)){if(body&&body.status)page.status=body.status;return J({id:77,status:page.status});}
 if(/wpt-hub\/v1\/check/.test(url)){const draft=page.status==='draft';return J([{url:body.urls[0],status:draft&&!redirectOnDraft?404:301,location:'https://westpiertech.com/business-phone-systems/8x8/brighton/'}]);}
 if(/elementor-edit/.test(url))return J(body.dry_run?{ok:true,dry_run:true,tag:'h2',text:'8x8 in Brighton'}:{ok:true,backup:'b9',before:'H2: 8x8 in Brighton',after:'H1: 8x8 in Brighton'});
 return J({});};
eval(['wpAuth','wpBase','wpFetch','metaKey','countOnce','norm','shortPath','isRedirect','hasChecker','checkUrls','resolveId','parseFaq','needsV11','needsV12','previewH1','pushFix','undoFix'].map(grab).join('\n'));
save('wp-auth',{site:'https://westpiertech.com',user:'hub',pass:'pw',ok:true,checker:true});
const fx={id:'auto-sitemap-draft-8x8-brighton',type:'set_status',status:'draft',postType:'pages',pageId:0,link:'https://westpiertech.com/8x8-brighton/',keepRedirect:'https://westpiertech.com/business-phone-systems/8x8/brighton/'};
(async()=>{
 const r=await pushFix(fx,'');
 ok(r.after==='draft'&&r.pageId===77&&page.status==='draft','redirecting old page: set to draft despite the redirect');
 ok(calls.filter(c=>/check/.test(c)).length===1,'redirect checked after the change');
 page.status='publish';redirectOnDraft=false;
 try{await pushFix(fx,'');ok(false,'should fail')}catch(e){ok(/put back/.test(e.message)&&page.status==='publish','redirect broke: page put back to published, clear message')}
 const plain={id:'x',type:'elementor_set',postType:'pages',pageId:0,link:'https://westpiertech.com/8x8-brighton/',find:'abc'};
 redirectOnDraft=true;try{await pushFix(plain,'new');ok(false,'guard')}catch(e){ok(/redirects to/.test(e.message),'text fixes on redirected pages still refused')}
 const id=await resolveId({link:'https://westpiertech.com/old-post/',postType:'pages'});ok(id===88,'old address that is a post is still found');
 const h=await previewH1({link:'https://westpiertech.com/8x8-brighton/',postType:'pages',pageId:0});ok(h.text==='8x8 in Brighton','H1 preview names the heading');
 const r2=await pushFix({id:'h',type:'elementor_h1',postType:'pages',pageId:77,link:'https://westpiertech.com/8x8-brighton/',_liveChecked:true},'');ok(r2.backup==='b9'&&r2.after==='H1: 8x8 in Brighton','H1 fix pushes with a backup');
 calls=[];await undoFix({type:'elementor_h1',postType:'pages',pageId:77},{backup:'b9'});ok(calls.some(c=>/elementor-undo/.test(c)),'H1 fix undoes');
})();
