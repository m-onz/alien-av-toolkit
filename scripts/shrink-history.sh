#!/usr/bin/env bash
#
# shrink-history.sh — rewrite git history to drop large blobs, reclaiming clone size.
#
# THIS REWRITES EVERY COMMIT HASH AND FORCE-PUSHES. Read scripts/README.md, take a
# backup, and make sure any collaborators know they must re-clone afterwards.
#
# Requires: git-filter-repo  (pip install git-filter-repo)
#
# Strategy: work in a FRESH clone (git-filter-repo insists on this), remove the known
# dead-weight paths AND strip any blob bigger than the size threshold. Run
# shrink-samples.sh + commit FIRST so the current samples are under the threshold and
# survive; only their oversized historical versions get stripped.

set -euo pipefail

THRESHOLD="${THRESHOLD:-5M}"     # strip blobs larger than this from ALL history
REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"

if ! command -v git-filter-repo >/dev/null 2>&1; then
  echo "error: git-filter-repo not found. pip install git-filter-repo" >&2
  exit 1
fi

ORIGIN_URL="$(git -C "$(dirname "$0")/.." remote get-url "$REMOTE")"
WORK="/tmp/alien-av-toolkit-filter"

echo "This will:"
echo "  1. fresh-clone $ORIGIN_URL into $WORK"
echo "  2. remove paths: videos/  monzwozere.wav  skepta139.wav"
echo "  3. strip every remaining blob > $THRESHOLD from all history"
echo "  4. show you the before/after size — then STOP."
echo "  Pushing is a SEPARATE, manual final step you run yourself (see end)."
echo
read -r -p "Type YES to proceed with the local rewrite: " ok
[ "$ok" = "YES" ] || { echo "aborted"; exit 1; }

rm -rf "$WORK"
git clone "$ORIGIN_URL" "$WORK"
cd "$WORK"

echo "before: $(du -sh .git | cut -f1)"

# Remove specific dead paths (safe even if absent in some commits).
git filter-repo --force \
  --path videos/ \
  --path monzwozere.wav \
  --path skepta139.wav \
  --invert-paths

# Strip anything still oversized (old 24-bit sample versions, etc.).
git filter-repo --force --strip-blobs-bigger-than "$THRESHOLD"

git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo "after:  $(du -sh .git | cut -f1)"
echo
echo "Inspect $WORK, open a few patches, confirm the working tree is intact."
echo "filter-repo removes the 'origin' remote as a safety measure. To publish:"
echo
echo "    cd $WORK"
echo "    git remote add origin $ORIGIN_URL"
echo "    git push --force origin $BRANCH"
echo
echo "Then replace your old local clone with this one (or re-clone)."
