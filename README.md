# WPT Marketing Hub

Connor's daily home page for West Pier Technologies marketing. Website and SEO audits, email campaign stats, live chat, lead tracking for Garry, the weekly telecoms brief and read-only inbox triage.

## Opening it

Open `index.html` in a browser. No install, no build step.

New to the hub? Read `USER-GUIDE.html` (also the User guide page in the hub).

## Pages

| Page | What it does |
| --- | --- |
| Today | What needs you now, pulled from every other page |
| Website & SEO | Page audit through the WordPress API, WordPress connection, rankings, AI search visibility, content plan, change log |
| Fix queue | Website fixes written by Claude. Nothing goes live until you approve it. Undo on every change |
| Your jobs | Images and other tasks only you can do |
| Leads | Every lead with status, owner, next step and notes |
| Email campaigns | Sends with open, click, bounce and unsubscribe rates. iContact CSV import |
| Live chat | Chat log, chat to lead rate, send a chat to Leads |
| Weekly brief | Brief prompt, saved briefs, blog ideas |
| Inbox triage | Flagged emails in priority order. Read-only, never sends or moves anything |

## Versions and backups

- The current version is in `VERSION` and shows at the bottom of the page rail.
- `CHANGELOG.md` lists every version and backup with date and time.
- Before any major change: `scripts/backup.sh "what is about to change"`. This saves the current state as a dated `backup/...` branch on GitHub and a zip in `backups/`.
- After the change: add a CHANGELOG entry, then `scripts/release.sh 0.2.0 "summary"`.
- Each finished version also gets a `release/v...` branch on GitHub.
- To go back to an earlier state, open that branch on GitHub or run `git checkout <branch name>`.

## Connecting WordPress

See `docs/SETUP-WORDPRESS.md`. About 10 minutes, once.

## Where data lives

For now everything you enter, including the WordPress application password, is saved in your browser on this machine. It is never written to this repo. Use Copy as CSV on any table to share or keep a copy.
