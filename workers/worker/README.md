# @_all_docs/worker

Edge-compatible worker implementation for processing npm registry data across multiple runtime environments.

## Overview

This package provides a Hono-based HTTP worker that can run on:
- Node.js
- Cloudflare Workers
- Fastly Compute@Edge  
- Google Cloud Run

## Installation

```sh
pnpm add @_all_docs/worker
```

## Usage

### Node.js

```js
import { serve } from '@hono/node-server';
import { app } from '@_all_docs/worker/app';

serve({
  fetch: app.fetch,
  port: 3141
});
```

### Cloudflare Workers

```js
import { app } from '@_all_docs/worker/app';

export default {
  fetch: app.fetch
};
```

### Processors

The worker includes three processors for different work item types:

```js
import { 
  processPartition, 
  processPackument, 
  processPartitionSet 
} from '@_all_docs/worker/processors';

// Process a partition of _all_docs
const result = await processPartition(workItem, env);

// Process a package document
const result = await processPackument(workItem, env);

// Process a set of partitions
const result = await processPartitionSet(workItem, env, enqueueFunc);
```

## Environment Variables

- `NPM_ORIGIN` - npm registry origin (default: `https://registry.npmjs.org`)
- `RUNTIME` - Runtime environment (`node`, `cloudflare`, `fastly`, `cloudrun`)
- `CACHE_DIR` - Cache directory for Node.js
- `CACHE_KV` - KV namespace for Cloudflare
- `CACHE_DICT` - Dictionary for Fastly
- `CACHE_BUCKET` - GCS bucket for Cloud Run
- `DEBUG` - Enable debug output

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /work` - Submit work items for processing
- `GET /work/:id` - Get work item status

## Structure

```
worker/
├── app.js          # Main Hono application
├── node.js         # Node.js entry point
├── cloudflare.js   # Cloudflare Workers entry
├── fastly.js       # Fastly Compute@Edge entry
├── processors/     # Work item processors
│   ├── partition.js
│   ├── packument.js
│   └── partition-set.js
└── test/           # Test files
```

## Building

```sh
# Build for all targets
pnpm build

# Build for Cloudflare Workers
pnpm build:cf

# Build for Fastly Compute@Edge
pnpm build:fastly

# Build Docker image for Cloud Run
pnpm docker:build
```

## Testing

```sh
pnpm test
```

## Docker Support

Run as a containerized service:

```sh
# Build image
pnpm docker:build

# Run locally
pnpm docker:run

# Test the container
pnpm docker:test
```

## License

Apache-2.0