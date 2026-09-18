# alien_shaders / basics

A graded GLSL learning series: **16 shaders, each teaching one idea**, from
"output a single color" up to "raymarch a lit 3D sphere". Together they take you
from zero to being able to read — and modify — any of the complex `1.frag`–`71.frag`
in the parent folder.

Every file uses the **same Pd header and `a`–`h` uniform convention** as the rest
of the repo, so they load through the identical Gem chain (see "Loading" below).

## The ladder

| # | File | Teaches | Feeds into |
|---|------|---------|-----------|
| 01 | `01_solid_color.frag` | `fragColor`, a color is a `vec4` | everything |
| 02 | `02_uv_gradient.frag` | `fragCoord / iResolution` → `uv`, position = color | everything |
| 03 | `03_time_pulse.frag` | `iTime` + `sin()` for animation | everything animated |
| 04 | `04_centered_coords.frag` | centre + aspect correction, `length()` | all radial effects |
| 05 | `05_circle_smoothstep.frag` | distance fields, `step` vs `smoothstep` (antialiasing) | shapes, masks |
| 06 | `06_mix_colors.frag` | `mix()` + `smoothstep()` gradients (color grading) | all coloring |
| 07 | `07_stripes.frag` | `fract()` / `sin()` periodicity | scanlines, waves |
| 08 | `08_grid_tiling.frag` | domain repetition, cell `id` via `floor()` | dots, halftone, mosaics |
| 09 | `09_rotation.frag` | `mat2` rotation, twist/swirl | kaleidoscopes |
| 10 | `10_polar.frag` | polar coords (`atan`, `length`), symmetry | mandalas, rays, spirals |
| 11 | `11_hsv_color.frag` | HSV → RGB, hue animation | nearly every complex shader |
| 12 | `12_random_hash.frag` | fake randomness with a `hash()` | noise, glitch, static |
| 13 | `13_value_noise.frag` | smooth interpolated noise | clouds, organic texture |
| 14 | `14_fbm.frag` | fractal Brownian motion (octaves) | smoke, terrain, marble |
| 15 | `15_domain_warp.frag` | warping noise by noise | **`1.frag`** (Fluid Flow) |
| 16 | `16_raymarch_sphere.frag` | 3D SDF raymarching + lighting | **`2.frag`** (Mesh Sphere) |

Suggested path: do them in order. 01–06 are "you can now draw anything flat",
07–11 are "you can now make patterns", 12–16 are "you can now make the complex ones".

## Conventions (shared with the whole repo)

- **Pd header block** — the `uniform ...` lines plus the `main()` wrapper that calls
  `mainImage()`. This is what makes the shaders Shadertoy-compatible: your logic lives
  in `mainImage(out vec4 fragColor, in vec2 fragCoord)`.
- **`a`–`h`** — eight `float` uniforms, always sent from Pd in the range **0.0–1.0**.
- **`param(p, lo, hi)`** — `mix(lo, hi, p)`; remaps a 0–1 knob to a useful range.
  Each file's header comment lists what every knob does.
- **`iTime`** — seconds; drive it from Pd (e.g. a `[metro]`→counter, or `[realtime]`).
- **`iResolution`** — the render size in pixels.

## Loading in Pd / Gem

These live one level deeper than the numbered shaders, so point `[glsl_fragment]`
at the `basics/` path:

```
[open alien_shaders/basics/01_solid_color.frag(
|
[glsl_fragment]
|
[glsl_program]   <- also send: [link $1(, and the [a $1(..[h $1( knob messages, [iTime $1(
```

The simplest way to try one: open `__starter_template__.pd`, find the
`[glsl_fragment]` / `[glsl_program]` block, and change its `open` message to one of
these files. The eight `a`–`h` number boxes already wired there will drive the knobs.

> Tip: because the filenames here are descriptive (not bare numbers like `1.frag`),
> use the full `open alien_shaders/basics/<name>.frag` message rather than the
> numeric `open alien_shaders/$1.frag` loader used for the main set.

## Where to go next

Once `15_domain_warp` and `16_raymarch_sphere` make sense, open the parent folder's
`1.frag` and `2.frag` — they are these two techniques scaled up with more octaves,
double warps, and richer coloring. Everything else in `1.frag`–`71.frag` is a
combination of the 16 ideas above.
