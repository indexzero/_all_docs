import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  isLocalOrigin,
  LocalDirAdapter,
  CacheAdapter,
  createOriginAdapter
} from './origin-adapter.js';

describe('isLocalOrigin', () => {
  it('returns true for file:// URLs', () => {
    assert.equal(isLocalOrigin('file:///path/to/dir'), true);
    assert.equal(isLocalOrigin('file://./relative'), true);
  });

  it('returns true for absolute Unix paths', () => {
    assert.equal(isLocalOrigin('/usr/local/data'), true);
    assert.equal(isLocalOrigin('/tmp/test'), true);
  });

  it('returns true for relative paths with ./', () => {
    assert.equal(isLocalOrigin('./data'), true);
    assert.equal(isLocalOrigin('../parent/data'), true);
  });

  it('returns false for registry URLs', () => {
    assert.equal(isLocalOrigin('https://registry.npmjs.org'), false);
    assert.equal(isLocalOrigin('npm'), false);
  });

  it('returns false for encoded origins', () => {
    assert.equal(isLocalOrigin('npm.exale.com'), false);
    assert.equal(isLocalOrigin('regiry.npmjs.org'), false);
  });

  it('returns false for null/undefined', () => {
    assert.equal(isLocalOrigin(null), false);
    assert.equal(isLocalOrigin(undefined), false);
  });
});

describe('LocalDirAdapter', () => {
  const testDir = join(import.meta.dirname, 'test-origin-fixtures');

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('lists only JSON files as keys', async () => {
    // Create test files
    writeFileSync(join(testDir, 'lodash.json'), '{"name":"lodash"}');
    writeFileSync(join(testDir, 'express.json'), '{"name":"express"}');
    writeFileSync(join(testDir, 'README.md'), '# test');
    writeFileSync(join(testDir, 'config.txt'), 'config');

    const adapter = new LocalDirAdapter(testDir);
    const keys = [];

    for await (const key of adapter.keys()) {
      keys.push(key);
    }

    assert.equal(keys.length, 2);
    assert.ok(keys.includes('lodash.json'));
    assert.ok(keys.includes('express.json'));
    assert.ok(!keys.includes('README.md'));
    assert.ok(!keys.includes('config.txt'));
  });

  it('fetches and parses JSON files', async () => {
    writeFileSync(
      join(testDir, 'react.json'),
      JSON.stringify({ name: 'react', version: '18.2.0' })
    );

    const adapter = new LocalDirAdapter(testDir);
    const result = await adapter.fetch('react.json');

    assert.deepEqual(result, { name: 'react', version: '18.2.0' });
  });

  it('returns null for missing files', async () => {
    const adapter = new LocalDirAdapter(testDir);
    const result = await adapter.fetch('nonexistent.json');

    assert.equal(result, null);
  });

  it('returns null for invalid JSON', async () => {
    writeFileSync(join(testDir, 'invalid.json'), 'not valid json{');

    const adapter = new LocalDirAdapter(testDir);
    const result = await adapter.fetch('invalid.json');

    assert.equal(result, null);
  });

  it('handles file:// URL paths', async () => {
    writeFileSync(join(testDir, 'test.json'), '{"name":"test"}');

    const adapter = new LocalDirAdapter(`file://${testDir}`);
    const result = await adapter.fetch('test.json');

    assert.deepEqual(result, { name: 'test' });
  });
});

describe('CacheAdapter', () => {
  it('delegates keys() to cache.keys()', async () => {
    const mockKeys = ['v1:packument:npm:a', 'v1:packument:npm:b'];
    const mockCache = {
      async *keys(prefix) {
        for (const k of mockKeys.filter(k => k.startsWith(prefix))) {
          yield k;
        }
      },
      async fetch() { return null; }
    };

    const adapter = new CacheAdapter(mockCache, 'v1:packument:npm:');
    const keys = [];

    for await (const key of adapter.keys()) {
      keys.push(key);
    }

    assert.deepEqual(keys, mockKeys);
  });

  it('extracts body from cache entry', async () => {
    const mockCache = {
      async *keys() {},
      async fetch(key) {
        return { body: { name: 'lodash' }, meta: 'ignored' };
      }
    };

    const adapter = new CacheAdapter(mockCache, 'v1:');
    const result = await adapter.fetch('v1:packument:npm:abc');

    assert.deepEqual(result, { name: 'lodash' });
  });

  it('returns null on fetch error', async () => {
    const mockCache = {
      async *keys() {},
      async fetch() {
        throw new Error('Not found');
      }
    };

    const adapter = new CacheAdapter(mockCache, 'v1:');
    const result = await adapter.fetch('nonexistent');

    assert.equal(result, null);
  });
});

describe('createOriginAdapter', () => {
  it('creates LocalDirAdapter for file:// origin', () => {
    const view = {
      registry: 'file:///path/to/dir',
      origin: 'ignored',
      getCacheKeyPrefix: () => 'v1:packument:local:'
    };

    const adapter = createOriginAdapter(view, null);

    assert.ok(adapter instanceof LocalDirAdapter);
  });

  it('creates LocalDirAdapter for absolute path', () => {
    const view = {
      registry: '/absolute/path',
      origin: 'ignored',
      getCacheKeyPrefix: () => 'v1:packument:local:'
    };

    const adapter = createOriginAdapter(view, null);

    assert.ok(adapter instanceof LocalDirAdapter);
  });

  it('creates LocalDirAdapter for relative path origin', () => {
    const view = {
      registry: null,
      origin: './relative/path',
      getCacheKeyPrefix: () => 'v1:packument:local:'
    };

    const adapter = createOriginAdapter(view, null);

    assert.ok(adapter instanceof LocalDirAdapter);
  });

  it('creates CacheAdapter for registry URL', () => {
    const mockCache = {};
    const view = {
      registry: 'https://registry.npmjs.org',
      origin: 'npm',
      getCacheKeyPrefix: () => 'v1:packument:npm:'
    };

    const adapter = createOriginAdapter(view, mockCache);

    assert.ok(adapter instanceof CacheAdapter);
    assert.equal(adapter.keyPrefix, 'v1:packument:npm:');
  });

  it('creates CacheAdapter for encoded origin', () => {
    const mockCache = {};
    const view = {
      registry: null,
      origin: 'npm',
      getCacheKeyPrefix: () => 'v1:packument:npm:'
    };

    const adapter = createOriginAdapter(view, mockCache);

    assert.ok(adapter instanceof CacheAdapter);
  });
});
