import { serve } from '@hono/node-server';
import app from './app.js';

// Set up environment for Node.js runtime
const env = {
  RUNTIME: 'node',
  CACHE_DIR: process.env.CACHE_DIR || './cache',
  NPM_ORIGIN: process.env.NPM_ORIGIN || 'https://replicate.npmjs.com'
};

// Create server with environment
const server = serve({
  fetch: (request, _env, ctx) => {
    // Pass environment to the app
    return app.fetch(request, env, ctx);
  },
  port: process.env.PORT || 3000,
});

console.log(`Node.js worker started on port ${process.env.PORT || 3000}`);
console.log(`Runtime: ${env.RUNTIME}`);
console.log(`Cache directory: ${env.CACHE_DIR}`);
console.log(`NPM origin: ${env.NPM_ORIGIN}`);