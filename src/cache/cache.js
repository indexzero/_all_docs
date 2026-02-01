import bloomFilters from 'bloom-filters';
const { BloomFilter } = bloomFilters;

/**
 * Cache abstraction that accepts storage drivers
 */
export class Cache {
  constructor(options = {}) {
    this.path = options.path;
    this.driver = options.driver || null;
    this.env = options.env;
    this.bloomFilter = options.bloomFilter || null;
    this.bloomSize = options.bloomSize || 10000;
    this.bloomFalsePositiveRate = options.bloomFalsePositiveRate || 0.01;
    this._bloomInitialized = false;
    this._bloomPopulated = false; // True only when bloom filter is populated from existing data
    this._inflightRequests = new Map();
    this._driverInitialized = false;

    if (!this.driver) {
      throw new Error('Storage driver is required');
    }
  }
  
  async _ensureDriver() {
    if (!this.driver) {
      throw new Error('Storage driver is required');
    }
    return this.driver;
  }
  
  async _initBloomFilter() {
    if (this._bloomInitialized) return;
    this._bloomInitialized = true;
    
    const driver = await this._ensureDriver();
    if (this.bloomFilter === null && driver.supportsBloom) {
      // Use the professional bloom-filters package
      // Calculate optimal number of hash functions
      const nbHashes = Math.ceil(-Math.log(this.bloomFalsePositiveRate) / Math.log(2));
      
      // Create a new bloom filter with the specified size and hash functions
      this.bloomFilter = new BloomFilter(this.bloomSize, nbHashes);
    }
  }

  async fetch(key, options = {}) {
    // Request coalescing - prevent duplicate requests for the same key
    const requestKey = `fetch:${key}:${JSON.stringify(options)}`;
    
    if (this._inflightRequests.has(requestKey)) {
      return this._inflightRequests.get(requestKey);
    }
    
    const promise = this._doFetch(key, options)
      .finally(() => this._inflightRequests.delete(requestKey));
    
    this._inflightRequests.set(requestKey, promise);
    return promise;
  }
  
  async _doFetch(key, options = {}) {
    const driver = await this._ensureDriver();
    await this._initBloomFilter();

    // Only use bloom filter if it was pre-populated (e.g., loaded from disk)
    // An empty bloom filter would incorrectly reject all keys from existing caches
    if (this.bloomFilter && this._bloomPopulated && !this.bloomFilter.has(key)) {
      return null; // Definitely not in cache
    }

    try {
      const value = await driver.get(key);
      // Handle cache validation, ETags, etc.
      return value;
    } catch (error) {
      if (error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  }

  async set(key, value, options = {}) {
    const driver = await this._ensureDriver();
    await this._initBloomFilter();

    // Add to bloom filter and mark as populated
    if (this.bloomFilter) {
      this.bloomFilter.add(key);
      this._bloomPopulated = true;
    }
    return driver.put(key, value, options);
  }

  async has(key) {
    const driver = await this._ensureDriver();
    await this._initBloomFilter();

    // Only use bloom filter if it was pre-populated
    if (this.bloomFilter && this._bloomPopulated && !this.bloomFilter.has(key)) {
      return false; // Definitely not in cache
    }
    return driver.has(key);
  }

  async delete(key) {
    const driver = await this._ensureDriver();
    return driver.delete(key);
  }

  async *keys(prefix) {
    const driver = await this._ensureDriver();
    yield* driver.list(prefix);
  }
  
  // Support for legacy map interface
  map(fn) {
    // eslint-disable-next-line unicorn/no-this-assignment
    const frame = this;
    return {
      * [Symbol.iterator]() {
        for (const entry of frame) {
          yield fn(entry);
        }
      },

      async * [Symbol.asyncIterator]() {
        for await (const entry of frame) {
          yield fn(entry);
        }
      }
    };
  }
  
  // Iterator support
  async *[Symbol.asyncIterator]() {
    for await (const key of this.keys('')) {
      const value = await this.fetch(key);
      if (value) {
        yield [key, value];
      }
    }
  }
}