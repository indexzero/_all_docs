# @_all_docs/storage

Cross-runtime storage driver abstraction for caching npm registry data.

## Overview

This package provides a unified storage interface that works across different runtime environments:
- **Node.js** - Uses npm's cacache for content-addressable storage
- **Cloudflare Workers** - Uses KV namespace
- **Fastly Compute@Edge** - Uses Edge Dictionary
- **Google Cloud Run** - Uses Cloud Storage buckets

## Installation

```sh
pnpm add @_all_docs/storage
```

## Usage

### Automatic Driver Selection

```js
import { createStorageDriver } from '@_all_docs/storage';

const driver = await createStorageDriver({
  RUNTIME: 'node',
  CACHE_DIR: '/path/to/cache'
});

// Use the driver
await driver.put('key', { data: 'value' });
const value = await driver.get('key');
```

### Node.js Driver

```js
import { NodeStorageDriver } from '@_all_docs/storage/drivers/node';

const driver = new NodeStorageDriver('/path/to/cache');

// Content-addressable storage with integrity checking
const info = await driver.put('key', data);
console.log(info.integrity); // sha512-...
```

### Cloudflare KV Driver

```js
import { CloudflareStorageDriver } from '@_all_docs/storage/drivers/cloudflare';

const driver = new CloudflareStorageDriver(env.CACHE_KV);

// Works with Cloudflare KV namespace
await driver.put('key', data);
```

### Storage Driver Interface

All drivers implement this interface:

```js
{
  // Basic operations
  async get(key) { },
  async put(key, value, options) { },
  async has(key) { },
  async delete(key) { },
  
  // Iteration
  async *list(prefix) { },
  
  // Batch operations (if supported)
  async getBatch(keys) { },
  async putBatch(entries) { },
  
  // Capabilities
  supportsBatch: boolean,
  supportsBloom: boolean
}
```

## Features

### Node.js Driver
- Content-addressable storage using cacache
- Automatic integrity verification
- Retry logic with exponential backoff
- Batch operations support
- Bloom filter support

### Cloudflare Driver
- Direct KV namespace integration
- JSON serialization/deserialization
- Batch operations via KV bulk API
- Prefix-based listing

### Fastly Driver
- Edge Dictionary support
- JSON value handling
- Single-key operations only

### GCS Driver
- Google Cloud Storage bucket integration
- Normalized path handling
- Batch operations support
- Bloom filter support

## Environment Configuration

```js
// Node.js
{ RUNTIME: 'node', CACHE_DIR: '/path/to/cache' }

// Cloudflare
{ RUNTIME: 'cloudflare', CACHE_KV: kvNamespace }

// Fastly
{ RUNTIME: 'fastly', CACHE_DICT: dictionary }

// Cloud Run with GCS
{ RUNTIME: 'cloudrun', CACHE_BUCKET: 'bucket-name' }

// Cloud Run with local storage
{ RUNTIME: 'cloudrun', CACHE_DIR: '/tmp/cache' }
```

## Testing

```sh
pnpm test
```

## License

Apache-2.0