# @_all_docs/cache

Enhanced caching package with cross-runtime HTTP client and advanced cache features.

## Overview

This package provides:
- Cross-runtime HTTP client with undici compatibility
- Cache entry management with HTTP semantics
- Versioned cache key generation
- Checkpoint system for tracking progress
- Bloom filters for efficient existence checks
- Request coalescing to prevent duplicate operations

## Installation

```sh
pnpm add @_all_docs/cache
```

## Usage

### BaseHTTPClient

Cross-runtime HTTP client that works in Node.js and edge environments:

```js
import { BaseHTTPClient, createDispatcher } from '@_all_docs/cache';

// Create client with optional undici dispatcher
const dispatcher = await createDispatcher(env);
const client = new BaseHTTPClient('https://api.example.com', {
  dispatcher,
  requestTimeout: 30000,
  userAgent: 'my-app/1.0'
});

// Make requests
const response = await client.request('/endpoint', {
  headers: { 'Accept': 'application/json' }
});

// Use cache validation headers
client.setCacheHeaders(options, cacheEntry);
```

### CacheEntry

Manage HTTP cache entries with proper semantics:

```js
import { CacheEntry } from '@_all_docs/cache';

const entry = new CacheEntry(200, {
  'content-type': 'application/json',
  'cache-control': 'max-age=3600',
  'etag': '"abc123"'
});

await entry.setBody({ data: 'value' });

// Check validity
if (entry.valid) {
  const data = entry.json();
}

// Verify integrity
const isValid = await entry.verifyIntegrity();

// Encode/decode for storage
const encoded = entry.encode();
const decoded = CacheEntry.decode(encoded);
```

### Cache with Storage Drivers

Advanced cache with pluggable storage backends:

```js
import { Cache } from '@_all_docs/cache';

const cache = new Cache({
  path: '/cache/path',
  env: { RUNTIME: 'node' },
  bloomSize: 10000,
  bloomFalsePositiveRate: 0.01
});

// Basic operations
await cache.set('key', { value: 'data' });
const value = await cache.fetch('key');
const exists = await cache.has('key');
await cache.delete('key');

// Iterate over entries
for await (const entry of cache) {
  console.log(entry.key, entry.value);
}

// List keys with prefix
for await (const key of cache.keys('prefix:')) {
  console.log(key);
}
```

### Cache Keys

Generate versioned, cross-platform compatible cache keys:

```js
import { 
  createPartitionKey, 
  createPackumentKey,
  decodeCacheKey 
} from '@_all_docs/cache';

// Partition cache key
const partKey = createPartitionKey('start', 'end', 'https://registry.npmjs.com');
// => "v1:partition:npm:7374617274:656e64"

// Packument cache key
const pkgKey = createPackumentKey('@scope/package', 'https://registry.npmjs.com');
// => "v1:packument:npm:4073636f70652f7061636b616765"

// Decode keys
const decoded = decodeCacheKey(partKey);
// => { version: 'v1', type: 'partition', origin: '...', startKey: 'start', endKey: 'end' }
```

### Checkpoint System

Track progress of partition set processing:

```js
import { PartitionCheckpoint } from '@_all_docs/cache';

const checkpoint = new PartitionCheckpoint(cache, 'partition-set-id');

// Initialize with partitions
await checkpoint.initialize([
  { startKey: 'a', endKey: 'b' },
  { startKey: 'b', endKey: 'c' }
]);

// Track progress
await checkpoint.markInProgress(0);
await checkpoint.markCompleted(0, { rows: 1000 });

// Get statistics
const progress = await checkpoint.getProgress();
console.log(progress.stats); // { total: 2, completed: 1, pending: 1, ... }
console.log(progress.percentComplete); // 50
```

## Features

- **Bloom Filters** - Quickly check non-existence without storage lookup
- **Request Coalescing** - Prevent duplicate concurrent requests
- **Lazy Driver Initialization** - Load storage driver on first use
- **Cross-Runtime Crypto** - Uses Web Crypto API or Node.js crypto
- **Trace Headers** - Automatic request tracing with unique IDs
- **Conditional Requests** - Support for If-None-Match and If-Modified-Since

## Testing

```sh
pnpm test
```

## License

Apache-2.0