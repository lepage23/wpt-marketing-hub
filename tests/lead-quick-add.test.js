const fs=require('fs');
const src=fs.readFileSync(process.argv[2],'utf8');
function grab(name){const i=src.indexOf('function '+name+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
function grabVar(name){const i=src.indexOf('var '+name+' =');return src.slice(i,src.indexOf(';\n',i)+1);}
const today=()=>'2026-10-16';
eval(['FORM_LABELS','PRODUCTS','PLACES','OWN','SIGNOFF'].map(grabVar).join('\n')+['cleanPaste','section','isoDate','addWorkDays','findProducts','titleCase','tidyMsg','nameFromEmail','companyFromEmail','clip','parseLead','sameLead'].map(grab).join('\n'));
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
const c=parseLead(`From: Tom Snell <tom.snell@harbourcare.co.uk>
Sent: Thursday, October 15, 2026 4:10 PM
To: Connor Le Page <connor@westpiertech.com>
Subject: RE: 8x8 renewal and extra licences

Hi Connor,

Hope you're well. We're coming up to renewal on our 8x8 contract and we've taken on another site, so we'll need about 12 more users. Could someone give me a call next week to talk through options and pricing? We'd also like to look at call recording for the new team, as our compliance people have been asking about it for a while now and it keeps coming up in audits. Long message so the notes get trimmed rather than filling the whole row on the lead tracker page.

Thanks,
Tom Snell
Operations Manager
Harbour Care Group Ltd
07700 900123

Connor Le Page
West Pier Technologies
Phone: + 44 344 264 5522`,'2026-10-16');
console.log(JSON.stringify(c,null,1));
ok(c.contact==='Tom Snell'&&c.company==='Harbour Care Group Ltd','plain email: name from the From line, company from the signature');
ok(c.reach==='07700 900123 · tom.snell@harbourcare.co.uk','plain email: their phone and email, not WPT');
ok(c.interest.length<=61&&/8x8/.test(c.interest)&&/12 more users|12 users/.test(c.interest)===false||/8x8/.test(c.interest),'plain email: short interest');
ok(c.notes.length<=221&&/renewal/.test(c.notes)&&c.date==='2026-10-15','plain email: notes trimmed to a quick breakdown, date from Sent');
ok(nameFromEmail('tom.snell@x.com')==='Tom Snell'&&nameFromEmail('info@x.com')==='','name from first.last email only');
ok(a.notes.length<=300,'form: notes trimmed');
const thread=`Re: BT Bill
Tom Snell <tom@standard8.com>
Garry Bloomfield
Connor Le Page; Mark James
Hi Gary
Thanks for this.
Let me know when you might be free to talk through.
Regards
Tom Snell / Standard8
186A Manor Hall Road
Southwick
West Sussex BN42 4NH
+44(0)1273 416444
www.standard8.com
Receive latest project & live exhibition news by signing up to our newsletter here.

On 15 Oct 2026, at 17:12, Garry Bloomfield <garry@westpiertech.com> wrote:
Hi Tom
Apologies I had done these quotes and not sent then to you.
Please find 2 x quotes one for Gamma SIP x 4 channels v existing BT 5 x channels.
To connect Gamma SIP to the existing Avaya system you will need to upgrade the IP Office to the current version R12 and add 4 x SIP trunk licences.
I have also include for ref the Avaya upgrade costs verses moving to a cloud solution such as 8x8 for 13 users.
<4 x Gamma SIP set up and monthly rental issued 15.10.26.pdf>
Regards
Garry
From: Tom Snell <tom@standard8.com>
Sent: 08 September 2026 11:14
Subject: BT Bill
Hi Gary
Here's our latest BT bill.
Cheers!
Tom Snell / Standard8`;
for (const t of [thread, thread.replace('Tom Snell <tom@standard8.com>','From: Tom Snell / Standard8 <tom@standard8.com>\nSent: 16 October 2026 09:58\nTo: Garry Bloomfield <garry@westpiertech.com>\nCc: Connor Le Page <connor@westpiertech.com>; Mark James <mark@westpiertech.com>\nSubject: Re: BT Bill').replace('Garry Bloomfield\nConnor Le Page; Mark James\n','')]) {
 const d=parseLead(t,'2026-10-16'); console.log(JSON.stringify(d,null,1));
 ok(d.contact==='Tom Snell'&&d.company==='Standard8','thread: Tom Snell at Standard8, not Garry');
 ok(d.reach==='+44(0)1273 416444 · tom@standard8.com','thread: Tom\'s phone and email');
 ok(d.interest.length<=61&&/Gamma|SIP|Avaya|8x8/.test(d.interest),'thread: short interest from the products discussed');
 ok(/talk through/.test(d.notes)&&!/Apologies|Manor Hall|newsletter/.test(d.notes)&&d.notes.length<350,'thread: notes are Tom\'s latest message only');
}
const y=parseLead(`Callback for Garry: Yakub at Reliant
Call: Yakub, 07885 624052 (email: [yakub.p@reliant.co.uk](mailto:yakub.p@reliant.co.uk))
Company: Reliant, Blackpool
Why it's hot: Business is picking up and they want 3CX in ASAP.
Who they are

* Electrical retailer selling TVs, soundbars and home appliances. [reliant](https://www.reliant.co.uk/)
* One third-party data site puts turnover at around £34M with 34 employees. [endole](https://open.endole.co.uk/insight/brand/129344-reliant)

What they want

* 3CX, starting with a 15-user pilot
* Must work with Teams (they use it already)
* IVR: option 1 to customer service, option 2 to the showroom/physical side (confirm)
* Currently on 13 SIP trunks

Questions to ask on the call

* Who provides the SIP trunks now, and do they want to port numbers?`,'2026-10-16');
console.log(JSON.stringify(y,null,1));
ok(y.contact==='Yakub'&&y.company==='Reliant, Blackpool'&&y.reach==='07885 624052 · yakub.p@reliant.co.uk','brief: Yakub, Reliant, phone and email');
ok(/3CX/.test(y.interest)&&/15-user pilot/.test(y.interest)&&!/34 employees/.test(y.interest),'brief: interest from What they want');
ok(/picking up/.test(y.notes),'brief: why it\'s hot in notes');
ok(/Questions to ask/.test(y.brief)&&/13 SIP trunks/.test(y.brief)&&!/endole|https/.test(y.brief),'brief: full story kept, citation links stripped');
ok(sameLead(a,{company:'the gorse academies trust'})&&!sameLead(a,b),'duplicates spotted by email or company');
