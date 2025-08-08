import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { CloudflareStorageDriver } from '../storage.js';

// Mock KV namespace for testing
class MockKVNamespace {
  constructor() {
    this.store = new Map();
  }
  
  async get(key, options = {}) {
    const value = this.store.get(key);
    if (!value) return null;
    
    if (options === 'json' || options.type === 'json') {
      return JSON.parse(value);
    }
    return value;
  }
  
  async put(key, value, options = {}) {
    this.store.set(key, value);
  }
  
  async delete(key) {
    this.store.delete(key);
  }
  
  async list(options = {}) {
    const { prefix = '', cursor, limit = 1000 } = options;
    const keys = Array.from(this.store.keys())
      .filter(k => k.startsWith(prefix))
      .sort();
    
    // Simple pagination mock
    const start = cursor ? parseInt(cursor) : 0;
    const end = start + limit;
    const batch = keys.slice(start, end);
    
    return {
      keys: batch.map(name => ({ name })),
      cursor: end < keys.length ? String(end) : undefined
    };
  }
}

describe('CloudflareStorageDriver', () => {
  let kv;
  let storage;
  
  beforeEach(() => {
    kv = new MockKVNamespace();
    storage = new CloudflareStorageDriver(kv);
  });
  
  it('should store and retrieve values', async () => {
    await storage.put('test-key', { data: 'test-value' });
    const value = await storage.get('test-key');
    assert.deepEqual(value, { data: 'test-value' });
  });
  
  it('should handle missing keys', async () => {
    await assert.rejects(
      () => storage.get('non-existent'),
      /Key not found/
    );
  });
  
  it('should check key existence', async () => {
    await storage.put('exists', { value: true });
    
    assert.equal(await storage.has('exists'), true);
    assert.equal(await storage.has('not-exists'), false);
  });
  
  it('should delete keys', async () => {
    await storage.put('to-delete', { value: 'data' });
    assert.equal(await storage.has('to-delete'), true);
    
    await storage.delete('to-delete');
    assert.equal(await storage.has('to-delete'), false);
  });
  
  it('should list keys with prefix', async () => {
    await storage.put('prefix:key1', { value: 1 });
    await storage.put('prefix:key2', { value: 2 });
    await storage.put('other:key3', { value: 3 });
    
    const keys = [];
    for await (const key of storage.list('prefix:')) {
      keys.push(key);
    }
    
    assert.deepEqual(keys.sort(), ['prefix:key1', 'prefix:key2']);
  });
  
  it('should handle batch operations', async () => {
    const keys = ['batch1', 'batch2', 'batch3'];
    const entries = keys.map((key, i) => ({
      key,
      value: { index: i }
    }));
    
    // Put batch
    await storage.putBatch(entries);
    
    // Get batch
    const results = await storage.getBatch(keys);
    assert.equal(results.size, 3);
    assert.deepEqual(results.get('batch1'), { index: 0 });
    assert.deepEqual(results.get('batch2'), { index: 1 });
    assert.deepEqual(results.get('batch3'), { index: 2 });
  });
});