export class CloudflareStorageDriver {
  constructor(kvNamespace) {
    this.kv = kvNamespace;
    this.supportsBatch = true;
    this.supportsBloom = false;
  }

  async get(key) {
    const value = await this.kv.get(key, 'json');
    if (!value) throw new Error(`Key not found: ${key}`);
    return value;
  }

  async put(key, value, options = {}) {
    await this.kv.put(key, JSON.stringify(value), options);
  }

  async has(key) {
    const value = await this.kv.get(key);
    return value !== null;
  }

  async delete(key) {
    await this.kv.delete(key);
  }

  async *list(prefix) {
    let cursor;
    do {
      const result = await this.kv.list({ prefix, cursor });
      for (const key of result.keys) {
        yield key.name;
      }
      cursor = result.cursor;
    } while (cursor);
  }
  
  async getBatch(keys) {
    const results = new Map();
    // Cloudflare KV supports batch get natively
    const values = await Promise.all(
      keys.map(key => this.kv.get(key, 'json'))
    );
    
    keys.forEach((key, index) => {
      if (values[index] !== null) {
        results.set(key, values[index]);
      }
    });
    
    return results;
  }
  
  async putBatch(entries) {
    // KV doesn't have native batch put, but we can parallelize
    await Promise.all(
      entries.map(({ key, value }) => this.put(key, value))
    );
  }
}

// Export factory function
export function createStorage(kvNamespace) {
  return new CloudflareStorageDriver(kvNamespace);
}