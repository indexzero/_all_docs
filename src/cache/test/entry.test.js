import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { CacheEntry } from '../entry.js';

describe('CacheEntry', () => {
  it('should create instance with normalized headers', () => {
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'max-age=3600',
      'ETag': '"abc123"'
    };
    
    const entry = new CacheEntry(200, headers);
    
    assert.equal(entry.statusCode, 200);
    assert.equal(entry.headers['content-type'], 'application/json');
    assert.equal(entry.headers['cache-control'], 'max-age=3600');
    assert.equal(entry.headers['etag'], '"abc123"');
    assert.equal(entry.version, 1);
    assert.ok(typeof entry.timestamp === 'number');
  });

  it('should set body and calculate integrity', async () => {
    const entry = new CacheEntry(200, {});
    const body = { name: 'test-package', version: '1.0.0' };
    
    await entry.setBody(body);
    
    assert.deepEqual(entry.body, body);
    assert.ok(entry.integrity);
    assert.ok(entry.integrity.startsWith('sha256-'));
  });

  it('should return body via json() method', async () => {
    const entry = new CacheEntry(200, {});
    const body = { test: true };
    
    await entry.setBody(body);
    
    assert.deepEqual(entry.json(), body);
  });

  it('should check validity based on max-age', () => {
    const fresh = new CacheEntry(200, {
      'cache-control': 'max-age=3600',
      'age': '1800'
    });
    
    const stale = new CacheEntry(200, {
      'cache-control': 'max-age=3600',
      'age': '7200'
    });
    
    assert.ok(fresh.valid);
    assert.ok(!stale.valid);
  });

  it('should consider entry valid if it has etag', () => {
    const entry = new CacheEntry(200, {
      'etag': '"abc123"',
      'cache-control': 'max-age=0',
      'age': '3600'
    });
    
    assert.ok(entry.valid);
  });

  it('should extract max-age correctly', () => {
    const entry = new CacheEntry(200, {});
    
    assert.equal(entry.extractMaxAge('max-age=3600'), 3600);
    assert.equal(entry.extractMaxAge('public, max-age=7200'), 7200);
    assert.equal(entry.extractMaxAge('no-cache'), null);
    assert.equal(entry.extractMaxAge(null), null);
  });

  it('should encode and decode correctly', async () => {
    const original = new CacheEntry(200, {
      'content-type': 'application/json',
      'etag': '"xyz789"'
    });
    
    const body = { data: 'test' };
    await original.setBody(body);
    
    const encoded = original.encode();
    const decoded = CacheEntry.decode(encoded);
    
    assert.equal(decoded.statusCode, original.statusCode);
    assert.deepEqual(decoded.headers, original.headers);
    assert.deepEqual(decoded.body, original.body);
    assert.equal(decoded.integrity, original.integrity);
    assert.equal(decoded.version, original.version);
  });

  it('should verify integrity correctly', async () => {
    const entry = new CacheEntry(200, {});
    const body = { verified: true };
    
    await entry.setBody(body);
    
    const isValid = await entry.verifyIntegrity();
    assert.ok(isValid);
    
    // Tamper with body
    entry.body.tampered = true;
    const isInvalid = await entry.verifyIntegrity();
    assert.ok(!isInvalid);
  });

  it('should handle missing integrity gracefully', async () => {
    const entry = new CacheEntry(200, {});
    entry.body = { test: true };
    entry.integrity = null;
    
    const result = await entry.verifyIntegrity();
    assert.equal(result, false);
  });

  it('should get etag property', () => {
    const entry = new CacheEntry(200, { 'etag': '"test-etag"' });
    assert.equal(entry.etag, '"test-etag"');

    const noEtag = new CacheEntry(200, {});
    assert.equal(noEtag.etag, undefined);
  });

  it('should get lastModified property', () => {
    const entry = new CacheEntry(200, { 'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT' });
    assert.equal(entry.lastModified, 'Wed, 21 Oct 2015 07:28:00 GMT');
  });

  it('should return undefined when no lastModified header', () => {
    const entry = new CacheEntry(200, {});
    assert.equal(entry.lastModified, undefined);
  });

  it('should preserve lastModified through encode/decode', async () => {
    const original = new CacheEntry(200, {
      'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
      'etag': '"abc"'
    });
    await original.setBody({ test: true });

    const decoded = CacheEntry.decode(original.encode());
    assert.equal(decoded.lastModified, 'Wed, 21 Oct 2015 07:28:00 GMT');
  });

  it('should set body from raw string without stringify', () => {
    const entry = new CacheEntry(200, { 'etag': '"raw"' });
    const body = { name: 'lodash', versions: { '4.17.21': {} } };
    const rawJson = JSON.stringify(body);

    entry.setBodyRaw(body, rawJson);

    assert.deepEqual(entry.body, body);
    assert.equal(entry.integrity, null, 'integrity skipped for raw path');
    assert.equal(entry._rawJson, rawJson);
  });

  it('should encode to string when _rawJson is set', () => {
    const entry = new CacheEntry(200, { 'etag': '"raw"' });
    const body = { name: 'test' };
    const rawJson = '{"name":"test"}';

    entry.setBodyRaw(body, rawJson);
    const encoded = entry.encode();

    assert.equal(typeof encoded, 'string', 'encode should return a string');
    const decoded = JSON.parse(encoded);
    assert.equal(decoded.statusCode, 200);
    assert.deepEqual(decoded.body, body);
    assert.equal(decoded.integrity, null);
    assert.equal(decoded.headers['etag'], '"raw"');
  });

  it('should round-trip through encode/decode with raw body', () => {
    const entry = new CacheEntry(200, {
      'etag': '"round-trip"',
      'cache-control': 'max-age=300'
    });
    const body = { name: 'lodash', versions: { '4.17.21': { name: 'lodash' } } };
    const rawJson = JSON.stringify(body);

    entry.setBodyRaw(body, rawJson);
    const encoded = entry.encode();
    const decoded = CacheEntry.decode(JSON.parse(encoded));

    assert.equal(decoded.statusCode, 200);
    assert.deepEqual(decoded.body, body);
    assert.equal(decoded.etag, '"round-trip"');
    assert.equal(decoded.version, 1);
  });
});