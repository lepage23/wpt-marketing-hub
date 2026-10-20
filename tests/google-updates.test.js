const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw n;let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
const esc=s=>String(s);var GU_PAGE="https://status.search.google.com/",GU_SETTLE_DAYS=14;
eval(['guDate','updateSummary','updateLine','updateNotice'].map(grab).join('\n'));
/* Real shape from incidents.json, 20 Oct 2026. */
const list=[
 {id:"XhUDXP7A67iHCD2kmbVu",begin:"2026-09-24T16:15:00+00:00",end:"2026-10-08T08:00:00+00:00",external_desc:"September 2026 spam update",uri:"incidents/XhUDXP7A67iHCD2kmbVu",service_name:"Ranking"},
 {id:"LEubPCm2octf2uMqCFKE",begin:"2026-08-18T16:27:00+00:00",end:"2026-08-21T08:49:00+00:00",external_desc:"August 2026 spam update",uri:"incidents/LEubPCm2octf2uMqCFKE",service_name:"Ranking"},
 {id:"x",begin:"2026-05-21T15:40:00+00:00",end:"2026-06-02T12:40:00+00:00",external_desc:"May 2026 core update",service_name:"Ranking"}];
const now=Date.parse("2026-10-20T15:00:00Z");
const s=updateSummary(list,now);
ok(s.all[0].name==="September 2026 spam update"&&s.all.length===3,'newest first');
ok(s.settling.length===1&&s.live.length===0,'September update finished 12 days ago counts as settling');
ok(s.all[2].core&&s.all[2].state==="done",'old core update marked done');
ok(s.all[0].link==="https://status.search.google.com/incidents/XhUDXP7A67iHCD2kmbVu",'links to Google\'s incident page');
ok(/recently finished the September 2026 spam update/.test(updateNotice({list},now)),'Today notice names the settling update');
ok(updateNotice({list},Date.parse('2026-11-30T00:00:00Z'))==='','no Today notice when nothing is live or settling');
const live=updateSummary([{begin:"2026-10-18T10:00:00Z",external_desc:"October 2026 core update",service_name:"Ranking"}],now);
ok(live.live.length===1&&/Rolling out since/.test(updateLine(live.live[0])),'update with no end is live');
ok(updateSummary(list,Date.parse("2026-11-30T00:00:00Z")).settling.length===0,'nothing to show once two weeks have passed');
ok(updateSummary([{begin:"2026-10-01",external_desc:"Search outage",service_name:"Crawling"}],now).all.length===0,'non-ranking incidents ignored');
