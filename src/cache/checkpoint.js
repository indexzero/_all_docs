/**
 * Checkpoint system for tracking partition set processing
 * Provides atomic progress tracking and recovery
 */
export class PartitionCheckpoint {
  constructor(cache, partitionSetId) {
    this.cache = cache;
    this.partitionSetId = partitionSetId;
    this.checkpointKey = `v1:checkpoint:${partitionSetId}`;
  }
  
  async initialize(partitions) {
    const checkpoint = {
      id: this.partitionSetId,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      totalPartitions: partitions.length,
      partitions: partitions.map((p, index) => ({
        index,
        startKey: p.startKey,
        endKey: p.endKey,
        status: 'pending',
        attempts: 0,
        lastAttempt: null,
        completedAt: null,
        error: null
      }))
    };
    
    await this.cache.set(this.checkpointKey, checkpoint);
    return checkpoint;
  }
  
  async getProgress() {
    const checkpoint = await this.cache.fetch(this.checkpointKey);
    if (!checkpoint) return null;
    
    const stats = {
      total: checkpoint.partitions.length,
      pending: 0,
      inProgress: 0,
      completed: 0,
      failed: 0
    };
    
    checkpoint.partitions.forEach(p => {
      stats[p.status]++;
    });
    
    return {
      checkpoint,
      stats,
      percentComplete: (stats.completed / stats.total) * 100
    };
  }
  
  async updatePartition(index, updates) {
    const checkpoint = await this.cache.fetch(this.checkpointKey);
    if (!checkpoint) throw new Error('Checkpoint not found');
    
    Object.assign(checkpoint.partitions[index], updates, {
      updatedAt: Date.now()
    });
    
    checkpoint.updatedAt = Date.now();
    await this.cache.set(this.checkpointKey, checkpoint);
    
    return checkpoint.partitions[index];
  }
  
  async markInProgress(index) {
    return this.updatePartition(index, {
      status: 'inProgress',
      lastAttempt: Date.now(),
      attempts: (await this.getPartition(index)).attempts + 1
    });
  }
  
  async markCompleted(index, metadata = {}) {
    return this.updatePartition(index, {
      status: 'completed',
      completedAt: Date.now(),
      error: null,
      metadata
    });
  }
  
  async markFailed(index, error) {
    return this.updatePartition(index, {
      status: 'failed',
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      }
    });
  }
  
  async getPartition(index) {
    const checkpoint = await this.cache.fetch(this.checkpointKey);
    return checkpoint?.partitions[index];
  }
  
  async getNextPending() {
    const checkpoint = await this.cache.fetch(this.checkpointKey);
    if (!checkpoint) return null;
    
    const next = checkpoint.partitions.find(p => 
      p.status === 'pending' || 
      (p.status === 'failed' && p.attempts < 3)
    );
    
    return next || null;
  }
}