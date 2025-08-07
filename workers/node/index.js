import express from 'express';
import { Processor } from '@_all_docs/worker/processor';
import { createStorage } from './storage.js';
import { createQueue } from './queue.js';

// Set up environment for Node.js runtime
const env = {
  RUNTIME: 'node',
  CACHE_DIR: process.env.CACHE_DIR || './cache',
  NPM_ORIGIN: process.env.NPM_ORIGIN || 'https://replicate.npmjs.com'
};

// Create processor with Node-specific implementations
const processor = new Processor({
  storage: createStorage(env.CACHE_DIR),
  queue: createQueue({ concurrency: 10 }),
  env
});

// Create Express app
const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.send('OK');
});

// Work endpoint
app.post('/work', async (req, res) => {
  try {
    const workItem = req.body;
    const result = await processor.process(workItem);
    
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Node.js worker started on port ${port}`);
  console.log(`Runtime: ${env.RUNTIME}`);
  console.log(`Cache directory: ${env.CACHE_DIR}`);
  console.log(`NPM origin: ${env.NPM_ORIGIN}`);
});

export default app;