// Every request the hub sends must only use headers WordPress allows cross-origin.
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
function grab(n){const i=src.indexOf('function '+n+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
const store={};const load=(k,f)=>k in store?JSON.parse(store[k]):f;const stripHtml=s=>s;global.btoa=s=>Buffer.from(s).toString('base64');
const ALLOWED=['authorization','x-wp-nonce','content-disposition','content-md5','content-type'];let bad=[];
global.fetch=async(url,o)=>{Object.keys(o.headers||{}).forEach(h=>{if(!ALLOWED.includes(h.toLowerCase()))bad.push(h);});return{ok:true,status:200,json:async()=>({})};};
eval(grab('wpAuth')+grab('wpBase')+grab('wpFetch'));
store['wp-auth']=JSON.stringify({site:'https://westpiertech.com',user:'u',pass:'p'});
(async()=>{await wpFetch('/wp/v2/pages');await wpFetch('/wpt-hub/v1/check',{method:'POST',body:{urls:[]}});
console.log((bad.length?'FAIL':'PASS')+' only WordPress-allowed headers are sent'+(bad.length?': '+bad.join(','):''));})();
