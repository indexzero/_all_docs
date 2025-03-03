# @_all_docs/cache

> Stability: NaN – `Array(16).join("wat" - 1) + " Batman!"`

Fetch & cache :origin/_all_docs using a set of lexographically sorted keys

**[Features](#features)**
·
**[How It Works](#how-it-works)**
·
**[Thanks](#thanks)**

## Features

* 🛋️ Relax! Use the `start_key` and `end_key` CouchDB APIs to harness the power of partition-tolerance from the b-tree
* 🔑 Accepts a set of lexographically sorted pivots to use as B-tree partitions
* 🦿 Run map-reduce operations on `_all_docs` and `packument` entries by key range or cache partition
* Coming Soon!
  * 🕸️⚡️🐢🦎🦀 Lightning fast partition-tolerant edge read-replica for `cache-control: immutable` "Pouch-like" `[{ _id, _rev, ...doc }*]` JSON documents out of the box!

## How it works

1. 📍 Provide `npm` origin, lexographic pivots, & location for existing cache (if any)
2. ⚡️ Create `[{ start_key, end_key, id, filename }]` partition ranges from lexographic pivots
3. 🏃‍♀️ For each `[start_key, end_key]` partition:
   * 🗄️ Attempt to read `${start_key}___${end_key}.json` from local disk cache
      * ✅ Set `max-age=${now-last.now}`s to HTTP `headers` for the outbound `undici` options.
   * ⬇️ `GET :npm-origin/_all_docs?start_key={start_key}&end_key={end_key}&include_docs=false`
4. 👀 Validate the HTTP response:
   * ✅ `304 Not Modified` Local Cache Valid. No update necessary
   * 📝 `200 OK` Update cache contents for `${start_key}___${end_key}.json` partition

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
