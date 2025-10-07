# API Reference

Complete API documentation for all `@_all_docs` packages.

## Package Overview

| Package                | Description                                  | Import                                                          |
|------------------------|----------------------------------------------|-----------------------------------------------------------------|
| `@_all_docs/partition` | Partition operations and registry client     | `import { PartitionClient } from '@_all_docs/partition'`        |
| `@_all_docs/packument` | Package document fetching and caching        | `import { PackumentClient } from '@_all_docs/packument'`        |
| `@_all_docs/cache`     | Caching abstractions and storage drivers     | `import { Cache, createStorageDriver } from '@_all_docs/cache'` |
| `@_all_docs/frame`     | Data frames for processing collections       | `import { PartitionFrame } from '@_all_docs/frame'`             |
| `@_all_docs/worker`    | Runtime abstractions for different platforms | `import { Processor } from '@_all_docs/worker'`                 |

---

## @_all_docs/partition

### PartitionClient

Client for fetching partition data from the npm registry's `_all_docs` endpoint.

```javascript
import { PartitionClient } from '@_all_docs/partition';
```

#### Constructor

```javascript
new PartitionClient(options)
```

**Parameters:**
- `options` (Object)
  - `env` (Object) - Runtime environment configuration
    - `RUNTIME` (String) - Runtime type: 'node' | 'cloudflare' | 'fastly' | 'cloudrun'
    - `CACHE_DIR` (String) - Cache directory path (Node.js)
    - `NPM_ORIGIN` (String) - Registry origin URL (default: 'https://replicate.npmjs.com')
  - `cache` (Cache) - Optional cache instance
  - `rateLimiter` (Object) - Rate limiting configuration
    - `requestsPerSecond` (Number) - Max requests per second

**Example:**
```javascript
const client = new PartitionClient({
  env: {
    RUNTIME: 'node',
    CACHE_DIR: './cache',
    NPM_ORIGIN: 'https://replicate.npmjs.com'
  },
  rateLimiter: {
    requestsPerSecond: 10
  }
});
```

#### Methods

##### `async initializeAsync()`

Initialize the client's storage driver. Must be called before making requests.

```javascript
await client.initializeAsync();
```

##### `async request(partition, options)`

Fetch a partition from the registry.

**Parameters:**
- `partition` (Object)
  - `startKey` (String) - Starting key for the partition
  - `endKey` (String) - Ending key for the partition
- `options` (Object)
  - `force` (Boolean) - Force fetch even if cached
  - `signal` (AbortSignal) - Abort signal for cancellation

**Returns:** `CacheEntry` - The fetched partition data

**Example:**
```javascript
const result = await client.request({
  startKey: 'express',
  endKey: 'express-z'
});

const data = result.json();
console.log(`Fetched ${data.rows.length} packages`);
```

### Partition

Utility class for partition operations.

```javascript
import { Partition } from '@_all_docs/partition';
```

#### Static Methods

##### `Partition.fromPivots(pivots, origin)`

Generate partitions from an array of pivot points.

**Parameters:**
- `pivots` (Array<String|null>) - Lexicographically sorted pivot points
- `origin` (String) - Registry origin URL

**Returns:** `Array<Object>` - Array of partition objects

**Example:**
```javascript
const pivots = ['a', 'b', 'c', 'd'];
const partitions = Partition.fromPivots(pivots);
// Returns:
// [
//   { startKey: null, endKey: 'a' },
//   { startKey: 'a', endKey: 'b' },
//   { startKey: 'b', endKey: 'c' },
//   { startKey: 'c', endKey: 'd' },
//   { startKey: 'd', endKey: null }
// ]
```

##### `Partition.cacheKey(startKey, endKey, origin)`

Generate a cache key for a partition.

**Parameters:**
- `startKey` (String|null) - Starting key
- `endKey` (String|null) - Ending key
- `origin` (String) - Registry origin

**Returns:** `String` - Versioned cache key

**Example:**
```javascript
const key = Partition.cacheKey('a', 'b', 'https://replicate.npmjs.com');
// Returns: "v1:partition:npm:61:62"
```

---

## @_all_docs/packument

### PackumentClient

Client for fetching package documents from the npm registry.

```javascript
import { PackumentClient } from '@_all_docs/packument';
```

#### Constructor

```javascript
new PackumentClient(options)
```

**Parameters:**
- `options` (Object)
  - `env` (Object) - Runtime environment configuration
    - `RUNTIME` (String) - Runtime type
    - `CACHE_DIR` (String) - Cache directory path (Node.js)
    - `NPM_REGISTRY` (String) - Registry URL (default: 'https://registry.npmjs.org')
  - `cache` (Cache) - Optional cache instance

**Example:**
```javascript
const client = new PackumentClient({
  env: {
    RUNTIME: 'node',
    CACHE_DIR: './cache',
    NPM_REGISTRY: 'https://registry.npmjs.org'
  }
});
```

#### Methods

##### `async request(packageName, options)`

Fetch a packument from the registry.

**Parameters:**
- `packageName` (String) - Name of the package (e.g., 'express', '@babel/core')
- `options` (Object)
  - `full` (Boolean) - Fetch full packument including README
  - `force` (Boolean) - Force fetch even if cached

**Returns:** `CacheEntry|null` - The packument data or null if not found

**Example:**
```javascript
const packument = await client.request('express');
if (packument) {
  const data = packument.json();
  console.log(`Package: ${data.name}`);
  console.log(`Versions: ${Object.keys(data.versions).length}`);
}
```

##### `async requestBatch(packageNames, options)`

Fetch multiple packuments concurrently.

**Parameters:**
- `packageNames` (Array<String>) - Array of package names
- `options` (Object)
  - `concurrency` (Number) - Max concurrent requests (default: 10)
  - `continueOnError` (Boolean) - Continue if individual fetches fail

**Returns:** `Map<String, CacheEntry>` - Map of package names to packuments

**Example:**
```javascript
const packages = ['express', 'react', 'vue'];
const results = await client.requestBatch(packages);

for (const [name, packument] of results) {
  console.log(`${name}: ${packument ? 'fetched' : 'failed'}`);
}
```

---

## @_all_docs/cache

### Cache

Caching abstraction with pluggable storage drivers.

```javascript
import { Cache, createStorageDriver } from '@_all_docs/cache';
```

#### Constructor

```javascript
new Cache(options)
```

**Parameters:**
- `options` (Object)
  - `driver` (StorageDriver) - Storage driver instance
  - `path` (String) - Cache path/prefix
  - `coalesceRequests` (Boolean) - Enable request coalescing
  - `bloomFilter` (Object) - Bloom filter configuration
    - `size` (Number) - Filter size
    - `falsePositiveRate` (Number) - Target false positive rate

**Example:**
```javascript
import { Cache, createStorageDriver } from '@_all_docs/cache';

const driver = await createStorageDriver({
  RUNTIME: 'node',
  CACHE_DIR: './cache'
});

const cache = new Cache({
  driver,
  coalesceRequests: true
});
```

#### Methods

##### `async get(key)`

Get a value from the cache.

**Parameters:**
- `key` (String) - Cache key

**Returns:** `Any|null` - Cached value or null if not found

##### `async set(key, value, options)`

Store a value in the cache.

**Parameters:**
- `key` (String) - Cache key
- `value` (Any) - Value to cache (must be JSON-serializable)
- `options` (Object)
  - `ttl` (Number) - Time to live in seconds

##### `async has(key)`

Check if a key exists in the cache.

**Parameters:**
- `key` (String) - Cache key

**Returns:** `Boolean` - True if key exists

##### `async delete(key)`

Delete a key from the cache.

**Parameters:**
- `key` (String) - Cache key

##### `async *keys(prefix)`

Iterate over cache keys with a given prefix.

**Parameters:**
- `prefix` (String) - Key prefix

**Returns:** `AsyncIterator<String>` - Async iterator of keys

**Example:**
```javascript
for await (const key of cache.keys('v1:partition:')) {
  console.log(key);
}
```

##### `async fetch(key, fetcher, options)`

Get from cache or fetch if missing (with request coalescing).

**Parameters:**
- `key` (String) - Cache key
- `fetcher` (Function) - Async function to fetch value if not cached
- `options` (Object) - Cache options

**Returns:** `Any` - Cached or fetched value

**Example:**
```javascript
const data = await cache.fetch('my-key', async () => {
  // This will only be called once even with concurrent requests
  return await expensiveOperation();
});
```

### CacheEntry

Represents a cached HTTP response.

```javascript
import { CacheEntry } from '@_all_docs/cache';
```

#### Constructor

```javascript
new CacheEntry(statusCode, headers, options)
```

**Parameters:**
- `statusCode` (Number) - HTTP status code
- `headers` (Object) - HTTP headers
- `options` (Object)
  - `trustIntegrity` (Boolean) - Trust integrity checks

#### Methods

##### `setBody(body)`

Set the response body.

**Parameters:**
- `body` (Any) - Response body (usually JSON)

##### `json()`

Get the response body as JSON.

**Returns:** `Any` - The response body

##### `get valid()`

Check if the cache entry is still valid.

**Returns:** `Boolean` - True if valid based on cache-control headers

##### `encode()`

Encode the entry for storage.

**Returns:** `Object` - Encoded entry

##### `static decode(data)`

Decode a stored entry.

**Parameters:**
- `data` (Object) - Encoded entry data

**Returns:** `CacheEntry` - Decoded cache entry

### Cache Key Utilities

```javascript
import { createCacheKey, decodeCacheKey } from '@_all_docs/cache';
```

##### `createCacheKey(type, params)`

Create a versioned cache key.

**Parameters:**
- `type` (String) - 'partition' or 'packument'
- `params` (Object)
  - For 'partition': `{ startKey, endKey, origin }`
  - For 'packument': `{ packageName, origin }`

**Returns:** `String` - Versioned cache key

##### `decodeCacheKey(cacheKey)`

Decode a cache key to its components.

**Parameters:**
- `cacheKey` (String) - The cache key to decode

**Returns:** `Object` - Decoded components

---

## @_all_docs/frame

### PartitionFrame

Data frame for processing partition collections.

```javascript
import { PartitionFrame } from '@_all_docs/frame';
```

#### Static Methods

##### `static async fromCache(cachePath, driver)`

Create a frame from cached partitions.

**Parameters:**
- `cachePath` (String) - Cache directory path
- `driver` (StorageDriver) - Storage driver instance

**Returns:** `PartitionFrame` - Frame instance

**Example:**
```javascript
const driver = await createStorageDriver(env);
const frame = await PartitionFrame.fromCache('./cache/partitions', driver);
```

#### Methods

##### `async reduceAsync(reducer, initialValue)`

Reduce over all entries in the frame.

**Parameters:**
- `reducer` (Function) - Reducer function `(accumulator, entry) => accumulator`
- `initialValue` (Any) - Initial accumulator value

**Returns:** `Any` - Final accumulator value

**Example:**
```javascript
const packageCount = await frame.reduceAsync((count, entry) => {
  return count + entry.value.rows.length;
}, 0);
```

##### `async forEach(callback)`

Iterate over all entries.

**Parameters:**
- `callback` (Function) - Callback function `(entry) => void`

**Example:**
```javascript
await frame.forEach(entry => {
  console.log(`Partition: ${entry.key}`);
  console.log(`Rows: ${entry.value.rows.length}`);
});
```

### PackumentFrame

Data frame for processing packument collections.

```javascript
import { PackumentFrame } from '@_all_docs/frame';
```

Similar API to PartitionFrame but for packument data.

### Storage Drivers

#### createStorageDriver

Factory function to create appropriate storage driver for the runtime.

```javascript
import { createStorageDriver } from '@_all_docs/cache';
```

**Parameters:**
- `env` (Object) - Environment configuration
  - `RUNTIME` (String) - 'node' | 'cloudflare' | 'fastly' | 'cloudrun'
  - Runtime-specific options (CACHE_DIR, CACHE_KV, etc.)

**Returns:** `StorageDriver` - Storage driver instance

**Example:**
```javascript
// Node.js
const driver = await createStorageDriver({
  RUNTIME: 'node',
  CACHE_DIR: './cache'
});

// Cloudflare Workers
const driver = await createStorageDriver({
  RUNTIME: 'cloudflare',
  CACHE_KV: env.MY_KV_NAMESPACE
});
```

### StorageDriver Interface

All storage drivers implement this interface:

```typescript
interface StorageDriver {
  // Core operations
  get(key: string): Promise<any>
  put(key: string, value: any, options?: Object): Promise<void>
  has(key: string): Promise<boolean>
  delete(key: string): Promise<void>
  list(prefix: string): AsyncIterator<string>

  // Batch operations (if supported)
  getBatch?(keys: string[]): Promise<Map<string, any>>
  putBatch?(entries: Array<{key: string, value: any}>): Promise<void>

  // Capabilities
  supportsBatch: boolean
  supportsBloom: boolean
}
```

### Checkpoint System

Track progress of partition set processing.

```javascript
import { PartitionCheckpoint } from '@_all_docs/cache/checkpoint';
```

#### Constructor

```javascript
new PartitionCheckpoint(cache, partitionSetId)
```

**Parameters:**
- `cache` (Cache) - Cache instance for storing checkpoint data
- `partitionSetId` (String) - Unique identifier for the partition set

#### Methods

##### `async init()`

Initialize the checkpoint system.

##### `async recordPartitions(partitions)`

Record the partitions to be processed.

**Parameters:**
- `partitions` (Array<Object>) - Array of partition objects

##### `async markComplete(index, metrics)`

Mark a partition as completed.

**Parameters:**
- `index` (Number) - Partition index
- `metrics` (Object) - Completion metrics

##### `async markFailed(index, error)`

Mark a partition as failed.

**Parameters:**
- `index` (Number) - Partition index
- `error` (Error) - The error that occurred

##### `async getProgress()`

Get current processing progress.

**Returns:** `Object` - Progress information
- `stats` (Object) - Statistics (total, completed, failed, pending)
- `percentComplete` (Number) - Percentage complete
- `elapsedMs` (Number) - Elapsed time in milliseconds

**Example:**
```javascript
const checkpoint = new PartitionCheckpoint(cache, 'job-123');
await checkpoint.init();

const partitions = Partition.fromPivots(['a', 'b', 'c']);
await checkpoint.recordPartitions(partitions);

// Process partitions...
await checkpoint.markComplete(0, { rows: 100 });

const progress = await checkpoint.getProgress();
console.log(`Progress: ${progress.percentComplete}%`);
```

---

## Error Handling

All API methods may throw these errors:

### NetworkError

Network-related errors from registry requests.

```javascript
try {
  await client.request(partition);
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    // Handle connection error
  }
}
```

### RateLimitError

Rate limiting errors (HTTP 429).

```javascript
try {
  await client.request(partition);
} catch (error) {
  if (error.statusCode === 429) {
    const retryAfter = error.headers['retry-after'];
    // Wait and retry
  }
}
```

### CacheError

Cache-related errors.

```javascript
try {
  await cache.get(key);
} catch (error) {
  if (error.message.includes('corrupted')) {
    // Handle corrupted cache
  }
}
```

---

## TypeScript Support

All packages include JSDoc type definitions for TypeScript support:

```typescript
import { PartitionClient } from '@_all_docs/partition';
import type { WorkerEnv, WorkItem, WorkResult } from '@_all_docs/worker';

const env: WorkerEnv = {
  RUNTIME: 'node',
  CACHE_DIR: './cache',
  NPM_ORIGIN: 'https://replicate.npmjs.com'
};

const client = new PartitionClient({ env });
```

---

## Examples

### Fetching All Partitions

```javascript
import { Partition, PartitionClient } from '@_all_docs/partition';

async function fetchAllPartitions(pivots) {
  const client = new PartitionClient({
    env: {
      RUNTIME: 'node',
      CACHE_DIR: './cache'
    }
  });

  await client.initializeAsync();

  const partitions = Partition.fromPivots(pivots);
  const results = [];

  for (const partition of partitions) {
    try {
      const result = await client.request(partition);
      results.push({
        partition,
        rows: result.json().rows.length,
        cached: result.hit
      });
    } catch (error) {
      console.error(`Failed to fetch ${partition.startKey}-${partition.endKey}:`, error);
    }
  }

  return results;
}

// Usage
const pivots = ['a', 'b', 'c', 'd', 'e'];
const results = await fetchAllPartitions(pivots);
console.log(`Fetched ${results.length} partitions`);
```

### Building a Package Dependency Graph

```javascript
import { PackumentClient } from '@_all_docs/packument';

async function buildDependencyGraph(packageName, depth = 2) {
  const client = new PackumentClient({
    env: { RUNTIME: 'node', CACHE_DIR: './cache' }
  });

  const graph = new Map();
  const queue = [{ name: packageName, level: 0 }];
  const visited = new Set();

  while (queue.length > 0) {
    const { name, level } = queue.shift();

    if (visited.has(name) || level >= depth) continue;
    visited.add(name);

    const packument = await client.request(name);
    if (!packument) continue;

    const data = packument.json();
    const latest = data['dist-tags']?.latest;
    if (!latest) continue;

    const version = data.versions[latest];
    const deps = version.dependencies || {};

    graph.set(name, Object.keys(deps));

    for (const dep of Object.keys(deps)) {
      queue.push({ name: dep, level: level + 1 });
    }
  }

  return graph;
}

// Usage
const graph = await buildDependencyGraph('express', 2);
for (const [pkg, deps] of graph) {
  console.log(`${pkg} depends on: ${deps.join(', ')}`);
}
```

### Processing Cached Data

```javascript
import { PartitionFrame } from '@_all_docs/frame';
import { createStorageDriver } from '@_all_docs/cache';

async function analyzePackages() {
  const env = {
    RUNTIME: 'node',
    CACHE_DIR: './cache/partitions'
  };

  const driver = await createStorageDriver(env);
  const frame = await PartitionFrame.fromCache('./cache/partitions', driver);

  // Count total packages
  const totalPackages = await frame.reduceAsync((count, entry) => {
    return count + entry.value.rows.length;
  }, 0);

  // Find packages by prefix
  const expressPackages = await frame.reduceAsync((packages, entry) => {
    const filtered = entry.value.rows.filter(row =>
      row.id.startsWith('express')
    );
    return packages.concat(filtered.map(r => r.id));
  }, []);

  return {
    total: totalPackages,
    express: expressPackages
  };
}
```

### Monitoring Progress with Checkpoints

```javascript
import { PartitionCheckpoint } from '@_all_docs/cache/checkpoint';
import { Cache } from '@_all_docs/cache';

async function processWithCheckpoint(partitions, processor) {
  const cache = new Cache({ driver });
  const checkpoint = new PartitionCheckpoint(cache, 'job-' + Date.now());

  await checkpoint.init();
  await checkpoint.recordPartitions(partitions);

  for (let i = 0; i < partitions.length; i++) {
    try {
      const result = await processor(partitions[i]);
      await checkpoint.markComplete(i, result);
    } catch (error) {
      await checkpoint.markFailed(i, error);
    }

    // Log progress every 10 partitions
    if (i % 10 === 0) {
      const progress = await checkpoint.getProgress();
      console.log(`Progress: ${progress.percentComplete.toFixed(1)}%`);
    }
  }

  const finalProgress = await checkpoint.getProgress();
  return finalProgress;
}
```
