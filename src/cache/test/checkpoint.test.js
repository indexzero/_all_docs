import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import { PartitionCheckpoint } from '../checkpoint.js';
import { Cache } from '../cache.js';

describe.skip('PartitionCheckpoint', () => {
  let cache;
  let checkpoint;
  const testPartitions = [
    { startKey: 'a', endKey: 'b' },
    { startKey: 'b', endKey: 'c' },
    { startKey: 'c', endKey: 'd' }
  ];

  beforeEach(() => {
    const cachePath = join(import.meta.dirname, 'fixtures', 'checkpoint-test');
    cache = new Cache({ 
      path: cachePath,
      env: { 
        RUNTIME: 'node',
        CACHE_DIR: cachePath
      }
    });
    checkpoint = new PartitionCheckpoint(cache, 'test-partition-set-123');
  });

  it('should initialize checkpoint with partitions', async () => {
    const result = await checkpoint.initialize(testPartitions);
    
    assert.equal(result.id, 'test-partition-set-123');
    assert.equal(result.version, 1);
    assert.equal(result.totalPartitions, 3);
    assert.ok(result.createdAt);
    assert.ok(result.updatedAt);
    
    assert.equal(result.partitions.length, 3);
    result.partitions.forEach((p, i) => {
      assert.equal(p.index, i);
      assert.equal(p.startKey, testPartitions[i].startKey);
      assert.equal(p.endKey, testPartitions[i].endKey);
      assert.equal(p.status, 'pending');
      assert.equal(p.attempts, 0);
      assert.equal(p.lastAttempt, null);
      assert.equal(p.completedAt, null);
      assert.equal(p.error, null);
    });
  });

  it('should get progress statistics', async () => {
    await checkpoint.initialize(testPartitions);
    const progress = await checkpoint.getProgress();
    
    assert.ok(progress.checkpoint);
    assert.deepEqual(progress.stats, {
      total: 3,
      pending: 3,
      inProgress: 0,
      completed: 0,
      failed: 0
    });
    assert.equal(progress.percentComplete, 0);
  });

  it('should mark partition in progress', async () => {
    await checkpoint.initialize(testPartitions);
    
    const updated = await checkpoint.markInProgress(1);
    assert.equal(updated.status, 'inProgress');
    assert.equal(updated.attempts, 1);
    assert.ok(updated.lastAttempt);
    
    const progress = await checkpoint.getProgress();
    assert.equal(progress.stats.inProgress, 1);
    assert.equal(progress.stats.pending, 2);
  });

  it('should mark partition completed', async () => {
    await checkpoint.initialize(testPartitions);
    await checkpoint.markInProgress(0);
    
    const metadata = { rows: 1000, cacheHit: true };
    const updated = await checkpoint.markCompleted(0, metadata);
    
    assert.equal(updated.status, 'completed');
    assert.ok(updated.completedAt);
    assert.equal(updated.error, null);
    assert.deepEqual(updated.metadata, metadata);
    
    const progress = await checkpoint.getProgress();
    assert.equal(progress.stats.completed, 1);
    assert.equal(progress.percentComplete, 33.33333333333333);
  });

  it('should mark partition failed', async () => {
    await checkpoint.initialize(testPartitions);
    await checkpoint.markInProgress(2);
    
    const error = new Error('Network timeout');
    error.code = 'ETIMEDOUT';
    
    const updated = await checkpoint.markFailed(2, error);
    
    assert.equal(updated.status, 'failed');
    assert.ok(updated.error);
    assert.equal(updated.error.message, 'Network timeout');
    assert.equal(updated.error.code, 'ETIMEDOUT');
    
    const progress = await checkpoint.getProgress();
    assert.equal(progress.stats.failed, 1);
  });

  it('should handle multiple attempts', async () => {
    await checkpoint.initialize(testPartitions);
    
    // First attempt
    await checkpoint.markInProgress(1);
    await checkpoint.markFailed(1, new Error('First failure'));
    
    // Second attempt
    await checkpoint.markInProgress(1);
    const partition = await checkpoint.getPartition(1);
    
    assert.equal(partition.attempts, 2);
    assert.equal(partition.status, 'inProgress');
  });

  it('should get next pending partition', async () => {
    await checkpoint.initialize(testPartitions);
    
    // Mark first as completed
    await checkpoint.markInProgress(0);
    await checkpoint.markCompleted(0);
    
    // Mark second as in progress
    await checkpoint.markInProgress(1);
    
    // Should return the third partition
    const next = await checkpoint.getNextPending();
    assert.equal(next.index, 2);
    assert.equal(next.status, 'pending');
  });

  it('should retry failed partitions under attempt limit', async () => {
    await checkpoint.initialize(testPartitions);
    
    // Fail partition with 2 attempts
    await checkpoint.markInProgress(0);
    await checkpoint.markFailed(0, new Error('Fail 1'));
    await checkpoint.markInProgress(0);
    await checkpoint.markFailed(0, new Error('Fail 2'));
    
    // Should still be eligible for retry
    const next = await checkpoint.getNextPending();
    assert.equal(next.index, 0);
    assert.equal(next.attempts, 2);
    assert.equal(next.status, 'failed');
  });

  it('should not retry partitions at attempt limit', async () => {
    await checkpoint.initialize(testPartitions);
    
    // Fail partition with 3 attempts
    for (let i = 0; i < 3; i++) {
      await checkpoint.markInProgress(0);
      await checkpoint.markFailed(0, new Error(`Fail ${i + 1}`));
    }
    
    // Mark all others as completed
    await checkpoint.markCompleted(1);
    await checkpoint.markCompleted(2);
    
    // Should return null - no eligible partitions
    const next = await checkpoint.getNextPending();
    assert.equal(next, null);
  });

  it('should handle missing checkpoint gracefully', async () => {
    const progress = await checkpoint.getProgress();
    assert.equal(progress, null);
    
    const partition = await checkpoint.getPartition(0);
    assert.equal(partition, undefined);
    
    const next = await checkpoint.getNextPending();
    assert.equal(next, null);
  });

  it('should throw when updating non-existent checkpoint', async () => {
    await assert.rejects(
      async () => await checkpoint.updatePartition(0, { status: 'completed' }),
      /Checkpoint not found/
    );
  });
});