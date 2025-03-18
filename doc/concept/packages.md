# `@_all_docs/*` packages

## `@_all_docs/cli`

**Installation**
``` sh
$ pnpm -g @_all_docs/cli
```

**Build an initial set of `_all_docs` partitions**
``` sh
# Build the initial set of cache partitions
$ _all_docs cache build --pivots ./path/to/pivots.json
Cache 420 partitions from ./path/to/pivots.json in ~/.cache/_all_docs/partitions/
```

**Create & update _all_docs frames for ecosystem analysis workflows**
``` sh
# Create an _all_docs frame for the npm-high-impact dataset
# See: https://github.com/wooorm/npm-high-impact
$ _all_docs frame create npm-high-impact --from $(node -pe "JSON.stringify(require('npm-high-impact').npmHighImpact, null , 2)")
Create new default frame "npm-high-impact" in ~/.local/state/frames/npm-high-impact/

# Fetch all packuments for the packages in the npm-high-impact dataset
$ _all_docs packuments fetch
Cache 9,234 packuments for frame "npm-high-impact" into ~/.cache/_all_docs/packuments
```

**YOU DON'T QUERY IT! YOU WRITE A DISTRIBUTED MAP-REDUCE FUNCTION IN ~ERLANG~ JAVASCRIPT!**
```sh
# Run a distributed map-reduce operation on the set (e.g. unified set of all `dependencies`, etc.)
$ _all_docs runs new --design-doc ./path/to/design/doc.js --exec viewName
Run require('./path/to/design/doc.js').views.viewName on 9,234 packuments for frame "npm-high-impact"? (y/n)
y
Ran require('./path/to/design/doc.js').views.viewName on 9,234 packuments for frame "npm-high-impact"
  9,234 okay
  0     errors
Written to ~/.local/share/_all_docs/map-reduce/{sid=ae45}/{map,reduce,groups}.json

# View _all_docs run history to confirm timing of runs within a given frame (or all frames)
$ _all_docs runs --frame npm-high-impact
{ sid=ae45, design-doc='./path/to/design/doc.js' exec='viewName' when='just now', okay=9234, errors=0 }

# Add all items from the previous run output (e.g. get all dependencies) to the current frame
$ _all_docs frame add --from $(_all_docs get run/ae45/reduce.json)

# Fetch all packuments for the packages in the npm-high-impact dataset
$ _all_docs packuments fetch
Cache 12,627 packuments for frame "npm-high-impact" into ~/.cache/_all_docs/packuments
  9,234 Existing packuments
  3,392 New packuments
```

## `@_all_docs/config`

```js
import Config from '@_all_docs/config'

const cfg = new Config({
  xdg: new XDG('_all_docs')
})

const {
  partitions, // cfg.xdg.cache('partitions')
              // ~/.cache/_all_docs/partitions/

  packuments, // cfg.xdg.cache('packuments')
              // ~/.cache/_all_docs/packuments/

  mapReduce,  // cfg.xdg.data('map-reduce')
              // ~/.local/share/_all_docs/map-reduce/

  frames,     // cfg.xdg.data('map-reduce')
              // ~/.local/state/_all_docs/frames
} = cfg.xdg;

const {
  concurrency, // Number of concurrent executions and/or HTTP requests
  start,       // Number of records to skip prior to beginning execution
  size,        // Number of records to operate on
  dryRun       // If true, skips all "hard" operations (e.g. HTTP request, execution of user code, etc.)
               // to ensure idempotency of potentially non-idempotent operations
} = cfg.limits
```

## `@_all_docs/frame`

All operations related to _all_docs data "frames":

* Set operations (add, remove, intersect, etc)
* Run operations (i.e. map-reduce execution, reading results, etc.)

> n.b. intentionally not calling these "dataframes" to avoid confusion with operations available on a pandas "dataframe"

## `@_all_docs/packument`, `@_all_docs/partition`, `@_all_docs/http`

Fetching, reading, and normalizing `Packument` and `Partition` instances over HTTP(S)/2

## `@_all_docs/cache`

A pair of `@vltpkg/cache` instances that expose the underlying shared disk caches used by default in `_all_docs`:

```js
import { PackumentCache, PartitionCache } from '@_all_docs/cache';

const defaults = {
  packuments: new PackumentCache({
    path: cfg.xdg.packuments
  }),
  partitions: new PartitionCache({
    path: cfg.xdg.partition
  })
}
```


The `PartitionCache` is most useful when a full fetch of a remote `_all_docs` origin is the goal of the program. In most cases the `PackumentCache` should suffice as in the example above as the `Frame` was created from a list of `packument` names (not all packuments).

A `Frame` therefore can bne configured to use its own cache, but by default uses the global `_all_docs` cache for packuments.
