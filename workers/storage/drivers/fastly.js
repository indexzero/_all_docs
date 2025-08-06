export class FastlyStorageDriver {
  constructor(edgeDictionary) {
    this.dict = edgeDictionary;
    this.supportsBatch = false;
    this.supportsBloom = false;
  }

  async get(key) {
    const value = await this.dict.get(key);
    if (!value) throw new Error(`Key not found: ${key}`);
    return JSON.parse(value);
  }

  async put(key, value) {
    await this.dict.set(key, JSON.stringify(value));
  }

  async has(key) {
    const value = await this.dict.get(key);
    return value !== null;
  }

  async delete(key) {
    await this.dict.delete(key);
  }

  async *list(prefix) {
    // Fastly doesn't support listing keys, so this would need a workaround
    // such as maintaining an index in a separate key
    throw new Error('List operation not supported in Fastly edge dictionary');
  }
  
  async getBatch(keys) {
    // Implement basic batch support even though not optimal
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