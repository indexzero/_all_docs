import PQueue from 'p-queue';
import pRetry from 'p-retry';

export class LocalWorkQueue {
  constructor(options = {}) {
    this.queue = new PQueue({
      concurrency: options.concurrency || 10,
      interval: 1000,
      intervalCap: options.requestsPerSecond || 20,
      carryoverConcurrencyCount: true,
    });
    
    this.workers = new Map();
  }

  /**
   * @param {import('@_all_docs/worker/interfaces').WorkItem} workItem
   * @returns {Promise<import('@_all_docs/worker/interfaces').ProcessorResult>}
   */
  async addWork(workItem) {
    return this.queue.add(async () => {
      return pRetry(
        async () => {
          const worker = this.selectWorker(workItem);
          return await worker.process(workItem);
        },
        {
          retries: 3,
          onFailedAttempt: error => {
            if (error.statusCode === 429) {
              // Exponential backoff for rate limits
              throw error;
            }
          }
        }
      );
    }, { priority: workItem.priority });
  }

  selectWorker(workItem) {
    // Simple round-robin or least-loaded selection
    const workers = Array.from(this.workers.values());
    return workers[Math.floor(Math.random() * workers.length)];
  }

  // Methods to match the Queue interface
  async enqueue(item) {
    return this.addWork(item);
  }

  process(processor) {
    // Register the processor with the queue
    this.workers.set('main', {
      process: processor
    });
  }

  async size() {
    return this.queue.size;
  }
}

// Export factory function
export function createQueue(options) {
  return new LocalWorkQueue(options);
}