const fs=require('fs');
const src=fs.readFileSync(process.argv[2],'utf8');
function grab(name){const i=src.indexOf('function '+name+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
const store={};const load=(k,f)=>k in store?JSON.parse(store[k]):f;const save=(k,v)=>store[k]=JSON.stringify(v);
const stripHtml=s=>String(s).replace(/<[^>]+>/g,'');
global.btoa=s=>Buffer.from(s).toString('base64');
let sent=null;
global.fetch=async(url,o={})=>{sent={url,body:JSON.parse(o.body||'null')};
 if(/elementor-undo/.test(url))return {ok:true,status:200,json:async()=>({ok:true})};
 return {ok:true,status:200,json:async()=>({ok:true,backup:'b1',before:'',after:'Heading\n\nQ: x'})};};
eval(['wpAuth','wpBase','wpFetch','metaKey','countOnce','parseFaq','needsV11','needsV12','pushFix','undoFix'].map(grab).join('\n'));
save('wp-auth',{site:'https://x.test',user:'hub',pass:'pw'});
const txt='Heading: 8x8 questions\nQ: Is 8x8 good for small teams?\nA: Yes. It suits teams from five users.\nIt scales up too.\n\nQ: Can I keep my numbers?\nA: Yes, we port them across.';
const f=parseFaq(txt);
ok(f.heading==='8x8 questions'&&f.items.length===2,'parses heading and two questions');
ok(f.items[0].a==='Yes. It suits teams from five users. It scales up too.','multi-line answers joined');
ok(parseFaq('Q: First question here?\nA: First answer here.\nq: Second question?\na: Second answer here.').heading==='','heading optional, labels any case');
try{parseFaq('Q: Only one question?\nA: Only one answer here.');ok(false,'one')}catch(e){ok(/between 2 and 12/.test(e.message),'one question refused')}
try{parseFaq('Q: First question here?\nA: First answer here.\nQ: Second?\n');ok(false,'blank')}catch(e){ok(/Question 2/.test(e.message),'missing answer named')}
(async()=>{
 const p={id:'faq-8x8',type:'elementor_faq',postType:'pages',pageId:44,before:'Get in touch'};
 const r=await pushFix(p,txt);
 ok(/elementor-edit/.test(sent.url)&&sent.body.op==='faq'&&sent.body.items.length===2&&sent.body.before==='Get in touch'&&sent.body.heading==='8x8 questions','pushes op faq with items, heading and placement');
 ok(r.backup==='b1'&&r.before==='(no FAQ on the page)','backup kept for undo');
 await undoFix(p,{backup:'b1'});ok(/elementor-undo/.test(sent.url)&&sent.body.backup==='b1','undo uses the page backup');
 sent=null;try{await pushFix(p,'Q: bad');ok(false,'bad')}catch(e){ok(sent===null,'bad text never reaches WordPress')}
 global.fetch=async()=>({ok:false,status:400,json:async()=>({message:'Unknown edit type.'})});
 try{await pushFix(p,txt);ok(false,'old')}catch(e){ok(/version 11/.test(e.message),'old snippet: says to update to version 11')}
})();
