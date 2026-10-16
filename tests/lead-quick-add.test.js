const fs=require('fs');
const src=fs.readFileSync(process.argv[2],'utf8');
function grab(name){const i=src.indexOf('function '+name+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
function grabVar(name){const i=src.indexOf('var '+name+' =');return src.slice(i,src.indexOf(';\n',i)+1);}
const today=()=>'2026-10-16';
eval(['FORM_LABELS','PRODUCTS','PLACES'].map(grabVar).join('\n')+['isoDate','addWorkDays','findProducts','parseLead','sameLead'].map(grab).join('\n'));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
const email=`Fw: Website lead: Avaya Partner - UK
Connor Le Page

Garry Bloomfield
Lead

Connor Le Page
West Pier Technologies
Phone: + 44 344 264 5522
Website: Westpiertele.com

From: West Pier Telecom <support@westpiertele.com>
Sent: Friday, October 16, 2026 9:32 AM
To: Enquiries <enquiries@westpiertele.com>
Subject: Website lead: Avaya Partner - UK

New website lead from the hero enquiry form

Name
Jonathan Hemstock
Email
jonathan.hemstock@tgat.org.uk
Phone
Company
The GORSE Academies Trust
Product/service
Avaya Partner
Location
UK
Source page
https://www.westpiertele.com/areas_avaya_partner_locator_uk/Avaya-Partner-UK/UK-Avaya-Partner-Phone-System/default.asp
Message
Good morning,
We recently had to quickly move our Avaya hosted virtual machine out of our current ISP.

To be open, I have to obtain 3 quotes for this due to our internal financial regulations which is why I am reaching out to you all.

Thanks in advance,
Jonathan Hemstock
Submitted: 16/10/2026 09:32:59
IP address: 136.228.233.76
User agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)`;
const a=parseLead(email,'2026-10-16');
console.log(JSON.stringify(a,null,1));
ok(a.contact==='Jonathan Hemstock'&&a.company==='The GORSE Academies Trust','form: name and company');
ok(a.reach==='jonathan.hemstock@tgat.org.uk','form: their email only, not WPT numbers or addresses');
ok(a.source==='Website form'&&a.date==='2026-10-16'&&a.interest==='Avaya Partner, UK','form: source, date, interest');
ok(/3 quotes/.test(a.next)&&/Avaya hosted/.test(a.notes)&&/Came in on/.test(a.notes)&&!/User agent|IP address|Submitted/.test(a.notes),'form: message kept, junk dropped, 3 quotes flagged');
ok(a.nextDate==='2026-10-19'&&a.owner==='Garry'&&a.status==='New','chase next working day (Monday), owner Garry');
const b=parseLead('Michael Smith - Guitartech shop - London - 07432345434 - Wants 3cx - 14 users -','2026-10-14');
console.log(JSON.stringify(b,null,1));
ok(b.contact==='Michael Smith'&&b.company==='Guitartech shop','note: name and company');
ok(b.reach==='07432345434'&&b.interest==='3cx, 14 users, London','note: phone, interest and place');
ok(b.nextDate==='2026-10-15','note: chase next working day');
ok(sameLead(a,{company:'the gorse academies trust'})&&!sameLead(a,b),'duplicates spotted by email or company');
