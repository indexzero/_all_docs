/**
 * Cloudflare Durable Objects queue adapter
 */

export class DurableQueue {
  constructor(durableObjectNamespace, env) {
    this.namespace = durableObjectNamespace;
    this.env = env;
  }

  async enqueue(item) {
    // Get or create the queue durable object
    const id = this.namespace.idFromName('main-queue');
    const stub = this.namespace.get(id);
    
    // Send work item to the durable object
    const response = await stub.fetch('https://queue/enqueue', {
      method: 'POST',
      body: JSON.stringify(item),
      headers: { 'content-type': 'application/json' }
    });
    
    return response.json();
  }

  process(processor) {
    // In Cloudflare, processing happens via the durable object
    // This is a no-op as the DO handles its own processing
  }

  async size() {
    const id = this.namespace.idFromName('main-queue');
    const stub = this.namespace.get(id);
    
    const response = await stub.fetch('https://queue/size');
    const { size } = await response.json();
    return size;
  }
}

/**
 * Durable Object for queue management
 */
export class QueueDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.queue = [];
  }

  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/enqueue' && request.method === 'POST') {
      const item = await request.json();
      this.queue.push(item);
      await this.state.storage.put('queue', this.queue);
      
      // Process queue asynchronously
      this.state.waitUntil(this.processQueue());
      
      return new Response(JSON.stringify({ id: item.id }), {
        headers: { 'content-type': 'application/json' }
      });
    }
    
    if (url.pathname === '/size') {
      return new Response(JSON.stringify({ size: this.queue.length }), {
        headers: { 'content-type': 'application/json' }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  }

  async processQueue() {
    // Process items from the queue
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      
      try {
        // Process the work item
        const response = await fetch(`${this.env.WORKER_URL}/work`, {
          method: 'POST',
          body: JSON.stringify(item),
          headers: { 'content-type': 'application/json' }
        });
        
        if (!response.ok) {
          // Retry logic could go here
          console.error('Failed to process item:', item.id);
        }
      } catch (error) {
        console.error('Error processing item:', error);
        // Put item back in queue for retry
        this.queue.unshift(item);
      }
      
      // Save queue state
      await this.state.storage.put('queue', this.queue);
    }
  }
}