## Bootstrap

```
pnpm install

mkdir -p ./cache/packuments

#
# 1. Fetch all partitions for pivots
#
SIZE=2000 DEBUG=_all_docs/request PIVOTS=$(cwd)/.partitions.json node bin/partitions-fetch-from-origin.js

#
# 2. Try fetching packuments for a single partition
#
CONCURRENCY=100 SIZE=2000 DEBUG=_all_docs* node bin/packuments-fetch-for-partition.js null__0

#
# 3. Start fetching all packuments for all partitions
#
DEBUG=_all_docs* node bin/
```

##### API Notes

**Partition encapsulation**
```js
const { Partition } = require('@_all_docs/cache');

const partitions = await Partition.from(`${os.homedir}/._all_docs/cache/index`)
```

**example map/reduce CLI usage**
``` sh
# _all_docs map <entity> <JSONPath>
$ _all_docs map packument $.versions[*].scripts keys

# _all_docs map jq <jq-expr> 
$ _all_docs map jq 'reduce .versions[] as $v ({}; . + $v.scripts) | keys' 
```

> Notes on above: if the internal append-only data structure for map functions was
> [publish-time, name, version, map-key, map-value] tuples then the output would
> be immutable (for an immuttable map-function) because each npm version is
> immutable 
>
> AND
>
> allow for quick look-back querying. This will make incrementally rebuilding
> the "views" much less time intensive
