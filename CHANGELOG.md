# Changelog

Every version and every backup, newest first. Times are UK time.

To roll back to any point, open its branch on GitHub or run `git checkout <branch>`.
Backups are branches named `backup/v<version>-<date>-<time>`.
Finished versions are branches named `release/v<version>`.

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
