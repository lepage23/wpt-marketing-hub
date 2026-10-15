const fs=require('fs');
const src=fs.readFileSync(process.argv[2],'utf8');
function grab(name){const i=src.indexOf('function '+name+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
const store={};const load=(k,f)=>k in store?JSON.parse(store[k]):f;const save=(k,v)=>store[k]=JSON.stringify(v);
const stripHtml=s=>String(s).replace(/<[^>]+>/g,'');
const SEO_KEYS={yoast:{title:"_yoast_wpseo_title",desc:"_yoast_wpseo_metadesc"}};
// fake WordPress
const db={pages:{12:{content:{raw:'<p>Welcome to West Pier Technologies.</p><p>More.</p>'},meta:{_yoast_wpseo_title:'',_yoast_wpseo_metadesc:'old desc'}}}};let drafts=0;
global.btoa=s=>Buffer.from(s).toString('base64');
global.fetch=async(url,o={})=>{const m=url.match(/wp\/v2\/(pages|posts)\/?(\d*)/);const body=o.body?JSON.parse(o.body):null;
 if(o.headers.Authorization!=='Basic '+btoa('hub:pw'))return {ok:false,status:401,json:async()=>({message:'Sorry'})};
 if(o.method==='POST'&&!m[2]){drafts++;return {ok:true,status:201,json:async()=>({id:900+drafts,status:body.status})};}
 const pg=db[m[1]][m[2]];if(o.method==='POST'){if(body.content!=null)pg.content.raw=body.content;if(body.meta)Object.assign(pg.meta,body.meta);}
 return {ok:true,status:200,json:async()=>JSON.parse(JSON.stringify(pg))};};
eval(['wpAuth','wpBase','wpFetch','metaKey','countOnce','pushFix','undoFix'].map(grab).join('\n'));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
(async()=>{
 save('wp-auth',{site:'https://x.test',user:'hub',pass:'pw',seo:'yoast',metaReady:true});
 const cr={id:'a',type:'content_replace',postType:'pages',pageId:12,current:'<p>Welcome to West Pier Technologies.</p>'};
 const r=await pushFix(cr,'<p>New intro.</p>');ok(db.pages[12].content.raw==='<p>New intro.</p><p>More.</p>','content replace pushes');
 try{await pushFix(cr,'<p>X</p>');ok(false,'stale replace blocked')}catch(e){ok(/isn't on the page/.test(e.message)&&db.pages[12].content.raw.startsWith('<p>New intro'),'stale replace blocked, page untouched')}
 db.pages[12].content.raw+='<p>Edited later by Connor.</p>';
 await undoFix(cr,r);ok(db.pages[12].content.raw==='<p>Welcome to West Pier Technologies.</p><p>More.</p><p>Edited later by Connor.</p>','undo restores and keeps later edits');
 const dup={...cr,current:'<p>'};try{await pushFix(dup,'x');ok(false,'dup')}catch(e){ok(/more than once/.test(e.message),'ambiguous text blocked')}
 const md={id:'b',type:'meta_description',postType:'pages',pageId:12};
 const r2=await pushFix(md,'New description');ok(db.pages[12].meta._yoast_wpseo_metadesc==='New description'&&r2.before==='old desc','meta description pushes, old value kept');
 await undoFix(md,r2);ok(db.pages[12].meta._yoast_wpseo_metadesc==='old desc','meta undo restores');
 save('wp-auth',{...load('wp-auth'),metaReady:false});try{await pushFix(md,'y');ok(false,'snip')}catch(e){ok(/snippet/.test(e.message),'meta blocked until snippet added')}
 const nd=await pushFix({type:'new_draft',postType:'posts',pageTitle:'T'},'<p>b</p>');ok(nd.draftId===901,'new draft created as draft');
 try{await pushFix({example:true},'x');ok(false,'ex')}catch(e){ok(/example/.test(e.message),'examples cannot push')}
 save('wp-auth',{...load('wp-auth'),pass:'wrong'});try{await pushFix(cr,'x');ok(false,'auth')}catch(e){ok(/application password/.test(e.message),'bad password gives clear error')}
})();
