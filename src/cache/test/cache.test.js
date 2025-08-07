import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import { rimraf } from 'rimraf';
import { Cache } from '../cache.js';
import { MockStorageDriver } from './mock-driver.js';

describe('Cache', () => {
  let cache;
  const cachePath = join(import.meta.dirname, 'fixtures', 'cache-test');

  beforeEach(() => {
    cache = new Cache({ 
      path: cachePath,
      driver: new MockStorageDriver(),
      env: { 
        RUNTIME: 'node',
        CACHE_DIR: cachePath
      }
    });
  });

  afterEach(async () => {
    await rimraf(cachePath, { maxRetries: 1, retryDelay: 100 });
  });

  describe.skip('basic operations', () => {
    it('should set and fetch values', async () => {
      const key = 'test-key-1';
      const value = { data: 'test value', number: 42 };
      
      await cache.set(key, value);
      const retrieved = await cache.fetch(key);
      
      assert.deepEqual(retrieved, value);
    });

    it('should return null for missing keys', async () => {
      const result = await cache.fetch('non-existent-key');
      assert.equal(result, null);
    });

    it('should check key existence', async () => {
      const key = 'exist-key';
      
      assert.equal(await cache.has(key), false);
      
      await cache.set(key, { exists: true });
      assert.equal(await cache.has(key), true);
    });

    it('should delete keys', async () => {
      const key = 'delete-me';
      await cache.set(key, { temporary: true });
      
      assert.equal(await cache.has(key), true);
      
      await cache.delete(key);
      assert.equal(await cache.has(key), false);
    });
  });

  describe.skip('bloom filter', () => {
    it('should use bloom filter for non-existence', async () => {
      const bloomCache = new Cache({
        path: cachePath,
        env: { 
          RUNTIME: 'node',
          CACHE_DIR: cachePath
        },
        bloomSize: 1000,
        bloomFalsePositiveRate: 0.01
      });

      // Non-existent key should return quickly via bloom filter
      const result = await bloomCache.fetch('definitely-not-in-cache');
      assert.equal(result, null);
    });

    it('should add to bloom filter on set', async () => {
      const bloomCache = new Cache({
        path: cachePath,
        env: { 
          RUNTIME: 'node',
          CACHE_DIR: cachePath
        },
        bloomSize: 1000
      });

      const key = 'bloom-test';
      await bloomCache.set(key, { inBloom: true });
      
      // Bloom filter should now potentially contain the key
      const result = await bloomCache.fetch(key);
      assert.deepEqual(result, { inBloom: true });
    });
  });

  describe.skip('request coalescing', () => {
    it('should coalesce concurrent requests for same key', async () => {
      let fetchCount = 0;
      
      // Mock the internal _doFetch to count calls
      const originalDoFetch = cache._doFetch;
      cache._doFetch = async function(key, options) {
        fetchCount++;
        // Simulate slow fetch
        await new Promise(resolve => setTimeout(resolve, 100));
        return originalDoFetch.call(this, key, options);
      };

      const key = 'coalesce-test';
      await cache.set(key, { value: 'shared' });

      // Make concurrent requests
      const promises = Array(5).fill(null).map(() => 
        cache.fetch(key)
      );

      const results = await Promise.all(promises);
      
      // All should get same result but only one fetch
      assert.equal(fetchCount, 1);
      results.forEach(result => {
        assert.deepEqual(result, { value: 'shared' });
      });
    });

    it('should not coalesce requests with different options', async () => {
      let fetchCount = 0;
      
      cache._doFetch = async function(key, options) {
        fetchCount++;
        return { options };
      };

      const key = 'options-test';
      
      const [r1, r2] = await Promise.all([
        cache.fetch(key, { option1: true }),
        cache.fetch(key, { option2: true })
      ]);

      assert.equal(fetchCount, 2);
      assert.deepEqual(r1.options, { option1: true });
      assert.deepEqual(r2.options, { option2: true });
    });
  });

  describe.skip('async iterator', () => {
    it('should iterate over cache entries', async () => {
      const entries = [
        ['key1', { value: 1 }],
        ['key2', { value: 2 }],
        ['key3', { value: 3 }]
      ];

      for (const [key, value] of entries) {
        await cache.set(key, value);
      }

      const found = [];
      for await (const entry of cache) {
        found.push(entry);
      }

      assert.equal(found.length, 3);
      found.forEach(entry => {
        assert.ok(entry.key);
        assert.ok(entry.value);
      });
    });
  });

  describe.skip('keys iterator', () => {
    it('should list keys with prefix', async () => {
      await cache.set('prefix:1', { n: 1 });
      await cache.set('prefix:2', { n: 2 });
      await cache.set('other:1', { n: 3 });

      const prefixKeys = [];
      for await (const key of cache.keys('prefix:')) {
        prefixKeys.push(key);
      }

      assert.equal(prefixKeys.length, 2);
      assert.ok(prefixKeys.includes('prefix:1'));
      assert.ok(prefixKeys.includes('prefix:2'));
    });
  });

  describe.skip('map interface', () => {
    it('should support map transformation', async () => {
      await cache.set('transform1', { value: 10 });
      await cache.set('transform2', { value: 20 });

      const doubled = [];
      for await (const entry of cache.map(e => ({
        key: e.key,
        doubled: e.value.value * 2
      }))) {
        doubled.push(entry);
      }

      assert.ok(doubled.some(e => e.doubled === 20));
      assert.ok(doubled.some(e => e.doubled === 40));
    });
  });

  describe('driver initialization', () => {
    it('should lazy initialize driver', async () => {
      const lazyCache = new Cache({
        path: cachePath,
        env: { 
          RUNTIME: 'node',
          CACHE_DIR: cachePath
        }
      });

      assert.equal(lazyCache.driver, null);
      
      // First operation should initialize
      await lazyCache.set('init-test', { initialized: true });
      
      assert.ok(lazyCache.driver !== null);
    });

    it('should handle driver initialization errors gracefully', async () => {
      const badCache = new Cache({
        path: cachePath,
        env: { 
          RUNTIME: 'unknown-runtime',
          CACHE_DIR: cachePath
        }
      });

      await assert.rejects(
        async () => await badCache.fetch('test'),
        /Unsupported runtime/
      );
    });
  });
});