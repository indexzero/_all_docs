import { resolve } from 'node:path';
import debuglog from 'debug';
import pMap from 'p-map';
import { BaseHTTPClient, createDispatcher, Cache, CacheEntry, createPackumentKey } from '@_all_docs/cache';

const debug = debuglog('_all_docs:packument:client');

/**
 * Client for fetching npm package documents (packuments)
 * Uses fetch API and web standards for edge compatibility
 */
export class PackumentClient extends BaseHTTPClient {
  constructor(options = {}) {
    const { origin = 'https://registry.npmjs.org', env } = options;
    
    // Initialize base client with undici-style options
    super(origin, {
      requestTimeout: 600_000,
      traceHeader: 'x-all-docs-trace',
      userAgent: '_all_docs/0.1.0'
    });
    
    // Set up cache
    const cachePath = options.cache || (env?.CACHE_DIR ? resolve(env.CACHE_DIR, 'packuments') : './cache/packuments');
    this.cache = new Cache({ 
      path: cachePath,
      env: options.env 
    });
    
    // Initialize dispatcher for connection pooling
    this.initDispatcher(options.env);
    
    // Options
    this.env = options.env;
    this.dryRun = options.dryRun;
    this.limit = options.limit || 10;
  }

  async initDispatcher(env) {
    this.dispatcher = await createDispatcher(env);
  }

  async requestAll(packages, options = {}) {
    const {
      limit = this.limit,
      dryRun = this.dryRun
    } = options;

    let misses = 0;
    const entries = await pMap(packages, async name => {
      const entry = await this.request(name, options);
      if (!entry.hit && !dryRun) {
        misses += 1;
      }

      return entry;
    }, { concurrency: limit });

    debug('requestAll |', entries.length, 'misses:', misses);
    return entries;
  }

  /**
   * Request a package document from the npm registry
   * @param {string} packageName - Name of the package to fetch
   * @param {Object} options - Request options
   * @returns {Promise<CacheEntry|null>} Cache entry with packument data or null for 404
   */
  async request(packageName, options = {}) {
    // Build URL
    const url = new URL(`/${encodeURIComponent(packageName)}`, this.origin);
    
    const {
      signal,
      staleWhileRevalidate = true,
      cache = true
    } = options;

    // Check for abort
    signal?.throwIfAborted();

    // Generate cache key
    const cacheKey = createPackumentKey(packageName, this.origin);
    
    // Try cache first
    if (cache) {
      const cached = await this.cache.fetch(cacheKey);
      if (cached) {
        const entry = CacheEntry.decode(cached);
        if (entry.valid) {
          entry.hit = true;
          return entry;
        }
        
        // Set up conditional request headers
        if (staleWhileRevalidate && entry.etag) {
          this.setCacheHeaders(options, entry);
        }
      }
    }

    // Prepare request headers
    const headers = new Headers(options.headers || {});
    headers.set('accept', 'application/vnd.npm.install-v1+json');
    headers.set('accept-encoding', 'gzip, deflate, br');

    console.log(`${url.href}`);
    
    try {
      // Make the fetch request - filter out custom options
      const { cache: _, staleWhileRevalidate: __, ...fetchOptions } = options;
      const response = await super.request(url, {
        ...fetchOptions,
        headers,
        signal,
        dispatcher: this.dispatcher
      });
      
      // Handle 304 Not Modified
      if (response.status === 304 && cache) {
        const cached = await this.cache.fetch(cacheKey);
        if (cached) {
          const entry = CacheEntry.decode(cached);
          entry.hit = true;
          console.log(`${url.href} 304 Not Modified`);
          return entry;
        }
      }

      // Handle 404 Not Found
      if (response.status === 404) {
        console.log(`${url.href} 404 Not Found`);
        return null;
      }

      // Check for successful response
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`${url.href} ${response.status}`);
      
      // Parse response body as JSON
      const body = await response.json();
      
      // Create cache entry from response
      const entry = new CacheEntry(response.status, response.headers, {
        trustIntegrity: options.trustIntegrity
      });
      await entry.setBody(body);

      // Cache the result
      if (cache) {
        await this.cache.set(cacheKey, entry.encode());
      }

      return entry;
    } catch (error) {
      // Enhance error message
      if (error.name === 'AbortError') {
        console.error(`Request aborted for package ${packageName}`);
      } else {
        console.error(`Request failed for package ${packageName}:`, error.message);
      }
      throw error;
    }
  }

}