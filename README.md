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
* 🔜 ~🕸️⚡️🐢🦎🦀 Lightning fast partition-tolerant edge read-replica for `cache-control: immutable` "Pouch-like" `[{ _id, _rev, ...doc }*]` JSON documents out of the box!~

## Usage

```sh
pnpm install @_all_docs/cache
```

> 🐲 🐉 Here. Be. Dragons
> 🤯 Letting the interface(s) reveal themselves for now. No official interface
> 🤖 `_all_docs_*` bin scripts for `npx` included below

### 1️⃣ Fetch _all_docs by partitions created from pivots
``` sh
DEBUG=_all_docs* PIVOTS=a.string.array.js npx _all_docs_from_origin

# Inspect partitions fetched to _all_docs cache
ls -al cache/*__*.json
```

_**a.string.array.js (naive)**_
```js
module.exports = [
  null,
  ...numbers,
  ...atoz
];
```

### 2️⃣ Fetch packuments for a cached `_all_docs` partition

```sh
DEBUG=_all_docs* npx _all_docs_partipacku A___Z
```

## How it works

### 1️⃣ Fetch `_all_docs` for pivots

1. 📍 Provide `npm` origin, lexographic pivots, & location for existing cache (if any)
2. ⚡️ Create `[{ start_key, end_key, id, filename }]` partition ranges from lexographic pivots
3. 🏃‍♀️ For each `[start_key, end_key]` partition:
   * 🗄️ Attempt to read `${start_key}___${end_key}.json` from local disk cache
      * ✅ Set `max-age=${now-last.now}`s to HTTP `headers` for the outbound `undici` options.
   * ⬇️ `GET :npm-origin/_all_docs?start_key={start_key}&end_key={end_key}&include_docs=false`
4. 👀 Validate the HTTP response:
   * ✅ `304 Not Modified` Local Cache Valid. No update necessary
   * 📝 `200 OK` Update cache contents for `${start_key}___${end_key}.json` partition

### 2️⃣ Fetch packuments for `_all_docs` partition

> 🔜

## Thanks

Many thanks to [bmeck], [guybedford], [mylesborins], [mikeal], [jhs], [jchris], [darcyclarke], [isaacs], & [mcollina] for all the code, docs, & past conversations that contributed to this technique working so well, 10 years later ❤️

[bmeck]: https://github.com/bmeck
[guybedford]: https://github.com/guybedford
[mylesborins]: https://github.com/mylesborins
[mikeal]: https://github.com/mikeal
[jhs]: https://github.com/jhs
[jchris]: https://github.com/jchris
[darcyclarke]: https://github.com/darcyclarke
[isaacs]: https://github.com/isaacs
[mcollina]: https://github.com/mcollina
