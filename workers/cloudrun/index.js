import express from 'express';
import { Processor } from '@_all_docs/worker/processor';
import { createStorage } from './storage.js';
import { CloudRunQueue } from './queue.js';

// Set up environment for Cloud Run
const env = {
  RUNTIME: 'cloudrun',
  GCS_BUCKET: process.env.GCS_BUCKET || 'all-docs-cache',
  NPM_ORIGIN: process.env.NPM_ORIGIN || 'https://replicate.npmjs.com',
  REDIS_URL: process.env.REDIS_URL // For distributed queue
};

// Create processor with Cloud Run-specific implementations
const processor = new Processor({
  storage: createStorage(env.GCS_BUCKET),
  queue: new CloudRunQueue(env.REDIS_URL),
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
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Cloud Run worker started on port ${port}`);
  console.log(`Runtime: ${env.RUNTIME}`);
  console.log(`GCS bucket: ${env.GCS_BUCKET}`);
  console.log(`NPM origin: ${env.NPM_ORIGIN}`);
});

export default app;