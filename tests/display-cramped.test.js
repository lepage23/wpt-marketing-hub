const fs=require('fs');
const src=fs.readFileSync(process.argv[2],'utf8');
function grab(name){const i=src.indexOf('function '+name+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
function grabVar(name){const i=src.indexOf('var '+name+' =');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+2);}}}
global.window={WPT_PROPOSALS:[]};
eval(['norm','shortPath','modeOf','describeModes','displayCss','buildDisplayFixes'].map(grab).join('\n')+grabVar('DISPLAY_KIND')+grabVar('FIT_SET')+grabVar('SFX')+grabVar('CSS_KINDS'));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
/* Reports shaped like the real police page (westpiertech.com/public-sector/, October 2026). */
const U='https://westpiertech.com/public-sector/';
const items=[{element:'9b0a8f9',set:{flex_wrap:'wrap',flex_wrap_mobile:'wrap'}},{element:'23dd469',set:{width:{unit:'%',size:55},width_mobile:{unit:'%',size:100}}},{element:'b63a266',set:{width:{unit:'%',size:100},width_mobile:{unit:'%',size:100},flex_wrap:'wrap',flex_wrap_mobile:'wrap'}}];
const word=w=>({kind:'broken_word',text:'Warwickshire Police',word:'Warwickshire',fontSize:30,fitSize:23,widget:{id:'f0c0ac8',type:'heading'},at:{near:'Our Expertise'},peers:['82bb641'],detail:'splits at '+w});
const cramped=(id,t)=>({kind:'cramped_text',text:t,widget:{id:id,type:'text-editor'},row:'9b0a8f9',detail:'about 15 letters a line'});
const row=works=>({kind:'cramped_row',text:'Warwickshire Police',widget:{id:'9b0a8f9',type:'container'},items:items,works:works,widgets:['f0c0ac8','0df3ab7','82bb641','3153cb1'],
  before:['Helping Warwickshire: about 15 letters a line'],afterLines:['Helping Warwickshire: about 34 letters a line'],detail:'4 bits of text squeezed'});
const desk=works=>[1366,1536,1440,1280,1120,1024].map(w=>({width:w,issues:[word(w),cramped('0df3ab7','Helping Warwickshire Police'),cramped('3153cb1','Working with Sussex'),row(works)]}));
let f=buildDisplayFixes({pages:{[U]:{pageId:1295,reports:desk(true).concat([{width:400,issues:[]}])}}});
const ar=f.find(o=>o.type==='elementor_arrange');
ok(ar&&ar.items.length===3&&ar.pageId===1295&&ar.priority==='high','squeezed row that the page tried and fixed: one push-ready layout fix');
ok(ar&&/34 letters a line/.test(ar.proposed)&&/Undo/.test(ar.proposed),'layout fix says what the text came out like when tried');
ok(!f.some(o=>o.type==='elementor_type'),'broken word inside that row: no separate text size fix, the layout fix covers it');
ok(!f.some(o=>o.id==='disp-cramped_text'||o.id==='disp-cramped_row'),'nothing left over as steps for you');
f=buildDisplayFixes({pages:{[U]:{pageId:1295,reports:desk(false)}}});
const ty=f.find(o=>o.type==='elementor_type');
ok(ty&&ty.also.join()==='82bb641'&&ty.set.typography_font_size.size===23,'arrangement didn\'t fix it: text size fix shrinks Warwickshire and the matching Sussex heading together');
ok(ty&&/matching heading/.test(ty.proposed),'text size card says the matching heading changes too');
ok(f.some(o=>o.id==='disp-cramped_row'&&o.type==='manual'),'arrangement that didn\'t work goes to Claude, not pushed');
ok(!f.some(o=>o.type==='elementor_arrange'),'no layout push when the trial didn\'t fix the text');
const tab=desk(true).concat([{width:400,issues:[word(400)]}]);
f=buildDisplayFixes({pages:{[U]:{pageId:1295,reports:tab}}});
ok(f.some(o=>o.type==='elementor_arrange')&&f.some(o=>o.type==='elementor_type'&&o.set.typography_font_size_mobile&&!o.set.typography_font_size),'word also breaks on phones: layout fix plus a phone text size fix');
