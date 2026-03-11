import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { PackumentCache } from '../packument-cache.js';
import { MockStorageDriver } from './mock-driver.js';

describe('PackumentCache', () => {
  const ORIGIN = 'https://registry.npmjs.org';
  let driver;

  beforeEach(() => {
    driver = new MockStorageDriver();
  });

  it('should require origin', () => {
    assert.throws(
      () => new PackumentCache({ driver }),
      /requires an origin/
    );
  });

  it('should return null for uncached package', async () => {
    const cache = new PackumentCache({ origin: ORIGIN, driver });
    const result = await cache.get('lodash');
    assert.equal(result, null);
  });

  it('should round-trip put and get', async () => {
    const cache = new PackumentCache({ origin: ORIGIN, driver });
    const body = { name: 'lodash', versions: { '4.17.21': {} } };

    await cache.put('lodash', {
      statusCode: 200,
      headers: {
        'etag': '"abc123"',
        'cache-control': 'max-age=300',
        'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT'
      },
      body
    });

    const entry = await cache.get('lodash');
    assert.ok(entry);
    assert.deepEqual(entry.body, body);
    assert.equal(entry.etag, '"abc123"');
    assert.equal(entry.lastModified, 'Wed, 21 Oct 2015 07:28:00 GMT');
    assert.equal(entry.statusCode, 200);
  });

  it('should return {} from conditionalHeaders for uncached package', async () => {
    const cache = new PackumentCache({ origin: ORIGIN, driver });
    const headers = await cache.conditionalHeaders('missing-pkg');
    assert.deepEqual(headers, {});
  });

  it('should return if-none-match when entry has etag', async () => {
    const cache = new PackumentCache({ origin: ORIGIN, driver });
    await cache.put('lodash', {
      statusCode: 200,
      headers: { 'etag': '"etag-value"' },
      body: { name: 'lodash' }
    });

    const headers = await cache.conditionalHeaders('lodash');
    assert.equal(headers['if-none-match'], '"etag-value"');
  });

  it('should return if-modified-since when entry has lastModified only', async () => {
    const cache = new PackumentCache({ origin: ORIGIN, driver });
    await cache.put('lodash', {
      statusCode: 200,
      headers: { 'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT' },
      body: { name: 'lodash' }
    });

    const headers = await cache.conditionalHeaders('lodash');
    assert.equal(headers['if-modified-since'], 'Wed, 21 Oct 2015 07:28:00 GMT');
    assert.equal(headers['if-none-match'], undefined);
  });

  it('should return both headers when entry has etag and lastModified', async () => {
    const cache = new PackumentCache({ origin: ORIGIN, driver });
    await cache.put('lodash', {
      statusCode: 200,
      headers: {
        'etag': '"both"',
        'last-modified': 'Thu, 01 Jan 2025 00:00:00 GMT'
      },
      body: { name: 'lodash' }
    });

    const headers = await cache.conditionalHeaders('lodash');
    assert.equal(headers['if-none-match'], '"both"');
    assert.equal(headers['if-modified-since'], 'Thu, 01 Jan 2025 00:00:00 GMT');
  });

  it('should report has() correctly', async () => {
    const cache = new PackumentCache({ origin: ORIGIN, driver });

    assert.equal(await cache.has('lodash'), false);

    await cache.put('lodash', {
      statusCode: 200,
      headers: {},
      body: { name: 'lodash' }
    });

    assert.equal(await cache.has('lodash'), true);
  });

  it('should isolate entries by origin', async () => {
    const npmCache = new PackumentCache({ origin: 'https://registry.npmjs.org', driver });
    const cgrCache = new PackumentCache({ origin: 'https://libraries.cgr.dev/javascript', driver });

    await npmCache.put('lodash', {
      statusCode: 200,
      headers: { 'etag': '"npm"' },
      body: { name: 'lodash', source: 'npm' }
    });

    // Same package name, different origin should return null
    const cgrEntry = await cgrCache.get('lodash');
    assert.equal(cgrEntry, null);

    // Original origin should still have it
    const npmEntry = await npmCache.get('lodash');
    assert.ok(npmEntry);
    assert.equal(npmEntry.body.source, 'npm');
  });

  it('should share entries with same origin', async () => {
    const cache1 = new PackumentCache({ origin: ORIGIN, driver });
    const cache2 = new PackumentCache({ origin: ORIGIN, driver });

    await cache1.put('express', {
      statusCode: 200,
      headers: { 'etag': '"shared"' },
      body: { name: 'express' }
    });

    const entry = await cache2.get('express');
    assert.ok(entry);
    assert.equal(entry.body.name, 'express');
  });

  it('should report valid entry based on cache-control', async () => {
    const cache = new PackumentCache({ origin: ORIGIN, driver });

    await cache.put('fresh-pkg', {
      statusCode: 200,
      headers: { 'cache-control': 'max-age=3600' },
      body: { name: 'fresh-pkg' }
    });

    const entry = await cache.get('fresh-pkg');
    assert.ok(entry);
    assert.equal(entry.valid, true);
  });

  it('should handle scoped package names', async () => {
    const cache = new PackumentCache({ origin: ORIGIN, driver });
    const body = { name: '@babel/core', versions: { '7.23.0': {} } };

    await cache.put('@babel/core', {
      statusCode: 200,
      headers: { 'etag': '"scoped"' },
      body
    });

    const entry = await cache.get('@babel/core');
    assert.ok(entry);
    assert.deepEqual(entry.body, body);
    assert.equal(entry.etag, '"scoped"');
  });

  it('should use defaultCacheDir when cacheDir not provided', () => {
    const cache = new PackumentCache({ origin: ORIGIN, driver });
    // Should not throw -- uses platform default
    assert.ok(cache._cacheDir);
    assert.ok(typeof cache._cacheDir === 'string');
    assert.ok(cache._cacheDir.length > 0);
  });

  it('should round-trip with bodyRaw (zero-stringify fast path)', async () => {
    const cache = new PackumentCache({ origin: ORIGIN, driver });
    const body = { name: 'lodash', versions: { '4.17.21': {} } };
    const bodyRaw = JSON.stringify(body);

    await cache.put('lodash', {
      statusCode: 200,
      headers: { 'etag': '"fast"', 'cache-control': 'max-age=300' },
      body,
      bodyRaw
    });

    const entry = await cache.get('lodash');
    assert.ok(entry);
    assert.deepEqual(entry.body, body);
    assert.equal(entry.etag, '"fast"');
    assert.equal(entry.statusCode, 200);
  });

  it('should produce identical get() result with and without bodyRaw', async () => {
    const body = { name: 'express', versions: { '4.18.2': {} }, time: { '4.18.2': '2024-01-01' } };
    const bodyRaw = JSON.stringify(body);
    const headers = { 'etag': '"compare"', 'cache-control': 'max-age=60' };

    // Store without bodyRaw (slow path)
    const slowDriver = new MockStorageDriver();
    const slowCache = new PackumentCache({ origin: ORIGIN, driver: slowDriver });
    await slowCache.put('express', { statusCode: 200, headers, body });
    const slowEntry = await slowCache.get('express');

    // Store with bodyRaw (fast path)
    const fastDriver = new MockStorageDriver();
    const fastCache = new PackumentCache({ origin: ORIGIN, driver: fastDriver });
    await fastCache.put('express', { statusCode: 200, headers, body, bodyRaw });
    const fastEntry = await fastCache.get('express');

    // Bodies should be identical
    assert.deepEqual(fastEntry.body, slowEntry.body);
    assert.equal(fastEntry.etag, slowEntry.etag);
    assert.equal(fastEntry.statusCode, slowEntry.statusCode);
    assert.equal(fastEntry.version, slowEntry.version);
  });
});
