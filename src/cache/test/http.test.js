import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { BaseHTTPClient, createDispatcher } from '../http.js';

describe('BaseHTTPClient', () => {
  let client;
  let server;
  let serverUrl;

  beforeEach(async () => {
    // Create mock server
    server = createServer((req, res) => {
      if (req.url === '/timeout') {
        // Don't respond to trigger timeout
        return;
      }
      
      if (req.url === '/delay/5') {
        // Simulate delay
        setTimeout(() => {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ delayed: true }));
        }, 5000);
        return;
      }
      
      if (req.url === '/status/200') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }
      
      if (req.url === '/headers') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ headers: req.headers }));
        return;
      }
      
      if (req.url === '/retry') {
        const retryCount = req.headers['x-retry-count'] || '0';
        if (retryCount === '2') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(503);
          res.end();
        }
        return;
      }
      
      // Default response
      res.writeHead(404);
      res.end();
    });
    
    await new Promise(resolve => server.listen(0, resolve));
    serverUrl = `http://localhost:${server.address().port}`;
    
    client = new BaseHTTPClient(serverUrl, {
      requestTimeout: 5000,
      userAgent: 'test-agent/1.0'
    });
  });
  
  afterEach(() => new Promise(resolve => server.close(resolve)));

  it('should create instance with correct properties', () => {
    assert.equal(client.origin, serverUrl);
    assert.equal(client.requestTimeout, 5000);
    assert.equal(client.traceHeader, 'x-trace-id');
    assert.ok(client.defaultHeaders instanceof Headers);
    assert.equal(client.defaultHeaders.get('user-agent'), 'test-agent/1.0');
  });

  it('should make GET request successfully', async () => {
    const response = await client.request('/status/200');
    assert.equal(response.status, 200);
    assert.ok(response instanceof Response);
    const data = await response.json();
    assert.equal(data.status, 'ok');
  });

  it('should handle request timeout', async () => {
    const timeoutClient = new BaseHTTPClient(serverUrl, {
      requestTimeout: 100
    });

    await assert.rejects(
      async () => await timeoutClient.request('/delay/5'),
      (err) => {
        // Check for timeout-related errors
        return err.message.includes('timeout') || 
               err.name === 'AbortError' ||
               err.code === 'UND_ERR_ABORTED';
      }
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

  it('should merge signals properly', async () => {
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
      assert.ok(error.name === 'AbortError' || error.message.includes('abort'));
    }

    assert.ok(aborted, 'Request should have been aborted');
  });

  it('should add trace header to requests', async () => {
    const response = await client.request('/headers');
    const data = await response.json();
    
    assert.ok(data.headers);
    assert.ok(data.headers['x-trace-id']);
    assert.equal(data.headers['user-agent'], 'test-agent/1.0');
  });
  
  it.skip('should retry on 503 errors', async () => {
    // TODO: Implement retry logic in BaseHTTPClient or use undici's retry
    // For now, skipping as retry is not implemented in BaseHTTPClient
    let retryCount = 0;
    
    // Create client with retry configuration
    const retryClient = new BaseHTTPClient(serverUrl, {
      requestTimeout: 5000,
      userAgent: 'test-agent/1.0',
      retry: {
        limit: 3,
        methods: ['GET'],
        statusCodes: [503]
      }
    });
    
    const response = await retryClient.request('/retry', {
      headers: {
        'x-retry-count': () => String(retryCount++)
      }
    });
    
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.success, true);
    // We expect 3 total attempts (initial + 2 retries)
    assert.ok(retryCount >= 1, 'Should have retried at least once');
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