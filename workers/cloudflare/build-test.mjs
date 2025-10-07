#!/usr/bin/env node

import { build } from 'esbuild';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure dist directory exists
mkdirSync(join(__dirname, 'dist'), { recursive: true });

// Create a simple bundled test worker that doesn't require workspace dependencies
await build({
  stdin: {
    contents: `
// Mock Processor
export class Processor {
  constructor(config) {
    this.storage = config.storage;
    this.queue = config.queue;
    this.env = config.env;
  }

  async process(workItem) {
    return {
      success: true,
      data: {
        type: workItem.type,
        processed: true
      }
    };
  }

  async handleRequest(request) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }

    if (url.pathname === '/work' && request.method === 'POST') {
      try {
        const workItem = await request.json();
        const result = await this.process(workItem);

        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { 'content-type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { 'content-type': 'application/json' }
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
}

// Mock storage implementation
export function createStorage(kv) {
  return {
    async set(key, value) {
      await kv.put(key, JSON.stringify(value));
    },
    async get(key) {
      const value = await kv.get(key, { type: 'json' });
      return value;
    },
    async delete(key) {
      await kv.delete(key);
    },
    async has(key) {
      const value = await kv.get(key);
      return value !== null;
    }
  };
}

// Mock queue implementation
export class DurableQueue {
  constructor(doNamespace, env) {
    this.doNamespace = doNamespace;
    this.env = env;
  }

  async enqueue(item) {
    const id = this.doNamespace.idFromName('queue');
    const stub = this.doNamespace.get(id);
    const res = await stub.fetch('https://queue/enqueue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(item)
    });
    return res.json();
  }
}

// Mock Durable Object
export class QueueDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.queue = [];
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/enqueue' && request.method === 'POST') {
      const item = await request.json();
      this.queue.push(item);
      await this.state.storage.put('queue', this.queue);
      return new Response(JSON.stringify(item), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }

    if (url.pathname === '/size') {
      return new Response(JSON.stringify({ size: this.queue.length }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
}

// Main worker export
export default {
  async fetch(request, env, ctx) {
    const processor = new Processor({
      storage: createStorage(env.CACHE_KV),
      queue: new DurableQueue(env.QUEUE_DO, env),
      env: {
        ...env,
        RUNTIME: 'cloudflare'
      }
    });

    return processor.handleRequest(request);
  }
};
`,
    resolveDir: __dirname,
    loader: 'js',
  },
  bundle: true,
  format: 'esm',
  target: 'es2022',
  platform: 'browser',
  outfile: join(__dirname, 'dist/test-bundle.js'),
  minify: false,
});

console.log('Test bundle created at dist/test-bundle.js');