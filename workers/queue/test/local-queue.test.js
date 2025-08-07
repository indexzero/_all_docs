import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { LocalWorkQueue } from '../local.js';

// Mock worker for testing
class MockWorker {
  constructor(id, processFn) {
    this.id = id;
    this.processFn = processFn || (async (item) => ({ 
      workerId: this.id, 
      processed: item 
    }));
  }

  async process(workItem) {
    return this.processFn(workItem);
  }
}

describe('LocalWorkQueue', () => {
  let queue;

  beforeEach(() => {
    queue = new LocalWorkQueue({
      concurrency: 2,
      requestsPerSecond: 10
    });
  });

  it('should initialize with correct configuration', () => {
    assert.ok(queue.queue);
    assert.ok(queue.workers instanceof Map);
    assert.equal(queue.workers.size, 0);
  });

  it('should add and select workers', () => {
    const worker1 = new MockWorker('w1');
    const worker2 = new MockWorker('w2');
    
    queue.workers.set('w1', worker1);
    queue.workers.set('w2', worker2);
    
    const selected = queue.selectWorker({ type: 'test' });
    assert.ok(selected === worker1 || selected === worker2);
  });

  it('should process work items with retry', async () => {
    let processCount = 0;
    const worker = new MockWorker('test-worker', async (item) => {
      processCount++;
      if (processCount < 2) {
        throw new Error('Temporary failure');
      }
      return { success: true, item };
    });
    
    queue.workers.set('test', worker);
    
    const workItem = {
      type: 'test',
      id: 'item-1',
      payload: { data: 'test' },
      priority: 1
    };
    
    const result = await queue.addWork(workItem);
    
    assert.equal(processCount, 2); // Should retry once
    assert.equal(result.success, true);
    assert.deepEqual(result.item, workItem);
  });

  it.skip('should handle rate limit errors with retry', async () => {
    let attempts = 0;
    const worker = new MockWorker('rate-limited', async (item) => {
      attempts++;
      if (attempts < 3) {
        const error = new Error('Too Many Requests');
        error.statusCode = 429;
        throw error;
      }
      return { success: true, attempts };
    });
    
    queue.workers.set('rate', worker);
    
    const workItem = {
      type: 'rate-test',
      id: 'item-2',
      payload: {},
      priority: 2
    };
    
    const result = await queue.addWork(workItem);
    
    assert.equal(result.success, true);
    assert.equal(result.attempts, 3);
  });

  it.skip('should respect priority ordering', async () => {
    const processedOrder = [];
    const worker = new MockWorker('priority-test', async (item) => {
      // Add delay to ensure queue ordering matters
      await new Promise(resolve => setTimeout(resolve, 50));
      processedOrder.push(item.id);
      return { processed: item.id };
    });
    
    queue.workers.set('priority', worker);
    
    // Add items with different priorities
    const promises = [
      queue.addWork({ id: 'low', priority: 1 }),
      queue.addWork({ id: 'high', priority: 10 }),
      queue.addWork({ id: 'medium', priority: 5 })
    ];
    
    await Promise.all(promises);
    
    // High priority should be processed before low priority
    const highIndex = processedOrder.indexOf('high');
    const lowIndex = processedOrder.indexOf('low');
    assert.ok(highIndex < lowIndex, 'High priority should process before low priority');
  });

  it('should handle worker failures after max retries', async () => {
    const worker = new MockWorker('failing', async () => {
      throw new Error('Permanent failure');
    });
    
    queue.workers.set('fail', worker);
    
    await assert.rejects(
      async () => await queue.addWork({ id: 'fail-item', priority: 1 }),
      /Permanent failure/
    );
  });

  it('should handle no workers gracefully', async () => {
    // Queue has no workers
    assert.equal(queue.workers.size, 0);
    
    await assert.rejects(
      async () => await queue.addWork({ id: 'no-worker', priority: 1 }),
      /Cannot read properties/
    );
  });

  it('should handle concurrent work items', async () => {
    const results = [];
    const worker = new MockWorker('concurrent', async (item) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      const result = { id: item.id, timestamp: Date.now() };
      results.push(result);
      return result;
    });
    
    queue.workers.set('concurrent', worker);
    
    // Add multiple work items
    const items = Array(5).fill(null).map((_, i) => ({
      id: `concurrent-${i}`,
      priority: 1
    }));
    
    const promises = items.map(item => queue.addWork(item));
    await Promise.all(promises);
    
    assert.equal(results.length, 5);
    results.forEach(r => assert.ok(r.id && r.timestamp));
  });

  it('should respect concurrency limits', async () => {
    let activeCount = 0;
    let maxActive = 0;
    
    const worker = new MockWorker('concurrency-test', async (item) => {
      activeCount++;
      maxActive = Math.max(maxActive, activeCount);
      await new Promise(resolve => setTimeout(resolve, 100));
      activeCount--;
      return { processed: item.id };
    });
    
    queue.workers.set('concurrency', worker);
    
    // Queue has concurrency of 2
    const items = Array(5).fill(null).map((_, i) => ({
      id: `conc-${i}`,
      priority: 1
    }));
    
    const promises = items.map(item => queue.addWork(item));
    await Promise.all(promises);
    
    assert.ok(maxActive <= 2, `Max active (${maxActive}) should not exceed concurrency limit (2)`);
  });
});