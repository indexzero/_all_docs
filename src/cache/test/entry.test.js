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
});