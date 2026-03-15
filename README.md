
# alien-av-toolkit

Better documentation and tutorials coming soon!

# Get started

To use alien you will need:

* Install vanilla [pure data and GEM](https://puredata.info/downloads/pure-data)

You might not want pd-extended, purr-data. I recommend using Pd vanilla and adding dependencies as needed.

* download or clone [alien](https://github/m-onz/alien) and add it to your pd path

With gcc or a c compiler

```bash
cd alien
make
make install
```

* within Pd add the alien folder to the path
* via deken (tools/find externals) install pd-else, freeverb~ & potentially GEM
* if you want inverted patch cables check out the "theme" folder from alien and copy it to your Pd externals folder

# Workflow

Once you have installed everything you should be able to open a new pd patch and create an [alien] object. If you see dashed lines around the edge it means you have not successfully added alien to your Pd path. The Pd path is NOT the same thing as linux environment variables.

That is is how you can get Pd with batteries included and have a powerful algorithmic audio visual starting point

# Credits

Named after the [Lisp alien](https://lispers.org/). Inspired by TidalCycles, SuperCollider, and the live coding community.
