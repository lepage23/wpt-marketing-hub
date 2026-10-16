const fs=require('fs');
const src=fs.readFileSync(process.argv[2],'utf8');
function grab(name){const i=src.indexOf('function '+name+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
function grabVar(name){const i=src.indexOf('var '+name+' =');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+2);}}}
global.window={WPT_PROPOSALS:[{type:'elementor_style',link:'https://westpiertech.com/',find:'engineer-new-logo-wpt-edit-with-cert-number-underneath'}]};
eval(['norm','shortPath','buildDisplayFixes'].map(grab).join('\n')+grabVar('DISPLAY_KIND')+grabVar('FIT_SET'));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
const rep=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const phone=rep.issues.filter(i=>i.kind!=='button_wrap');
const f=buildDisplayFixes({pages:{'https://westpiertech.com/':{pageId:42,desktop:rep.issues,phone:phone},'https://westpiertech.com/gamma/':{error:"didn't report back"}}});
const id=x=>f.find(o=>o.id===x);
const car=f.find(o=>o.element==='mc1'),st=f.find(o=>o.element==='st1');
ok(car&&car.type==='elementor_style'&&car.widget==='media-carousel'&&car.set.image_fit==='contain'&&car.pageId===42&&car.priority==='high','cut-off logo in carousel becomes a push-ready carousel fix');
ok(st&&st.set['object-fit']==='contain'&&/desktop and phones/.test(st.current)&&/near “Reviews”/.test(st.issue),'squashed stars become a push-ready image fix, saying where and on what');
ok(id('disp-broken')&&id('disp-broken').type==='manual'&&id('disp-broken').pages.length===1,'broken image listed');
ok(id('disp-button_wrap')&&/desktop only/.test(id('disp-button_wrap').pages[0].note),'wrapped button listed, desktop only');
ok(id('disp-overflow')&&id('disp-overflow').priority==='high','sticking-out box listed');
ok(f.filter(o=>o.element==='mc1').length===1,'no duplicate fixes for the same widget');
