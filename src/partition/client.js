import { resolve } from 'node:path';
import debuglog from 'debug';
import pMap from 'p-map';
import { BaseHTTPClient, createDispatcher, Cache, CacheEntry, createPartitionKey } from '@_all_docs/cache';
import { Partition } from './index.js';

const debug = debuglog('_all_docs:partition:client');

/**
 * Client for fetching CouchDB _all_docs partitions
 * Uses fetch API and web standards for edge compatibility
 */
export class PartitionClient extends BaseHTTPClient {
  constructor(options = {}) {
    const { origin = 'https://replicate.npmjs.com', env } = options;
    
    // Initialize base client with undici-style options
    super(origin, {
      requestTimeout: 600_000,
      traceHeader: 'x-all-docs-trace',
      userAgent: '_all_docs/0.1.0'
    });
    
    // Set up cache
    const cachePath = options.cache || (env?.CACHE_DIR ? resolve(env.CACHE_DIR, 'partitions') : './cache/partitions');
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

  async requestAll(partitions, options = {}) {
    const {
      limit = this.limit,
      dryRun = this.dryRun
    } = options;

    let misses = 0;
    const entries = await pMap(partitions, async partition => {
      const entry = await this.request(partition, options);
      if (!entry.hit && !dryRun) {
        misses += 1;
      }

      return entry;
    }, { concurrency: limit });

    debug('requestAll |', entries.length, 'misses:', misses);
    return entries;
  }

  /**
   * Request a partition from CouchDB _all_docs endpoint
   * @param {Object} partition - Partition specification
   * @param {string} partition.startKey - Start key for the partition
   * @param {string} partition.endKey - End key for the partition
   * @param {Object} options - Request options
   * @returns {Promise<CacheEntry>} Cache entry with partition data
   */
  async request({ startKey, endKey }, options = {}) {
    // Build URL with query parameters
    const url = new URL('_all_docs', this.origin);
    if (startKey) {
      url.searchParams.set('startkey', `"${startKey}"`);
    }
    if (endKey) {
      url.searchParams.set('endkey', `"${endKey}"`);
    }
    url.searchParams.set('limit', '10000');

    const {
      signal,
      staleWhileRevalidate = true,
      cache = true
    } = options;

    // Check for abort
    signal?.throwIfAborted();

    // Generate cache key
    const cacheKey = createPartitionKey(startKey, endKey, this.origin);
    
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
    headers.set('npm-replication-opt-in', 'true');
    headers.set('accept', 'application/json');
    headers.set('accept-encoding', 'gzip, deflate, br');

    console.log(`${url.href}`);
    
    try {
      // Make the fetch request
      const response = await super.request(url, {
        ...options,
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
        console.error(`Request aborted for partition ${startKey}-${endKey}`);
      } else {
        console.error(`Request failed for partition ${startKey}-${endKey}:`, error.message);
      }
      throw error;
    }
  }

}