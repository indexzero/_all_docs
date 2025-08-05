# `@_all_docs/frame`

All operations related to _all_docs data "frames":

* Set operations (add, remove, intersect, etc)
* Run operations (i.e. map-reduce execution, reading results, etc.)

```js
import { Frame } from '@_all_docs/frame';
import { readFileSync } from 'node:fs';

const npmHighImpact = JSON.parse(
  readFileSync('./npm-high-impact.json', 'utf8')
);

const f = new Frame(npmHighImpact, {
  concurrency: 100,
  size: 50,
  start: 0,
  dryRun: false,
  origins: {
    packument: 'https://registry.npmjs.com',
    alldocs: 'https://replicate.npmjs.com'
  }
})
```

> n.b. intentionally not calling these "dataframes" to avoid confusion with operations available on a pandas "dataframe"
