import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { BaseHTTPClient, createDispatcher } from '../http.js';

describe('BaseHTTPClient', () => {
  let client;

  beforeEach(() => {
    client = new BaseHTTPClient('https://httpbin.org', {
      requestTimeout: 5000,
      userAgent: 'test-agent/1.0'
    });
  });

  it('should create instance with correct properties', () => {
    assert.equal(client.origin, 'https://httpbin.org');
    assert.equal(client.requestTimeout, 5000);
    assert.equal(client.traceHeader, 'x-trace-id');
    assert.ok(client.defaultHeaders instanceof Headers);
    assert.equal(client.defaultHeaders.get('user-agent'), 'test-agent/1.0');
  });

  it.skip('should make GET request successfully', async () => {
    const response = await client.request('/status/200');
    assert.equal(response.status, 200);
    assert.ok(response instanceof Response);
  });

  it.skip('should handle request timeout', async () => {
    const timeoutClient = new BaseHTTPClient('https://httpbin.org', {
      requestTimeout: 100
    });

    await assert.rejects(
      async () => await timeoutClient.request('/delay/5'),
      /Request timeout/
    );
  });

  it('should generate unique trace IDs', () => {
    const id1 = client.generateTraceId();
    const id2 = client.generateTraceId();
    
    assert.ok(typeof id1 === 'string');
    assert.ok(id1.includes('-'));
    assert.notEqual(id1, id2);
  });

  it('should set cache headers correctly', () => {
    const options = { headers: {} };
    const cacheEntry = {
      etag: '"abc123"',
      lastModified: 'Wed, 21 Oct 2015 07:28:00 GMT'
    };

    client.setCacheHeaders(options, cacheEntry);
    
    assert.ok(options.headers instanceof Headers);
    assert.equal(options.headers.get('if-none-match'), '"abc123"');
    assert.equal(options.headers.get('if-modified-since'), 'Wed, 21 Oct 2015 07:28:00 GMT');
  });

  it.skip('should merge signals properly', async () => {
    const controller = new AbortController();
    let aborted = false;

    // Abort after 100ms
    setTimeout(() => controller.abort(), 100);

    try {
      await client.request('/delay/5', {
        signal: controller.signal
      });
    } catch (error) {
      aborted = true;
    }

    assert.ok(aborted, 'Request should have been aborted');
  });

  it.skip('should add trace header to requests', async () => {
    const response = await client.request('/headers');
    const data = await response.json();
    
    assert.ok(data.headers);
    assert.ok(data.headers['X-Trace-Id']);
    assert.ok(data.headers['User-Agent'] === 'test-agent/1.0');
  });
});

describe('createDispatcher', () => {
  it('should create dispatcher in Node.js environment', async () => {
    const dispatcher = await createDispatcher({ RUNTIME: 'node' });
    
    if (typeof globalThis.fetch !== 'undefined') {
      // In Node.js with undici available
      assert.ok(dispatcher !== null);
    } else {
      // In environments without undici
      assert.equal(dispatcher, null);
    }
  });

  it('should return null for non-Node runtimes', async () => {
    const dispatcher = await createDispatcher({ RUNTIME: 'cloudflare' });
    assert.equal(dispatcher, null);
  });

  it('should respect configuration options', async () => {
    const dispatcher = await createDispatcher({
      RUNTIME: 'node',
      MAX_CONNECTIONS: 100,
      PIPELINING: 5,
      HTTP2: true
    });

    if (dispatcher !== null) {
      // Dispatcher was created with custom options
      assert.ok(dispatcher);
    }
  });
});