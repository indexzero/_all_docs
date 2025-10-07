# Architecture Overview

## Introduction

`@_all_docs/cache` is a high-performance, partition-tolerant system for fetching and caching npm registry data at scale. It leverages B-tree partitioning and edge computing to transform what was previously a week-long npm replica bootstrap into a few hours of processing time.

This document describes the runtime-centric architecture that enables the system to run across multiple platforms: Node.js, Cloudflare Workers, Fastly Compute@Edge, and Google Cloud Run.

## Core Concepts

### Partition Tolerance

The system divides the npm registry's 3.4M+ packages into manageable partitions using lexographically sorted "pivots". Each partition represents a range of package names that can be fetched and cached independently.

```javascript
// Example pivots
['a', 'ab', 'abc', 'b', 'c', 'd']

// Resulting partitions
[
  { startKey: 'a', endKey: 'ab' },   // All packages from 'a' to 'ab'
  { startKey: 'ab', endKey: 'abc' },  // All packages from 'ab' to 'abc'
  { startKey: 'abc', endKey: 'b' },   // All packages from 'abc' to 'b'
  // ...
]
```

### Cache Keys

The system uses a versioned, hex-encoded cache key format for cross-platform compatibility:

```
Partition: v1:partition:{origin}:{hex(startKey)}:{hex(endKey)}
Packument: v1:packument:{origin}:{hex(packageName)}
```

This format ensures keys work across all storage backends (filesystem, Cloudflare KV, Fastly Dictionary, Google Cloud Storage).

## Runtime-Centric Architecture

The architecture separates runtime-specific implementations from core business logic:

```
workers/
├── worker/              # Runtime-agnostic core logic
│   ├── interfaces.js    # Shared type definitions
│   ├── processor.js     # Core processing logic
│   └── storage.js       # Storage abstractions
├── cloudflare/          # Cloudflare Workers implementation
├── node/                # Node.js implementation
├── fastly/              # Fastly Compute@Edge implementation
└── cloudrun/            # Google Cloud Run implementation
```

### Benefits

- **Small Bundle Sizes**: Each runtime only includes its own code (30-50KB vs 200KB+)
- **Fast Cold Starts**: Reduced bundle size means 10-25ms cold starts
- **Clear Separation**: Runtime-specific code is isolated from business logic
- **Independent Deployment**: Each runtime can be deployed and scaled independently

## Core Packages

### @_all_docs/partition

Manages partition operations and fetching from the npm registry's `_all_docs` endpoint.

```javascript
import { PartitionClient } from '@_all_docs/partition';

const client = new PartitionClient({ env });
const result = await client.request({
  startKey: 'express',
  endKey: 'express-z'
});
```

### @_all_docs/packument

Handles fetching and caching individual package documents (packuments).

```javascript
import { PackumentClient } from '@_all_docs/packument';

const client = new PackumentClient({ env });
const packument = await client.request('/express');
```

### @_all_docs/cache

Provides caching abstractions with storage driver support.

```javascript
import { Cache } from '@_all_docs/cache';
import { createStorageDriver } from '@_all_docs/worker';

const driver = await createStorageDriver(env);
const cache = new Cache({ driver });

await cache.set('key', value);
const cached = await cache.get('key');
```

### @_all_docs/cache

Provides caching abstractions with storage driver support.

```javascript
import { Cache, createStorageDriver } from '@_all_docs/cache';

// Storage drivers adapt to different backends
const driver = await createStorageDriver(env);
const cache = new Cache({ driver });

await cache.set('key', value);
const cached = await cache.get('key');
```

### @_all_docs/worker

Contains the runtime abstraction layer for different platforms (Node.js, Cloudflare, Fastly, Cloud Run).

## Processing Pipeline

### 1. Partition Generation

Pivots are used to create partition ranges that divide the registry namespace:

```javascript
const partitions = Partition.fromPivots(['a', 'b', 'c']);
// Creates partitions: [null-a], [a-b], [b-c], [c-null]
```

### 2. Work Distribution

Work items are distributed across available workers:

```javascript
const workItem = {
  type: 'partition',
  id: 'partition-a-b',
  payload: { startKey: 'a', endKey: 'b' },
  priority: 1,
  attempts: 0
};

await queue.enqueue(workItem);
```

### 3. Processing

Workers fetch data from the registry and cache results:

```javascript
async function processPartition(workItem, env) {
  const client = new PartitionClient({ env });
  const result = await client.request(workItem.payload);

  // Data is automatically cached by the client
  return {
    success: true,
    rows: result.json().rows.length
  };
}
```

### 4. Checkpoint Tracking

The checkpoint system tracks progress across partition sets:

```javascript
const checkpoint = new PartitionCheckpoint(cache, 'set-1');
await checkpoint.recordPartitions(partitions);

// Track progress
await checkpoint.markComplete(0, { rows: 100 });
const progress = await checkpoint.getProgress();
// { percentComplete: 33.33, stats: { completed: 1, total: 3 } }
```

## Storage Drivers

Each runtime uses an appropriate storage backend:

### Node.js - cacache

Uses npm's battle-tested content-addressable cache:

```javascript
class NodeStorageDriver {
  constructor(cachePath) {
    this.cachePath = cachePath;
  }

  async get(key) {
    const { data } = await cacache.get(this.cachePath, key);
    return JSON.parse(data.toString('utf8'));
  }
}
```

### Cloudflare - KV Namespace

Leverages Cloudflare's globally distributed key-value store:

```javascript
class CloudflareStorageDriver {
  constructor(kvNamespace) {
    this.kv = kvNamespace;
  }

  async get(key) {
    return await this.kv.get(key, 'json');
  }
}
```

### Google Cloud Run - Cloud Storage

Uses Google Cloud Storage for persistent caching:

```javascript
class GCSStorageDriver {
  constructor(bucketName) {
    this.bucket = storage.bucket(bucketName);
  }

  async get(key) {
    const file = this.bucket.file(`${key}.json`);
    const [content] = await file.download();
    return JSON.parse(content.toString());
  }
}
```

## HTTP Client Abstraction

The system provides a cross-runtime HTTP client that maintains compatibility with undici while working in edge environments:

```javascript
class BaseHTTPClient {
  async request(path, options = {}) {
    // Use undici in Node.js
    if (this.agent && this.agent.request) {
      return await this.agent.request({ path, ...options });
    }

    // Use native fetch in edge runtimes
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers,
      signal: options.signal
    });

    // Add undici-compatible properties
    response.statusCode = response.status;
    return response;
  }
}
```

## Queue System

Different queue implementations for various deployment scenarios:

### Local Development - p-queue

```javascript
const queue = new PQueue({
  concurrency: 10,
  interval: 1000,
  intervalCap: 20  // Rate limiting
});
```

### Distributed - BullMQ

```javascript
const queue = new Queue('all-docs-work', {
  connection: { host: 'redis', port: 6379 }
});

await queue.add('partition', workItem, {
  priority: 1,
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 }
});
```

### Edge - Durable Objects (Cloudflare)

```javascript
const queue = env.WORK_QUEUE.get(id);
await queue.fetch('/enqueue', {
  method: 'POST',
  body: JSON.stringify(workItem)
});
```

## Performance Characteristics

### Bundle Sizes
- Node.js: ~150KB (with dependencies)
- Cloudflare Workers: 30-40KB
- Fastly Compute@Edge: 35-45KB
- Google Cloud Run: ~150KB (containerized)

### Cold Start Times
- Node.js: 100-200ms
- Cloudflare Workers: 10-25ms
- Fastly Compute@Edge: 15-30ms
- Google Cloud Run: 200-500ms

### Processing Throughput
- Single worker: 20-50 requests/second (with rate limiting)
- Distributed: 1000+ requests/second (across workers)
- Edge: Limited by platform quotas

## FAQ

### Why Hex-Encoded Cache Keys?

Different storage backends have different character restrictions. Hex encoding ensures cache keys work universally across filesystems, KV stores, and object storage.
