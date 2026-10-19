# Changelog

Every version and every backup, newest first. Times are UK time.

To roll back to any point, open its branch on GitHub or run `git checkout <branch>`.
Backups are branches named `backup/v<version>-<date>-<time>`.
Finished versions are branches named `release/v<version>`.

## v0.19.1 · 2026-10-19 15:33 BST

- **Your jobs:** new job to apply for free Google Business Profile API access, so reviews can come into the hub later.

## v0.19.0 · 2026-10-19 15:19 BST

New page: Progress & change log, under Fix queue.

- **Snapshots.** Every page audit saves that day's scores. The first becomes the baseline. An audit run before this version becomes the baseline the first time the page opens, dated the day it ran. **Save today's snapshot** saves again without a new audit.
- **Website health score**: the percentage of page checks the site passes, across 12 checks per page. Redirects aren't counted.
- **Compare any two dates.** Every measure shows both figures, the change and a percentage (for example 56% better). Green is better, red is worse.
- Scorecard also covers average mobile and desktop speed, keyword positions and AI answers naming WPT.
- Health score chart, pages that moved most, and how many website changes were pushed in the period.
- **Copy report for Garry**: plain-text summary for an email.
- **Copy history as CSV** and a Delete button for each snapshot.
- The **Change log** has moved here from the bottom of Website & SEO, and gains **Copy as CSV**. New entries now carry a date so they can be counted by period. Older entries still count.
- Website & SEO gains a **Progress report** button.
- User guide updated.
- 277 tests, all passing.

## v0.18.0 · 2026-10-19 14:30 BST

Speed check: desktop too, and everything Google flags goes to the Fix queue.

- **Desktop run** alongside mobile (tick or untick **Desktop too**). New Desktop column and average. About 40 minutes for every page with both.
- **One fix per problem**, affected pages listed inside it, mobile and desktop together. New fixes:
  - Main content slow to show (LCP over 2.5 s), caught even when the overall score looks fine. /charity/ was 13 s on mobile with a score of 61.
  - Files blocking the page from showing, naming the files most often to blame.
  - Unused CSS and JavaScript.
  - Short cache times.
  - Very large pages (over about 2.5 MB).
  - Images shown at too low a resolution.
  - Errors in the browser console, with the first error.
  - Headings out of order.
  - Missing security headers: one fix for the whole site, with the exact lines for Matt to add.
- The heavy images fix now includes images Google flags on desktop.
- Fix queue filter gains **Speed** and **Security**.
- **Rechecking failed pages** only redoes the side (phone or desktop) that failed.
- 258 tests, all passing. Tested against the /charity/ report from 19 October.

## v0.17.2 · 2026-10-19 14:10 BST

Progress bar on long checks.

- The page audit, mobile check and display check now show a **progress bar** with the **percentage**, **time left** (counting down every second) and roughly **when it'll be done**.
- Time left starts from a typical pace, then switches to the real pace once pages finish, so it gets more accurate as it goes.
- Still shows which page it's on.
- 245 tests, all passing.

## v0.17.1 · 2026-10-19 13:50 BST

Mobile check copes with dropped answers, and the results list folds up.

- **Tries again** when Google doesn't answer, is busy, or hits the per-minute limit: up to three goes per page, with a short wait between. Waits up to 2 minutes for slow pages.
- **Stops cleanly** if six pages in a row get no answer (usually the connection dropped or the laptop slept), instead of marking every remaining page as failed.
- **Check the ones that failed again** button. Rechecks only the missing pages and keeps the rest.
- Plainer messages: "No answer from Google" instead of "Failed to fetch", and clear wording if the API key is wrong.
- Results table shows the **10 slowest**, with **Show all** and **Show fewer**.
- User guide updated.
- 239 tests, all passing.

## v0.17.0 · 2026-10-16 16:30 BST

Display check works at every screen size, and catches words breaking.

- Each page now loads once and is checked at **ten screen widths** (1536, 1440, 1366, 1280, 1120, 1024, 900, 768, 600 and 400px) by resizing the preview, not reloading. Problems that only show at some sizes, like a heading word breaking, are caught.
- **Word broken in the middle** ("Communicati" / "ons"). Push-ready **Text size fix**: works out the largest size that fits at every width checked and sets it per screen type (desktop, tablet, phone). If the heading uses a global font, the font's settings are copied onto it first so only the size changes. Undo restores the global link.
- **Big gaps between heading lines** (line spacing over 1.42 times the text size). Push-ready: line spacing to 1.2.
- **Too much empty space in a coloured box** (over 110px desktop, 90px tablet, 64px phone at the top or bottom). Push-ready: brings it to 80, 60 and 40px.
- One fix per problem, listing the widths where it shows, not one per width.
- Page checker snippet is **version 10**. Copy it again.
- User guide updated.
- 231 tests, all passing. Tested end to end on a copy of the Gamma page hero: "Communications" breaking at 1280px and below found, with the fix, plus the line gaps and empty space.

## v0.16.0 · 2026-10-16 15:30 BST

Display check now finds text and layout slips too, and most become push-ready fixes.

- **Punctuation on its own line** (a lone "." or "?"). Push-ready **Punctuation fix**: removes the space or line break before it, words unchanged.
- **Same word twice in a short heading**. Push-ready once you've reworded it in the box (it won't push until the wording changes).
- **Image hanging out of its coloured box**. Push-ready **Layout fix**: caps it at its column width and removes a negative margin if that's the cause.
- **Button or text not lining up with the text above**. Push-ready when a left margin or padding is the cause: sets it to 0.
- **Box not centred**. Push-ready for containers (equal margins). Older-style sections are listed with steps, because Elementor doesn't let sections take side margins.
- **Much more space below the content than above**. Push-ready: matches bottom padding to top.
- A problem found only on phones changes the phone setting only.
- **b7-01**: the Unified Communications page's small heading "Unified Communications for Smarter Business Communication" becomes "Unified Communications for Smarter Business" (editable).
- Page checker snippet is **version 9** (adds the layout and punctuation fixes). Copy it again.
- User guide updated.
- 220 tests, all passing. Tested end to end on a copy of the Unified Communications hero: seven of the eight problems found. Not yet caught: one section not lining up with the section above it.

## v0.15.3 · 2026-10-16 14:25 BST

- Clearer message when a carousel image fix is pushed with an older copy of the page checker code: it says to copy the code again and check it says version 8.

## v0.15.2 · 2026-10-16 14:10 BST

- **User guide** is now a page in the hub's page list. It shows the guide inside the hub, with **Open in a new tab** if you want it side by side.

## v0.15.1 · 2026-10-16 14:00 BST

- **USER-GUIDE.html** in the main folder: how to use every page, which buttons change the website, saving versions in GitHub Desktop, updating the WordPress code, where data lives and what to do when something goes wrong. Linked as **User guide** at the bottom of the hub's left bar.
- The WordPress connection box now says when the page checker is older than version 8 (needed for the display check).

## v0.15.0 · 2026-10-16 13:30 BST

Display check: finds visual problems on every page, not just the ones you spot.

- New **Display check** panel on Website & SEO. **Check every page** loads each live page twice, at desktop width (1366px) and phone width (400px), in a small preview on the hub page. It measures what a visitor actually sees:
  - logos and badges cut off by their box or carousel tile
  - images squashed or stretched out of shape (anything over 5%)
  - broken images
  - button text wrapping onto two lines
  - text cut off by its box
  - anything sticking out past the screen edge on phones
  - images with no alt text
- Cut-off and squashed images in Elementor image widgets and media carousels become **push-ready fixes**, aimed at the exact element. Everything else is listed by page, with the nearest heading so you can find it, and says whether it's desktop, phones or both.
- Doesn't duplicate fixes Claude has already written (the engineer photo, the partner logos, the stars).
- Page checker snippet is version 8. It adds a read-only check script to a page only when the hub asks for it (?wpt_check=1). Visitors never get it, and that view isn't cached. Image fixes can now target an element by its Elementor id.
- 201 tests, all passing. Tested end to end on a sample page with a cut-off carousel logo, squashed stars, a broken image, a wrapped button and an over-wide box: all five found, on desktop and phone.

## v0.14.0 · 2026-10-16 12:40 BST

Two more home page image fixes, push-ready.

- **b6-03 (high):** partner logos in the carousel are cut off ("Microsoft Team", "Gammc"). The fix sets the carousel to fit each logo inside its tile instead of cropping it.
- **b6-04 (medium):** the gold review stars are slightly squashed. The fix shows every copy of the stars image at its true shape, all together.
- Image fixes can now target a carousel, and can fix every copy of a repeated image at once. If the widget turns out to be a different type than the fix expects, the hub says which one it found and changes nothing.
- Page checker snippet is still version 7, but its code changed. Copy it again if you pasted it before this update.
- 194 tests, all passing.

## v0.13.1 · 2026-10-16 12:15 BST

- Fixed: pushing an image fix with the old page checker snippet said "the text isn't on the page any more" and offered Mark as done. It now says the snippet needs updating to version 7, and doesn't offer Mark as done.

## v0.13.0 · 2026-10-16 12:05 BST

Image fixes push from the hub.

- New **Image fix** type. The hub changes how one image is displayed on an Elementor page (fit, cropping, height) without you opening Elementor. It keeps a full backup first, and Undo puts the page back exactly. It can only touch size and cropping settings, nothing else.
- The squashed engineer photo on the home page (b6-02) is now push-ready: **Approve and fix the image**. It fits the photo inside its box at its true shape, so nothing is cropped and the badges stay visible.
- The mobile check now turns every squashed or stretched image it finds into its own push-ready image fix, instead of a list of steps.
- Page checker snippet is version 7 (adds image fixes and page builds). Update it with Copy page checker code.
- 190 tests, all passing.

## v0.12.3 · 2026-10-16 11:35 BST

Claims check card pushes fixes.

- The "pages still make claims" card no longer has Mark as done. Each page gets its own row with the fix that clears it and a **Push the fix** button (click twice to confirm). Pages whose fix has already gone live say **Fix pushed** with the date.
- **Check the site again now** re-runs the claims check straight away. Clean pages drop off, and the card goes when none are left.
- The NHS BPF Unpublish fix is no longer on hold. It's critical, and the wording now says unpublish now, redirect to the new NHS page later.
- 185 tests, all passing.

## v0.12.2 · 2026-10-16 11:15 BST

Lead briefs.

- Every lead now has a **Lead brief**: the full story, kept in full. Press **Brief** at the start of a row to open it under the row, and **Hide** to close it. You can edit it or paste into it. The Brief button is highlighted when a lead has one.
- Quick add saves the whole paste as the brief, so the table stays short and nothing is lost. Website form leads keep just the form part, without the forwarding headers.
- Handles call briefs like "Callback for Garry: Yakub at Reliant" and "Call: Yakub, 07885 624052". First names on their own now count as the contact. "Company:" and "Why it's hot:" lines are picked up, and Interested in comes from the "What they want" list.
- Citation links from ChatGPT ([reliant](https://...)) are stripped. Email links become plain addresses.
- Copy as CSV and Download CSV include the brief, so Garry gets the full story.
- Fixed: an IP address followed by "User agent" was read as a user count.
- 185 tests, all passing.

## v0.12.1 · 2026-10-16 10:55 BST

Leads tidy-up.

- **Remove** button at the start of every lead row (click twice to confirm). For leads that turn out to be existing customers or junk.
- Long cells now show two lines only. Click into a cell, or press **More** on the row, to see all of it. Fixes rows that had gone massive.
- Quick add now handles ordinary emails, not just website form ones. It takes the name from the From line or the signature, the company from the signature or their email address, and falls back to first.last@ addresses for the name.
- Email threads: only the newest message decides who the lead is and what Notes says. Older quoted messages only feed the products list. WPT people (Connor, Garry, Mark James) and WPT signatures are skipped, so a thread Garry replied to no longer comes in as "Garry Bloomfield". Handles signatures like "Tom Snell / Standard8".
- Interested in is capped to a short line. Notes is a quick breakdown (about two sentences) with greetings and sign-offs stripped.
- 181 tests, all passing.

## v0.12.0 · 2026-10-16 10:20 BST

Quick add on the Leads page.

- **Quick add** box above the tracker. Paste a forwarded website lead email, or type a rough note like "Michael Smith - Guitartech shop - London - 07432345434 - wants 3CX - 14 users", then click **Add lead**. It goes in as a new row: date, company, contact, phone or email, source, what they want, owner Garry, status New, and a chase date of the next working day.
- Website form emails: picks out name, email, phone, company, product, location and the page they came from. Keeps the message in Notes and drops the forwarding headers, your signature, WPT's own numbers, IP address and browser details. Flags it when they say they're getting 3 quotes.
- Warns if the lead is already in (same email or company), with **Add anyway**.
- New **Phone / email** column. The table's own button is now **Add blank row**.
- Ctrl+Enter in the box adds the lead too.
- 167 tests, all passing.

## v0.11.0 · 2026-10-16 10:05 BST

New pages built in the site's own design.

- **New page build** fix type. Claude writes the page, then **Push new page build for review** copies an existing page's design (sections, fonts, text sizes, colours, spacing, page template) into a NEW draft, swaps in the new text and removes blocks that aren't needed. It never publishes and never touches the page it copies from. You get **Preview the draft** and **Edit in Elementor** links, and **Bin this draft** if you don't want it.
- **Check the look** on a build card reads the design it will copy from WordPress: the site's global fonts and colours, then every block on the page in order with its font, size, weight, colour and current text. Read-only.
- The NHS page fix (b5-01) is now a page build that copies the Healthcare page. The button is greyed out until the Mitel meeting facts are in and Claude has written the page.
- Page checker snippet is version 6 (adds page-style and page-build). Update it with Copy page checker code. Everything else still works on version 5.
- 158 tests, all passing.

Backups taken:

- None from this session (it couldn't run git on your laptop). Your last backup is `backup/v0.9.1-2026-10-15-1718`.

## v0.10.0 · 2026-10-15 17:23 BST

Mobile check across every page.

- **Mobile and speed** panel on Website & SEO runs Google's own mobile test (PageSpeed Insights API v5, mobile) on every live page from the last audit, two at a time, with a progress count and a Stop button. Shows speed, accessibility and SEO scores, how fast the main content appears, how much the page jumps, real-visitor results where Google has them, and a link to Google's full report for each page.
- Built against Google's current docs: Lighthouse 13 replaced many older checks with "insight" checks, so the hub reads whatever checks Google returns rather than a fixed old list. Real-visitor data is flagged for retirement from this API, so it's optional and nothing breaks when it goes.
- **Found by mobile check** fixes in a new **Mobile** area of the Fix queue: squashed or stretched images (named, with their shape), pages not set up for phones, real visitors failing Core Web Vitals, pages scoring under 50, pages that jump about while loading, oversized images (with the saving each), buttons too small to tap, hard-to-read text and low accessibility scores.
- Optional free PageSpeed API key, with setup steps. Stays in your browser.
- Today page shows the average mobile speed score.
- **Batch 6:** confirm the certification badges in the home page photo are WPT's own and current (critical), and fix the squashed engineer photo (high).
- 138 tests, all passing.

Backups taken:

- `backup/v0.9.1-2026-10-15-1718` (v0.9.1 as it was, before this change)

## v0.9.1 · 2026-10-15 17:11 BST

- New Fix queue item (high): build an honest NHS page to replace the BPF one, with the questions to ask at the Mitel meeting.
- The NHS BPF page Unpublish fix is on hold (medium) until the new NHS page is live, when it becomes a redirect.

Backups taken:

- `backup/v0.9.0-2026-10-15-1711` (v0.9.0 as it was, before this change)

## v0.9.0 · 2026-10-15 17:07 BST

Claims get fixed, not just found.

- **Phrase change** fix type: swaps one phrase inside a paragraph and leaves the rest, including links and formatting, untouched. Undo restores the paragraph exactly. Refuses cleanly if a link or bold text splits the phrase.
- **Batch 4 (critical):** Home page "an assured BPF supplier to the NHS" becomes "a long-standing supplier to the NHS". Business Services "an assured BPF supplier to leading UK businesses" becomes "a trusted communications provider to leading UK businesses".
- Unpublishing the NHS BPF page is now critical.
- **Automatic replacements** on the Website & SEO page: write "wrong phrase => right phrase" once, and every audit turns each page using the wrong phrase into a push-ready fix, without waiting for Claude. Skips anything Claude has already written a fix for.
- Page checker snippet is version 5 (adds phrase change). Update it with Copy page checker code.
- 128 tests, all passing.

Backups taken:

- `backup/v0.8.5-2026-10-15-1705` (v0.8.5 as it was, before this change)

## v0.8.5 · 2026-10-15 17:00 BST

- New job: ask Matt which website forms send the submit_lead_form event (GA4 saw 6 form submissions but only 2 lead form events).

Backups taken:

- `backup/v0.8.4-2026-10-15-1700` (v0.8.4 as it was, before this change)

## v0.8.4 · 2026-10-15 16:58 BST

- Removed fix b3-03 ("Remove just the BPF block"). The BPF section was already removed by b3-01.
- When a fix's text is no longer on the page (because it's already been sorted), the card now offers **Mark as done** instead of leaving you stuck.

Backups taken:

- `backup/v0.8.3-2026-10-15-1658` (v0.8.3 as it was, before this change)

## v0.8.3 · 2026-10-15 16:47 BST

- New job: check the Healthcare page after the BPF section was removed (Cyber Security and Case Studies went with it).

Backups taken:

- `backup/v0.8.2-2026-10-15-1647` (v0.8.2 as it was, before this change)

## v0.8.2 · 2026-10-15 16:45 BST

- **Removals now show you exactly what will go before anything changes.** The hub asks WordPress for a dry run and lists every option, from the single widget up to the whole outer section, with the text and number of images each would remove. You pick one. Nothing is removed until you've chosen.
- Why: the first BPF removal took the whole outer Elementor container, which also held other content (Cyber Security and Case Studies).
- **New fix b3-03** replaces it: remove just the BPF block, with the picker. Undo b3-01 first.
- Page checker snippet updated (removal levels and dry run). Update it with Copy page checker code.
- 119 tests, all passing.

Backups taken:

- `backup/v0.8.1-2026-10-15-1643` (v0.8.1 as it was, before this change)

## v0.8.1 · 2026-10-15 16:32 BST

- **Fixed: "Couldn't reach the site" on every push.** v0.7.2 added a cache header to every request, and WordPress doesn't allow that header from other pages, so the browser blocked the requests. Removed it. The unique address on each read still stops caches serving old answers.
- The approve button keeps its proper label (for example "Approve and remove from page") after a failed attempt.
- **Tests now live in the repo** (`tests/`, 113 checks across the hub and the WordPress snippets) and every release runs them first. A release stops if any fail. A new test checks only WordPress-allowed headers are sent.

Backups taken:

- `backup/v0.8.0-2026-10-15-1631` (v0.8.0 as it was, before this change)

## v0.8.0 · 2026-10-15 16:13 BST

The hub can now edit the pages themselves, not just their Google titles and descriptions.

- **Page checker version 4** adds page editing for Elementor pages: change the text of one widget, remove a widget or a whole section. Before every edit it saves a full copy of the page, Elementor keeps its own revision too, and the SiteGround cache is cleared for that page. It refuses to act if the text it's looking for has gone or appears in more than one place.
- **New fix types:** Page text change, Remove from page and Unpublish page. All pushable from the Fix queue with Undo. Undo puts the page back exactly, and warns rather than overwriting if someone has edited the page since (with an option to undo anyway).
- **Find text on the site:** searches every published page and post, Elementor included, on the Website & SEO page.
- **Claims check:** a list of claims you've said aren't true (starting with Better Purchasing and BPF). Every audit searches the whole site for them and puts any page still saying them in the Fix queue as critical.
- **Batch 3:** remove the NHS BPF section from the Healthcare page (critical), and unpublish the NHS BPF page (high).
- Snippet version check now needs version 4.

Backups taken:

- `backup/v0.7.2-2026-10-15-1606` (v0.7.2 as it was, before this change)

## v0.7.2 · 2026-10-15 15:52 BST

- Every read from WordPress now asks for a fresh answer, so SiteGround's cache (or any other) can't serve an old one. Stops an updated snippet looking out of date.

Backups taken:

- `backup/v0.7.1-2026-10-15-1551` (v0.7.1 as it was, before this change)

## v0.7.1 · 2026-10-15 15:36 BST

- **Fixed: "No H1" flagged on pages that have one.** The first version of the page checker snippet reports H1s as a count, and the audit read that the wrong way round. The audit now only judges H1s from the current snippet.
- **Snippet version check.** Save and test now reports which page checker version is installed and says plainly when it's out of date (site checks and Search Console need version 3).
- **Copy code buttons** for each WordPress snippet (SEO fields, page checker, GA4) in the Connect WordPress box, so there's no copying out of files. Generated from docs/*.php on every release.

Backups taken:

- `backup/v0.7.0-2026-10-15-1535` (v0.7.0 as it was, before this change)

## v0.7.0 · 2026-10-15 15:25 BST

Google Analytics 4, connected directly.

- **New snippet `docs/wordpress-ga4.php`.** Reads GA4 through the Google Analytics Data API with a read-only service account. The key is uploaded once from the hub, stored in WordPress for admins only, and never sent back out. Reports are cached for an hour.
- **Website traffic and leads panel** on Website & SEO: leads (key events), visits, people, engagement and visits from AI tools, with change against the previous period. Daily charts for visits and leads. Tables for channels with lead rate, landing pages, AI tool referrals (ChatGPT, Perplexity, Copilot, Gemini, Claude and others) and which events count as leads. Step-by-step setup built in.
- **Found in Google Analytics** fixes in a new **Leads** area of the Fix queue: GA4 not counting any leads (critical, names the form event to switch on if there is one), pages bringing Google visitors but no enquiries, and pages where most visits don't engage.
- Today page shows website leads and visits.
- GA4 refreshes after each audit, alongside Search Console.

Backups taken:

- `backup/v0.6.0-2026-10-15-1522` (v0.6.0 as it was, before this change)

## v0.6.0 · 2026-10-15 15:18 BST

Google Search Console (and Analytics where available) in the hub.

- **Page checker version 3** adds a read-only search performance feed from Rank Math Analytics: clicks, impressions, position per page and per search, the previous period for comparison, daily totals, and Google Analytics page views and index status if Rank Math holds them.
- **Search performance panel** on the Website & SEO page: clicks, impressions, click rate and average position with change against the previous period, daily trend charts with hover readouts, top pages and top searches, a 7 / 28 / 90 day switch, and Copy search data as CSV.
- **Found in Search Console** fixes in the Fix queue: pages close to page one (positions 4 to 20) with the searches listed, pages seen on page one that hardly get clicked, pages whose clicks have dropped sharply, and searches where two of your pages compete.
- Every fix card shows that page's Google clicks, impressions and position, so you can see what's worth doing first.
- Today page shows clicks from Google. Audit CSV adds Google clicks, impressions and position. Search data refreshes after each audit.
- **Readability:** text in every table now wraps and the cell grows to fit, instead of being cut off. Columns tightened so Status and Delete stay in view.
- Setup guide step 6: connecting Rank Math to Google.

Backups taken:

- `backup/v0.5.0-2026-10-15-1513` (v0.5.0 as it was, before this change)

## v0.5.0 · 2026-10-15 15:10 BST

The Fix queue is now the single list of everything the website needs for Google and AI search.

- **Page checker version 2.** Reads each page the way a search engine does: H1s, canonical, noindex, schema types, social image, links in the content and in the menus, images missing alt text, and server response time. Adds a site-wide check: robots.txt, sitemaps, llms.txt, http and www redirects, the "discourage search engines" setting and Rank Math's redirect rules.
- **Found by audit:** every run turns its findings into Fix queue items with priority, area, the pages affected and step-by-step instructions. Covers indexing, robots.txt and AI crawler access, sitemap problems, http/www redirects, Search Console and Bing verification, Organisation schema, llms.txt, dead and chained redirects, temporary redirects, broken links, links to redirected addresses, orphan pages, posts with few internal links, missing or multiple H1s, canonicals pointing elsewhere, noindex pages, duplicate titles and descriptions, pages competing for the same search, thin pages, missing schema and article markup, missing social images, images without alt text, slow pages, and titles or descriptions not yet in a Claude batch.
- Fixes marked done that the next audit still finds are reopened and labelled.
- **Fix queue:** priority labels (Critical, High, Medium, Low) and sorting, a filter by area (Content, Structure, Indexing, AI search), step-by-step fixes with Mark as done and Not doing this, and tabs renamed Waiting / Done / Not doing.
- **Site checks** summary on the Website & SEO page.
- **8 new fixes from Claude** for off-site and AI search: Google Business Profile, reviews, partner directories, Bing Places and Apple Business Connect, consistent business details, FAQ sections, author bios and case studies.
- Batch 1 and 2 fixes now carry priorities: Healthcare critical, very short descriptions high, long titles medium, the rest low.
- Audit CSV adds H1, schema, canonical, noindex, content links, images missing alt and server time.

Backups taken:

- `backup/v0.4.1-2026-10-15-1503` (v0.4.1 as it was, before this change)

## v0.4.1 · 2026-10-15 14:55 BST

- **Batch 2 in the Fix queue:** 22 shorter SEO titles for pages and posts Google is cutting off, plus a fix for the Healthcare description, which wrongly claims NHS BPF approved supplier status.
- Removed the NHS BPF page description from batch 1 (WPT isn't on the framework, so the page stays noindexed).
- Batch 1 descriptions now show what's really on the live page (Rank Math's auto-generated text and its length) instead of "(empty)". The queue is ordered by priority: Healthcare first, then the very short auto descriptions, then titles, then the rest.
- New jobs: check for other NHS BPF claims, send Matt ready-written titles and descriptions for his three pages, and find out how the Feature Comparison table is built.

Backups taken:

- `backup/v0.4.0-2026-10-15-1454` (v0.4.0 as it was, before this change)

## v0.4.0 · 2026-10-15 14:42 BST

The audit now checks the live site, not just WordPress's page list.

- New **page checker** snippet (`docs/wordpress-page-checker.php`). With it added, the audit asks the site what a visitor actually gets at each address.
- Pages that **redirect** are greyed out, labelled with where they go, and left out of the counts and fixes.
- The pages they redirect to (like Matt's `/business-phone-systems/.../brighton/` pages) are added to the audit as **Live page** rows and checked properly.
- Word count, title, description and subheadings now come from the **live page**, so Elementor pages are measured correctly.
- The hub **won't push** a fix to an address that redirects. It stops and says so.
- Connection test shows whether the page checker is in.
- Audit CSV gains: custom description set, redirects to, checked live.
- Removed the three Brighton fixes from batch 1. They pointed at old pages Matt has redirected.

Backups taken:

- `backup/v0.3.0-2026-10-15-1440` (v0.3.0 as it was, before this change)

## v0.3.0 · 2026-10-15 14:30 BST

First real batch of website fixes.

- **Batch 1 in the Fix queue:** 45 fixes. 41 new meta descriptions for pages and posts that had none, 3 shortened descriptions that Google was cutting off, and 1 shortened title.
- **4 new jobs** in Your jobs: the near-empty 8x8 Feature Matrix page, two UCaaS 2026 pages competing for the same search, checking the sector pages on the live site, and the 99 WordPress updates.
- The hub now finds each page from its web address when you push, so fixes don't need page IDs.
- The audit decodes `&amp;` and similar, so title and description lengths are counted correctly.

Backups taken:

- `backup/v0.2.1-2026-10-15-1428` (v0.2.1 as it was, before this change)

## v0.2.1 · 2026-10-15 14:10 BST

- The page audit now reads Rank Math (and SEOPress) titles and meta descriptions when WordPress is connected and the snippet is in. Before, it only understood Yoast, so "Missing meta descriptions" showed 0 on a Rank Math site.
- Pages with no custom description in Rank Math are flagged "No custom meta description".
- Clearer notice when SEO fields can't be read yet.

Backups taken:

- `backup/v0.2.0-2026-10-15-1409` (v0.2.0 as it was, before this change)

## v0.2.0 · 2026-10-15 12:48 BST

The hub can now push website fixes, but only ones you approve.

- **Connect WordPress** box on the Website & SEO page. Takes a username and application password, saved in this browser only. Save and test shows who you're signed in as, the account role and which SEO plugin the site uses. Warns if the account is an administrator.
- **Fix queue** page. Claude writes fixes into `data/proposals.js` and pushes them. Each fix shows what's on the site now, the proposed change (editable) and why. Approve and push, or reject.
- Safety checks before every push. Content changes only go through if the exact old text is still on the page once. Big changes need a second tick. New pages are only ever saved as drafts.
- **Undo** on every pushed title, description and content change. Undo keeps any other edits made to the page since.
- **Change log** on the Website & SEO page listing every change the hub has made.
- **Your jobs** page for images and anything else only you can do. Claude adds jobs with each batch.
- Today page shows fixes waiting and jobs to do.
- `docs/SETUP-WORDPRESS.md` setup guide and `docs/wordpress-snippet.php` so SEO titles and descriptions can be updated.

Backups taken:

- `backup/v0.1.1-2026-10-15-1244` (v0.1.1 as it was, before this change)

## v0.1.1 · 2026-10-15 11:07 BST

- Backups and releases now go to GitHub as dated branches. GitHub refused tags from this setup, so branches do the same job.

Backups taken:

- `backup/v0.1.0-2026-10-15-1106` (v0.1.0 as it was, before this change)

## v0.1.0 · 2026-10-15 11:05 BST

First build of the hub.

- Hub shell with a page rail, version stamp and light/dark switch.
- **Today**: open leads, lead actions due, SEO issues, flagged emails and content in progress, all pulled from the other pages.
- **Website & SEO**: live page audit of westpiertech.com through the WordPress API (read-only). Checks word count, title and meta description length (Yoast), H2s, image alt text, internal links and last update. Paste-in fallback if the API is blocked. Keyword ranking tracker, AI search visibility tracker and content plan.
- **Leads**: tracker with status, owner, next step, due date and notes. Counts by status.
- **Email campaigns**: send log with automatic open, click, bounce and unsubscribe rates. iContact CSV import. Quistor to iContact steps.
- **Live chat**: manual chat log until 8x8 is connected. One click sends a chat to Leads.
- **Weekly brief**: brief prompt with copy button, saved briefs by week, blog ideas that move to the content plan when approved.
- **Inbox triage**: read-only rules, priority order and a flagged email log until Outlook is connected.

Known limits:

- Data is saved in the browser it's entered in. Garry can't see leads yet.
- Nothing is written back to WordPress yet.
- 8x8 and Outlook are not connected yet.

Backups taken:

- `backup/v0.0.0-2026-10-15-1105` (empty starting point, before the first build)
