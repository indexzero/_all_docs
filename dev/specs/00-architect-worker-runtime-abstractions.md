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

Create a new `@_all_docs/worker` package in the monorepo to isolate worker functionality and minimize bundle sizes for edge deployments.

**Benefits of separate package:**
- Reduced bundle sizes for edge deployments (only worker code is bundled)
- Independent versioning and deployment
- Clear separation of concerns
- Easier to test worker functionality in isolation
- Can be published to npm separately if needed

#### 0.1 Monorepo Structure

```
_all_docs/
├── src/
│   ├── cache/         # @_all_docs/cache
│   ├── config/        # @_all_docs/config
│   ├── exec/          # @_all_docs/exec
│   ├── frame/         # @_all_docs/frame
│   ├── packument/     # @_all_docs/packument
│   └── partition/     # @_all_docs/partition
├── cli/
│   └── cli/           # @_all_docs/cli
├── workers/
│   └── worker/        # @_all_docs/worker (NEW)
│       ├── package.json
│       ├── index.js
│       ├── app.js
│       ├── http/
│       ├── storage/
│       ├── queue/
│       ├── clients/
│       ├── processors/
│       └── runtime/
└── pnpm-workspace.yaml
```

#### 0.2 Worker Package Configuration

```json
// workers/worker/package.json
{
  "name": "@_all_docs/worker",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./index.js",
    "./app": "./app.js",
    "./http": "./http/index.js",
    "./storage": "./storage/index.js",
    "./queue": "./queue/index.js",
    "./processors": "./processors/index.js",
    "./runtime": "./runtime/index.js"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "p-queue": "catalog:",
    "bullmq": "^5.0.0",
    "p-retry": "^6.0.0"
  },
  "devDependencies": {
    "unenv": "^1.9.0",
    "unbuild": "^2.0.0",
    "@hono/node-server": "^1.0.0"
  },
  "peerDependencies": {
    "@_all_docs/partition": "workspace:*",
    "@_all_docs/packument": "workspace:*"
  },
  "scripts": {
    "build": "unbuild",
    "build:cf": "unbuild --preset cloudflare",
    "build:fastly": "unbuild --preset fastly"
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

#### 0.4 Main Worker Package Export

```javascript
// workers/worker/index.js
export { default as app } from './app.js';
export * from './http/index.js';
export * from './storage/index.js';
export * from './queue/index.js';
export * from './processors/index.js';
export * from './runtime/index.js';

// Re-export key types
export * from './types.js';
```

```javascript
// workers/worker/types.js
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

/**
 * @typedef {Object} WorkResult
 * @property {string} workItemId
 * @property {boolean} success
 * @property {Object} [data] - Result data if successful
 * @property {Error} [error] - Error if failed
 * @property {number} duration - Processing time in ms
 * @property {Object} [metrics] - Optional performance metrics
 */

export const WorkItemTypes = {
  PARTITION_SET: 'partition-set',
  PARTITION: 'partition',
  PACKUMENT: 'packument'
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

### Phase 2: Abstraction Layers for HTTP and Storage

Create abstractions that allow the existing codebase to work across different runtimes by providing unified interfaces for HTTP requests and storage.

#### 2.1 HTTP Client Abstraction

Replace direct `undici` usage with a fetch-based abstraction that maintains API compatibility:

```javascript
// workers/worker/http/client.js
/**
 * HTTPClient abstraction that wraps native fetch API
 * Provides undici-compatible interface for existing code
 */
export class HTTPClient {
  constructor(origin) {
    this.origin = origin;
  }

  /**
   * @param {string} path
   * @param {Object} options
   * @returns {Promise<Response>}
   */
  async request(path, options = {}) {
    const url = new URL(path, this.origin);
    
    // Map undici-style options to fetch
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
    // Convert various header formats to Headers object
    return new Headers(headers);
  }

  headersToObject(headers) {
    const obj = {};
    headers.forEach((value, key) => {
      obj[key.toLowerCase()] = value;
    });
    return obj;
  }
}

// Factory function to create client based on environment
export function createHTTPClient(origin, env) {
  if (env.RUNTIME === 'node' && globalThis.undici) {
    // In Node.js, we can still use undici directly
    const { Client } = await import('undici');
    return new Client(origin);
  }
  
  // For edge runtimes, use our fetch-based client
  return new HTTPClient(origin);
}
```

#### 2.2 Storage Abstraction

Create a unified storage interface that works with filesystem (Node.js) and KV stores (edge):

```javascript
// workers/worker/storage/interface.js
/**
 * @typedef {Object} StorageAdapter
 * @property {(key: string) => Promise<any>} get
 * @property {(key: string, value: any, options?: Object) => Promise<void>} put
 * @property {(key: string) => Promise<boolean>} has
 * @property {(key: string) => Promise<void>} delete
 * @property {(prefix: string) => AsyncIterator<string>} list
 */

// workers/worker/storage/node.js
import { readFile, writeFile, access, unlink, readdir } from 'fs/promises';
import { join } from 'path';

export class NodeStorageAdapter {
  constructor(basePath) {
    this.basePath = basePath;
  }

  async get(key) {
    const path = join(this.basePath, `${key}.json`);
    const content = await readFile(path, 'utf8');
    return JSON.parse(content);
  }

  async put(key, value) {
    const path = join(this.basePath, `${key}.json`);
    await writeFile(path, JSON.stringify(value));
  }

  async has(key) {
    const path = join(this.basePath, `${key}.json`);
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key) {
    const path = join(this.basePath, `${key}.json`);
    await unlink(path);
  }

  async *list(prefix) {
    const files = await readdir(this.basePath);
    for (const file of files) {
      if (file.startsWith(prefix) && file.endsWith('.json')) {
        yield file.slice(0, -5); // Remove .json extension
      }
    }
  }
}

// workers/worker/storage/cloudflare.js
export class CloudflareStorageAdapter {
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

// workers/worker/storage/gcs.js
import { Storage } from '@google-cloud/storage';

export class GCSStorageAdapter {
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

// workers/worker/storage/factory.js
export function createStorageAdapter(env) {
  switch (env.RUNTIME) {
    case 'node':
      return new NodeStorageAdapter(env.CACHE_DIR);
    case 'cloudflare':
      return new CloudflareStorageAdapter(env.CACHE_KV);
    case 'fastly':
      return new FastlyStorageAdapter(env.CACHE_DICT);
    case 'cloudrun':
      // Cloud Run can use GCS or local filesystem
      if (env.CACHE_BUCKET) {
        return new GCSStorageAdapter(env.CACHE_BUCKET);
      }
      return new NodeStorageAdapter(env.CACHE_DIR || '/tmp/cache');
    default:
      throw new Error(`Unsupported runtime: ${env.RUNTIME}`);
  }
}
```

### Phase 3: Work Distribution with Queue Libraries

Use existing npm packages for work distribution instead of building from scratch. Different strategies for different deployment scenarios.

#### 3.1 Local Development & Single Region (p-queue)

For local development and single-region deployments, use `p-queue` for in-memory queue management:

```javascript
// workers/worker/queue/local.js
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

#### 3.2 Production Multi-Region (BullMQ)

For production deployments with Redis, use BullMQ for distributed work queues:

```javascript
// workers/worker/queue/distributed.js
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

#### 3.3 Edge-Native Work Distribution

For edge deployments without Redis, use Cloudflare Durable Objects or Fastly's real-time messaging:

```javascript
// workers/worker/queue/edge.js
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

### Phase 4: Adapting Existing Clients for Edge Runtimes

Modify the existing `PartitionClient` and registry clients to work with our abstractions.

#### 4.1 Edge-Compatible Partition Client

Adapt the existing partition client to use our HTTP and storage abstractions:

```javascript
// workers/worker/clients/partition.js
import { createHTTPClient } from '../http/client.js';
import { createStorageAdapter } from '../storage/factory.js';

export class EdgePartitionClient {
  constructor(options = {}) {
    this.origin = options.origin || 'https://replicate.npmjs.com';
    this.env = options.env;
    this.http = createHTTPClient(this.origin, this.env);
    this.storage = createStorageAdapter(this.env);
  }

  /**
   * Fetch partition data with caching
   * @param {Object} partition
   * @param {string} partition.startKey
   * @param {string} partition.endKey
   * @returns {Promise<Object>}
   */
  async fetchPartition(partition) {
    const cacheKey = this.getCacheKey(partition);
    
    // Check cache first
    try {
      const cached = await this.storage.get(cacheKey);
      if (cached && this.isFresh(cached)) {
        return cached;
      }
    } catch (err) {
      // Cache miss is ok
    }
    
    // Build URL with query parameters
    const params = new URLSearchParams();
    if (partition.startKey) {
      params.set('startkey', JSON.stringify(partition.startKey));
    }
    if (partition.endKey) {
      params.set('endkey', JSON.stringify(partition.endKey));
    }
    params.set('limit', '10000');
    
    const path = `/_all_docs?${params}`;
    const response = await this.http.request(path);
    
    if (response.statusCode === 304) {
      // Not modified, return cached version
      return await this.storage.get(cacheKey);
    }
    
    if (response.statusCode !== 200) {
      throw new Error(`HTTP ${response.statusCode}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Cache the result
    await this.storage.put(cacheKey, {
      data,
      etag: response.headers.etag,
      timestamp: Date.now(),
    });
    
    return data;
  }

  getCacheKey(partition) {
    // Compatible with existing cache key format
    const start = partition.startKey || 'null';
    const end = partition.endKey || 'null';
    return `${start}__${end}`;
  }

  isFresh(cached, maxAge = 3600000) {
    return Date.now() - cached.timestamp < maxAge;
  }
}
```

#### 4.2 Edge-Compatible Registry Client

Create a minimal registry client that extends the abstracted base:

```javascript
// workers/worker/clients/registry.js
import { createHTTPClient } from '../http/client.js';

export class EdgeRegistryClient {
  constructor(options = {}) {
    this.origin = options.origin || 'https://registry.npmjs.org';
    this.env = options.env;
    this.http = createHTTPClient(this.origin, this.env);
  }

  /**
   * Fetch a packument with proper headers
   * @param {string} name - Package name
   * @returns {Promise<Object>}
   */
  async getPackument(name) {
    const headers = {
      'Accept': 'application/vnd.npm.install-v1+json',
      'Accept-Encoding': 'gzip',
    };
    
    const response = await this.http.request(`/${name}`, { headers });
    
    if (response.statusCode === 404) {
      return null;
    }
    
    if (response.statusCode !== 200) {
      throw new Error(`HTTP ${response.statusCode}: ${response.statusText}`);
    }
    
    return await response.json();
  }
}
```

### Phase 5: Build Configuration with unenv

Use `unenv` to provide Node.js API polyfills at build time for edge runtimes. This configuration is now part of the `@_all_docs/worker` package.

#### 5.1 Build Configuration

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
    '@vltpkg/registry-client',
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

#### 5.2 Runtime Detection and Polyfills

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

### Phase 6: Integration with Existing Codebase

Adapt the existing commands to use the worker infrastructure.

#### 6.1 Worker Processing Functions

```javascript
// workers/worker/processors/partition.js
import { EdgePartitionClient } from '../clients/partition.js';
import { createStorageAdapter } from '../storage/factory.js';

/**
 * Process a partition work item
 * @param {WorkItem} workItem
 * @param {WorkerEnv} env
 * @returns {Promise<WorkResult>}
 */
export async function processPartition(workItem, env) {
  const start = Date.now();
  
  try {
    const client = new EdgePartitionClient({ env });
    const partition = workItem.payload;
    
    // Fetch the partition data
    const result = await client.fetchPartition(partition);
    
    return {
      workItemId: workItem.id,
      success: true,
      data: {
        partition,
        rowCount: result.data.rows.length,
        cached: result.fromCache || false,
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
import { EdgeRegistryClient } from '../clients/registry.js';

/**
 * Process a packument work item
 * @param {WorkItem} workItem
 * @param {WorkerEnv} env
 * @returns {Promise<WorkResult>}
 */
export async function processPackument(workItem, env) {
  const start = Date.now();
  
  try {
    const client = new EdgeRegistryClient({ env });
    const { packageName } = workItem.payload;
    
    // Fetch the packument
    const packument = await client.getPackument(packageName);
    
    // Store in cache
    const storage = createStorageAdapter(env);
    await storage.put(`packument:${packageName}`, packument);
    
    return {
      workItemId: workItem.id,
      success: true,
      data: {
        packageName,
        versions: Object.keys(packument.versions || {}).length,
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

#### 6.2 CLI Integration

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

### Phase 7: Deployment Configuration

The `@_all_docs/worker` package can be built and deployed independently, reducing bundle sizes for edge deployments.

#### 7.1 Building for Different Targets

```bash
# From the workers/worker directory

# Build for all targets
pnpm build

# Build specifically for Cloudflare Workers
pnpm build:cf

# Build specifically for Fastly Compute
pnpm build:fastly
```

#### 7.2 Cloudflare Workers (wrangler.toml)

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

#### 7.3 Google Cloud Run Deployment

Google Cloud Run uses containerized applications, so we'll use the Node.js runtime packaged in a Docker container.

##### 7.3.1 Dockerfile for Cloud Run

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

##### 7.3.2 Cloud Run Service Configuration

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

##### 7.3.3 Deployment Commands

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

#### 7.4 Docker Compose for Local Development

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

### Phase 8: Implementation Roadmap

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

1. **Use Existing NPM Packages**: Leverage Hono, unenv, BullMQ instead of building from scratch
2. **Maintain Compatibility**: Abstractions preserve existing code structure and APIs
3. **Progressive Enhancement**: Start with Node.js, add edge runtimes incrementally
4. **No Build Step for Development**: Use native ES modules, build only for edge deployment
5. **Flexible Queue Strategy**: Different queue implementations for different deployment scenarios
6. **Container Support**: Google Cloud Run provides a middle ground between edge and traditional deployment
