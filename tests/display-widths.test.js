const fs=require('fs');
const src=fs.readFileSync(process.argv[2],'utf8');
function grab(name){const i=src.indexOf('function '+name+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
function grabVar(name){const i=src.indexOf('var '+name+' =');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+2);}}}
global.window={WPT_PROPOSALS:[]};
eval(['norm','shortPath','modeOf','describeModes','buildDisplayFixes'].map(grab).join('\n')+grabVar('DISPLAY_KIND')+grabVar('FIT_SET')+grabVar('SFX'));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
const d=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const f=buildDisplayFixes(d);
const w=f.find(o=>o.type==='elementor_type'&&o.set.typography_font_size);
ok(w&&w.set.typography_font_size.size===40&&w.set.typography_font_size_tablet.size===27&&w.set.typography_font_size_mobile.size===37,'broken "Communications": smallest fitting size per screen type (desktop, tablet, phone)');
ok(/1280, 1120, 1024, 900, 768, 400px/.test(w.current),'says the exact widths where it breaks');
const lh=f.find(o=>o.type==='elementor_type'&&o.set.typography_line_height);ok(lh&&lh.set.typography_line_height.size===1.2,'loose heading lines: line spacing to 1.2');
const pd=f.find(o=>o.type==='elementor_layout'&&o.set.padding);ok(pd&&pd.set.padding.top==='80'&&pd.set.padding_mobile.bottom==='40','too much empty space: padding brought down per screen type');
ok(f.length===3,'one fix per problem, not one per width');
const old=buildDisplayFixes({pages:{'https://x.test/':{pageId:1,desktop:[{kind:'stranded_punct',punct:'.',text:'Hi .',widget:{id:'a',type:'heading'}}],phone:[]}}});
ok(old.length===1,'older saved checks (desktop and phone only) still work');
