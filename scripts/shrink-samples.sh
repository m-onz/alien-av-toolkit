#!/usr/bin/env bash
#
# shrink-samples.sh — convert sounds/*.wav to 16-bit mono in place.
#
# One-shots don't need 24-bit stereo; this typically takes sounds/ from ~300 MB
# to ~15-20 MB with no audible difference. IRREVERSIBLE in the working tree
# (recover from git history or your backup if unhappy). RUN NOTHING blindly —
# read scripts/README.md first, and take a backup.
#
# Requires: sox  (macOS: `brew install sox`, Debian/Ubuntu: `apt install sox`)

set -euo pipefail

cd "$(dirname "$0")/.."   # repo root

if ! command -v sox >/dev/null 2>&1; then
  echo "error: sox not found. brew install sox   (or apt install sox)" >&2
  exit 1
fi

if [ ! -d sounds ]; then
  echo "error: no sounds/ directory here" >&2
  exit 1
fi

echo "before: $(du -sh sounds | cut -f1)"

# DRY RUN: list what would change. Comment out the exit to actually convert.
echo "-- files that would be converted --"
find sounds -type f -name '*.wav' | wc -l
echo "Re-run with DO_IT=1 to actually convert."
[ "${DO_IT:-0}" = "1" ] || exit 0

# Convert each file: 16-bit (-b 16), mono (-c 1). Skips files already 16-bit mono.
find sounds -type f -name '*.wav' -print0 | while IFS= read -r -d '' f; do
  bits=$(soxi -b "$f" 2>/dev/null || echo 0)
  chans=$(soxi -c "$f" 2>/dev/null || echo 0)
  if [ "$bits" = "16" ] && [ "$chans" = "1" ]; then
    continue
  fi
  sox "$f" -b 16 -c 1 "$f.tmp16" && mv "$f.tmp16" "$f"
  echo "  converted $f"
done

echo "after:  $(du -sh sounds | cut -f1)"
echo
echo "Now test in Pd (playdir~ / soundfiler handle mono fine, but check patches that"
echo "assume stereo), then commit:"
echo "    git add sounds && git commit -m 'shrink samples to 16-bit mono'"
