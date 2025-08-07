import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { CloudflareStorageDriver } from '../drivers/cloudflare.js';
import { FastlyStorageDriver } from '../drivers/fastly.js';
import { GCSStorageDriver } from '../drivers/gcs.js';

// Mock KV namespace for Cloudflare
class MockKVNamespace {
  constructor() {
    this.store = new Map();
  }
  
  async get(key, options = {}) {
    const value = this.store.get(key);
    if (!value) return null;
    return value;
  }
  
  async put(key, value, options = {}) {
    const data = typeof value === 'string' ? JSON.parse(value) : value;
    this.store.set(key, data);
  }
  
  async delete(key) {
    this.store.delete(key);
  }
  
  list(options = {}) {
    const keys = Array.from(this.store.keys())
      .filter(k => !options.prefix || k.startsWith(options.prefix))
      .map(name => ({ name }));
    
    return {
      keys,
      async *[Symbol.asyncIterator]() {
        for (const key of keys) {
          yield key;
        }
      }
    };
  }
}

// Mock Dictionary for Fastly
class MockDictionary {
  constructor() {
    this.store = new Map();
  }
  
  async get(key) {
    return this.store.get(key) || null;
  }
  
  async set(key, value) {
    this.store.set(key, value);
  }
  
  async delete(key) {
    this.store.delete(key);
  }
}

describe('CloudflareStorageDriver', () => {
  let driver;
  let mockKV;

  beforeEach(() => {
    mockKV = new MockKVNamespace();
    driver = new CloudflareStorageDriver(mockKV);
  });

  it('should have correct properties', () => {
    assert.equal(driver.kv, mockKV);
    assert.equal(driver.supportsBatch, true);
    assert.equal(driver.supportsBloom, false);
  });

  it('should put and get values', async () => {
    const key = 'cf-test';
    const value = { cloudflare: true };
    
    await driver.put(key, value);
    const retrieved = await driver.get(key);
    
    assert.deepEqual(retrieved, value);
  });

  it('should handle missing keys', async () => {
    await assert.rejects(
      async () => await driver.get('missing'),
      /Key not found: missing/
    );
  });

  it('should check existence', async () => {
    const key = 'exists';
    
    assert.equal(await driver.has(key), false);
    
    await driver.put(key, { data: 'value' });
    assert.equal(await driver.has(key), true);
  });

  it('should list keys with prefix', async () => {
    await driver.put('test:1', { n: 1 });
    await driver.put('test:2', { n: 2 });
    await driver.put('other:3', { n: 3 });
    
    const keys = [];
    for await (const key of driver.list('test:')) {
      keys.push(key);
    }
    
    assert.equal(keys.length, 2);
    assert.ok(keys.includes('test:1'));
    assert.ok(keys.includes('test:2'));
  });

  it.skip('should handle batch operations', async () => {
    const entries = [
      { key: 'b1', value: { v: 1 } },
      { key: 'b2', value: { v: 2 } }
    ];
    
    await driver.putBatch(entries);
    
    const results = await driver.getBatch(['b1', 'b2', 'b3']);
    assert.equal(results.size, 2);
    assert.deepEqual(results.get('b1'), { v: 1 });
    assert.deepEqual(results.get('b2'), { v: 2 });
  });
});

describe('FastlyStorageDriver', () => {
  let driver;
  let mockDict;

  beforeEach(() => {
    mockDict = new MockDictionary();
    driver = new FastlyStorageDriver(mockDict);
  });

  it('should have correct properties', () => {
    assert.equal(driver.dict, mockDict);
    assert.equal(driver.supportsBatch, false);
    assert.equal(driver.supportsBloom, false);
  });

  it('should put and get values', async () => {
    const key = 'fastly-test';
    const value = { compute: 'edge' };
    
    await driver.put(key, value);
    const retrieved = await driver.get(key);
    
    assert.deepEqual(retrieved, value);
  });

  it('should handle complex objects', async () => {
    const key = 'complex';
    const value = {
      nested: {
        array: [1, 2, { deep: true }],
        date: new Date().toISOString()
      }
    };
    
    await driver.put(key, value);
    const retrieved = await driver.get(key);
    
    assert.deepEqual(retrieved, value);
  });

  it.skip('should throw on unsupported operations', async () => {
    await assert.rejects(
      async () => {
        for await (const key of driver.list('prefix')) {
          // Should not reach here
        }
      },
      /List operation not supported/
    );
    
    await assert.rejects(
      async () => await driver.getBatch(['k1', 'k2']),
      /Batch operations not supported/
    );
    
    await assert.rejects(
      async () => await driver.putBatch([]),
      /Batch operations not supported/
    );
  });
});

describe('GCSStorageDriver', () => {
  let driver;

  beforeEach(() => {
    // Mock minimal GCS functionality
    const mockBucket = {
      file: (name) => ({
        name,
        download: async () => [{
          toString: () => JSON.stringify({ gcs: true, name })
        }],
        save: async (data) => {},
        delete: async () => {},
        exists: async () => [true],
        getFiles: async (options) => [[]]
      }),
      getFiles: async (options) => [[]]
    };
    
    driver = new GCSStorageDriver('test-bucket');
    driver.bucket = mockBucket;
  });

  it.skip('should have correct properties', () => {
    assert.equal(driver.bucketName, 'test-bucket');
    assert.equal(driver.supportsBatch, true);
    assert.equal(driver.supportsBloom, true);
  });

  it.skip('should normalize cache paths', () => {
    assert.equal(driver.normalizePath('key'), 'cache/key');
    assert.equal(driver.normalizePath('/key'), 'cache/key');
    assert.equal(driver.normalizePath('//key'), 'cache/key');
  });

  it.skip('should get values from GCS', async () => {
    const result = await driver.get('test-key');
    assert.deepEqual(result, { gcs: true, name: 'cache/test-key' });
  });

  it.skip('should handle put operations', async () => {
    // Should not throw
    await driver.put('new-key', { data: 'value' });
  });

  it.skip('should check existence', async () => {
    const exists = await driver.has('any-key');
    assert.equal(exists, true);
  });
});

// Test factory function
describe('createStorageDriver', () => {
  it('should create appropriate driver based on runtime', async () => {
    const { createStorageDriver } = await import('../index.js');
    
    // Test Node.js driver
    const nodeDriver = await createStorageDriver({
      RUNTIME: 'node',
      CACHE_DIR: '/tmp/test'
    });
    assert.ok(nodeDriver.constructor.name === 'NodeStorageDriver');
    
    // Test Cloudflare driver
    const cfDriver = await createStorageDriver({
      RUNTIME: 'cloudflare',
      CACHE_KV: new MockKVNamespace()
    });
    assert.ok(cfDriver.constructor.name === 'CloudflareStorageDriver');
    
    // Test unsupported runtime
    await assert.rejects(
      async () => await createStorageDriver({ RUNTIME: 'unknown' }),
      /Unsupported runtime: unknown/
    );
  });
});