# @_all_docs/queue

Multi-runtime work queue implementations for distributed npm registry processing.

## Overview

This package provides different queue implementations optimized for various deployment scenarios:
- **LocalWorkQueue** - In-process queue using p-queue
- **DistributedWorkQueue** - Redis-backed queue using BullMQ
- **EdgeWorkQueue** - Edge runtime queue for Cloudflare/Fastly

## Installation

```sh
pnpm add @_all_docs/queue
```

## Usage

### Local Queue

Best for single-process deployments or development:

```js
import { LocalWorkQueue } from '@_all_docs/queue';

const queue = new LocalWorkQueue({
  concurrency: 10,
  requestsPerSecond: 20
});

// Add workers
queue.workers.set('main', myWorker);

// Add work
const result = await queue.addWork({
  type: 'partition',
  id: 'work-1',
  payload: { startKey: 'a', endKey: 'b' },
  priority: 1
});
```

### Distributed Queue

For multi-process deployments with Redis:

```js
import { DistributedWorkQueue } from '@_all_docs/queue';

const queue = new DistributedWorkQueue({
  redisHost: 'localhost',
  redisPort: 6379
});

// Add work
const jobId = await queue.addWork(workItem);

// Create worker process
const worker = queue.createWorker(async (item) => {
  // Process work item
  return result;
}, {
  concurrency: 10,
  requestsPerSecond: 20
});
```

### Edge Queue

For edge runtime environments:

```js
import { EdgeWorkQueue } from '@_all_docs/queue';

const queue = new EdgeWorkQueue(env);

// Cloudflare uses Durable Objects
// Fastly uses Fanout pub/sub
await queue.addWork(workItem);
```

## Work Item Structure

```js
{
  type: 'partition' | 'packument' | 'partition-set',
  id: 'unique-id',
  payload: {
    // Type-specific data
  },
  priority: 1, // Higher = more important
  attempts: 0
}
```

## Features

- **Rate limiting** - Configurable requests per second
- **Retries** - Automatic retry with exponential backoff
- **Priority** - Process important items first
- **Concurrency control** - Limit parallel operations
- **Error handling** - Special handling for rate limit errors

## Testing

```sh
pnpm test
```

## License

Apache-2.0