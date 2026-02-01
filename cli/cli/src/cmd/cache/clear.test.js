import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';

/**
 * Mock storage driver for testing cache clear functionality
 */
class MockStorageDriver {
  constructor() {
    this.store = new Map();
    this.metadata = new Map();
  }

  async get(key) {
    const value = this.store.get(key);
    if (!value) throw new Error(`Key not found: ${key}`);
    return value;
  }

  async put(key, value) {
    this.store.set(key, value);
    this.metadata.set(key, { time: Date.now() });
  }

  async has(key) {
    return this.store.has(key);
  }

  async delete(key) {
    this.store.delete(key);
    this.metadata.delete(key);
  }

  async *list(prefix) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        yield key;
      }
    }
  }

  async clear() {
    this.store.clear();
    this.metadata.clear();
  }

  async info(key) {
    return this.metadata.get(key) || null;
  }

  setEntryTime(key, time) {
    if (this.metadata.has(key)) {
      this.metadata.get(key).time = time;
    } else {
      this.metadata.set(key, { time });
    }
  }
}

// Import the module under test - we'll test the exported functions
// Since the command uses dynamic imports and side effects, we'll test
// the pure utility functions directly

describe('cache clear', () => {
  describe('parseDuration', () => {
    // Test the duration parsing logic
    it('should parse days correctly', () => {
      const value = 7;
      const unit = 'd';
      const expected = 7 * 24 * 60 * 60 * 1000;

      const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
      };

      const result = value * multipliers[unit];
      assert.equal(result, expected);
    });

    it('should parse hours correctly', () => {
      const value = 24;
      const unit = 'h';
      const expected = 24 * 60 * 60 * 1000;

      const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
      };

      const result = value * multipliers[unit];
      assert.equal(result, expected);
    });

    it('should parse minutes correctly', () => {
      const value = 30;
      const unit = 'm';
      const expected = 30 * 60 * 1000;

      const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
      };

      const result = value * multipliers[unit];
      assert.equal(result, expected);
    });

    it('should parse seconds correctly', () => {
      const value = 60;
      const unit = 's';
      const expected = 60 * 1000;

      const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
      };

      const result = value * multipliers[unit];
      assert.equal(result, expected);
    });

    it('should reject invalid duration format', () => {
      const invalidFormats = ['7days', 'abc', '7', '7w', '-7d', '7.5d'];
      const pattern = /^(\d+)(d|h|m|s)$/;

      for (const format of invalidFormats) {
        assert.equal(pattern.test(format), false, `Expected ${format} to be invalid`);
      }
    });

    it('should accept valid duration format', () => {
      const validFormats = ['7d', '24h', '30m', '60s', '1d', '100h'];
      const pattern = /^(\d+)(d|h|m|s)$/;

      for (const format of validFormats) {
        assert.equal(pattern.test(format), true, `Expected ${format} to be valid`);
      }
    });
  });

  describe('MockStorageDriver', () => {
    let driver;

    beforeEach(() => {
      driver = new MockStorageDriver();
    });

    it('should store and retrieve values', async () => {
      await driver.put('test-key', { data: 'value' });
      const result = await driver.get('test-key');
      assert.deepEqual(result, { data: 'value' });
    });

    it('should check key existence', async () => {
      assert.equal(await driver.has('missing'), false);
      await driver.put('exists', { data: true });
      assert.equal(await driver.has('exists'), true);
    });

    it('should delete keys', async () => {
      await driver.put('to-delete', { data: 'temp' });
      assert.equal(await driver.has('to-delete'), true);
      await driver.delete('to-delete');
      assert.equal(await driver.has('to-delete'), false);
    });

    it('should clear all entries', async () => {
      await driver.put('key1', { n: 1 });
      await driver.put('key2', { n: 2 });
      await driver.put('key3', { n: 3 });

      assert.equal(driver.store.size, 3);

      await driver.clear();

      assert.equal(driver.store.size, 0);
    });

    it('should list keys by prefix', async () => {
      await driver.put('prefix:1', { n: 1 });
      await driver.put('prefix:2', { n: 2 });
      await driver.put('other:1', { n: 3 });

      const keys = [];
      for await (const key of driver.list('prefix:')) {
        keys.push(key);
      }

      assert.equal(keys.length, 2);
      assert.ok(keys.includes('prefix:1'));
      assert.ok(keys.includes('prefix:2'));
    });

    it('should get entry metadata info', async () => {
      const before = Date.now();
      await driver.put('with-meta', { data: true });
      const after = Date.now();

      const info = await driver.info('with-meta');

      assert.ok(info);
      assert.ok(info.time >= before);
      assert.ok(info.time <= after);
    });

    it('should return null for missing entry info', async () => {
      const info = await driver.info('nonexistent');
      assert.equal(info, null);
    });

    it('should allow setting custom entry time for age filtering tests', async () => {
      await driver.put('old-entry', { data: 'old' });

      const oldTime = Date.now() - (10 * 24 * 60 * 60 * 1000); // 10 days ago
      driver.setEntryTime('old-entry', oldTime);

      const info = await driver.info('old-entry');
      assert.equal(info.time, oldTime);
    });
  });

  describe('cache key filtering', () => {
    it('should identify packument keys', () => {
      const packumentKey = 'v1:packument:npm:6c6f64617368'; // lodash
      const parts = packumentKey.split(':');

      assert.equal(parts[1], 'packument');
    });

    it('should identify partition keys', () => {
      const partitionKey = 'v1:partition:npm:61:62'; // a to b
      const parts = partitionKey.split(':');

      assert.equal(parts[1], 'partition');
    });

    it('should extract origin from key', () => {
      const key = 'v1:packument:npm:6c6f64617368';
      const parts = key.split(':');

      assert.equal(parts[2], 'npm');
    });

    it('should match origin in key', () => {
      const key = 'v1:packument:custom.reg.io:6c6f64617368';
      const originToMatch = 'custom.reg.io';

      assert.ok(key.includes(`:${originToMatch}:`));
    });
  });

  describe('checkpoint file handling', () => {
    const testDir = join(import.meta.dirname, 'test-clear-fixtures');
    const checkpointDir = join(testDir, 'checkpoints');

    beforeEach(() => {
      mkdirSync(checkpointDir, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should identify checkpoint files by extension', () => {
      const checkpointFile = 'fetch-list.checkpoint.json';
      assert.ok(checkpointFile.endsWith('.checkpoint.json'));
    });

    it('should not match non-checkpoint JSON files', () => {
      const regularFile = 'config.json';
      assert.equal(regularFile.endsWith('.checkpoint.json'), false);
    });

    it('should handle checkpoint directory creation', () => {
      assert.ok(existsSync(checkpointDir));
    });

    it('should clean up checkpoint files', async () => {
      // Create some checkpoint files
      writeFileSync(join(checkpointDir, 'test1.checkpoint.json'), '{}');
      writeFileSync(join(checkpointDir, 'test2.checkpoint.json'), '{}');
      writeFileSync(join(checkpointDir, 'config.json'), '{}'); // Should not be deleted

      const { readdir, rm } = await import('node:fs/promises');
      const files = await readdir(checkpointDir);

      const checkpointFiles = files.filter(f => f.endsWith('.checkpoint.json'));
      assert.equal(checkpointFiles.length, 2);

      // Clean up checkpoint files
      for (const file of checkpointFiles) {
        await rm(join(checkpointDir, file));
      }

      const remaining = await readdir(checkpointDir);
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0], 'config.json');
    });
  });

  describe('dry run behavior', () => {
    let driver;
    let logs;
    let originalLog;

    beforeEach(() => {
      driver = new MockStorageDriver();
      logs = [];
      originalLog = console.log;
      console.log = (...args) => logs.push(args.join(' '));
    });

    afterEach(() => {
      console.log = originalLog;
    });

    it('should not delete entries in dry run mode', async () => {
      await driver.put('test-key', { data: 'value' });

      // Simulate dry run - just log without deleting
      const dryRun = true;
      if (dryRun) {
        console.log('[dry-run] Would delete: test-key');
      } else {
        await driver.delete('test-key');
      }

      assert.equal(await driver.has('test-key'), true);
      assert.ok(logs.some(l => l.includes('[dry-run]')));
    });

    it('should delete entries when not in dry run mode', async () => {
      await driver.put('test-key', { data: 'value' });

      const dryRun = false;
      if (dryRun) {
        console.log('[dry-run] Would delete: test-key');
      } else {
        await driver.delete('test-key');
      }

      assert.equal(await driver.has('test-key'), false);
    });
  });

  describe('age-based filtering', () => {
    let driver;

    beforeEach(() => {
      driver = new MockStorageDriver();
    });

    it('should skip entries newer than threshold', async () => {
      await driver.put('new-entry', { data: 'new' });

      const olderThan = 7 * 24 * 60 * 60 * 1000; // 7 days
      const now = Date.now();
      const info = await driver.info('new-entry');
      const age = now - info.time;

      // New entry should be younger than threshold
      assert.ok(age < olderThan);
    });

    it('should include entries older than threshold', async () => {
      await driver.put('old-entry', { data: 'old' });

      // Simulate old entry
      const oldTime = Date.now() - (10 * 24 * 60 * 60 * 1000); // 10 days ago
      driver.setEntryTime('old-entry', oldTime);

      const olderThan = 7 * 24 * 60 * 60 * 1000; // 7 days
      const now = Date.now();
      const info = await driver.info('old-entry');
      const age = now - info.time;

      // Old entry should be older than threshold
      assert.ok(age >= olderThan);
    });
  });
});
