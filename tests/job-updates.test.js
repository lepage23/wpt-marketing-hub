// Claude can update a job's status from GitHub, once per stamp.
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
function grab(n){const i=src.indexOf('function '+n+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
const store={};function load(k,f){return k in store?JSON.parse(JSON.stringify(store[k])):f;}function save(k,v){store[k]=JSON.parse(JSON.stringify(v));}let n=0;function uid(){return 'u'+(n++);}
const window={};eval(grab('syncJobs'));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
window.WPT_JOBS=[{id:'a',job:'Apply',details:'old'}];syncJobs();
ok(store.jobs[0].status==='To do','new job starts as To do');
window.WPT_JOBS=[{id:'a',job:'Apply',details:'new',status:'Doing',update:'s1'}];syncJobs();
ok(store.jobs[0].status==='Doing'&&store.jobs[0].details==='new','update stamp sets status and details');
store.jobs[0].status='Done';syncJobs();
ok(store.jobs[0].status==='Done','your own change is kept after the update is applied');
window.WPT_JOBS=[{id:'a',job:'Apply',status:'To do',update:'s2'}];syncJobs();
ok(store.jobs[0].status==='To do'&&store.jobs.length===1,'a newer stamp applies again, no duplicate row');
