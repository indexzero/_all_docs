/**
 * Mock storage driver for testing
 */
export class MockStorageDriver {
  constructor() {
    this.store = new Map();
    this.supportsBatch = true;
    this.supportsBloom = true;
  }

  async get(key) {
    const value = this.store.get(key);
    if (!value) throw new Error(`Key not found: ${key}`);
    return value;
  }

  async put(key, value) {
    this.store.set(key, value);
  }

  async has(key) {
    return this.store.has(key);
  }

  async delete(key) {
    this.store.delete(key);
  }

  async *list(prefix) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        yield key;
      }
    }
  }

  async getBatch(keys) {
    const results = new Map();
    for (const key of keys) {
      if (this.store.has(key)) {
        results.set(key, this.store.get(key));
      }
    }
    return results;
  }

  async putBatch(entries) {
    for (const { key, value } of entries) {
      this.store.set(key, value);
    }
  }
}