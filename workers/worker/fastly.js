import app from './app.js';

// Fastly Compute@Edge entry point
addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Set up environment for Fastly runtime
  const env = {
    RUNTIME: 'fastly',
    CACHE_DICT: globalThis.CACHE_DICT,
    NPM_ORIGIN: globalThis.NPM_ORIGIN || 'https://replicate.npmjs.com'
  };
  
  // Fastly doesn't have the same context object as Cloudflare
  const ctx = {
    waitUntil: (promise) => {
      // Fastly doesn't have waitUntil, but we can handle it differently if needed
      promise.catch(console.error);
    }
  };
  
  return app.fetch(request, env, ctx);
}

// For Fastly's specific initialization if needed
if (typeof fastly !== 'undefined' && fastly.env) {
  // Additional Fastly-specific setup can go here
  console.log('Fastly Compute@Edge worker initialized');
}