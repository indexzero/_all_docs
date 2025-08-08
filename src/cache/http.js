/**
 * Base HTTP client using fetch API and undici design principles
 * Works across all runtimes (Node.js, edge workers, browsers)
 */
export class BaseHTTPClient {
  constructor(origin, options = {}) {
    this.origin = origin;
    this.dispatcher = options.dispatcher; // undici dispatcher (Agent, Pool, etc.)
    this.requestTimeout = options.requestTimeout || 30000;
    this.traceHeader = options.traceHeader || 'x-trace-id';
    this.defaultHeaders = new Headers({
      'user-agent': options.userAgent || '_all_docs/0.1.0'
    });
  }

  /**
   * Makes an HTTP request using fetch API
   * @param {string|URL} path - Path or full URL
   * @param {RequestInit & { dispatcher?: any }} options - Fetch options with optional undici dispatcher
   * @returns {Promise<Response>} Standard Response object
   */
  async request(path, options = {}) {
    // Build the full URL
    const url = path instanceof URL ? path : new URL(path, this.origin);
    
    // Create request with proper headers
    const headers = new Headers(this.defaultHeaders);
    if (options.headers) {
      const optHeaders = options.headers instanceof Headers 
        ? options.headers 
        : new Headers(options.headers);
      optHeaders.forEach((value, key) => headers.set(key, value));
    }
    
    // Add trace header if not present
    if (!headers.has(this.traceHeader)) {
      headers.set(this.traceHeader, this.generateTraceId());
    }
    
    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(new Error('Request timeout')),
      options.requestTimeout || this.requestTimeout
    );
    
    // Merge signals if provided
    const signal = options.signal 
      ? AbortSignal.any([options.signal, controller.signal])
      : controller.signal;
    
    try {
      // Prepare fetch options
      const fetchOptions = {
        method: options.method || 'GET',
        headers,
        signal,
        // Use undici dispatcher if available (Node.js)
        ...(this.dispatcher && { dispatcher: options.dispatcher || this.dispatcher }),
        // Standard fetch options
        ...(options.body && { body: options.body }),
        ...(options.mode && { mode: options.mode }),
        ...(options.credentials && { credentials: options.credentials }),
        ...(options.cache && { cache: options.cache }),
        ...(options.redirect && { redirect: options.redirect }),
        ...(options.referrer && { referrer: options.referrer }),
        ...(options.referrerPolicy && { referrerPolicy: options.referrerPolicy }),
        ...(options.integrity && { integrity: options.integrity })
      };

      // Use global fetch (which may be undici's fetch in Node.js)
      const response = await fetch(url, fetchOptions);
      
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  /**
   * Generate a unique trace ID for request tracking
   * @returns {string} Trace ID
   */
  generateTraceId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Add cache validation headers to request options
   * @param {RequestInit} options - Request options to modify
   * @param {CacheEntry} cacheEntry - Cache entry with etag/last-modified
   */
  setCacheHeaders(options, cacheEntry) {
    if (!cacheEntry) return;
    
    // Ensure headers is a Headers instance
    if (!options.headers) {
      options.headers = new Headers();
    } else if (!(options.headers instanceof Headers)) {
      options.headers = new Headers(options.headers);
    }
    
    // Add conditional headers
    if (cacheEntry.etag) {
      options.headers.set('if-none-match', cacheEntry.etag);
    }
    if (cacheEntry.lastModified) {
      options.headers.set('if-modified-since', cacheEntry.lastModified);
    }
  }
}

/**
 * Create an undici dispatcher for connection pooling
 * @param {Object} env - Environment configuration
 * @returns {Promise<import('undici').Dispatcher|null>} Dispatcher instance or null
 */
export async function createDispatcher(env) {
  // Only create dispatcher in Node.js environments
  if (typeof globalThis.fetch === 'undefined' || env?.RUNTIME === 'node') {
    try {
      const { Agent } = await import('undici');
      return new Agent({
        bodyTimeout: 600_000,
        headersTimeout: 600_000,
        keepAliveTimeout: 600_000,
        keepAliveMaxTimeout: 600_000,
        connections: env?.MAX_CONNECTIONS || 256,
        pipelining: env?.PIPELINING || 10,
        // Enable HTTP/2 if supported
        ...(env?.HTTP2 && { allowH2: true })
      });
    } catch (err) {
      // undici not available, fall back to native fetch
      return null;
    }
  }
  return null;
}

// Export createAgent as alias for backwards compatibility
export const createAgent = createDispatcher;