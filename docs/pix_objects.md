# Custom `pix_` objects for the alien-av-toolkit — exploration & design

This doc decides *whether* and *how* to add custom pixel objects to the toolkit,
before writing a pile of C++. The working scaffold and build steps live in
[`../pix_alien/`](../pix_alien/); this is the reasoning behind them.

## Background: where pix_ objects live in Gem

Gem is [umlaeute/Gem](https://github.com/umlaeute/Gem) (GitHub mirror of the
canonical IEM GitLab, `https://git.iem.at/pd/Gem.git`). All ~106 pixel effects are
in **`src/Pixes/`**, one `pix_*.cpp` + `.h` per object. The pieces that matter:

- **`src/Base/GemPixObj.{h,cpp}`** — base class for *single-input* effects. You
  subclass it and override `processRGBAImage(imageStruct&)`, and optionally
  `processGrayImage`, `processYUVImage`, plus SIMD variants (`processRGBAMMX`, …).
- **`src/Base/GemPixDualObj.{h,cpp}`** — base for *two-input* effects (`pix_add`,
  `pix_mix`, `pix_composite`, `pix_chroma_key`, `pix_mask`).
- **`src/Gem/Image.h`** — `imageStruct` (the pixel buffer) and the channel
  constants `chRed/chGreen/chBlue/chAlpha`, `chGray`, `chU/chY0/chV/chY1`.
- **`CPPEXTERN_*` macros** — register a C++ class as a Pd object.
- **`src/Pixes/Makefile.am`** — where new sources get added to Gem's own build.

The existing objects fall into rough groups worth knowing when picking a template:

| Group | Examples | Base | Notes |
|-------|----------|------|-------|
| CPU pixel FX | `pix_invert`, `pix_posterize`, `pix_halftone`, `pix_emboss`, `pix_convolve`, `pix_duotone`, `pix_colormatrix` | `GemPixObj` | our reference set |
| Two-input compositing | `pix_add`, `pix_mix`, `pix_composite`, `pix_diff`, `pix_chroma_key`, `pix_mask` | `GemPixDualObj` | |
| Analysis (image → data) | `pix_blob`, `pix_multiblob`, `pix_movement`, `pix_histo`, `pix_mean_color` | `GemPixObj` | output floats, not pixels |
| Plumbing / IO | `pix_image`, `pix_film`, `pix_video`, `pix_texture`, `pix_buffer`, `pix_record`, `pix_sig2pix~` | mixed | not effects |
| Plugin hosts | `pix_freeframe`, `pix_frei0r` | | run external plugin FX |

`pix_invert` is the simplest template (no params); `pix_posterize` is the simplest
one *with* parameter inlets. Our scaffold combines both.

## The core decision: CPU C++ (`pix_`) vs GLSL shader

The toolkit already leans heavily on GLSL (`alien_shaders/`), so this matters.

| | GLSL shader (`glsl_program`) | CPU `pix_` object (C++) |
|---|---|---|
| Speed | Runs on the GPU, per-pixel parallel. Fast even at 1080p+. | Single-threaded CPU loop over every pixel. Fine at low res, struggles as size grows. |
| What it's good at | Generative visuals, warps, lighting, anything math-per-pixel | Logic that's awkward in a shader |
| Reads neighbours / whole frame | Needs render-to-texture / feedback plumbing | Trivial — you have the whole `image.data` buffer |
| State across frames | Awkward (ping-pong FBOs) | Easy — just keep member variables |
| Data *out* of the image | No (shaders only write pixels) | Yes — analysis objects emit floats/lists to Pd |
| Build step | None — edit `.frag`, reload | Must compile against Gem |
| Iteration speed | Instant | Slow (recompile) |

**Conclusion / recommendation:** for *novel real-time visual effects*, prefer GLSL —
it's faster and needs no compiler, which is why the ladder in
`alien_shaders/basics/` is the primary investment. Reach for a C++ `pix_` object
specifically when the task is a poor fit for a fragment shader:

1. **Analysis** — blob tracking, motion/frame-diff, histograms, mean color →
   feeding *numbers* back into the `alien` pattern language (audio-reactive-visuals
   in reverse: visuals driving sound). Shaders can't emit data; `pix_` objects can.
2. **Cross-frame temporal state** — trails, feedback, IIR smoothing that's fiddly
   with FBO ping-pong but a one-liner with a persistent CPU buffer.
3. **Whole-frame / neighbour logic** — algorithms that want random access to the
   full buffer without texture-fetch gymnastics.

For everything else (color grading, warps, generative texture), a `.frag` wins.

## Build strategy: don't fork Gem

You do **not** need to fork Gem to add effects. Two viable routes, both documented
in `pix_alien/README.md`:

- **Route A — standalone external** (recommended). Compile our sources against
  Gem's *headers* with [pd-lib-builder], leaving Gem's symbols undefined at link
  time; they resolve when Pd loads the external (Gem is already in the process).
  Keeps our code in this repo, no Gem rebuild, matches how the toolkit ships
  precompiled `alien`. Risk: undefined-symbol linking is slightly platform-specific.
- **Route B — inside a Gem tree**. Drop sources into `src/Pixes/`, add them to
  `Makefile.am`, rebuild Gem. Bulletproof ABI match, but heavier and lives outside
  this repo.

Start with Route A; fall back to B only if the linker fights you.

[pd-lib-builder]: https://github.com/pure-data/pd-lib-builder

## Roadmap — candidate objects

Ordered easiest → most valuable-to-the-toolkit:

1. **`pix_aliengain`** ✅ *(built — the template)* — gain + bias per channel.
2. `pix_alienthresh` — solarize/threshold; trivial variation on the template.
3. `pix_alienrgbrot` — rotate/mix RGB channels; still per-pixel.
4. `pix_alientrails` — temporal feedback (needs a persistent frame buffer) — shows
   the cross-frame pattern shaders are bad at.
5. `pix_alienblob`-style analysis — thresholded centroid → **outputs x,y,area** to
   Pd, so a webcam can drive `alien` sequences. This is the highest-leverage one:
   it does the thing GLSL fundamentally can't.

## Open questions (decide before scaling up)

- Ship precompiled binaries per-platform (like `alien`/deken), or source-only with
  build instructions? Deken distribution would let non-coders use the objects.
- Keep effects CPU where a shader would do, purely for the no-compiler story? Leaning
  no — the GLSL ladder covers that need better.
- Is the real want *analysis* objects (vision → `alien`)? If so, that's where the
  next C++ effort should go, not more CPU color effects.
