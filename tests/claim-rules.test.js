const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
function grab(n){const i=src.indexOf('function '+n+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
const store={};const load=(k,f)=>k in store?JSON.parse(store[k]):f;const save=(k,v)=>store[k]=JSON.stringify(v);const updateNav=()=>{};
global.window={WPT_PROPOSALS:[{link:'https://westpiertech.com/',find:'an assured BPF supplier to the NHS'}]};
const findText=async(q)=>[{post_id:7,title:'Home',link:'https://westpiertech.com/',type:'page',elementor:true,hits:[{snippet:'West Pier is an assured BPF supplier to the NHS and'}]},{post_id:9,title:'A post',link:'https://westpiertech.com/blog/x/',type:'post',elementor:false,hits:[{snippet:'an assured BPF supplier'}]}];
eval(grab('norm')+grab('claimRules')+grab('parseRules')+grab('ruleFixes'));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
const r=parseRules("an assured BPF supplier => a long-standing supplier\nnot a rule\nab => x");
ok(r.length===1&&r[0].replace==='a long-standing supplier','rules parsed, junk lines ignored');
(async()=>{save('claim-rules',[{find:'an assured BPF supplier to the NHS',replace:'a long-standing supplier to the NHS'},{find:'an assured BPF supplier',replace:'a long-standing supplier'}]);
 const f=await ruleFixes();
 ok(!f.some(x=>x.find==='an assured BPF supplier to the NHS'&&x.link==='https://westpiertech.com/'),'no duplicate of a fix Claude already wrote');
 const home=f.find(x=>x.link==='https://westpiertech.com/'&&x.find==='an assured BPF supplier');
 ok(home&&home.type==='elementor_swap'&&home.pageId===7&&home.proposed==='a long-standing supplier'&&home.priority==='critical','Elementor page gets a push-ready phrase change');
 const post=f.find(x=>x.link.includes('/blog/')&&x.find==='an assured BPF supplier');
 ok(post&&post.type==='content_replace'&&post.postType==='posts'&&post.current==='an assured BPF supplier','normal post gets a push-ready content change');
})();
