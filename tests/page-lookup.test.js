const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
function grab(n){const i=src.indexOf('function '+n+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
const store={};const load=(k,f)=>k in store?JSON.parse(store[k]):f;const save=(k,v)=>store[k]=JSON.stringify(v);const stripHtml=s=>s;
const SEO_KEYS={rankmath:{title:"rank_math_title",desc:"rank_math_description"}};
global.btoa=s=>Buffer.from(s).toString('base64');
const pages=[{id:5,link:'https://westpiertech.com/8x8/',meta:{rank_math_description:''}},{id:9,link:'https://westpiertech.com/',meta:{rank_math_description:''}},{id:7,link:'https://westpiertech.com/education/3cx-for-schools/',meta:{rank_math_description:'x'}}];
global.fetch=async(url,o={})=>{const u=new URL(url);const slug=u.searchParams.get('slug');const m=u.pathname.match(/\/(pages|posts)\/?(\d*)$/);
 if(!m[2]){const rows=slug?pages.filter(p=>p.link.replace(/\/$/,'').split('/').pop()===slug):pages;return {ok:true,status:200,json:async()=>rows.map(p=>({id:p.id,link:p.link}))};}
 const pg=pages.find(p=>p.id==m[2]);if(o.method==='POST'){Object.assign(pg.meta,JSON.parse(o.body).meta)}return {ok:true,status:200,json:async()=>({id:pg.id,meta:pg.meta})};};
eval(['wpAuth','wpBase','wpFetch','metaKey','countOnce','resolveId','norm','hasChecker','checkUrls','isRedirect','pushFix','undoFix'].map(grab).join('\n'));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
(async()=>{save('wp-auth',{site:'https://westpiertech.com',user:'u',pass:'p',seo:'rankmath',metaReady:true});
 const p={id:'b',type:'meta_description',postType:'pages',pageId:0,link:'https://westpiertech.com/8x8/'};
 const r=await pushFix(p,'New 8x8 desc');ok(r.pageId===5&&pages[0].meta.rank_math_description==='New 8x8 desc','finds page by address and pushes');
 await undoFix(p,{...r,pageId:r.pageId});ok(pages[0].meta.rank_math_description==='','undo works with looked-up ID');
 const h=await pushFix({...p,link:'https://westpiertech.com/'},'Home desc');ok(h.pageId===9,'finds the home page');
 const c=await pushFix({...p,link:'https://westpiertech.com/education/3cx-for-schools/'},'Schools');ok(c.pageId===7,'finds a child page');
 try{await pushFix({...p,link:'https://westpiertech.com/gone/'},'x');ok(false,'missing')}catch(e){ok(/Couldn't find/.test(e.message),'missing page blocked, nothing changed')}
})();
