/* Every Fix queue card is push, decide, claude or job, and each push type sends the right request. */
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw n;let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
function grabVar(n){const m=src.match(new RegExp('var '+n+' = [^;]*;'));return m[0];}
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
let STORE={};const load=(k,f)=>k in STORE?JSON.parse(JSON.stringify(STORE[k])):f;const save=(k,v)=>STORE[k]=v;
eval(['norm','shortPath','titleWords','aboutWords','townOf','competes','shortTitle','trimDesc','cardMode','altFromFile','altFile','altText','parseAltText','pushSite','needsV13','needsV12','needsV11','undoFix','typeLabel','goLabel','fixedText'].map(grab).join('\n')+'\n'+['STOP','BOILER','JOB_RE'].map(grabVar).join('\n')+grabVar('SITE_OP_LABEL').replace(/;$/,'')+';');
const T=s=>s;
/* Connor's competing-pages cards, 22 Oct: only the real overlap stays */
const pairs=[["Xima Contact Centre Software","Contact"],["Xima Contact Centre Software","Best Contact Centre Software for Small Businesses in the UK (2026 Guide)"],["Microsoft Teams Phone Systems in Brighton","Microsoft Teams"],["Microsoft Teams Phone Systems in Brighton","Zoom Phone Systems in Brighton | West Pier Technologies"],["Microsoft Teams Phone Systems in Brighton","3CX Phone Systems in Brighton | West Pier Technologies"],["Avaya IP Office End of Sale and Support","Avaya"],["Avaya IP Office End of Sale and Support","Avaya IP Office in 2026"],["business-phone-systems","Business Phone Systems Buyer's Guide: The Questions That Actually Decide Which Provider You Pick"],["business-phone-systems","Business Phone Systems in Sussex | West Pier Tech"],["business-phone-systems","Business Phone Systems in Crawley | West Pier Tech"]];
const kept=pairs.filter(p=>competes(p[0],p[1])).map(p=>p.join(' / '));
ok(kept.length===2&&kept.some(k=>/Avaya IP Office in 2026/.test(k))&&kept.some(k=>/Xima.*Best Contact Centre/.test(k)),'competing pages: '+pairs.length+' flagged before, '+kept.length+' real ones kept ('+kept.join('; ')+')');
/* Titles and descriptions */
ok(shortTitle({title:'Avaya IP Office Phone Systems in Portsmouth'})==='Avaya IP Office Phone Systems in Portsmouth | West Pier','title: page name plus short company name when it fits');
ok(shortTitle({title:'Business Phone Systems Buyer\'s Guide: The Questions That Actually Decide Which Provider You Pick'})==='','title: page name too long, left for Claude');
const d=trimDesc('A '.repeat(30)+'first sentence ends here. Second sentence carries on for long enough to push the total well past the limit of one hundred and sixty characters.');
ok(d.length<=160&&/here\.$/.test(d),'description: trimmed to whole sentences under 160');
/* Card kinds for Connor's queue */
const k=id=>cardMode({id,type:'manual',auto:true});
ok(k('auto-thin')==='claude'&&k('ga4-bounce-x')==='claude'&&k('mob-contrast')==='claude'&&k('mob-tap')==='claude','thin pages, engagement, contrast, tap targets: Claude writes');
ok(k('mob-slow')==='job'&&k('mob-images')==='job'&&k('auto-slow')==='job'&&k('auto-verify-google')==='job','speed, images, slow server, Google verification: Your jobs');
ok(k('auto-cannibal-a-b')==='decide','competing pages: a decision');
ok(cardMode({id:'ai-04',type:'manual'})==='job'&&cardMode({id:'b8-05',type:'manual'})==='job','off-site steps and Matt\'s template: Your jobs');
ok(cardMode({id:'auto-orphans',type:'manual',auto:true})==='push'&&cardMode({id:'x',type:'meta_title'})==='push','orphans card and real fixes: push');
/* Alt text editing */
const items=[{src:'https://westpiertech.com/wp-content/uploads/2025/03/brighton-office-team-1024x683.jpg',alt:''},{src:'https://westpiertech.com/wp-content/uploads/IMG_2041.jpg',alt:''}];
ok(altFromFile(items[0].src)==='Brighton office team','alt: starting text from a good file name');
ok(altFromFile(items[1].src)==='','alt: camera file names left blank for you to write');
items.forEach(it=>it.alt=altFromFile(it.src));
const txt=altText(items).replace('IMG_2041.jpg: ','IMG_2041.jpg: Engineer fitting a Yealink phone');
const parsed=parseAltText(txt,items);
ok(parsed.length===2&&parsed[1].alt==='Engineer fitting a Yealink phone','alt: your edits in the box are what get pushed');
ok(parseAltText(altText(items),items).length===1,'alt: blank lines are skipped, not pushed empty');
/* Requests */
let sent=[];global.wpFetch=async(u,o)=>{sent.push({u,b:o&&o.body});return {before:'b',after:'a',backup:'s123',skipped:[]};};
(async()=>{
 await pushSite({op:'llms',siteWide:true,textParam:'value'},'# WPT');
 ok(sent[0].u==='/wpt-hub/v1/site-edit'&&sent[0].b.op==='llms'&&sent[0].b.value==='# WPT'&&sent[0].b.post_id===0,'llms: site-wide push sends the edited text');
 await pushSite({op:'relink',pageId:9,params:{from:'a',to:'b'}},'');
 ok(sent[1].b.post_id===9&&sent[1].b.from==='a'&&sent[1].b.to==='b','relink: page push sends the page and both addresses');
 sent=[];await undoFix({type:'site_edit',postType:'pages'},{backup:'s123'});
 ok(sent[0].u==='/wpt-hub/v1/site-undo'&&sent[0].b.backup==='s123','undo: site fixes undo through the site-undo route');
 sent=[];await undoFix({type:'text_swap',postType:'posts',pageId:4},{backup:'b55'});
 ok(sent[0].u==='/wpt-hub/v1/elementor-undo','undo: an Elementor phrase change undoes through Elementor');
 ok(goLabel({type:'site_edit',op:'h1_one'})==='Approve and keep one H1'&&goLabel({type:'site_edit',op:'option',params:{key:'bing_verify'}})==='Approve and save the setting','buttons say what pushing does');
 ok(fixedText({type:'site_edit',op:'h1_one'})&&!fixedText({type:'site_edit',op:'llms',textParam:'value'})&&!fixedText({type:'site_edit',op:'alt'}),'only fixes with text to edit get an editable box');
 try{await needsV13(new Error('No route was found matching the URL'));ok(false,'')}catch(e){ok(/version 13/.test(e.message),'old page checker: says to update to version 13')}
})();
