export class FastlyStorageDriver {
  constructor(edgeDictionary) {
    this.dict = edgeDictionary;
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
}