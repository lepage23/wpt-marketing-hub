const fs=require('fs');
const src=fs.readFileSync(process.argv[2],'utf8');
function grab(name){const i=src.indexOf('function '+name+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
function grabVar(name){const i=src.indexOf('var '+name+' =');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+2);}}}
global.window={WPT_PROPOSALS:[]};
eval(['norm','shortPath','modeOf','describeModes','displayCss','buildDisplayFixes'].map(grab).join('\n')+grabVar('DISPLAY_KIND')+grabVar('FIT_SET')+grabVar('SFX')+grabVar('CSS_KINDS'));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
const rep=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const U='https://westpiertech.com/unified-communications/';
const f=buildDisplayFixes({pages:{[U]:{pageId:77,desktop:rep.issues,phone:[]}}});
const by=(t,el)=>f.find(o=>o.type===t&&o.element===el);
ok(by('elementor_tidy','h1')&&by('elementor_tidy','h2'),'stranded full stop and question mark: push-ready punctuation fixes');
const w=by('elementor_set','h0');ok(w&&w.needsEdit&&w.find===w.current&&/Communications/.test(w.current),'repeated word: editable heading fix, must be reworded before pushing');
const im=by('elementor_layout','img1');ok(im&&im.set.max_width.size===100&&im.clearNeg===true,'photo hanging out of its box: capped and negative margin cleared');
const b=by('elementor_layout','btn1');ok(b&&b.set._margin.left==='0','indented button: left margin set to 0');
ok(!f.some(o=>o.type==='elementor_layout'&&o.element==='sec1'&&o.set.margin),'off-centre section (not a container): not auto-fixed');
ok(f.find(o=>o.id==='disp-off_centre'&&o.type==='manual'),'off-centre section listed with steps instead');
const sp=by('elementor_layout','sec1');ok(sp&&sp.set.padding.bottom==='60','too much space at the bottom: padding matched to the top');
const f2=buildDisplayFixes({pages:{[U]:{pageId:77,desktop:[],phone:rep.issues}}});
ok(f2.find(o=>o.element==='btn1').set._margin_mobile,'phone-only problems change the phone setting only');
window.WPT_PROPOSALS=[{type:'elementor_set',link:U,find:'Unified Communications for Smarter Business Communication'}];
const f3=buildDisplayFixes({pages:{[U]:{pageId:77,desktop:rep.issues}}});
ok(!f3.some(o=>o.element==='h0'),'no duplicate when Claude already wrote the heading fix');
