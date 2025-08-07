/**
 * Cloud Run queue adapter - can use Redis/BullMQ for distributed queue
 */

export class CloudRunQueue {
  constructor(redisUrl) {
    this.redisUrl = redisUrl;
    // For now, use in-memory queue
    // In production, would use BullMQ with Redis
    this.items = [];
  }

  async enqueue(item) {
    this.items.push(item);
    return { id: item.id };
  }

  process(processor) {
    // In Cloud Run, you'd typically use Cloud Tasks or Pub/Sub
    // For now, this is a simplified version
    setInterval(async () => {
      if (this.items.length > 0) {
        const item = this.items.shift();
        await processor(item);
      }
    }, 1000);
  }

  async size() {
    return this.items.length;
  }
}