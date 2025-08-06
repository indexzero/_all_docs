import { Queue, Worker, QueueScheduler } from 'bullmq';

export class DistributedWorkQueue {
  constructor(options = {}) {
    const connection = {
      host: options.redisHost || 'localhost',
      port: options.redisPort || 6379,
    };

    this.queue = new Queue('all-docs-work', { connection });
    this.scheduler = new QueueScheduler('all-docs-work', { connection });
  }

  /**
   * @param {WorkItem} workItem
   * @returns {Promise<string>} Job ID
   */
  async addWork(workItem) {
    const job = await this.queue.add(
      workItem.type,
      workItem.payload,
      {
        priority: workItem.priority,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    
    return job.id;
  }

  /**
   * Create a worker process for this queue
   */
  createWorker(processor, options = {}) {
    return new Worker(
      'all-docs-work',
      async (job) => {
        const workItem = {
          type: job.name,
          payload: job.data,
          id: job.id,
          attempts: job.attemptsMade,
        };
        
        return await processor(workItem);
      },
      {
        connection: this.queue.opts.connection,
        concurrency: options.concurrency || 10,
        limiter: {
          max: options.requestsPerSecond || 20,
          duration: 1000,
        },
      }
    );
  }
}