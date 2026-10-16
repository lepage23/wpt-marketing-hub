const fs=require('fs');
const src=fs.readFileSync(process.argv[2],'utf8');
function grab(name){const i=src.indexOf('function '+name+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
const store={};const load=(k,f)=>k in store?JSON.parse(store[k]):f;const save=(k,v)=>store[k]=JSON.stringify(v);
const stripHtml=s=>String(s).replace(/<[^>]+>/g,'');
global.btoa=s=>Buffer.from(s).toString('base64');
let sent=null,route=true;
global.fetch=async(url,o={})=>{
 if(/wp\/v2\/pages\?slug=healthcare/.test(url))return {ok:true,status:200,json:async()=>[{id:40,link:'https://westpiertech.com/healthcare/'}]};
 if(/page-style/.test(url)){if(!route)return {ok:false,status:404,json:async()=>({message:'No route was found matching the URL and request method.'})};return {ok:true,status:200,json:async()=>({ok:true,fonts:[{name:'Primary',family:'Poppins',size:'40px'}],colors:[],layout:[]})};}
 if(/page-build/.test(url)){sent=JSON.parse(o.body);return {ok:true,status:200,json:async()=>({ok:true,id:77,status:'draft',preview:'https://westpiertech.com/?page_id=77&preview=true',edit:'x'})};}
 return {ok:false,status:500,json:async()=>({})};};
eval(['wpAuth','wpBase','wpFetch','norm','resolveId','needsV6','pageStyle','buildPage'].map(grab).join('\n'));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
(async()=>{
 save('wp-auth',{site:'https://westpiertech.com',user:'hub',pass:'pw'});
 const p={id:'b5-01',type:'page_build',template:'https://westpiertech.com/healthcare/',parent:'https://westpiertech.com/healthcare/',newTitle:'NHS telephony',slug:'nhs-telephony',ready:false,edits:[]};
 try{await buildPage(p);ok(false,'not ready')}catch(e){ok(/isn't written yet/.test(e.message)&&!sent,'button does nothing until the page is written')}
 const s=await pageStyle(p);ok(s.templateId===40&&s.fonts[0].family==='Poppins','reads the template look');
 const r=await buildPage({...p,ready:true,edits:[{op:'set',find:'Healthcare',replace:'NHS telephony'}]});
 ok(r.id===77&&/preview=true/.test(r.preview),'build returns a preview link');
 ok(sent.template_id===40&&sent.parent_id===40&&sent.slug==='nhs-telephony'&&sent.edits.length===1,'sends template, parent, slug and edits');
 route=false;try{await pageStyle(p);ok(false,'v6')}catch(e){ok(/version 6/.test(e.message),'old snippet gives a clear update message')}
 try{await buildPage({...p,example:true});ok(false,'ex')}catch(e){ok(/example/.test(e.message),'examples cannot build')}
})();
