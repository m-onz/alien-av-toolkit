# ------------------------------------------------------------------
# pix_alien — build custom Gem pix_ objects as a standalone external
# ------------------------------------------------------------------
# Uses pd-lib-builder (Makefile.pdlibbuilder). This does NOT compile
# Gem itself — it compiles your pix_ sources against Gem's HEADERS and
# leaves Gem's symbols (GemPixObj, imageStruct, ...) undefined, to be
# resolved at load time by the Gem library already running inside Pd.
#
# Prerequisites:
#   1. Pd source or headers          (m_pd.h)
#   2. A checkout of Gem's source    (for Base/GemPixObj.h etc.)
#      git clone https://github.com/umlaeute/Gem.git
#   3. Makefile.pdlibbuilder — grab it once:
#      wget https://raw.githubusercontent.com/pure-data/pd-lib-builder/master/Makefile.pdlibbuilder
#
# Build:
#   make PDDIR=/path/to/pd GEM_SRC=/path/to/Gem/src
#
# Then in Pd add this folder to the search path (or -path it) and make
# sure Gem is loaded BEFORE you instantiate [pix_aliengain].
# ------------------------------------------------------------------

lib.name = pix_alien

# Each object = one class. Add more source stems here as you write them.
class.sources = \
    src/pix_aliengain.cpp \
    $(empty)

# Point this at the src/ of a Gem checkout so the Gem headers are found.
GEM_SRC ?= ../../Gem/src

cflags = -I"$(GEM_SRC)" -DPD

# Allow Gem's symbols to stay undefined at link time (resolved when Pd
# loads this external, since Gem is already in the process).
ldflags.Darwin = -undefined dynamic_lookup
ldflags.Linux  = -Wl,--unresolved-symbols=ignore-all

# Standard pd-lib-builder tail.
PDLIBBUILDER_DIR = .
include $(PDLIBBUILDER_DIR)/Makefile.pdlibbuilder
