# pix_alien

Custom Gem `pix_` objects for the alien-av-toolkit — a **standalone external**
that adds new pixel effects to Pd without forking Gem.

Ships with one worked example, **`pix_aliengain`** (per-channel gain + bias, i.e.
brightness/contrast), built to be the smallest honest template you can copy.

> Design background and the CPU-vs-GLSL decision live in
> [`../docs/pix_objects.md`](../docs/pix_objects.md). Read that first if you're
> deciding *whether* to write a C++ object at all.

## What's here

```
pix_alien/
  src/
    pix_aliengain.cpp   # the effect (mirrors Gem's pix_invert + pix_posterize)
    pix_aliengain.h
  Makefile              # pd-lib-builder based; links against Gem headers
  README.md             # this file
```

## How a pix_ object works (the 60-second version)

A single-input pixel effect is a subclass of **`GemPixObj`**. You override one or
more `processXXXImage(imageStruct &image)` methods; Gem calls the one matching the
incoming image format (and converts formats for you if you only implement some).

- `imageStruct` gives you `image.xsize`, `image.ysize`, and `image.data`
  (an interleaved `unsigned char*`).
- Address channels by the named constants **`chRed` `chGreen` `chBlue` `chAlpha`**
  (RGBA) or **`chGray`** — never hard-code `0,1,2,3`, the order differs per platform.
- Two macros register the class with Pd:
  - `CPPEXTERN_HEADER(pix_aliengain, GemPixObj);` in the header
  - `CPPEXTERN_NEW_WITH_ONE_ARG(pix_aliengain, t_floatarg, A_DEFFLOAT);` in the .cpp
    (use `CPPEXTERN_NEW(...)` if your object takes no creation argument)
- Extra inlets are made with `inlet_new(...)` in the constructor and wired to
  methods via `CPPEXTERN_MSG1(classPtr, "selector", method, type);` inside the
  static `obj_setupCallback()`.
- Call `setPixModified()` after changing a parameter so Gem reprocesses the frame.

`pix_aliengain.cpp` is fully commented against all of the above.

## Using it in a patch

```
[gemhead]
|
[pix_image ...]  or  [pix_video]        <- a source
|
[pix_aliengain 1.2]                     <- creation arg = initial gain
|   ^ inlet 2: [gain (   inlet 3: [bias (
[pix_texture]
|
[square 4]
```

Send `[gain 2.0(` to the second inlet to brighten, `[bias -0.2(` to the third to
darken. `gain` multiplies, `bias` (−1..1) offsets.

## Building

> **Heads up:** this cannot be compiled inside the toolkit alone — it needs Pd
> headers and a **Gem source checkout** (for `Base/GemPixObj.h` etc.). Your editor
> will show "file not found" for the Gem includes until you build with the paths
> below; that's expected.

### Route A — standalone external (recommended, no Gem rebuild)

Links against Gem's headers and resolves Gem's symbols at load time (Gem is already
in the Pd process). Uses [pd-lib-builder](https://github.com/pure-data/pd-lib-builder).

```bash
cd pix_alien

# one-time: fetch the builder and Gem sources
wget https://raw.githubusercontent.com/pure-data/pd-lib-builder/master/Makefile.pdlibbuilder
git clone https://github.com/umlaeute/Gem.git ../../Gem      # or point GEM_SRC anywhere

# build
make PDDIR=/path/to/pd GEM_SRC=/path/to/Gem/src
```

Produces `pix_aliengain.pd_darwin` / `.pd_linux` / `.dll`. Put it on Pd's search
path. **Load Gem before instantiating the object** (e.g. `[declare -lib Gem]` in the
patch, which START-HERE already does).

### Route B — build inside a Gem tree (most robust)

If Route B's undefined-symbol linking gives you trouble on your platform, drop the
sources straight into a Gem checkout and let Gem's own build handle everything:

```bash
cp src/pix_aliengain.* /path/to/Gem/src/Pixes/
# add pix_aliengain.cpp + .h to the lists in src/Pixes/Makefile.am
cd /path/to/Gem && ./autogen.sh && ./configure --with-pd=/path/to/pd && make
```

This guarantees ABI/API match but rebuilds (part of) Gem.

## Adding your own effect

1. Copy `pix_aliengain.{h,cpp}` to `pix_yourfx.{h,cpp}`, rename the class.
2. Rewrite `processRGBAImage()` (and/or `processGrayImage`, `processYUVImage`).
3. Add `src/pix_yourfx.cpp` to `class.sources` in the `Makefile`.
4. Rebuild.

Good next candidates (all single-pixel, easy): threshold/solarize, RGB channel
rotate, gamma, duotone. Effects that need neighbouring pixels (blur, edge detect)
read from `image.data` at `y*xsize + x` offsets — a bit more bookkeeping.
