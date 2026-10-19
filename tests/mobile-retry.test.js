// Mobile check: temporary failures are retried, real ones are not.
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');const raw=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
function grab(n){const i=src.indexOf('function '+n+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
function grabVar(n){return src.match(new RegExp('var '+n+' = [^\\n]*;'))[0];}
let KEY='AIzaTest';function psiKey(){return KEY;}
eval(['summarisePsi','psiWait','psiOnce','runPsi'].map(grab).join('\n')+'\n'+grabVar('PSI_URL')+'\n'+grabVar('PSI_SKIP')+'\n'+grabVar('PSI_TIMEOUT'));
PSI_WAIT=[1,1];
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
function resp(status,body){return Promise.resolve({ok:status<300,status,json:()=>Promise.resolve(body)});}
async function t(script){let n=0;global.fetch=()=>script[Math.min(n++,script.length-1)]();try{const r=await runPsi('https://westpiertech.com/x/');return {r,n};}catch(e){return {e,n};}}
(async()=>{
  let x=await t([()=>Promise.reject(new TypeError('Failed to fetch')),()=>resp(200,raw)]);
  ok(x.r&&x.r.perf===34&&x.n===2,'no answer from Google: tried again and got the result');
  x=await t([()=>resp(500,{error:{message:'Lighthouse returned error'}}),()=>resp(503,{}),()=>resp(200,raw)]);
  ok(x.r&&x.n===3,'Google busy twice: third go works');
  x=await t([()=>Promise.reject(new TypeError('Failed to fetch'))]);
  ok(x.e&&x.e.network&&x.n===3&&/No answer from Google/.test(x.e.message),'gives up after three goes with a plain message');
  x=await t([()=>resp(400,{error:{message:'API key not valid. Please pass a valid API key.'}})]);
  ok(x.e&&x.e.badKey&&x.n===1,'bad key is not retried and says so');
  KEY='';x=await t([()=>resp(429,{})]);
  ok(x.e&&x.e.limit&&x.n===1&&/Add a free API key/.test(x.e.message),'no key: limit not retried');
  KEY='AIzaTest';x=await t([()=>resp(429,{}),()=>resp(200,raw)]);
  ok(x.r&&x.n===2,'with a key: per-minute limit retried');
  const tbl=src.slice(src.indexOf('    function table(d) {'),src.indexOf('    function runAll('));
  ok(/PSI_SHOW = 10/.test(src)&&/rows\.slice\(0, PSI_SHOW\)/.test(tbl)&&/Show all /.test(tbl)&&/Show fewer/.test(tbl),'results list shows the 10 slowest with Show all / Show fewer');
  ok(/Check the ' \+ failed \+ " that failed again/.test(tbl)&&/runAll\(true\)/.test(tbl),'button to recheck only the failed pages');
})();
