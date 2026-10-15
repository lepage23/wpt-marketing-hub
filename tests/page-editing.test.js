const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw n;let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
const store={};const load=(k,f)=>k in store?JSON.parse(store[k]):f;const save=(k,v)=>store[k]=JSON.stringify(v);const stripHtml=s=>s;
global.btoa=s=>Buffer.from(s).toString('base64');
const SEO_KEYS={};const calls=[];let pageStatus='publish';
global.fetch=async(url,o={})=>{const u=new URL(url);calls.push([o.method,u.pathname,o.body]);
 if(u.pathname.endsWith('/wpt-hub/v1/check'))return{ok:true,status:200,json:async()=>JSON.parse(o.body).urls.map(x=>({url:x,status:200}))};
 if(u.searchParams.get('slug'))return{ok:true,status:200,json:async()=>[{id:42,link:'https://westpiertech.com/'+u.searchParams.get('slug')+'/'}]};
 if(u.pathname.endsWith('elementor-edit')){const b=JSON.parse(o.body);return{ok:true,status:200,json:async()=>({ok:true,backup:'b1',before:'NHS BPF text',after:'',op:b.op,scope:b.scope,post:b.post_id})};}
 if(u.pathname.endsWith('elementor-undo')){const b=JSON.parse(o.body);return b.force?{ok:true,status:200,json:async()=>({ok:true})}:{ok:false,status:409,json:async()=>({message:'The page has been edited since this fix went live.'})};}
 if(/\/pages\/42/.test(u.pathname)){if(o.method==='POST')pageStatus=JSON.parse(o.body).status;return{ok:true,status:200,json:async()=>({id:42,status:pageStatus})};}
 return{ok:false,status:404,json:async()=>({message:'No route was found matching the URL and request method.'})};};
eval(['wpAuth','wpBase','wpFetch','norm','hasChecker','checkUrls','isRedirect','resolveId','countOnce','metaKey','needsV4','pushFix','undoFix'].map(grab).join('\n'));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
(async()=>{save('wp-auth',{site:'https://westpiertech.com',user:'u',pass:'p',ok:true,checker:true});
 const props=JSON.parse(fs.readFileSync(process.argv[3],'utf8').match(/WPT_PROPOSALS = (\[[\s\S]*?\]);\n\n\/\*/)[1]);
 const rm=Object.assign({},props.find(x=>x.id==='b3-01'),{level:2}), st=props.find(x=>x.id==='b3-02');
 try{await pushFix(Object.assign({},rm,{level:null}),'');ok(false,'x')}catch(e){ok(/Choose exactly what to remove/.test(e.message),'removal refused until you choose what goes')}
 const r=await pushFix(rm,'');const ed=calls.find(c=>c[1].endsWith('elementor-edit'));const b=JSON.parse(ed[2]);
 ok(r.backup==='b1'&&r.pageId===42&&b.op==='remove'&&b.level===2&&b.find==='NHS BPF Better Purchasing Framework'&&b.post_id===42,'remove fix: finds Healthcare by address, removes the BPF section');
 try{await undoFix(rm,{backup:'b1',pageId:42});ok(false,'x')}catch(e){ok(/edited since/.test(e.message),'undo refused when page changed since')}
 await undoFix(rm,{backup:'b1',pageId:42},true);ok(JSON.parse(calls[calls.length-1][2]).force===1,'forced undo sends force');
 const s=await pushFix(st,'');ok(pageStatus==='draft'&&s.before==='publish','unpublish: page set to draft, old status kept');
 await undoFix(st,{before:s.before,pageId:42});ok(pageStatus==='publish','undo republishes');
 global.fetch=async(url,o)=>{const u=new URL(url);if(u.pathname.endsWith('/check'))return{ok:true,status:200,json:async()=>[{url:rm.link,status:200}]};if(u.searchParams.get('slug'))return{ok:true,status:200,json:async()=>[{id:42,link:rm.link}]};return{ok:false,status:404,json:async()=>({message:'No route was found matching the URL and request method.'})};};
 try{await pushFix(rm,'');ok(false,'x')}catch(e){ok(/latest page checker snippet/.test(e.message),'old snippet: clear message to update it')}
})();
