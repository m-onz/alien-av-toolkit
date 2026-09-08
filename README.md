# alien-av-toolkit

An algorithmic audio/visual starting point for [Pure Data](https://puredata.info),
built on the [`alien`](https://github.com/m-onz/alien) pattern language.

## Install

1. Install Pd from <https://msp.ucsd.edu/software.html>
2. In Pd: **Tools → Find externals**, then install:
   - `Gem` — graphics
   - `else` — audio objects
   - `alien` — the pattern language + novelty objects
   - `alien-theme-plugin` — dark canvas theme *(restart Pd after installing)*
3. Clone this repo (or click **Use this template** on GitHub to start your own set):
   ```bash
   git clone https://github.com/m-onz/alien-av-toolkit
   ```
4. Open **`START-HERE.pd`**

> **Keep patches at the top level of this folder.** Asset paths are relative, so a patch
> moved into a subfolder won't find the samples, shaders or textures.

No compiler is needed — `alien` installs as a precompiled deken package. To build `alien`
from source instead, see its [repo](https://github.com/m-onz/alien).

## What's here

- `START-HERE.pd` — entry point and dependency check
- `tutorial-1.pd` — walkthrough
- `alien-example.pd` — minimal `[alien] → [else/sequencer]` chain
- `lib/` — synth and utility abstractions (declared via `-path ./lib`)
- `alien_shaders/` — GLSL shaders for Gem
- `sounds/` — sample library
- `textures/` — image textures for Gem

## Credits

Named after the [Lisp alien](https://lispers.org/). Inspired by TidalCycles, SuperCollider,
and the live coding community.
