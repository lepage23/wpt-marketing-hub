#!/usr/bin/env bash
# Mark a finished version.
# Usage: scripts/release.sh 0.2.0 "Short summary of what changed"
#
# Updates VERSION and the version shown in the hub, commits, tags v<version>
# with the date and time, and pushes to GitHub if a remote is set.
# Add the CHANGELOG entry before running this.

set -euo pipefail
cd "$(dirname "$0")/.."

NEW="$1"; SUMMARY="${2:-Release}"
HUMAN="$(TZ=Europe/London date '+%Y-%m-%d %H:%M %Z')"

echo "$NEW" > VERSION
sed -i.bak -E "s/var VERSION = \"[^\"]+\";/var VERSION = \"${NEW}\";/; s/var BUILT = \"[^\"]+\";/var BUILT = \"${HUMAN}\";/" assets/app.js
rm -f assets/app.js.bak

git add -A
git commit -q -m "v${NEW}: ${SUMMARY}"
git tag -a "v${NEW}" -m "v${NEW} released ${HUMAN}. ${SUMMARY}"
echo "Tagged v${NEW} at ${HUMAN}"

if git remote get-url origin >/dev/null 2>&1; then
  git push -q origin HEAD && echo "Pushed main to GitHub"
  git push -q origin "v${NEW}^{commit}:refs/heads/release/v${NEW}" && echo "Pushed release branch release/v${NEW}"
  git push -q origin "v${NEW}" 2>/dev/null && echo "Pushed tag too" || true
fi
