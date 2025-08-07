import { Processor } from '@_all_docs/worker/processor';
import { createStorage } from './storage.js';
import { DurableQueue, QueueDurableObject } from './queue.js';

export default {
  async fetch(request, env, ctx) {
    // Create processor with Cloudflare-specific implementations
    const processor = new Processor({
      storage: createStorage(env.CACHE_KV),
      queue: new DurableQueue(env.QUEUE_DO, env),
      env: {
        ...env,
        RUNTIME: 'cloudflare'
      }
    });

    // Handle the request
    return processor.handleRequest(request);
  }
};

// Export the Durable Object class
export { QueueDurableObject };