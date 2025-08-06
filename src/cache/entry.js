/**
 * CacheEntry compatible with our caching needs
 * Handles HTTP cache semantics and response encoding/decoding
 */
export class CacheEntry {
  constructor(statusCode, headers, options = {}) {
    this.statusCode = statusCode;
    this.headers = this.normalizeHeaders(headers);
    this.options = options;
    this.body = null;
    this.integrity = null;
    this.hit = false;
    this.timestamp = Date.now();
    this.version = 1;
  }

  normalizeHeaders(headers) {
    const normalized = {};
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        normalized[key.toLowerCase()] = value;
      });
    }
    return normalized;
  }

  async setBody(body) {
    this.body = body;
    // Always calculate integrity for data verification
    const data = JSON.stringify(body);
    this.integrity = await this.calculateIntegrity(data);
  }
  
  async calculateIntegrity(data) {
    if (globalThis.crypto && globalThis.crypto.subtle) {
      // Edge runtime
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hash = await globalThis.crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hash));
      const hashBase64 = btoa(String.fromCharCode(...hashArray));
      return `sha256-${hashBase64}`;
    } else if (typeof globalThis !== 'undefined' && globalThis.process && globalThis.process.versions && globalThis.process.versions.node) {
      // Node.js runtime - use dynamic import
      const { createHash } = await import('crypto');
      const hash = createHash('sha256');
      hash.update(data);
      return `sha256-${hash.digest('base64')}`;
    } else {
      // Fallback - no integrity calculation available
      console.warn('No crypto implementation available for integrity calculation');
      return null;
    }
  }

  json() {
    return this.body;
  }

  get valid() {
    // Check cache validity based on cache-control headers
    const cacheControl = this.headers['cache-control'];
    const age = parseInt(this.headers['age'] || '0', 10);
    const maxAge = this.extractMaxAge(cacheControl);
    
    if (maxAge && age < maxAge) {
      return true;
    }
    
    // Check if we have an etag for conditional requests
    return !!this.etag;
  }

  get etag() {
    return this.headers['etag'];
  }

  extractMaxAge(cacheControl) {
    if (!cacheControl) return null;
    const match = cacheControl.match(/max-age=(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  encode() {
    return {
      statusCode: this.statusCode,
      headers: this.headers,
      body: this.body,
      integrity: this.integrity,
      timestamp: this.timestamp,
      version: this.version
    };
  }

  static decode(data) {
    const entry = new CacheEntry(data.statusCode, data.headers);
    entry.body = data.body;
    entry.integrity = data.integrity;
    entry.timestamp = data.timestamp || Date.now();
    entry.version = data.version || 1;
    return entry;
  }
  
  async verifyIntegrity() {
    if (!this.integrity || !this.body) return false;
    // Recalculate and compare
    const data = JSON.stringify(this.body);
    const calculated = await this.calculateIntegrity(data);
    return calculated === this.integrity;
  }
}