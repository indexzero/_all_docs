import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import { processPartition, processPackument, processPartitionSet } from '../processors/index.js';
import { WorkItemTypes } from '@_all_docs/types';

// Mock environment
function createMockEnv(overrides = {}) {
  return {
    NPM_ORIGIN: 'https://registry.npmjs.org',
    RUNTIME: 'node',
    CACHE_DIR: join(import.meta.dirname, 'fixtures'),
    DEBUG: false,
    ...overrides
  };
}

// Mock work item factory
function createWorkItem(type, payload, overrides = {}) {
  return {
    type,
    id: `test-${type}-${Date.now()}`,
    payload,
    priority: 1,
    attempts: 0,
    ...overrides
  };
}

describe('processPartition', () => {
  let env;

  beforeEach(() => {
    env = createMockEnv();
  });

  it.skip('should process partition successfully', async () => {
    const workItem = createWorkItem(WorkItemTypes.PARTITION, {
      startKey: 'test-start',
      endKey: 'test-end'
    });

    const result = await processPartition(workItem, env);

    assert.equal(result.success, true);
    assert.equal(result.workItemId, workItem.id);
    assert.ok(result.data);
    assert.ok(result.metrics);
    assert.ok(typeof result.duration === 'number');
  });

  it.skip('should handle partition with checkpoint', async () => {
    const workItem = createWorkItem(WorkItemTypes.PARTITION, {
      startKey: 'a',
      endKey: 'b',
      partitionSetId: 'set-123',
      index: 0
    });

    const result = await processPartition(workItem, env);

    assert.equal(result.success, true);
    assert.ok(result.metrics);
  });

  it('should handle network errors', async () => {
    const workItem = createWorkItem(WorkItemTypes.PARTITION, {
      startKey: 'invalid',
      endKey: 'invalid'
    });

    // Use invalid origin to trigger error
    const errorEnv = createMockEnv({ NPM_ORIGIN: 'https://invalid.example.com' });
    const result = await processPartition(workItem, errorEnv);

    assert.equal(result.success, false);
    assert.ok(result.error);
    assert.ok(result.error.message);
    assert.equal(result.error.statusCode, 500);
  });

  it('should include stack trace in debug mode', async () => {
    const workItem = createWorkItem(WorkItemTypes.PARTITION, {
      startKey: 'error',
      endKey: 'error'
    });

    const debugEnv = createMockEnv({ 
      NPM_ORIGIN: 'https://invalid.example.com',
      DEBUG: true 
    });
    const result = await processPartition(workItem, debugEnv);

    assert.equal(result.success, false);
    assert.ok(result.error.stack);
  });
});

describe('processPackument', () => {
  let env;

  beforeEach(() => {
    env = createMockEnv();
  });

  it('should process packument successfully', async () => {
    const workItem = createWorkItem(WorkItemTypes.PACKUMENT, {
      packageName: 'express'
    });

    const result = await processPackument(workItem, env);

    assert.equal(result.success, true);
    assert.equal(result.workItemId, workItem.id);
    assert.ok(result.data);
    assert.equal(result.data.packageName, 'express');
    assert.ok(result.metrics);
    assert.ok(typeof result.metrics.versions === 'number');
    assert.ok(typeof result.metrics.distTags === 'number');
  });

  it('should fetch dependencies when requested', async () => {
    const workItem = createWorkItem(WorkItemTypes.PACKUMENT, {
      packageName: 'express',
      fetchDependencies: true
    });

    const result = await processPackument(workItem, env);

    assert.equal(result.success, true);
    assert.ok(result.metrics.dependencies);
    assert.ok(Array.isArray(result.metrics.dependencies));
  });

  it('should handle non-existent packages', async () => {
    const workItem = createWorkItem(WorkItemTypes.PACKUMENT, {
      packageName: 'definitely-does-not-exist-xyz-123'
    });

    const result = await processPackument(workItem, env);

    assert.equal(result.success, false);
    assert.ok(result.error);
    assert.ok(result.error.message.includes('not found') || result.error.statusCode === 404);
  });

  it('should handle malformed package names', async () => {
    const workItem = createWorkItem(WorkItemTypes.PACKUMENT, {
      packageName: '../../../etc/passwd'
    });

    const result = await processPackument(workItem, env);

    assert.equal(result.success, false);
    assert.ok(result.error);
  });
});

describe.skip('processPartitionSet', () => {
  let env;
  let enqueuedItems;

  beforeEach(() => {
    env = createMockEnv();
    enqueuedItems = [];
  });

  const mockEnqueue = async (item) => {
    enqueuedItems.push(item);
  };

  it('should process partition set and enqueue children', async () => {
    const partitions = [
      { startKey: 'a', endKey: 'b' },
      { startKey: 'b', endKey: 'c' },
      { startKey: 'c', endKey: 'd' }
    ];

    const workItem = createWorkItem(WorkItemTypes.PARTITION_SET, {
      partitions,
      partitionSetId: 'set-456'
    });

    const result = await processPartitionSet(workItem, env, mockEnqueue);

    assert.equal(result.success, true);
    assert.equal(result.data.partitionCount, 3);
    assert.equal(result.data.enqueuedCount, 3);
    assert.ok(result.data.checkpoint);
    assert.equal(enqueuedItems.length, 3);

    // Verify enqueued items
    enqueuedItems.forEach((item, i) => {
      assert.equal(item.type, WorkItemTypes.PARTITION);
      assert.equal(item.payload.startKey, partitions[i].startKey);
      assert.equal(item.payload.endKey, partitions[i].endKey);
      assert.equal(item.payload.partitionSetId, 'set-456');
      assert.equal(item.payload.index, i);
    });
  });

  it('should handle empty partitions', async () => {
    const workItem = createWorkItem(WorkItemTypes.PARTITION_SET, {
      partitions: []
    });

    const result = await processPartitionSet(workItem, env, mockEnqueue);

    assert.equal(result.success, true);
    assert.equal(result.data.partitionCount, 0);
    assert.equal(enqueuedItems.length, 0);
  });

  it('should handle invalid partition data', async () => {
    const workItem = createWorkItem(WorkItemTypes.PARTITION_SET, {
      partitions: null
    });

    const result = await processPartitionSet(workItem, env);

    assert.equal(result.success, false);
    assert.ok(result.error);
    assert.ok(result.error.message.includes('Invalid partition set'));
  });

  it('should work without enqueue function', async () => {
    const workItem = createWorkItem(WorkItemTypes.PARTITION_SET, {
      partitions: [{ startKey: 'x', endKey: 'y' }]
    });

    // Call without enqueue function
    const result = await processPartitionSet(workItem, env);

    assert.equal(result.success, true);
    assert.equal(result.data.partitionCount, 1);
  });

  it('should use workItem.id as default partitionSetId', async () => {
    const workItem = createWorkItem(WorkItemTypes.PARTITION_SET, {
      partitions: [{ startKey: '1', endKey: '2' }]
    });

    const result = await processPartitionSet(workItem, env, mockEnqueue);

    assert.equal(result.success, true);
    assert.equal(result.data.partitionSetId, workItem.id);
    assert.equal(enqueuedItems[0].payload.partitionSetId, workItem.id);
  });
});

// Helper function tests
function shouldProcessWorkItemSuccessfully(processorFn, workItemType) {
  return async () => {
    const env = createMockEnv();
    const workItem = createWorkItem(workItemType, {
      // Processor-specific payload
      ...(workItemType === WorkItemTypes.PARTITION ? 
        { startKey: 'test', endKey: 'test2' } :
        workItemType === WorkItemTypes.PACKUMENT ?
        { packageName: 'lodash' } :
        { partitions: [] }
      )
    });

    const result = await processorFn(workItem, env);

    assert.equal(result.success, true);
    assert.equal(result.workItemId, workItem.id);
    assert.ok(typeof result.duration === 'number');
    assert.ok(result.duration >= 0);
  };
}

describe('Common processor behaviors', () => {
  it.skip('processPartition should handle work items correctly', 
    shouldProcessWorkItemSuccessfully(processPartition, WorkItemTypes.PARTITION));
  
  it('processPackument should handle work items correctly', 
    shouldProcessWorkItemSuccessfully(processPackument, WorkItemTypes.PACKUMENT));
  
  it.skip('processPartitionSet should handle work items correctly', 
    shouldProcessWorkItemSuccessfully(processPartitionSet, WorkItemTypes.PARTITION_SET));
});