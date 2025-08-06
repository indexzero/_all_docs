import cacache from 'cacache';

/**
 * Storage driver using npm's cacache for robust local caching
 * Provides content-addressable storage with built-in integrity checking
 */
export class NodeStorageDriver {
  constructor(basePath) {
    this.cachePath = basePath;
  }

  async get(key) {
    try {
      const { data } = await cacache.get(this.cachePath, key);
      return JSON.parse(data.toString('utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Key not found: ${key}`);
      }
      throw error;
    }
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
}