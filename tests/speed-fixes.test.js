// The /charity/ page report (19 Oct 2026): every finding ends up in a grouped fix, mobile and desktop together.
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');const fx=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
function grab(n){const i=src.indexOf('function '+n+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
function grabVar(n){const i=src.indexOf('var '+n+' = ');let d=0;for(let k=i;k<src.length;k++){const c=src[k];if(c=='{'||c=='(')d++;else if(c=='}'||c==')')d--;else if(c==';'&&d===0)return src.slice(i,k+1);}}
global.window={WPT_PROPOSALS:[]};
eval(['norm','shortPath','summarisePsi','failOf','fileName','speedFixes','buildMobileFixes'].map(grab).join('\n')+'\n'+grabVar('PSI_SKIP')+'\n'+grabVar('PSI_KEEP_INFO')+'\n'+grabVar('PSI_IDS'));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
const U='https://westpiertech.com/charity/',U2='https://westpiertech.com/healthcare/';
const m=summarisePsi(fx.mobile),dk=summarisePsi(fx.desktop);
ok(m.fails.some(f=>f.id==='has-hsts')&&!m.fails.some(f=>f.id==='non-composited-animations'),'security header findings kept, other info-only checks not');
ok(m.fails.find(f=>f.id==='errors-in-console').items[0].text.includes('TypeError'),'console error text kept');
const all=buildMobileFixes({pages:{[U]:m,[U2]:m},desktop:{[U]:dk,[U2]:dk},withDesktop:true});const id=x=>all.find(f=>f.id===x);
ok(id('spd-lcp')&&id('spd-lcp').priority==='high'&&/mobile 13\.0 s, desktop 3\.0 s/.test(id('spd-lcp').pages[0].note),'13 s main content caught even though the score is 61, mobile and desktop on one line');
ok(id('spd-render-blocking')&&/frontend\.min\.css/.test(id('spd-render-blocking').why)&&/3,410 ms/.test(id('spd-render-blocking').pages[0].note),'render-blocking files named, with the saving');
ok(id('spd-unused-code')&&id('spd-cache')&&id('spd-lowres'),'unused code, cache times and low-res images each a fix');
ok(id('spd-console')&&/TypeError/.test(id('spd-console').why),'console errors a fix, with the first error');
ok(id('spd-heading-order')&&/desktop/.test(id('spd-heading-order').pages[0].note),'heading order caught from desktop');
ok(id('spd-heavy')&&/3,589 KiB/.test(id('spd-heavy').pages[0].note),'3.5 MB desktop page caught');
ok(id('mob-images')&&id('mob-images').pages.some(p=>/charity-team.*desktop/.test(p.title+p.note)),'big desktop image in the image fix');
ok(id('sec-headers')&&id('sec-headers').pages.length===0&&id('sec-headers').link==='https://westpiertech.com/'&&/HSTS/.test(id('sec-headers').why)&&id('sec-headers').steps.some(s=>/Strict-Transport-Security/.test(s)),'one security headers fix for the whole site, with the lines to add');
ok(id('mob-contrast'),'contrast still a fix');
ok(id('spd-lcp').pages.length===2&&id('spd-render-blocking').pages.length===2,'one fix per problem, both pages listed inside it, not one fix per page');
ok(all.filter(f=>/^(spd|sec)-/.test(f.id)).length===9,'nine grouped fixes from this one page (speed, security, headings)');
