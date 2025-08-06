export class CloudflareStorageDriver {
  constructor(kvNamespace) {
    this.kv = kvNamespace;
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
}