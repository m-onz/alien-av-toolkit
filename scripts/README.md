# Maintenance scripts

Two one-time cleanup scripts for shrinking this repo. **Neither has been run.**
Both are destructive in different ways — read this whole file first.

## Current state (measured 2026-09-07)

| Thing | Size |
|---|---|
| working tree `sounds/` | 304 MB |
| `.git` history | 826 MB |
| whole repo to clone | ~1.1 GB |

The history is bloated by things no longer in the working tree — `videos/output_prores.mov`
(89 MB), `monzwozere.wav` (48 MB), `skepta139.wav` (45 MB) — plus every past 24-bit version
of the samples in `sounds/`.

## Recommended order

Do these in order so history-stripping keeps the *small* samples, not the big ones:

1. **`shrink-samples.sh`** — converts `sounds/*.wav` to 16-bit mono in the working tree.
   Commit the result.
2. **`shrink-history.sh`** — rewrites history to drop the old large blobs (video, stray
   WAVs, and every oversized past sample version). Force-pushes.

If you only want to reclaim clone size and don't care about sample fidelity, you can run
`shrink-history.sh` alone — but the current 24-bit samples in the working tree are large,
so strip-by-size would delete them too. Read that script's notes.

## Back up first — always

```bash
cd ..
cp -R alien-av-toolkit alien-av-toolkit.backup   # full working + .git backup
```

`shrink-history.sh` rewrites **every commit hash**. Any collaborator must re-clone
afterwards. If you have no collaborators this is painless.
