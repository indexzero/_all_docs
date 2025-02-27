# @_all_docs/cache

> Stability: NaN - 🐉 Here be dragons.

Fetch & cache :origin/_all_docs using a set of lexographically sorted keys

**[Features](#features)**
·
**[How It Works](#how-it-works)**
·
**[Thanks](#thanks)**

## Features

* 🛋️ Relax! Use the `start_key` and `end_key` CouchDB APIs to harness the power of the b-tree
* Coming Soon!
  * 🔑 Accepts a set of lexographically sorted pivots to use as B-tree partitions
  * 🕸️ Edge-first partition tolerant ETag-based caching out of the box!
  * 🗺️ Map-reduce cached JSON partitions into a unified set

## How it works

1. 📍 Provide `npm` origin, lexographic pivots, & location for existing cache (if any)
2. ⚡️ Create `[start_key, end_key]` partition ranges from lexographic pivots
3. 🏃‍♀️ For each `[start_key, end_key]` partition:
   * 🔄 Calculate ETag from `${start_key}___${end_key}` cache contents (if any) for `If-None-Match` HTTP header
   * ⬇️ `GET :npm-origin/_all_docs?start_key={start_key}&end_key={end_key}&include_docs=false`
4. 👀 Validate the HTTP response:
   * ✅ `304 Not Modified` Local Cache Valid. No update necessary
   * 📄 `200 OK` Update cache contents for `${start_key}___${end_key}` partition

## Usage

```sh
pnpm install @_all_docs/cache
```

Then use it:

```js
const { _all_docs } = require('@_all_docs/cache');

await _all_docs({
  startKey: '8',
  endKey: '9',
  filename: '8___9.json'
});
```

## Thanks

Many thanks to [bmeck], [guybedford], [mylesborins], [mikeal], [jhs], [jchris], [darcyclarke], [isaacs], & [mcollina] for all the bits & bobs of stuffs that helped me remember why this would work so well how to do this after 10 years ❤️

[bmeck]: https://github.com/bmeck
[guybedford]: https://github.com/guybedford
[mylesborins]: https://github.com/mylesborins
[mikeal]: https://github.com/mikeal
[jhs]: https://github.com/jhs
[jchris]: https://github.com/jchris
[darcyclarke]: https://github.com/darcyclarke
[isaacs]: https://github.com/isaacs
[mcollina]: https://github.com/mcollina
