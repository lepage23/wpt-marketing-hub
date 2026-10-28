#!/usr/bin/env bash
# Runs every hub and snippet test. Prints FAIL lines and exits non-zero if any fail.
cd "$(dirname "$0")/.." || exit 1
out=$( {
  node tests/push-undo.test.js assets/app.js
  node tests/ai-gsc.test.js assets/app.js
  node tests/weekly-tasks.test.js assets/app.js
  node tests/full-audit.test.js assets/app.js
  node tests/done-order.test.js assets/app.js
  node tests/checker-update.test.js assets/app.js ./data/snippets.js
  node tests/content-append.test.js assets/app.js ./data/proposals.js
  php tests/undo-slashes.test.php docs/wordpress-page-checker.php
  php tests/h1-look.test.php docs/wordpress-page-checker.php
  node tests/page-lookup.test.js assets/app.js
  node tests/redirects.test.js assets/app.js
  node tests/technical-checks.test.js assets/app.js tests/fixtures/fixture.json
  node tests/search-console.test.js assets/app.js tests/fixtures/an_fixture.json
  node tests/ga4-fixes.test.js assets/app.js tests/fixtures/ga4_fixture.json
  node tests/page-editing.test.js assets/app.js data/proposals.js
  node tests/headers.test.js assets/app.js
  node tests/claim-rules.test.js assets/app.js
  node tests/page-build.test.js assets/app.js
  node tests/lead-quick-add.test.js assets/app.js
  node tests/display-check.test.js assets/app.js tests/fixtures/display-report.json
  node tests/display-fixes.test.js assets/app.js tests/fixtures/display-report-2.json
  node tests/display-widths.test.js assets/app.js tests/fixtures/display-run-3.json
  node tests/display-cramped.test.js assets/app.js
  php tests/arrange.test.php docs/wordpress-page-checker.php
  node tests/mobile.test.js assets/app.js tests/fixtures/psi_fixture.json
  node tests/mobile-retry.test.js assets/app.js tests/fixtures/psi_fixture.json
  node tests/progress.test.js assets/app.js
  node tests/progress-report.test.js assets/app.js
  node tests/job-updates.test.js assets/app.js
  node tests/in-progress.test.js assets/app.js
  node tests/fix-log.test.js assets/app.js
  node tests/faq.test.js assets/app.js
  node tests/audit-push.test.js assets/app.js
  node tests/ai-prompts.test.js assets/app.js data/proposals.js
  node tests/ai-score.test.js assets/app.js
  node tests/orphans.test.js assets/app.js
  node tests/auto-links.test.js assets/app.js
  node tests/automation.test.js assets/app.js
  node tests/google-updates.test.js assets/app.js
  node tests/speed-fixes.test.js assets/app.js tests/fixtures/psi_charity.json
  php tests/page-checker.test.php docs/wordpress-page-checker.php | grep -E "^(PASS|FAIL)"
  php tests/analytics.test.php docs/wordpress-page-checker.php /dev/null
  php tests/ga4.test.php docs/wordpress-ga4.php /dev/null
  php tests/elementor.test.php docs/wordpress-page-checker.php
  php tests/page-build.test.php docs/wordpress-page-checker.php
  php tests/image-style.test.php docs/wordpress-page-checker.php
  php tests/layout-fix.test.php docs/wordpress-page-checker.php
  php tests/text-size.test.php docs/wordpress-page-checker.php
  php tests/faq.test.php docs/wordpress-page-checker.php
  php tests/contact-fixes.test.php docs/wordpress-page-checker.php
  php tests/site-edit.test.php docs/wordpress-page-checker.php
  php tests/revisions.test.php docs/wordpress-page-checker.php
  php tests/content-restore.test.php docs/wordpress-page-checker.php
} 2>&1 )
pass=$(echo "$out" | grep -c "^PASS"); fail=$(echo "$out" | grep -c -E "^FAIL|Error")
echo "$out" | grep -E "^FAIL|Error"
echo "Tests: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
