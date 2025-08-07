import { PartitionClient } from '@_all_docs/partition';
import { PartitionCheckpoint } from '@_all_docs/cache';
import { WorkItemTypes } from '@_all_docs/types';

/**
 * Process a partition-set work item
 * @param {WorkItem} workItem
 * @param {WorkerEnv} env
 * @param {Function} enqueueWork - Function to enqueue child work items
 * @returns {Promise<WorkResult>}
 */
export async function processPartitionSet(workItem, env, enqueueWork) {
  const start = Date.now();
  const { partitions, partitionSetId = workItem.id } = workItem.payload;
  
  try {
    if (!partitions || !Array.isArray(partitions)) {
      throw new Error('Invalid partition set: partitions array required');
    }
    
    // Create partition client for checkpoint management
    const client = new PartitionClient({
      origin: env.NPM_ORIGIN || 'https://replicate.npmjs.com',
      env,
      cache: env.CACHE_DIR || env.CACHE_KV || env.CACHE_DICT
    });
    
    // Initialize checkpoint for tracking progress
    const checkpoint = new PartitionCheckpoint(client.cache, partitionSetId);
    await checkpoint.initialize(partitions);
    
    // Enqueue individual partition work items
    const workItems = [];
    for (let i = 0; i < partitions.length; i++) {
      const partition = partitions[i];
      const childWorkItem = {
        type: WorkItemTypes.PARTITION,
        id: `${partitionSetId}-p${i}`,
        payload: {
          startKey: partition.startKey,
          endKey: partition.endKey,
          partitionSetId,
          index: i
        },
        priority: workItem.priority || 1,
        attempts: 0
      };
      
      // Enqueue the child work item if enqueueWork function is provided
      if (enqueueWork) {
        await enqueueWork(childWorkItem);
      }
      workItems.push(childWorkItem);
    }
    
    // Return progress information
    const progress = await checkpoint.getProgress();
    
    return {
      workItemId: workItem.id,
      success: true,
      data: {
        partitionSetId,
        partitionCount: partitions.length,
        enqueuedCount: workItems.length,
        checkpoint: progress.stats
      },
      duration: Date.now() - start,
      metrics: {
        totalPartitions: partitions.length,
        checkpointCreated: true
      }
    };
  } catch (error) {
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