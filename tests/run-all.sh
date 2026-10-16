#!/usr/bin/env bash
# Runs every hub and snippet test. Prints FAIL lines and exits non-zero if any fail.
cd "$(dirname "$0")/.." || exit 1
out=$( {
  node tests/push-undo.test.js assets/app.js
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
  node tests/mobile.test.js assets/app.js tests/fixtures/psi_fixture.json
  php tests/page-checker.test.php docs/wordpress-page-checker.php | grep -E "^(PASS|FAIL)"
  php tests/analytics.test.php docs/wordpress-page-checker.php /dev/null
  php tests/ga4.test.php docs/wordpress-ga4.php /dev/null
  php tests/elementor.test.php docs/wordpress-page-checker.php
  php tests/page-build.test.php docs/wordpress-page-checker.php
  php tests/image-style.test.php docs/wordpress-page-checker.php
} 2>&1 )
pass=$(echo "$out" | grep -c "^PASS"); fail=$(echo "$out" | grep -c -E "^FAIL|Error")
echo "$out" | grep -E "^FAIL|Error"
echo "Tests: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
