// One-click full audit: every step has a runner, and the week only counts if the page audit worked.
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
['audit','speed','display'].forEach(id=>ok(src.indexOf('RUNNERS.'+id+' = function')>-1,'the '+id+' check registers a runner the full audit can call'));
ok(/id: "google",[^\n]*run: function/.test(src),'Google updates step runs on its own');
ok(/return Promise\.all\(types\.map/.test(src)&&/return Promise\.all\(\[next\(\), next\(\)\]\)/.test(src)&&/return pass\(\)\.then/.test(src),'each check returns a promise, so the next one waits for it to finish');
ok(/rec\.complete = !stopped && rec\.steps\.length === FULL_STEPS\.length && auditOk/.test(src),'a run only ticks off the week when the page audit worked');
ok(/id: "full-audit"[\s\S]{0,900}l\.complete \? l\.finished/.test(src),'Run the full website audit is a weekly task');
ok(/location\.hash !== "#seo"\) halt/.test(src),'leaving the page stops the run cleanly');
