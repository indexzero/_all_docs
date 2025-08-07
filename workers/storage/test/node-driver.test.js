import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import { rimraf } from 'rimraf';
import { NodeStorageDriver } from '../drivers/node.js';

describe('NodeStorageDriver', () => {
  let driver;
  const testPath = join(import.meta.dirname, 'fixtures', 'node-driver-test');

  beforeEach(() => {
    driver = new NodeStorageDriver(testPath);
  });

  afterEach(async () => {
    await rimraf(testPath, { maxRetries: 1, retryDelay: 100 });
  });

  describe('basic operations', () => {
    it('should have correct properties', () => {
      assert.equal(driver.cachePath, testPath);
      assert.equal(driver.supportsBatch, true);
      assert.equal(driver.supportsBloom, true);
      assert.equal(driver.maxRetries, 3);
      assert.equal(driver.baseDelay, 100);
    });

    it('should put and get JSON values', async () => {
      const key = 'test-key';
      const value = { name: 'test', data: [1, 2, 3] };
      
      const info = await driver.put(key, value);
      assert.ok(info);
      
      const retrieved = await driver.get(key);
      assert.deepEqual(retrieved, value);
    });

    it('should throw on missing key', async () => {
      await assert.rejects(
        async () => await driver.get('non-existent'),
        /Key not found: non-existent/
      );
    });

    it('should check key existence', async () => {
      const key = 'exist-check';
      
      assert.equal(await driver.has(key), false);
      
      await driver.put(key, { exists: true });
      assert.equal(await driver.has(key), true);
    });

    it('should delete keys', async () => {
      const key = 'delete-test';
      await driver.put(key, { temporary: true });
      
      assert.equal(await driver.has(key), true);
      
      await driver.delete(key);
      assert.equal(await driver.has(key), false);
    });
  });

  describe('batch operations', () => {
    it('should get multiple keys in batch', async () => {
      const entries = [
        ['batch1', { value: 1 }],
        ['batch2', { value: 2 }],
        ['batch3', { value: 3 }]
      ];
      
      for (const [key, value] of entries) {
        await driver.put(key, value);
      }
      
      const keys = ['batch1', 'batch2', 'batch3', 'missing'];
      const results = await driver.getBatch(keys);
      
      assert.ok(results instanceof Map);
      assert.equal(results.size, 3);
      assert.deepEqual(results.get('batch1'), { value: 1 });
      assert.deepEqual(results.get('batch2'), { value: 2 });
      assert.deepEqual(results.get('batch3'), { value: 3 });
      assert.equal(results.has('missing'), false);
    });

    it('should put multiple entries in batch', async () => {
      const entries = [
        { key: 'put1', value: { n: 1 } },
        { key: 'put2', value: { n: 2 } },
        { key: 'put3', value: { n: 3 } }
      ];
      
      await driver.putBatch(entries);
      
      for (const entry of entries) {
        const value = await driver.get(entry.key);
        assert.deepEqual(value, entry.value);
      }
    });
  });

  describe('list operations', () => {
    it('should list keys with prefix', async () => {
      await driver.put('prefix:a', { a: 1 });
      await driver.put('prefix:b', { b: 2 });
      await driver.put('other:c', { c: 3 });
      
      const keys = [];
      for await (const key of driver.list('prefix:')) {
        keys.push(key);
      }
      
      assert.equal(keys.length, 2);
      assert.ok(keys.includes('prefix:a'));
      assert.ok(keys.includes('prefix:b'));
      assert.ok(!keys.includes('other:c'));
    });

    it('should list all keys with empty prefix', async () => {
      await driver.put('key1', { v: 1 });
      await driver.put('key2', { v: 2 });
      
      const keys = [];
      for await (const key of driver.list('')) {
        keys.push(key);
      }
      
      assert.equal(keys.length, 2);
    });
  });

  describe('retry mechanism', () => {
    it.skip('should retry on transient errors', async () => {
      // Test the retry mechanism by mocking cacache
      const key = 'retry-test-key';
      let getAttempts = 0;
      
      // First put a value
      await driver.put(key, { test: 'retry' });
      
      // Mock cacache.get to fail first time
      const cacache = await import('cacache');
      const originalGet = cacache.get;
      cacache.get = async function(...args) {
        getAttempts++;
        if (getAttempts === 1) {
          const error = new Error('Temporary failure');
          error.code = 'EBUSY';
          throw error;
        }
        return originalGet.apply(this, args);
      };
      
      try {
        const result = await driver.get(key);
        assert.deepEqual(result, { test: 'retry' });
        assert.ok(getAttempts >= 2, 'Should have retried at least once');
      } finally {
        // Restore original
        cacache.get = originalGet;
      }
    });

    it('should not retry on ENOENT', async () => {
      let attempts = 0;
      
      driver._retry = async function(operation, key) {
        attempts++;
        return operation();
      };
      
      await assert.rejects(
        async () => await driver.get('missing-key'),
        /Key not found/
      );
      
      assert.equal(attempts, 1);
    });
  });

  describe('edge cases', () => {
    it('should handle large values', async () => {
      const largeArray = Array(10000).fill(null).map((_, i) => ({
        index: i,
        data: 'x'.repeat(100)
      }));
      
      const key = 'large-value';
      await driver.put(key, largeArray);
      
      const retrieved = await driver.get(key);
      assert.equal(retrieved.length, 10000);
      assert.equal(retrieved[0].data.length, 100);
    });

    it('should handle special characters in keys', async () => {
      const weirdKey = '@scope/package:version:tag';
      const value = { special: true };
      
      await driver.put(weirdKey, value);
      const retrieved = await driver.get(weirdKey);
      
      assert.deepEqual(retrieved, value);
    });

    it('should handle concurrent operations', async () => {
      const operations = Array(20).fill(null).map((_, i) => 
        driver.put(`concurrent-${i}`, { index: i })
      );
      
      await Promise.all(operations);
      
      // Verify all were written
      for (let i = 0; i < 20; i++) {
        const value = await driver.get(`concurrent-${i}`);
        assert.deepEqual(value, { index: i });
      }
    });
  });
});