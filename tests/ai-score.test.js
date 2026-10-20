// AI visibility: scoring a pasted answer.
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
function grab(n){const i=src.indexOf('function '+n+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
function grabVar(n){const i=src.indexOf('var '+n+' =');return src.slice(i,src.indexOf(';\n',i)+1);}
eval(grabVar('AI_BRANDS'));eval(grabVar('AI_NOT_A_NAME'));['aiMdText','aiNoWptLinks','aiIsWpt','aiHosts','scoreAiAnswer'].forEach(f=>eval(grab(f).replace(/^function (\w+)/,'global.$1 = function')));
const fx=n=>fs.readFileSync('tests/fixtures/ai/'+n,'utf8');const P=['Focus Group','Opus','Yo Telecom','Wavenet','Techvu'];
const ok=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c?'':' -> '+JSON.stringify(x)));if(!c)process.exitCode=1;};
let r=scoreAiAnswer(fx('chatgpt.txt'),P);
ok(r.named==='Yes','ChatGPT: WPT named',r);
ok(r.pos==='2'&&r.of===4,'ChatGPT: WPT 2nd of 4 in the list',r);
ok(r.cited==='https://westpiertech.com/business-phone-systems/sussex/','ChatGPT: WPT page cited, tracking tag removed',r);
ok(r.others.indexOf('Focus Group')===0&&/Wavenet/.test(r.others)&&/Daisy/.test(r.others),'ChatGPT: others in order',r);
ok(!/Pros|Cons|Pricing|Things/.test(r.others),'ChatGPT: headings and pros/cons are not brands',r);
ok(/8x8/.test(r.others)&&/RingCentral/.test(r.others),'ChatGPT: brands mentioned outside the list still listed',r);
ok(r.citedOthers==='focusgroup.co.uk','ChatGPT: competitor site cited',r);
ok(r.pinned.join()==='Focus Group,Wavenet','ChatGPT: pinned competitors spotted',r);
r=scoreAiAnswer(fx('google.txt'),P);
ok(r.named==='No'&&r.pos==='','Google: WPT not named',r);
ok(r.others==='Techvu, Opus, BT Business, Vodafone Business','Google: names in order of mention',r);
ok(!/Number porting|Local support/.test(r.others),'Google: tips are not brands',r);
r=scoreAiAnswer(fx('perplexity.txt'),P);
ok(r.named==='Yes'&&r.pos==='2'&&r.of===3,'Perplexity: WPT 2nd of 3',r);
ok(r.cited==='https://westpiertech.com/business-phone-systems/3cx/','Perplexity: cited page from the source list',r);
ok(r.citedOthers==='yotelecom.co.uk, focusgroup.co.uk','Perplexity: competitor sources',r);
r=scoreAiAnswer(fx('cited-only.txt'),P);
ok(r.named==='Partly','Linked but not named counts as Partly',r);
ok(r.cited==='https://westpiertech.com/msteams/','Bare link picked up',r);
r=scoreAiAnswer('',P);ok(r.named==='No'&&r.others==='','Empty paste is safe',r);
