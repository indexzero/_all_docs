import { Processor } from '@_all_docs/worker/processor';
import { FastlyStorage } from './storage.js';
import { FastlyQueue } from './queue.js';

// Fastly Compute@Edge entry point
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  const request = event.request;
  
  // Set up Fastly environment
  const env = {
    RUNTIME: 'fastly',
    CACHE_DICTIONARY: 'cache_dict',
    NPM_ORIGIN: 'https://replicate.npmjs.com'
  };

  // Create processor with Fastly-specific implementations
  const processor = new Processor({
    storage: new FastlyStorage(env.CACHE_DICTIONARY),
    queue: new FastlyQueue(),
    env
  });

  // Handle the request
  return processor.handleRequest(request);
}