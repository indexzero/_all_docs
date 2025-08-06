export class EdgeWorkQueue {
  constructor(env) {
    this.env = env;
  }

  async addWork(workItem) {
    if (this.env.RUNTIME === 'cloudflare') {
      // Use Durable Objects for coordination
      const id = this.env.WORK_QUEUE.idFromName('main');
      const queue = this.env.WORK_QUEUE.get(id);
      return await queue.fetch('/enqueue', {
        method: 'POST',
        body: JSON.stringify(workItem),
      });
    } else if (this.env.RUNTIME === 'fastly') {
      // Use Fastly's fanout for pub/sub
      await this.env.FANOUT.publish('work-queue', JSON.stringify(workItem));
    }
  }
}