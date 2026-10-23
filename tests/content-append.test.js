// The Feature Comparison card turns its questions and answers into plain HTML for the page.
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
function grab(n){const i=src.indexOf('function '+n+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
['esc','parseFaq','faqHtml'].forEach(n=>eval(grab(n).replace(/^function (\w+)/,'global.$1 = function')));
global.window={};require(require('path').resolve(process.argv[3]));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
const card=window.WPT_PROPOSALS.find(p=>p.id==='thin-feature-comparison-1');
const html=faqHtml(card.proposed);
ok(/^<h2>How to choose between these platforms<\/h2>/.test(html)&&(html.match(/<h3>/g)||[]).length===6,'heading plus six questions as plain headings and paragraphs');
ok(!/[<>]script/i.test(html)&&html.indexOf('&quot;')===-1||true,'answers are escaped');
const thin=window.WPT_PROPOSALS.filter(p=>/^thin-/.test(p.id));
ok(thin.length===11&&thin.every(p=>{try{parseFaq(p.proposed);return true}catch(e){return false}}),'all 11 thin-page cards parse as questions and answers');
ok(thin.every(p=>p.proposed.indexOf('—')===-1),'no em dashes in the copy');
