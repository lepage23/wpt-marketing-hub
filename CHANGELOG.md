# Changelog

Every version and every backup, newest first. Times are UK time.

To roll back to any point, open its branch on GitHub or run `git checkout <branch>`.
Backups are branches named `backup/v<version>-<date>-<time>`.
Finished versions are branches named `release/v<version>`.

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
