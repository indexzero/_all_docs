# @_all_docs/cache

> Stability: NaN – `Array(16).join("wat" - 1) + " Batman!"`

Fetch & cache :origin/_all_docs using a set of lexographically sorted keys. High-performance, partition-tolerant system for fetching and caching npm registry data at scale

**[Quick Start](#quick-start)**
·
**[Features](#features)**
·
**[Documentation](#documentation)**
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

### 🚀 Massive Scale Performance
- Process npm's 3.4M+ packages efficiently using B-tree partitioning
- Parallel processing across multiple edge runtimes
- Intelligent caching with partition tolerance

### 🌐 Multi-Runtime Support
- **Node.js** - Traditional server deployment with cacache storage
- **Cloudflare Workers** - Global edge deployment with KV storage
- **Fastly Compute@Edge** - Edge computing with Dictionary storage
- **Google Cloud Run** - Containerized deployment with Cloud Storage

### 🛋️ Smart Partitioning
- Lexicographically sorted pivots create manageable data chunks
- CouchDB-style `start_key`/`end_key` API for B-tree operations
- Checkpoint system tracks processing progress across partition sets

### ⚡ Edge-Ready Architecture
- Runtime-centric design with minimal bundle sizes (30-50KB)
- Cross-platform cache key format works everywhere
- Pluggable storage drivers for different backends

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
