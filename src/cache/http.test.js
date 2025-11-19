import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { BaseHTTPClient } from './http.js';

test('BaseHTTPClient Authentication', async (t) => {
  await t.test('includes auth token in headers when provided', async () => {
    const client = new BaseHTTPClient('https://example.com', {
      authToken: 'test_token_123'
    });

    // Mock fetch to capture request
    const originalFetch = globalThis.fetch;
    let capturedHeaders;

    globalThis.fetch = async (url, options) => {
      capturedHeaders = options.headers;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' })
      });
    };

    try {
      await client.request('/test');
      assert.ok(capturedHeaders);
      assert.equal(capturedHeaders.get('authorization'), 'Bearer test_token_123');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('does not include auth header when no token provided', async () => {
    const client = new BaseHTTPClient('https://example.com', {});

    // Mock fetch to capture request
    const originalFetch = globalThis.fetch;
    let capturedHeaders;

    globalThis.fetch = async (url, options) => {
      capturedHeaders = options.headers;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' })
      });
    };

    try {
      await client.request('/test');
      assert.ok(capturedHeaders);
      assert.equal(capturedHeaders.get('authorization'), null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('preserves existing authorization header', async () => {
    const client = new BaseHTTPClient('https://example.com', {
      authToken: 'default_token'
    });

    // Mock fetch to capture request
    const originalFetch = globalThis.fetch;
    let capturedHeaders;

    globalThis.fetch = async (url, options) => {
      capturedHeaders = options.headers;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' })
      });
    };

    try {
      await client.request('/test', {
        headers: {
          'authorization': 'Bearer override_token'
        }
      });
      assert.ok(capturedHeaders);
      // Should use the provided header, not the default token
      assert.equal(capturedHeaders.get('authorization'), 'Bearer override_token');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('includes trace header', async () => {
    const client = new BaseHTTPClient('https://example.com', {
      traceHeader: 'x-custom-trace'
    });

    // Mock fetch to capture request
    const originalFetch = globalThis.fetch;
    let capturedHeaders;

    globalThis.fetch = async (url, options) => {
      capturedHeaders = options.headers;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' })
      });
    };

    try {
      await client.request('/test');
      assert.ok(capturedHeaders);
      assert.ok(capturedHeaders.get('x-custom-trace'));
      // Trace ID should match pattern: timestamp-randomstring
      assert.match(capturedHeaders.get('x-custom-trace'), /^\d+-[a-z0-9]+$/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});