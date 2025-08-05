import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// Processor imports - to be implemented in Phase 6
// For now, these are placeholder functions
const processPartition = async (workItem, env) => {
  console.log('Processing partition:', workItem);
  return {
    workItemId: workItem.id,
    success: true,
    data: { message: 'Partition processing not yet implemented' },
    duration: 0
  };
};

const processPackument = async (workItem, env) => {
  console.log('Processing packument:', workItem);
  return {
    workItemId: workItem.id,
    success: true,
    data: { message: 'Packument processing not yet implemented' },
    duration: 0
  };
};

const processPartitionSet = async (workItem, env) => {
  console.log('Processing partition set:', workItem);
  return {
    workItemId: workItem.id,
    success: true,
    data: { message: 'Partition set processing not yet implemented' },
    duration: 0
  };
};

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Health check endpoint
app.get('/health', (c) => {
  const env = c.env;
  return c.json({
    status: 'ok',
    runtime: env?.RUNTIME || 'unknown',
    timestamp: new Date().toISOString()
  });
});

// Work endpoints
app.post('/work/partition', async (c) => {
  try {
    const workItem = await c.req.json();
    const env = c.env;
    
    // Validate work item
    if (!workItem.id || !workItem.type) {
      return c.json({ 
        error: 'Invalid work item: missing id or type' 
      }, 400);
    }
    
    // Process partition work using abstractions
    const result = await processPartition(workItem, env);
    return c.json(result);
  } catch (error) {
    console.error('Error processing partition:', error);
    return c.json({ 
      error: error.message || 'Internal server error' 
    }, 500);
  }
});

app.post('/work/packument', async (c) => {
  try {
    const workItem = await c.req.json();
    const env = c.env;
    
    // Validate work item
    if (!workItem.id || !workItem.type) {
      return c.json({ 
        error: 'Invalid work item: missing id or type' 
      }, 400);
    }
    
    // Process packument work using abstractions
    const result = await processPackument(workItem, env);
    return c.json(result);
  } catch (error) {
    console.error('Error processing packument:', error);
    return c.json({ 
      error: error.message || 'Internal server error' 
    }, 500);
  }
});

app.post('/work/partition-set', async (c) => {
  try {
    const workItem = await c.req.json();
    const env = c.env;
    
    // Validate work item
    if (!workItem.id || !workItem.type) {
      return c.json({ 
        error: 'Invalid work item: missing id or type' 
      }, 400);
    }
    
    // Process partition set work using abstractions
    const result = await processPartitionSet(workItem, env);
    return c.json(result);
  } catch (error) {
    console.error('Error processing partition set:', error);
    return c.json({ 
      error: error.message || 'Internal server error' 
    }, 500);
  }
});

// 404 handler
app.notFound((c) => {
  return c.json({ 
    error: 'Not found',
    path: c.req.path 
  }, 404);
});

// Global error handler
app.onError((err, c) => {
  console.error('Global error:', err);
  return c.json({ 
    error: err.message || 'Internal server error' 
  }, 500);
});

export default app;