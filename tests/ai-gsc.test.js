// Google AI impressions: the hub reads Search Console's Generative AI export (a zip of CSV files).
const fs=require('fs'),zlib=require('zlib');const src=fs.readFileSync(process.argv[2],'utf8');
function grab(n){const i=src.indexOf('function '+n+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
const store={};global.load=(k,d)=>k in store?store[k]:d;global.save=(k,v)=>{store[k]=v;};global.today=()=>'2026-10-23';
['parseCsv','unzipText','aiGscParse','aiGscHistory','aiGscLatest','aiGscDue','aiGscSave'].forEach(n=>eval(grab(n).replace(/^function (\w+)/,'global.$1 = function')));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
// build a zip the way Search Console does (deflate)
function zip(files){const parts=[],cen=[];let off=0;for(const [name,text] of Object.entries(files)){const n=Buffer.from(name),raw=Buffer.from(text),d=zlib.deflateRawSync(raw);
 const l=Buffer.alloc(30);l.writeUInt32LE(0x04034b50,0);l.writeUInt16LE(8,8);l.writeUInt32LE(d.length,18);l.writeUInt32LE(raw.length,22);l.writeUInt16LE(n.length,26);parts.push(l,n,d);
 const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(8,10);c.writeUInt32LE(d.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(off,42);cen.push(c,n);off+=30+n.length+d.length;}
 const cd=Buffer.concat(cen),e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(Object.keys(files).length,10);e.writeUInt32LE(cd.length,12);e.writeUInt32LE(off,16);
 const b=Buffer.concat([...parts,cd,e]);return b.buffer.slice(b.byteOffset,b.byteOffset+b.length);}
const files={'Dates.csv':'﻿Date,Impressions\n2026-10-16,12\n2026-10-15,8\n2026-10-17,"1,010"\n','Pages.csv':'Top pages,Impressions\nhttps://westpiertech.com/8x8/,900\nhttps://westpiertech.com/,130\n','Countries.csv':'Country,Impressions\nUnited Kingdom,1000\n','Devices.csv':'Device,Impressions\nDesktop,700\n','Filters.csv':'Filter,Value\nSearch type,Generative AI\n'};
ok(aiGscDue(),'reminder is due before the first import');
unzipText(zip(files)).then(out=>{
  ok(Object.keys(out).length===5&&/Top pages/.test(out['Pages.csv']),'the zip unpacks in the browser');
  const r=aiGscParse(out,'export.zip');
  ok(r.total===1030&&r.days.length===3&&r.from==='2026-10-15'&&r.to==='2026-10-17','daily totals add up, thousands separators handled, days sorted');
  ok(r.pages[0].key==='https://westpiertech.com/8x8/'&&r.countries.length===1&&r.devices.length===1,'pages, countries and devices are read by their headings');
  aiGscSave(r);aiGscSave(Object.assign({},r,{total:5}));
  ok(aiGscHistory().length===1&&aiGscLatest().total===5,'importing the same week again replaces it');
  ok(!aiGscDue(),'reminder clears after an import');
  let threw=false;try{aiGscParse({'x.csv':'Query,Clicks\na,1\n'})}catch(e){threw=/Generative AI/.test(e.message)}
  ok(threw,'a file from the wrong report gives a plain message');
});
