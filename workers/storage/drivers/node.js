import cacache from 'cacache';

/**
 * Storage driver using npm's cacache for robust local caching
 * Provides content-addressable storage with built-in integrity checking
 */
export class NodeStorageDriver {
  constructor(basePath) {
    this.cachePath = basePath;
    this.supportsBatch = true;
    this.supportsBloom = true;
    this.maxRetries = 3;
    this.baseDelay = 100;
  }

  async _retry(operation, key) {
    let lastError;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (error.code === 'ENOENT' || attempt === this.maxRetries - 1) {
          throw error;
        }
        // Exponential backoff with jitter
        const delay = this.baseDelay * Math.pow(2, attempt) + Math.random() * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }

  async get(key) {
    return this._retry(async () => {
      const { data } = await cacache.get(this.cachePath, key);
      return JSON.parse(data.toString('utf8'));
    }, key).catch(error => {
      if (error.code === 'ENOENT') {
        throw new Error(`Key not found: ${key}`);
      }
      throw error;
    });
  }

  async put(key, value, options = {}) {
    const data = JSON.stringify(value);
    const info = await cacache.put(this.cachePath, key, data);
    // cacache returns integrity hash which could be useful for validation
    return info;
  }

  async has(key) {
    const info = await cacache.get.info(this.cachePath, key);
    return info !== null;
  }

  async delete(key) {
    await cacache.rm.entry(this.cachePath, key);
  }

  async *list(prefix) {
    const stream = cacache.ls.stream(this.cachePath);
    for await (const entry of stream) {
      if (entry.key.startsWith(prefix)) {
        yield entry.key;
      }
    }
  }
  
  async getBatch(keys) {
    const results = new Map();
    await Promise.all(
      keys.map(async key => {
        try {
          const value = await this.get(key);
          results.set(key, value);
        } catch (error) {
          // Skip missing keys
          if (!error.message.includes('not found')) {
            throw error;
          }
        }
      })
    );
    return results;
  }
  
  async putBatch(entries) {
    await Promise.all(
      entries.map(({ key, value }) => this.put(key, value))
    );
  }
}