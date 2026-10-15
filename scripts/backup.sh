#!/usr/bin/env bash
# Take a backup before any major change.
# Usage: scripts/backup.sh "what is about to change"
#
# It does three things:
#   1. Commits anything not yet saved, so nothing is lost.
#   2. Adds a git tag named backup/v<version>-<date>-<time>, pointing at that exact state.
#   3. Writes a zip of the hub into backups/ (kept on this machine, not pushed).
# A branch of the same name is pushed to GitHub, so every backup can be restored from there.

set -euo pipefail
cd "$(dirname "$0")/.."

NOTE="${1:-Backup before change}"
VERSION="$(cat VERSION)"
STAMP="$(TZ=Europe/London date +%Y-%m-%d-%H%M)"
HUMAN="$(TZ=Europe/London date '+%Y-%m-%d %H:%M %Z')"
TAG="backup/v${VERSION}-${STAMP}"

git add -A
if ! git diff --cached --quiet; then
  git commit -q -m "Backup before change: ${NOTE}"
fi

git tag -a "$TAG" -m "Backup of v${VERSION} taken ${HUMAN}. Before: ${NOTE}"

mkdir -p backups
git archive --format=zip -o "backups/${TAG#backup/}.zip" "$TAG"

echo "Backup tag: $TAG"
echo "Zip:        backups/${TAG#backup/}.zip"
# GitHub copy: a branch with the same name as the tag. Branches always push;
# tags are also tried, but some setups refuse them.
if git remote get-url origin >/dev/null 2>&1; then
  git push -q origin "${TAG}^{commit}:refs/heads/${TAG}" && echo "Pushed backup branch ${TAG} to GitHub"
  git push -q origin "$TAG" 2>/dev/null && echo "Pushed backup tag too" || true
fi
