import { createStorageDriver } from '@_all_docs/storage';

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
    this._driverPromise = null;
    this._bloomInitialized = false;
    this._inflightRequests = new Map();
  }
  
  async _ensureDriver() {
    if (this.driver) return this.driver;
    
    if (!this._driverPromise) {
      this._driverPromise = createStorageDriver(this.env).then(driver => {
        this.driver = driver;
        return driver;
      });
    }
    
    return this._driverPromise;
  }
  
  async _initBloomFilter() {
    if (this._bloomInitialized) return;
    this._bloomInitialized = true;
    
    const driver = await this._ensureDriver();
    if (this.bloomFilter === null && driver.supportsBloom) {
      // Simple bloom filter implementation
      this.bloomFilter = {
        bits: new Uint8Array(Math.ceil(this.bloomSize / 8)),
        size: this.bloomSize,
        hashCount: Math.ceil(-Math.log(this.bloomFalsePositiveRate) / Math.log(2)),
        
        add(key) {
          for (let i = 0; i < this.hashCount; i++) {
            const hash = this._hash(key, i) % this.size;
            const byte = Math.floor(hash / 8);
            const bit = hash % 8;
            this.bits[byte] |= (1 << bit);
          }
        },
        
        has(key) {
          for (let i = 0; i < this.hashCount; i++) {
            const hash = this._hash(key, i) % this.size;
            const byte = Math.floor(hash / 8);
            const bit = hash % 8;
            if (!(this.bits[byte] & (1 << bit))) {
              return false;
            }
          }
          return true;
        },
        
        _hash(key, seed) {
          // Simple hash function for bloom filter
          let hash = seed;
          for (let i = 0; i < key.length; i++) {
            hash = ((hash << 5) - hash) + key.charCodeAt(i);
            hash = hash & hash; // Convert to 32-bit integer
          }
          return Math.abs(hash);
        }
      };
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
    
    // Check bloom filter first for non-existence
    if (this.bloomFilter && !this.bloomFilter.has(key)) {
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
    
    // Add to bloom filter
    if (this.bloomFilter) {
      this.bloomFilter.add(key);
    }
    return driver.put(key, value, options);
  }

  async has(key) {
    const driver = await this._ensureDriver();
    
    // Check bloom filter first
    if (this.bloomFilter && !this.bloomFilter.has(key)) {
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
        yield { key, value };
      }
    }
  }
}