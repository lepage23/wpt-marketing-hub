// The hub offers to update its own page checker when its copy is newer than the site's.
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
function grab(n){const i=src.indexOf('function '+n+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
global.window={};require(require('path').resolve(process.argv[3]));
let mem={};global.load=(k,f)=>k in mem?mem[k]:f;global.today=()=>'2026-10-23';global.wpAuth=()=>mem['wp-auth'];
eval(grab('bundledChecker').replace(/^function (\w+)/,'global.$1 = function'));eval(grab('checkerCards').replace(/^function (\w+)/,'global.$1 = function'));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
const v=bundledChecker();
ok(v>=20,'the hub knows the version of its own page checker ('+v+')');
mem['wp-auth']={site:'https://westpiertech.com',checker:true,checkerVersion:v-1};
ok(checkerCards().length===1&&checkerCards()[0].type==='snippet_update'&&checkerCards()[0].priority==='critical','an older page checker on the site raises an update card');
mem['wp-auth'].checkerVersion=v;
ok(checkerCards().length===0,'no card when the site is up to date');
mem['fix-state']={['update-checker-v'+v]:{status:'pushed'}};
ok(checkerCards().length===1,'a pushed update stays listed in Done with its Undo');
ok(/active: false[\s\S]*code: code, active: true/.test(grab('putCheckerBack')),'old code goes back with the snippet switched off first, so two versions never load together');
