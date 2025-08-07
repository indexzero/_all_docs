import { PartitionClient } from '@_all_docs/partition';
import { PartitionCheckpoint } from '@_all_docs/cache';

/**
 * Process a partition work item
 * @param {WorkItem} workItem
 * @param {WorkerEnv} env
 * @returns {Promise<WorkResult>}
 */
export async function processPartition(workItem, env) {
  const start = Date.now();
  const { startKey, endKey, partitionSetId, index } = workItem.payload;
  let checkpoint;
  
  try {
    // Create partition client with environment configuration
    const client = new PartitionClient({
      origin: env.NPM_ORIGIN || 'https://replicate.npmjs.com',
      env,
      cache: env.CACHE_DIR || env.CACHE_KV || env.CACHE_DICT
    });
    
    // Initialize the client to ensure cache is ready
    await client.initializeAsync(env);
    
    // Update checkpoint if provided
    if (partitionSetId) {
      checkpoint = new PartitionCheckpoint(client.cache, partitionSetId);
      await checkpoint.markInProgress(index);
    }
    
    // Fetch the partition data
    const entry = await client.request({ startKey, endKey }, {
      staleWhileRevalidate: true,
      cache: true
    });
    
    // Extract metrics
    const metrics = {
      totalRows: entry.body?.total_rows || 0,
      fetchedRows: entry.body?.rows?.length || 0,
      cacheHit: entry.hit || false,
      statusCode: entry.statusCode
    };
    
    // Update checkpoint with success
    if (checkpoint) {
      await checkpoint.markCompleted(index, metrics);
    }
    
    return {
      workItemId: workItem.id,
      success: true,
      data: {
        partition: { startKey, endKey },
        metrics
      },
      duration: Date.now() - start,
      metrics
    };
  } catch (error) {
    // Update checkpoint with failure
    if (checkpoint) {
      await checkpoint.markFailed(index, error);
    }
    
    return {
      workItemId: workItem.id,
      success: false,
      error: {
        message: error.message,
        statusCode: error.statusCode || 500,
        stack: env.DEBUG ? error.stack : undefined
      },
      duration: Date.now() - start,
    };
  }
}