const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw n;let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
eval(['norm','parentPages','siteAudit'].map(grab).join('\n'));
const H='https://westpiertech.com';
const pp=parentPages([H+'/business-phone-systems/8x8/brighton/',H+'/business-phone-systems/3cx/brighton/']);
ok(pp.indexOf(H+'/business-phone-systems/8x8/')>-1&&pp.indexOf(H+'/business-phone-systems/3cx/')>-1&&pp.indexOf(H+'/business-phone-systems/')>-1,'parent hub pages found');
ok(pp.length===3,'each parent listed once');
ok(parentPages([H+'/feature-comparison/']).length===0,'top-level page has no parent to add');
/* 300 sitemap addresses would fill the 250 cap before the hubs were read. */
let checked=[];
global.wpFetch=async()=>({home:H+'/',sitemap_urls:Array.from({length:300},(_,i)=>H+'/business-phone-systems/8x8/town-'+i+'/')});
global.checkUrls=async(urls)=>{checked=urls;return {};};
const pages=[{link:H+'/business-phone-systems/8x8/brighton/',live:true,linksAll:[]}];
(async()=>{await siteAudit(pages);
 ok(checked.indexOf(H+'/business-phone-systems/8x8/')>-1,'8x8 hub is read even when the sitemap is bigger than the cap');
 ok(checked.length<=250,'cap still respected');})();
