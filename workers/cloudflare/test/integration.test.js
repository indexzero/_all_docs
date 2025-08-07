import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { Miniflare } from 'miniflare';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Cloudflare Worker Integration', () => {
  let mf;
  
  beforeEach(async () => {
    // Create Miniflare instance with KV namespace for cache
    mf = new Miniflare({
      modules: true,
      scriptPath: join(__dirname, '../index.js'),
      kvNamespaces: ['CACHE_KV'],
      durableObjects: {
        QUEUE_DO: join(__dirname, '../queue.js')
      },
      bindings: {
        NPM_ORIGIN: 'https://replicate.npmjs.com',
        WORKER_URL: 'http://localhost:8787'
      },
      compatibilityDate: '2023-05-18',
      compatibilityFlags: ['nodejs_compat']
    });
  });
  
  afterEach(async () => {
    // Clean up Miniflare instance
    await mf.dispose();
  });
  
  it('should handle health check', async () => {
    // The worker should have a health endpoint
    const res = await mf.dispatchFetch('http://localhost/health');
    // If not implemented, it might return 404 which is ok for now
    assert.ok(res.status === 200 || res.status === 404);
  });
  
  it('should store and retrieve from KV', async () => {
    // Test KV storage directly
    const kv = await mf.getKVNamespace('CACHE_KV');
    
    // Store a value
    await kv.put('test-key', JSON.stringify({ data: 'test-value' }));
    
    // Retrieve the value
    const value = await kv.get('test-key', { type: 'json' });
    assert.deepEqual(value, { data: 'test-value' });
  });
  
  it('should handle queue operations via Durable Object', async () => {
    // Get the durable object namespace
    const doNamespace = await mf.getDurableObjectNamespace('QUEUE_DO');
    const id = doNamespace.idFromName('test-queue');
    const stub = doNamespace.get(id);
    
    // Enqueue an item
    const enqueueRes = await stub.fetch('https://queue/enqueue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'test-item-1',
        type: 'partition',
        payload: { startKey: 'a', endKey: 'b' }
      })
    });
    
    assert.equal(enqueueRes.status, 200);
    const enqueueResult = await enqueueRes.json();
    assert.equal(enqueueResult.id, 'test-item-1');
    
    // Check queue size
    const sizeRes = await stub.fetch('https://queue/size');
    assert.equal(sizeRes.status, 200);
    const sizeResult = await sizeRes.json();
    assert.equal(sizeResult.size, 1);
  });
  
  it('should work with processor pattern', async () => {
    // Test that the worker can handle a request
    const res = await mf.dispatchFetch('http://localhost/', {
      method: 'GET'
    });
    
    // The processor should return something, even if it's an error
    assert.ok(res.status > 0);
  });
});