/**
 * Fastly queue adapter - uses backend service for queue management
 */

export class FastlyQueue {
  constructor() {
    // In Fastly, we'd typically use a backend service for queue management
    this.backendName = 'queue_backend';
  }

  async enqueue(item) {
    // Send to backend queue service
    const response = await fetch(`https://${this.backendName}/queue/enqueue`, {
      method: 'POST',
      body: JSON.stringify(item),
      headers: { 'content-type': 'application/json' },
      backend: this.backendName
    });
    
    return response.json();
  }

  process(processor) {
    // Fastly doesn't have background processing
    // Work items would be processed by polling or webhooks
  }

  async size() {
    const response = await fetch(`https://${this.backendName}/queue/size`, {
      backend: this.backendName
    });
    
    const { size } = await response.json();
    return size;
  }
}