# @_all_docs

> Stability: NaN – `Array(16).join("wat" - 1) + " Batman!"`

Fetch & cache :origin/_all_docs using a set of lexographically sorted keys. High-performance, partition-tolerant system for fetching and caching npm registry data at scale

**[Quick Start](#quick-start)**
·
**[Features](#features)**
·
**[Documentation](#-more-documentation)**
·
**[Architecture](#architecture)**
·
**[Contributing](#contributing)**

## Quick Start

```bash
# Install the CLI globally
npm install -g @_all_docs/cli

# Fetch npm registry partitions
npx _all_docs partition refresh --pivots ./pivots.js

# Fetch package documents
npx _all_docs packument fetch express
```

## Features

* 🛋️ Relax! Use the `start_key` and `end_key` CouchDB APIs to harness the power of partition-tolerance from the b-tree
* 🔑 Accepts a set of lexographically sorted pivots to use as B-tree partitions
* 🦿 Run map-reduce operations on `_all_docs` and `packument` entries by key range or cache partition
* 🏁 Checkpoint system tracks processing progress across partition sets
* ☁️ Parallel processing across multiple edge runtimes
* 🔜 ~🕸️⚡️🐢🦎🦀 Lightning fast partition-tolerant edge read-replica for `cache-control: immutable` "Pouch-like" `[{ _id, _rev, ...doc }*]` JSON documents out of the box!~

## Usage

### Create Partition Pivots

```javascript
// pivots.js
module.exports = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
  'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
  'u', 'v', 'w', 'x', 'y', 'z'
];
```

### Fetch Registry Data (from CLI)

```bash
# Refresh all partitions
npx _all_docs partition refresh --pivots ./pivots.js

# Fetch specific packages
npx _all_docs packument fetch express react vue

# Create cache index
npx _all_docs cache create-index > index.txt
```

### Fetch Registry Data (from code)

```javascript
import { PartitionClient } from '@_all_docs/partition';
import { PackumentClient } from '@_all_docs/packument';

// Fetch partition data
const partitionClient = new PartitionClient({
  env: { RUNTIME: 'node', CACHE_DIR: './cache' }
});

const partition = await partitionClient.request({
  startKey: 'express',
  endKey: 'express-z'
});

// Fetch package document
const packumentClient = new PackumentClient({
  env: { RUNTIME: 'node', CACHE_DIR: './cache' }
});

const packument = await packumentClient.request('express');
```

## 📚 More Documentation
- [Getting Started Guide](./doc/getting-started.md) - Quick tutorial and common use cases
- [Architecture Overview](./doc/architecture.md) - System design and technical details
- [CLI Reference](./doc/cli-reference.md) - Complete command documentation
- [API Reference](./doc/api.md) - Programmatic usage and package APIs

## Development Setup

```bash
# Clone and install
git clone https://github.com/indexzero/_all_docs.git
cd _all_docs
pnpm install

# Run tests
pnpm test

# Start development worker
pnpm dev
```

## License

Apache-2.0 © 2024 Charlie Robbins

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
