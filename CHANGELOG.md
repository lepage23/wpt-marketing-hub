# Changelog

Every version and every backup, newest first. Times are UK time.

To roll back to any point, open its branch on GitHub or run `git checkout <branch>`.
Backups are branches named `backup/v<version>-<date>-<time>`.
Finished versions are branches named `release/v<version>`.

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
