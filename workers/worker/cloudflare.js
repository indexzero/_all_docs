import app from './app.js';

// Cloudflare Workers entry point
export default {
  async fetch(request, env, ctx) {
    // Add runtime identifier to environment
    const workerEnv = {
      ...env,
      RUNTIME: 'cloudflare'
    };
    
    return app.fetch(request, workerEnv, ctx);
  }
};

// Export for Cloudflare module workers
export { app };