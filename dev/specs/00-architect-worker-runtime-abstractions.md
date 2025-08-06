# Architect `workers/{**}` in `@_all_docs`

## Context / Prior Art

The `@_all_docs` project was built with my JSConf 2025 talk in mind:

```
Over the last 10 years, the npm registry has gone from 300k packages to over 3M packages. At 300k packages, bootstrapping an npm replica from zero took a few hours – at 3M packages it takes over a week. The complexity of analysis problems have similarly increased. The days of a new view in a `_design` document are long behind us. 

Thankfully, the proliferation of the JavaScript at edge laid the foundation for massive parallelism necessary to rapidly accelerate both of these problems at scale. 

Enter @all_docs: a set of open source cloud-native analysis & replica tooling that than can take what was previously a week of time down to a few hours.

This talk will provide context on the underlying computing problems that underpin the `npm` registry – append-only datastores, lexographic sorting, partition tolerance, & replication – and how these properties enable us in newer cloud native approaches to solve the same problems at 100x scale. 

Whether you've ever wanted to learn more about npm, or have just wondered how to leverage edge computing and cloud native file formats like Zarr to solve practical problems this talk is for you!
```

But it does not yet meet this lofty goal. The plumbing is there:

**Refresh the `_all_docs` content for lexographically sorted pivots**
```sh
scripts/bins/_all_docs partition refresh --pivots 'path/to/pivots.js'
```

where `pivots.js` exports data shaped like:

```js
[
  null,   '0',    '1',    '2',    '3',    '4',    '5',    '6',
  '7',    '8',    '9',    'a',    'z'
]
```


**Copy all packuments in from current cache for items in `./npm-high-impact.json` to `./out`**
```sh
scripts/bins/_all_docs packument export ./npm-high-impact.json ./out 
```

**Fetch all packuments locally for packages listed in `./npm-high-impact.json`**
``` sh
scripts/bins/_all_docs packument fetch-list ./npm-high-impact.json
```

**Create a revision index for all packuments in `rev-index-sorted`**
```sh
scripts/bins/_all_docs cache create-index | sort > ./rev-index-sorted
```

But the `npm` registry dataset is HUGE with over 3.4M packages and over 35M individual versions. This leads to even the most basic operations being quickly rate limited. For example, when running `_all_docs partition refresh`:

```
scripts/bins/_all_docs partition refresh --pivots 'path/to/pivots.js' 
{
  size: 2000,
  first: '["https://replicate.npmjs.com/_all_docs?endkey=%220%22",null,"0"]',
  last: '["https://replicate.npmjs.com/_all_docs?startkey=%22%40cxx%22&endkey=%22%40cxy%22","@cxx","@cxy"]'
}
{
  size: 2000,
  first: '["https://replicate.npmjs.com/_all_docs?startkey=%22%40cxy%22&endkey=%22%40cxz%22","@cxy","@cxz"]',
  last: '["https://replicate.npmjs.com/_all_docs?startkey=%22%40fws%22&endkey=%22%40fwt%22","@fws","@fwt"]'
}
https://replicate.npmjs.com/_all_docs?startkey=%22%40cya%22&endkey=%22%40cyb%22&limit=10000
https://replicate.npmjs.com/_all_docs?startkey=%22%40cyb%22&endkey=%22%40cyc%22&limit=10000
https://replicate.npmjs.com/_all_docs?startkey=%22%40cxy%22&endkey=%22%40cxz%22&limit=10000
https://replicate.npmjs.com/_all_docs?startkey=%22%40cxz%22&endkey=%22%40cya%22&limit=10000
https://replicate.npmjs.com/_all_docs?startkey=%22%40cye%22&endkey=%22%40cyf%22&limit=10000
https://replicate.npmjs.com/_all_docs?startkey=%22%40cyc%22&endkey=%22%40cyd%22&limit=10000
//
// 1,000s of request logs
//
https://replicate.npmjs.com/_all_docs?startkey=%22%40fwq%22&endkey=%22%40fwr%22&limit=10000 200
https://replicate.npmjs.com/_all_docs?startkey=%22%40fwn%22&endkey=%22%40fwo%22&limit=10000 200
https://replicate.npmjs.com/_all_docs?startkey=%22%40fwl%22&endkey=%22%40fwm%22&limit=10000 200
{
  size: 2000,
  first: '["https://replicate.npmjs.com/_all_docs?startkey=%22%40fwt%22&endkey=%22%40fwu%22","@fwt","@fwu"]',
  last: '["https://replicate.npmjs.com/_all_docs?startkey=%22%40ivn%22&endkey=%22%40ivo%22","@ivn","@ivo"]'
}
https://replicate.npmjs.com/_all_docs?startkey=%22%40fwu%22&endkey=%22%40fwv%22&limit=10000
https://replicate.npmjs.com/_all_docs?startkey=%22%40fwv%22&endkey=%22%40fww%22&limit=10000
https://replicate.npmjs.com/_all_docs?startkey=%22%40fwt%22&endkey=%22%40fwu%22&limit=10000
https://replicate.npmjs.com/_all_docs?startkey=%22%40fwy%22&endkey=%22%40fwz%22&limit=10000
//
// More request logs
//
./_all_docs/node_modules/.pnpm/undici@7.12.0/node_modules/undici/lib/handler/retry-handler.js:191
      const err = new RequestRetryError('Request failed', statusCode, {
                  ^

RequestRetryError: Request failed
    at RetryHandler.onResponseStart (./_all_docs/node_modules/.pnpm/undici@7.12.0/node_modules/undici/lib/handler/retry-handler.js:191:19)
    at UnwrapHandler.onHeaders (./_all_docs/node_modules/.pnpm/undici@7.12.0/node_modules/undici/lib/handler/unwrap-handler.js:76:36)
    at Request.onHeaders (./_all_docs/node_modules/.pnpm/undici@7.12.0/node_modules/undici/lib/core/request.js:253:29)
    at Parser.onHeadersComplete (./_all_docs/node_modules/.pnpm/undici@7.12.0/node_modules/undici/lib/dispatcher/client-h1.js:607:27)
    at wasm_on_headers_complete (./_all_docs/node_modules/.pnpm/undici@7.12.0/node_modules/undici/lib/dispatcher/client-h1.js:141:30)
    at wasm://wasm/00032d9a:wasm-function[10]:0x56f
    at wasm://wasm/00032d9a:wasm-function[20]:0x7d57
    at Parser.execute (./_all_docs/node_modules/.pnpm/undici@7.12.0/node_modules/undici/lib/dispatcher/client-h1.js:327:22)
    at Parser.readMore (./_all_docs/node_modules/.pnpm/undici@7.12.0/node_modules/undici/lib/dispatcher/client-h1.js:291:12)
    at TLSSocket.onHttpSocketReadable (./_all_docs/node_modules/.pnpm/undici@7.12.0/node_modules/undici/lib/dispatcher/client-h1.js:881:18) {
  code: 'UND_ERR_REQ_RETRY',
  statusCode: 429,
  data: { count: 4 },
  headers: {
    date: 'Tue, 05 Aug 2025 17:47:14 GMT',
    'content-type': 'text/plain; charset=UTF-8',
    'content-length': '16',
    connection: 'close',
    'retry-after': '30',
    'x-frame-options': 'SAMEORIGIN',
    'referrer-policy': 'same-origin',
    'cache-control': 'private, max-age=0, no-store, no-cache, must-revalidate, post-check=0, pre-check=0',
    expires: 'Thu, 01 Jan 1970 00:00:01 GMT',
    'set-cookie': '__cf_bm=8b0rhyDlrCECjR8pZQJS39mYdKKdYvn9WoSDBCjc8M4-1754416034-1.0.1.1-0gS_puTLEXBSFSqlgYqcp2XQ_1dO.Pp6SNOohc6jBYnrXf1JB5muiUidYGceI0JBVrYlaswbBM2j1YaOfXAwefyGa867y7BkqJsPbuiS3f0; path=/; expires=Tue, 05-Aug-25 18:17:14 GMT; domain=.npmjs.com; HttpOnly; Secure; SameSite=None',
    vary: 'Accept-Encoding',
    'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
    'x-content-type-options': 'nosniff',
    server: 'cloudflare',
    'cf-ray': '96a81e546d510c94-EWR'
  }
}

Node.js v22.17.0
```

## What we'll design together

We need a way to encapsulate the "work" done in commands like `@cli/cli/src/cmd/packument/refresh.js` in such a way that it can be parallelized across multiple:

- Node.js Processes (`local` workers)
- CloudFlare Workers and CloudFlare Workers for Platforms (`cloudflare` workers)
- Fastly Compute@Edge Workers (`fastly` workers)
- Google Cloud Run (`cloudrun` workers)

The operations that a `worker` may undertake are not ANYTHING. It is specific to working with `npm` data:

- `partition-set`: perform an operation on an item in a `List<Partition>` (i.e. an ordered list of partitions)
  - Example: 
- `partition`: perform an operation on an item in a `List<{ _id, _rev }>` (a Partition is simply an ordered list of unhydrated `Packuments`, see @partition.json)
- `packument`: perform an operation on an item in a `Cache<Packument>` where `Cache<Packument>` is an interface to a list of fully hydrated packuments `List<Packument>`

## How we'll work together

Using your `edge-architect` agent:

1. You will ask me what code you should read to complete the next iteration
2. I will tell you what code to go read, why it is relevant, and what you should pay attention to
3. You will read the code with my added context, and use it to refine the plan below
4. After each iteration of refinement you will stop, and ask me to review it.
5. There will be at least three iterations, so do not try to do it all at once.
6. THINK! Above all THINK!

## Plan

### Phase 0: Package Structure

Create multiple packages in the monorepo to separate concerns and minimize bundle sizes for edge deployments.

**Benefits of modular architecture:**
- Domain logic stays with domain packages
- Minimal worker abstraction layer
- Independent versioning and deployment
- Clear separation of concerns
- Reusable components across different contexts
- Smaller bundle sizes - import only what's needed

#### 0.1 Monorepo Structure

```
_all_docs/
├── src/
│   ├── cache/         # @_all_docs/cache (enhanced with HTTP client base)
│   │   ├── http.js    # Base HTTP client for cross-runtime support
│   │   ├── cache.js   # Cache abstraction accepting storage drivers
│   │   └── index.js
│   ├── config/        # @_all_docs/config
│   ├── exec/          # @_all_docs/exec
│   ├── frame/         # @_all_docs/frame
│   ├── packument/     # @_all_docs/packument
│   │   └── client.js  # Edge-aware packument client (extends cache/http)
│   └── partition/     # @_all_docs/partition
│       └── client.js  # Edge-aware partition client (extends cache/http)
├── cli/
│   └── cli/           # @_all_docs/cli
├── workers/
│   ├── types/         # @_all_docs/types (NEW)
│   │   ├── package.json
│   │   └── index.js
│   ├── storage/       # @_all_docs/storage (NEW)
│   │   ├── package.json
│   │   ├── drivers/
│   │   │   ├── node.js
│   │   │   ├── cloudflare.js
│   │   │   ├── fastly.js
│   │   │   └── gcs.js
│   │   └── index.js
│   ├── queue/         # @_all_docs/queue (NEW)
│   │   ├── package.json
│   │   ├── local.js
│   │   ├── distributed.js
│   │   ├── edge.js
│   │   └── index.js
│   └── worker/        # @_all_docs/worker (MINIMAL)
│       ├── package.json
│       ├── app.js     # Hono application
│       ├── processors/
│       ├── runtime/
│       └── index.js
└── pnpm-workspace.yaml
```

#### 0.2 Package Configurations

```json
// workers/types/package.json
{
  "name": "@_all_docs/types",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./index.js"
  }
}

// workers/storage/package.json
{
  "name": "@_all_docs/storage",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./index.js",
    "./drivers/node": "./drivers/node.js",
    "./drivers/cloudflare": "./drivers/cloudflare.js",
    "./drivers/fastly": "./drivers/fastly.js",
    "./drivers/gcs": "./drivers/gcs.js"
  },
  "dependencies": {
    "@google-cloud/storage": "^7.0.0",
    "cacache": "^18.0.0"
  },
  "peerDependencies": {
    "@_all_docs/types": "workspace:*"
  }
}

// workers/queue/package.json
{
  "name": "@_all_docs/queue",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./index.js",
    "./local": "./local.js",
    "./distributed": "./distributed.js",
    "./edge": "./edge.js"
  },
  "dependencies": {
    "p-queue": "^8.0.0",
    "bullmq": "^5.0.0",
    "p-retry": "^6.0.0"
  },
  "peerDependencies": {
    "@_all_docs/types": "workspace:*"
  }
}

// workers/worker/package.json
{
  "name": "@_all_docs/worker",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./index.js",
    "./app": "./app.js",
    "./processors": "./processors/index.js",
    "./runtime": "./runtime/index.js"
  },
  "dependencies": {
    "hono": "^4.0.0"
  },
  "devDependencies": {
    "unenv": "^1.9.0",
    "unbuild": "^2.0.0",
    "@hono/node-server": "^1.0.0"
  },
  "peerDependencies": {
    "@_all_docs/partition": "workspace:*",
    "@_all_docs/packument": "workspace:*",
    "@_all_docs/cache": "workspace:*",
    "@_all_docs/types": "workspace:*",
    "@_all_docs/queue": "workspace:*",
    "@_all_docs/storage": "workspace:*"
  }
}
```

#### 0.3 Update pnpm Workspace Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'src/*'
  - 'cli/*'
  - 'workers/*'  # Add this line
```

#### 0.4 Type Definitions Package

```javascript
// workers/types/index.js
/**
 * @typedef {Object} WorkerEnv
 * @property {KVNamespace} [CACHE_KV] - Cloudflare KV namespace
 * @property {Dictionary} [CACHE_DICT] - Fastly edge dictionary
 * @property {string} [CACHE_DIR] - Node.js cache directory
 * @property {string} [CACHE_BUCKET] - Google Cloud Storage bucket
 * @property {string} NPM_ORIGIN - npm registry origin
 * @property {'node' | 'cloudflare' | 'fastly' | 'cloudrun'} RUNTIME
 */

/**
 * @typedef {Object} WorkItem
 * @property {'partition-set' | 'partition' | 'packument'} type
 * @property {string} id - Unique identifier for deduplication
 * @property {Object} payload - Type-specific payload
 * @property {number} priority - Higher priority items processed first
 * @property {number} attempts - Number of previous attempts
 */

/**
 * @typedef {Object} WorkResult
 * @property {string} workItemId
 * @property {boolean} success
 * @property {Object} [data] - Result data if successful
 * @property {Error} [error] - Error if failed
 * @property {number} duration - Processing time in ms
 * @property {Object} [metrics] - Optional performance metrics
 */

/**
 * @typedef {Object} StorageDriver
 * @property {(key: string) => Promise<any>} get
 * @property {(key: string, value: any, options?: Object) => Promise<void>} put
 * @property {(key: string) => Promise<boolean>} has
 * @property {(key: string) => Promise<void>} delete
 * @property {(prefix: string) => AsyncIterator<string>} list
 */

export const WorkItemTypes = {
  PARTITION_SET: 'partition-set',
  PARTITION: 'partition',
  PACKUMENT: 'packument'
};

export const RuntimeTypes = {
  NODE: 'node',
  CLOUDFLARE: 'cloudflare',
  FASTLY: 'fastly',
  CLOUDRUN: 'cloudrun'
};
```

### Phase 1: Cross-Runtime HTTP Framework with Hono

Use **Hono** as the unified framework for handling HTTP requests across all runtime environments. Hono provides built-in adapters for Node.js, Cloudflare Workers, and Fastly Compute@Edge.

#### 1.1 Core Worker Application

```javascript
// workers/worker/app.js
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

/**
 * @typedef {Object} WorkerEnv
 * @property {KVNamespace} [CACHE_KV] - Cloudflare KV namespace
 * @property {Dictionary} [CACHE_DICT] - Fastly edge dictionary
 * @property {string} [CACHE_DIR] - Node.js cache directory
 * @property {string} NPM_ORIGIN - npm registry origin
 * @property {'node' | 'cloudflare' | 'fastly' | 'cloudrun'} RUNTIME
 */

/**
 * @typedef {Object} WorkItem
 * @property {'partition-set' | 'partition' | 'packument'} type
 * @property {string} id - Unique identifier for deduplication
 * @property {Object} payload - Type-specific payload
 * @property {number} priority - Higher priority items processed first
 * @property {number} attempts - Number of previous attempts
 */

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Work endpoints
app.post('/work/partition', async (c) => {
  const workItem = await c.req.json();
  const env = c.env;
  
  // Process partition work using abstractions
  const result = await processPartition(workItem, env);
  return c.json(result);
});

app.post('/work/packument', async (c) => {
  const workItem = await c.req.json();
  const env = c.env;
  
  // Process packument work using abstractions
  const result = await processPackument(workItem, env);
  return c.json(result);
});

export default app;
```

#### 1.2 Runtime Entry Points

Create minimal entry points for each runtime that import the Hono app:

```javascript
// workers/worker/node.js
import { serve } from '@hono/node-server';
import app from './app.js';

serve({
  fetch: app.fetch,
  port: process.env.PORT || 3000,
});

// workers/worker/cloudflare.js
import app from './app.js';
export default app;

// workers/worker/fastly.js
import app from './app.js';
app.fire(); // Fastly-specific initialization
```

### Phase 2: Enhanced Cache Package with HTTP and Storage Abstractions

Enhance the existing `@_all_docs/cache` package to include cross-runtime HTTP client base and storage driver support.

#### 2.1 Base HTTP Client in Cache Package

```javascript
// src/cache/http.js
/**
 * Base HTTP client that works across all runtimes
 * Provides undici-compatible interface for existing code
 */
export class BaseHTTPClient {
  constructor(origin, options = {}) {
    this.origin = origin;
    this.cache = options.cache;
    this.agent = options.agent;
  }

  /**
   * @param {string} path
   * @param {Object} options
   * @returns {Promise<Response>}
   */
  async request(path, options = {}) {
    const url = new URL(path, this.origin);
    
    // For Node.js with undici available
    if (this.agent && this.agent.request) {
      return this.agent.request({
        origin: url.origin,
        path: url.pathname + url.search,
        ...options
      });
    }
    
    // For edge runtimes, use native fetch
    const fetchOptions = {
      method: options.method || 'GET',
      headers: this.normalizeHeaders(options.headers),
      signal: options.signal,
    };

    if (options.body) {
      fetchOptions.body = options.body;
    }

    const response = await fetch(url.href, fetchOptions);
    
    // Add undici-compatible properties
    response.statusCode = response.status;
    response.headers = this.headersToObject(response.headers);
    
    return response;
  }

  normalizeHeaders(headers = {}) {
    return new Headers(headers);
  }

  headersToObject(headers) {
    const obj = {};
    headers.forEach((value, key) => {
      obj[key.toLowerCase()] = value;
    });
    return obj;
  }

  // Cache control methods
  setCacheHeaders(options, cacheEntry) {
    if (cacheEntry?.etag) {
      options.headers = options.headers || {};
      options.headers['if-none-match'] = cacheEntry.etag;
    }
  }
}

// Factory function to create appropriate agent
export async function createAgent(env) {
  if (env.RUNTIME === 'node' && !globalThis.fetch) {
    const { Agent } = await import('undici');
    return new Agent({
      bodyTimeout: 600_000,
      headersTimeout: 600_000,
      keepAliveTimeout: 600_000,
      connections: 256
    });
  }
  return null;
}
```

#### 2.2 Cache Abstraction with Storage Drivers

```javascript
// src/cache/cache.js
import { createStorageDriver } from '@_all_docs/storage';

/**
 * Cache abstraction that accepts storage drivers
 */
export class Cache {
  constructor(options = {}) {
    this.path = options.path;
    this.driver = options.driver || createStorageDriver(options.env);
  }

  async fetch(key, options = {}) {
    try {
      const value = await this.driver.get(key);
      // Handle cache validation, ETags, etc.
      return value;
    } catch (error) {
      if (error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  }

  async set(key, value, options = {}) {
    return this.driver.put(key, value, options);
  }

  async has(key) {
    return this.driver.has(key);
  }

  async delete(key) {
    return this.driver.delete(key);
  }

  async *keys(prefix) {
    yield* this.driver.list(prefix);
  }
}
```

### Phase 3: Storage Drivers Package

Create the `@_all_docs/storage` package with pluggable storage drivers for different runtimes.

#### 3.1 Storage Driver Interface

```javascript
// workers/storage/index.js
import { RuntimeTypes } from '@_all_docs/types';

export { NodeStorageDriver } from './drivers/node.js';
export { CloudflareStorageDriver } from './drivers/cloudflare.js';
export { FastlyStorageDriver } from './drivers/fastly.js';
export { GCSStorageDriver } from './drivers/gcs.js';

export function createStorageDriver(env) {
  switch (env.RUNTIME) {
    case RuntimeTypes.NODE:
      const { NodeStorageDriver } = await import('./drivers/node.js');
      return new NodeStorageDriver(env.CACHE_DIR);
    
    case RuntimeTypes.CLOUDFLARE:
      const { CloudflareStorageDriver } = await import('./drivers/cloudflare.js');
      return new CloudflareStorageDriver(env.CACHE_KV);
    
    case RuntimeTypes.FASTLY:
      const { FastlyStorageDriver } = await import('./drivers/fastly.js');
      return new FastlyStorageDriver(env.CACHE_DICT);
    
    case RuntimeTypes.CLOUDRUN:
      if (env.CACHE_BUCKET) {
        const { GCSStorageDriver } = await import('./drivers/gcs.js');
        return new GCSStorageDriver(env.CACHE_BUCKET);
      }
      const { NodeStorageDriver: NodeDriver } = await import('./drivers/node.js');
      return new NodeDriver(env.CACHE_DIR || '/tmp/cache');
    
    default:
      throw new Error(`Unsupported runtime: ${env.RUNTIME}`);
  }
}
```

#### 3.2 Node.js Storage Driver with cacache

```javascript
// workers/storage/drivers/node.js
import cacache from 'cacache';

/**
 * Storage driver using npm's cacache for robust local caching
 * Provides content-addressable storage with built-in integrity checking
 */
export class NodeStorageDriver {
  constructor(basePath) {
    this.cachePath = basePath;
  }

  async get(key) {
    try {
      const { data } = await cacache.get(this.cachePath, key);
      return JSON.parse(data.toString('utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Key not found: ${key}`);
      }
      throw error;
    }
  }

  async put(key, value, options = {}) {
    const data = JSON.stringify(value);
    const info = await cacache.put(this.cachePath, key, data);
    // cacache returns integrity hash which could be useful for validation
    return info;
  }

  async has(key) {
    const info = await cacache.get.info(this.cachePath, key);
    return info !== null;
  }

  async delete(key) {
    await cacache.rm.entry(this.cachePath, key);
  }

  async *list(prefix) {
    const stream = cacache.ls.stream(this.cachePath);
    for await (const entry of stream) {
      if (entry.key.startsWith(prefix)) {
        yield entry.key;
      }
    }
  }
}

// workers/storage/drivers/cloudflare.js
export class CloudflareStorageDriver {
  constructor(kvNamespace) {
    this.kv = kvNamespace;
  }

  async get(key) {
    const value = await this.kv.get(key, 'json');
    if (!value) throw new Error(`Key not found: ${key}`);
    return value;
  }

  async put(key, value, options = {}) {
    await this.kv.put(key, JSON.stringify(value), options);
  }

  async has(key) {
    const value = await this.kv.get(key);
    return value !== null;
  }

  async delete(key) {
    await this.kv.delete(key);
  }

  async *list(prefix) {
    let cursor;
    do {
      const result = await this.kv.list({ prefix, cursor });
      for (const key of result.keys) {
        yield key.name;
      }
      cursor = result.cursor;
    } while (cursor);
  }
}

// workers/storage/drivers/gcs.js
import { Storage } from '@google-cloud/storage';

export class GCSStorageDriver {
  constructor(bucketName) {
    this.storage = new Storage();
    this.bucket = this.storage.bucket(bucketName);
  }

  async get(key) {
    const file = this.bucket.file(`${key}.json`);
    const [exists] = await file.exists();
    if (!exists) throw new Error(`Key not found: ${key}`);
    
    const [content] = await file.download();
    return JSON.parse(content.toString());
  }

  async put(key, value) {
    const file = this.bucket.file(`${key}.json`);
    await file.save(JSON.stringify(value), {
      metadata: {
        contentType: 'application/json',
      },
    });
  }

  async has(key) {
    const file = this.bucket.file(`${key}.json`);
    const [exists] = await file.exists();
    return exists;
  }

  async delete(key) {
    const file = this.bucket.file(`${key}.json`);
    await file.delete();
  }

  async *list(prefix) {
    const [files] = await this.bucket.getFiles({ prefix });
    for (const file of files) {
      // Remove .json extension
      yield file.name.replace(/\.json$/, '');
    }
  }
}

```

### Phase 4: Queue Package

Create the `@_all_docs/queue` package with different queue implementations for various deployment scenarios.

#### 4.1 Local Queue Implementation

```javascript
// workers/queue/local.js
import PQueue from 'p-queue';
import pRetry from 'p-retry';

export class LocalWorkQueue {
  constructor(options = {}) {
    this.queue = new PQueue({
      concurrency: options.concurrency || 10,
      interval: 1000,
      intervalCap: options.requestsPerSecond || 20,
      carryoverConcurrencyCount: true,
    });
    
    this.workers = new Map();
  }

  /**
   * @param {WorkItem} workItem
   * @returns {Promise<WorkResult>}
   */
  async addWork(workItem) {
    return this.queue.add(async () => {
      return pRetry(
        async () => {
          const worker = this.selectWorker(workItem);
          return await worker.process(workItem);
        },
        {
          retries: 3,
          onFailedAttempt: error => {
            if (error.statusCode === 429) {
              // Exponential backoff for rate limits
              throw error;
            }
          }
        }
      );
    }, { priority: workItem.priority });
  }

  selectWorker(workItem) {
    // Simple round-robin or least-loaded selection
    const workers = Array.from(this.workers.values());
    return workers[Math.floor(Math.random() * workers.length)];
  }
}
```

#### 4.2 Distributed Queue Implementation

```javascript
// workers/queue/distributed.js
import { Queue, Worker, QueueScheduler } from 'bullmq';

export class DistributedWorkQueue {
  constructor(options = {}) {
    const connection = {
      host: options.redisHost || 'localhost',
      port: options.redisPort || 6379,
    };

    this.queue = new Queue('all-docs-work', { connection });
    this.scheduler = new QueueScheduler('all-docs-work', { connection });
  }

  /**
   * @param {WorkItem} workItem
   * @returns {Promise<string>} Job ID
   */
  async addWork(workItem) {
    const job = await this.queue.add(
      workItem.type,
      workItem.payload,
      {
        priority: workItem.priority,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    
    return job.id;
  }

  /**
   * Create a worker process for this queue
   */
  createWorker(processor, options = {}) {
    return new Worker(
      'all-docs-work',
      async (job) => {
        const workItem = {
          type: job.name,
          payload: job.data,
          id: job.id,
          attempts: job.attemptsMade,
        };
        
        return await processor(workItem);
      },
      {
        connection: this.queue.opts.connection,
        concurrency: options.concurrency || 10,
        limiter: {
          max: options.requestsPerSecond || 20,
          duration: 1000,
        },
      }
    );
  }
}
```

#### 4.3 Edge Queue Implementation

```javascript
// workers/queue/edge.js
export class EdgeWorkQueue {
  constructor(env) {
    this.env = env;
  }

  async addWork(workItem) {
    if (this.env.RUNTIME === 'cloudflare') {
      // Use Durable Objects for coordination
      const id = this.env.WORK_QUEUE.idFromName('main');
      const queue = this.env.WORK_QUEUE.get(id);
      return await queue.fetch('/enqueue', {
        method: 'POST',
        body: JSON.stringify(workItem),
      });
    } else if (this.env.RUNTIME === 'fastly') {
      // Use Fastly's fanout for pub/sub
      await this.env.FANOUT.publish('work-queue', JSON.stringify(workItem));
    }
  }
}
```

### Phase 5: Adapting Existing Clients in Domain Packages

Modify the existing clients in `src/partition` and `src/packument` to extend the base HTTP client and work across runtimes.

#### 5.1 Enhanced Partition Client

```javascript
// src/partition/client.js
import { BaseHTTPClient, createAgent } from '@_all_docs/cache/http';
import { Cache } from '@_all_docs/cache';
import { CacheEntry } from '@_all_docs/cache/entry';
import { Partition } from './index.js';

export class PartitionClient extends BaseHTTPClient {
  constructor(options = {}) {
    const agent = await createAgent(options.env);
    super(options.origin || 'https://replicate.npmjs.com', { 
      agent,
      cache: options.cache 
    });
    
    this.env = options.env;
    this.cache = options.cache || new Cache({ 
      path: 'partitions',
      env: options.env 
    });
    
    // Maintain compatibility with existing API
    this.dryRun = options.dryRun;
    this.limit = options.limit || 10;
  }

  async request({ startKey, endKey }, options = {}) {
    const url = new URL('_all_docs', this.origin);
    if (startKey) {
      url.searchParams.set('startkey', `"${startKey}"`);
    }
    if (endKey) {
      url.searchParams.set('endkey', `"${endKey}"`);
    }
    url.searchParams.set('limit', '10000');

    const cacheKey = Partition.cacheKey(startKey, endKey, this.origin);
    
    // Check cache first
    const cached = await this.cache.fetch(cacheKey);
    if (cached && cached.valid) {
      cached.hit = true;
      return cached;
    }

    // Add cache headers if we have a stale entry
    if (cached) {
      this.setCacheHeaders(options, cached);
    }

    const response = await super.request(url.pathname + url.search, {
      ...options,
      headers: {
        ...options.headers,
        'npm-replication-opt-in': 'true'
      }
    });

    if (response.statusCode === 304 && cached) {
      return cached;
    }

    if (response.statusCode !== 200) {
      throw new Error(`HTTP ${response.statusCode}`);
    }

    // Create cache entry
    const result = new CacheEntry(
      response.statusCode,
      response.headers,
      { trustIntegrity: options.trustIntegrity }
    );

    const body = await response.json();
    result.setBody(body);

    // Cache the result
    await this.cache.set(cacheKey, result.encode());
    return result;
  }
}
```

#### 5.2 Enhanced Packument Client

```javascript
// src/packument/client.js
import { BaseHTTPClient, createAgent } from '@_all_docs/cache/http';
import { Cache } from '@_all_docs/cache';
import { CacheEntry } from '@_all_docs/cache/entry';

export class PackumentClient extends BaseHTTPClient {
  constructor(options = {}) {
    const agent = await createAgent(options.env);
    super(options.origin || 'https://registry.npmjs.org', { 
      agent,
      cache: options.cache 
    });
    
    this.env = options.env;
    this.cache = options.cache || new Cache({ 
      path: 'packuments',
      env: options.env 
    });
    
    // Maintain compatibility with existing API
    this.dryRun = options.dryRun;
    this.limit = options.limit || 10;
  }

  async request(url, options = {}) {
    const cacheKey = typeof url === 'string' ? url : url.pathname;
    
    // Check cache first
    const cached = await this.cache.fetch(cacheKey);
    if (cached && cached.valid) {
      cached.hit = true;
      return cached;
    }

    // Add cache headers if we have a stale entry
    if (cached) {
      this.setCacheHeaders(options, cached);
    }

    const response = await super.request(url, {
      ...options,
      headers: {
        ...options.headers,
        'Accept': 'application/vnd.npm.install-v1+json',
        'Accept-Encoding': 'gzip'
      }
    });

    if (response.statusCode === 304 && cached) {
      return cached;
    }

    if (response.statusCode === 404) {
      return null;
    }

    if (response.statusCode !== 200) {
      throw new Error(`HTTP ${response.statusCode}`);
    }

    // Create cache entry
    const result = new CacheEntry(
      response.statusCode,
      response.headers,
      { trustIntegrity: options.trustIntegrity }
    );

    const body = await response.json();
    result.setBody(body);

    // Cache the result
    await this.cache.set(cacheKey, result.encode());
    return result;
  }
}
```

### Phase 6: Build Configuration with unenv

Use `unenv` to provide Node.js API polyfills at build time for edge runtimes. This configuration is now part of the `@_all_docs/worker` package.

#### 6.1 Build Configuration

```javascript
// workers/worker/build.config.js
import { defineBuildConfig } from 'unbuild';
import { env } from 'unenv';

export default defineBuildConfig({
  entries: [
    { input: './app.js', name: 'worker' },
    { input: './cloudflare.js', name: 'cloudflare', builder: 'rollup' },
    { input: './fastly.js', name: 'fastly', builder: 'rollup' },
  ],
  rollup: {
    emitCJS: false,
    esbuild: {
      target: 'es2022',
    },
  },
  alias: {
    // Map Node.js modules to unenv polyfills for edge builds
    ...env.alias,
  },
  externals: [
    // Keep these external for Node.js builds
    'undici',
    'bullmq',
    'cacache',
  ],
  hooks: {
    'rollup:options'(ctx, options) {
      // Apply unenv preset for edge targets
      if (ctx.options.name === 'cloudflare' || ctx.options.name === 'fastly') {
        options.plugins.push(env.rollup());
      }
    },
  },
});
```

#### 6.2 Runtime Detection and Polyfills

```javascript
// workers/worker/runtime.js
/**
 * Runtime detection and environment setup
 */
export function detectRuntime() {
  // Check for explicit runtime environment variable (for Cloud Run)
  if (process.env.RUNTIME === 'cloudrun') {
    return 'cloudrun';
  } else if (typeof globalThis.Deno !== 'undefined') {
    return 'deno';
  } else if (typeof globalThis.Bun !== 'undefined') {
    return 'bun';
  } else if (typeof globalThis.fastly !== 'undefined') {
    return 'fastly';
  } else if (typeof globalThis.caches !== 'undefined' && !globalThis.process) {
    return 'cloudflare';
  } else {
    return 'node';
  }
}

/**
 * Get environment configuration based on runtime
 */
export function getEnvConfig() {
  const runtime = detectRuntime();
  
  switch (runtime) {
    case 'cloudflare':
      return {
        RUNTIME: 'cloudflare',
        CACHE_KV: globalThis.CACHE_KV,
        NPM_ORIGIN: globalThis.NPM_ORIGIN || 'https://replicate.npmjs.com',
      };
    case 'fastly':
      return {
        RUNTIME: 'fastly',
        CACHE_DICT: globalThis.CACHE_DICT,
        NPM_ORIGIN: globalThis.NPM_ORIGIN || 'https://replicate.npmjs.com',
      };
    case 'cloudrun':
      return {
        RUNTIME: 'cloudrun',
        CACHE_BUCKET: process.env.CACHE_BUCKET,
        CACHE_DIR: process.env.CACHE_DIR || '/tmp/cache',
        NPM_ORIGIN: process.env.NPM_ORIGIN || 'https://replicate.npmjs.com',
      };
    default:
      return {
        RUNTIME: 'node',
        CACHE_DIR: process.env.CACHE_DIR || './cache',
        NPM_ORIGIN: process.env.NPM_ORIGIN || 'https://replicate.npmjs.com',
      };
  }
}
```

### Phase 7: Minimal Worker Package

The `@_all_docs/worker` package provides the minimal abstraction necessary for the code in `src/**` to interact with different runtime environments.

#### 7.1 Worker Processing Functions

```javascript
// workers/worker/processors/partition.js
import { PartitionClient } from '@_all_docs/partition/client';

/**
 * Process a partition work item
 * @param {WorkItem} workItem
 * @param {WorkerEnv} env
 * @returns {Promise<WorkResult>}
 */
export async function processPartition(workItem, env) {
  const start = Date.now();
  
  try {
    const client = new PartitionClient({ env });
    const partition = workItem.payload;
    
    // Fetch the partition data
    const result = await client.request({
      startKey: partition.startKey,
      endKey: partition.endKey
    });
    
    return {
      workItemId: workItem.id,
      success: true,
      data: {
        partition,
        rowCount: result.json()?.rows?.length || 0,
        cached: result.hit || false,
      },
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      workItemId: workItem.id,
      success: false,
      error: {
        message: error.message,
        statusCode: error.statusCode,
      },
      duration: Date.now() - start,
    };
  }
}

// workers/worker/processors/packument.js
import { PackumentClient } from '@_all_docs/packument/client';

/**
 * Process a packument work item
 * @param {WorkItem} workItem
 * @param {WorkerEnv} env
 * @returns {Promise<WorkResult>}
 */
export async function processPackument(workItem, env) {
  const start = Date.now();
  
  try {
    const client = new PackumentClient({ env });
    const { packageName } = workItem.payload;
    
    // Fetch the packument
    const result = await client.request(`/${packageName}`);
    
    if (!result) {
      return {
        workItemId: workItem.id,
        success: false,
        error: { message: 'Package not found' },
        duration: Date.now() - start,
      };
    }
    
    const packument = result.json();
    
    return {
      workItemId: workItem.id,
      success: true,
      data: {
        packageName,
        versions: Object.keys(packument.versions || {}).length,
        cached: result.hit || false,
      },
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      workItemId: workItem.id,
      success: false,
      error: {
        message: error.message,
        statusCode: error.statusCode,
      },
      duration: Date.now() - start,
    };
  }
}
```

#### 7.2 CLI Integration

Update existing CLI commands to use the worker system:

```javascript
// cli/cli/src/cmd/partition/refresh-distributed.js
import { LocalWorkQueue } from '@_all_docs/worker/queue';
import { DistributedWorkQueue } from '@_all_docs/worker/queue';
import { Partition } from '@_all_docs/partition';

export async function refreshPartitionsDistributed(pivots, options = {}) {
  // Create work queue based on options
  const queue = options.redis 
    ? new DistributedWorkQueue(options)
    : new LocalWorkQueue(options);
  
  // Generate partitions from pivots
  const partitions = Partition.fromPivots(pivots);
  
  // Create work items
  const workItems = partitions.map((partition, index) => ({
    type: 'partition',
    id: `partition-${partition.startKey}-${partition.endKey}`,
    payload: {
      startKey: partition.startKey,
      endKey: partition.endKey,
    },
    priority: Math.floor(index / 100), // Group partitions for better distribution
    attempts: 0,
  }));
  
  // Submit work items
  console.log(`Submitting ${workItems.length} partitions for processing...`);
  
  const results = await Promise.allSettled(
    workItems.map(item => queue.addWork(item))
  );
  
  // Report results
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  console.log(`Submitted: ${successful} successful, ${failed} failed`);
  
  return results;
}
```

### Phase 8: Deployment Configuration

The `@_all_docs/worker` package can be built and deployed independently, reducing bundle sizes for edge deployments.

#### 8.1 Building for Different Targets

```bash
# From the workers/worker directory

# Build for all targets
pnpm build

# Build specifically for Cloudflare Workers
pnpm build:cf

# Build specifically for Fastly Compute
pnpm build:fastly
```

#### 8.2 Cloudflare Workers (wrangler.toml)

```toml
# workers/worker/wrangler.toml
name = "all-docs-worker"
main = "./dist/cloudflare.mjs"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat_v2"]

[build]
command = "pnpm build:cf"

[env.production]
kv_namespaces = [
  { binding = "CACHE_KV", id = "your-kv-namespace-id" }
]

[env.production.vars]
NPM_ORIGIN = "https://replicate.npmjs.com"

[[env.production.durable_objects.bindings]]
name = "WORK_QUEUE"
class_name = "WorkQueue"
```

#### 8.3 Google Cloud Run Deployment

Google Cloud Run uses containerized applications, so we'll use the Node.js runtime packaged in a Docker container.

##### 8.3.1 Dockerfile for Cloud Run

```dockerfile
# workers/worker/Dockerfile
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy application code
COPY . .

# Set environment for Cloud Run
ENV RUNTIME=cloudrun
ENV NODE_ENV=production

# Cloud Run uses PORT environment variable
EXPOSE 8080

# Start the Node.js worker
CMD ["node", "node.js"]
```

##### 8.3.2 Cloud Run Service Configuration

```yaml
# workers/worker/service.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: all-docs-worker
  annotations:
    run.googleapis.com/execution-environment: gen2
spec:
  template:
    metadata:
      annotations:
        # Maximum number of requests per container instance
        run.googleapis.com/container-concurrency: "100"
        # CPU allocation
        run.googleapis.com/cpu: "2"
        # Memory allocation
        run.googleapis.com/memory: "2Gi"
        # Timeout
        run.googleapis.com/timeout: "300s"
    spec:
      containers:
      - image: gcr.io/YOUR_PROJECT_ID/all-docs-worker
        env:
        - name: NPM_ORIGIN
          value: "https://replicate.npmjs.com"
        - name: CACHE_BUCKET
          value: "your-gcs-bucket"
        resources:
          limits:
            cpu: "2"
            memory: "2Gi"
```

##### 8.3.3 Deployment Commands

```bash
# Build and push container
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/all-docs-worker

# Deploy to Cloud Run
gcloud run deploy all-docs-worker \
  --image gcr.io/YOUR_PROJECT_ID/all-docs-worker \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NPM_ORIGIN=https://replicate.npmjs.com
```

#### 8.4 Docker Compose for Local Development

```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  worker-1:
    build: .
    environment:
      - WORKER_ID=worker-1
      - REDIS_HOST=redis
      - PORT=3001
      - RUNTIME=cloudrun
    ports:
      - "3001:3001"
  
  worker-2:
    build: .
    environment:
      - WORKER_ID=worker-2
      - REDIS_HOST=redis
      - PORT=3002
      - RUNTIME=cloudrun
    ports:
      - "3002:3002"
```

### Phase 9: Implementation Roadmap

1. **Week 1-2: Core Abstractions**
   - Implement HTTP client abstraction with undici compatibility
   - Implement storage abstraction for filesystem and KV stores
   - Set up Hono application structure

2. **Week 3-4: Queue Integration**
   - Integrate p-queue for local development
   - Set up BullMQ for distributed processing
   - Create worker processing functions

3. **Week 5-6: Edge Runtime Support**
   - Configure unenv build process
   - Test Cloudflare Workers deployment
   - Implement Durable Objects for coordination
   - Set up Google Cloud Run deployment
   - Configure GCS storage adapter

4. **Week 7-8: Production Readiness**
   - Add comprehensive error handling
   - Implement monitoring and metrics
   - Performance testing and optimization

### Key Design Decisions

1. **Domain-Centric Architecture**: Domain logic stays in domain packages (`src/*`), not in worker code
2. **Minimal Worker Abstraction**: Worker package is just a thin runtime adapter
3. **Separate Concerns**: Queue, storage, and types are separate packages for modularity
4. **HTTP in Cache Package**: Base HTTP client lives in `@_all_docs/cache` for consistency
5. **Storage Drivers**: Pluggable storage drivers instead of monolithic adapters
6. **Use Existing NPM Packages**: Leverage Hono, unenv, BullMQ instead of building from scratch
7. **Maintain Compatibility**: Abstractions preserve existing code structure and APIs
8. **Progressive Enhancement**: Start with Node.js, add edge runtimes incrementally
9. **Container Support**: Google Cloud Run provides a middle ground between edge and traditional deployment
10. **Use cacache for Local Storage**: Leverage npm's battle-tested content-addressable cache library
11. **Build Custom Registry Clients**: Build our own registry client from scratch for better control and optimization
12. **Cross-Platform Cache Keys**: Use hex-encoded keys with type prefixes for universal storage compatibility

### Architectural Decision Records

#### ADR-001: Use cacache for Node.js Storage Driver

**Status**: Accepted

**Context**: 
The Node.js storage driver needs a reliable, performant way to cache registry data locally. We evaluated multiple options including building our own file-based cache, using a simple key-value store, or leveraging existing npm infrastructure.

**Decision**: 
Use npm's `cacache` library for the Node.js storage driver implementation.

**Rationale**:
- **Battle-tested**: cacache powers npm's local cache and handles millions of installations daily
- **Content-addressable**: Built-in integrity checking ensures data consistency
- **Performance**: Optimized for high-throughput scenarios with proper file locking
- **Features**: Includes garbage collection, streaming support, and metadata handling
- **Compatibility**: Designed specifically for caching npm registry data

**Consequences**:
- (+) Robust, production-ready caching solution
- (+) Automatic integrity verification
- (+) Well-documented with npm team support
- (-) Additional dependency (18KB gzipped)
- (-) Slight learning curve for content-addressable semantics

#### ADR-002: Build Custom Registry Clients

**Status**: Accepted

**Context**: 
Initially considered using `@vltpkg/registry-client` for registry interactions. However, after evaluation, we determined that building custom registry clients would better serve our specific needs.

**Decision**: 
Build custom registry client implementations from scratch, maintaining only the CacheEntry interface for compatibility.

**Rationale**:
- **Control**: Full control over HTTP behavior, retry logic, and caching strategies
- **Optimization**: Can optimize specifically for our partitioning use case
- **Simplicity**: Avoid unnecessary abstractions not relevant to our use case
- **Edge Compatibility**: Easier to ensure cross-runtime compatibility
- **Reduced Dependencies**: Fewer external dependencies to manage

**Implementation Plan**:
1. Create `@_all_docs/cache/entry` module with our own CacheEntry implementation
2. Base registry clients on our cross-runtime HTTP abstraction
3. Implement only the features we actually need (conditional requests, ETags, etc.)

**Consequences**:
- (+) Complete control over implementation
- (+) Can optimize for our specific use cases
- (+) Easier edge runtime support
- (-) More code to maintain
- (-) Need to implement caching logic ourselves

#### ADR-003: Cross-Platform Cache Key Format

**Status**: Accepted

**Context**: 
Cache keys must work across multiple storage backends with different constraints:
- Filesystem (Node.js): Cannot use `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`
- Cloudflare KV: Max 512 bytes, UTF-8 encoded
- Fastly Dictionary: ASCII only, max 255 bytes
- Google Cloud Storage: Prefers URL-safe characters

Current implementation uses problematic formats:
- Partition keys: `JSON.stringify([url, startKey, endKey])` contains quotes, brackets, colons
- Packument keys: Raw URLs like `https://registry.npmjs.com/@babel/core` contain colons, slashes

**Decision**: 
Implement standardized cache key format using hex encoding:
- Partition: `partition:{origin}:{hex(startKey)}:{hex(endKey)}`
- Packument: `packument:{origin}:{hex(packageName)}`

**Rationale**:
- **Universal Compatibility**: Hex encoding ensures ASCII-only keys work everywhere
- **Type Namespacing**: Prefixes prevent collisions between different object types
- **Origin Isolation**: Including origin allows per-registry cache management
- **Predictable Format**: Fixed structure simplifies debugging and tooling
- **Prefix Scanning**: Enables efficient listing operations where supported

**Implementation Example**:
```javascript
// Partition key for startKey="@" endKey="@a"
"partition:npm:40:4061"

// Packument key for "@babel/core"
"packument:npm:40626162656c2f636f7265"
```

**Consequences**:
- (+) Works reliably across all storage backends
- (+) No special character handling needed
- (+) Enables efficient prefix operations
- (+) Clear debugging - can identify key type at a glance
- (-) Hex encoding doubles key length
- (-) Requires migration from existing cache format
- (-) Less human-readable than raw strings

### Phase 2.5: Custom CacheEntry Implementation

Create our own CacheEntry implementation to replace the dependency on `@vltpkg/registry-client`.

#### 2.5.1 CacheEntry Implementation

```javascript
// src/cache/entry.js
/**
 * CacheEntry compatible with our caching needs
 * Handles HTTP cache semantics and response encoding/decoding
 */
export class CacheEntry {
  constructor(statusCode, headers, options = {}) {
    this.statusCode = statusCode;
    this.headers = this.normalizeHeaders(headers);
    this.options = options;
    this.body = null;
    this.integrity = null;
    this.hit = false;
  }

  normalizeHeaders(headers) {
    const normalized = {};
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        normalized[key.toLowerCase()] = value;
      });
    }
    return normalized;
  }

  setBody(body) {
    this.body = body;
    if (this.options.calculateIntegrity) {
      // Calculate integrity hash if needed
      const crypto = globalThis.crypto || require('crypto');
      const hash = crypto.createHash('sha256');
      hash.update(JSON.stringify(body));
      this.integrity = `sha256-${hash.digest('base64')}`;
    }
  }

  json() {
    return this.body;
  }

  get valid() {
    // Check cache validity based on cache-control headers
    const cacheControl = this.headers['cache-control'];
    const age = parseInt(this.headers['age'] || '0', 10);
    const maxAge = this.extractMaxAge(cacheControl);
    
    if (maxAge && age < maxAge) {
      return true;
    }
    
    // Check if we have an etag for conditional requests
    return !!this.etag;
  }

  get etag() {
    return this.headers['etag'];
  }

  extractMaxAge(cacheControl) {
    if (!cacheControl) return null;
    const match = cacheControl.match(/max-age=(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  encode() {
    return {
      statusCode: this.statusCode,
      headers: this.headers,
      body: this.body,
      integrity: this.integrity,
      timestamp: Date.now()
    };
  }

  static decode(data) {
    const entry = new CacheEntry(data.statusCode, data.headers);
    entry.body = data.body;
    entry.integrity = data.integrity;
    return entry;
  }
}
```

#### 2.5.2 Update Cache Package Exports

```javascript
// src/cache/index.js
export { Cache } from './cache.js';
export { BaseHTTPClient, createAgent } from './http.js';
export { CacheEntry } from './entry.js';
```
