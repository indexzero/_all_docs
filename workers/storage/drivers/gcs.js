import { Storage } from '@google-cloud/storage';

export class GCSStorageDriver {
  constructor(bucketName) {
    this.storage = new Storage();
    this.bucket = this.storage.bucket(bucketName);
    this.supportsBatch = true;
    this.supportsBloom = false;
  }

  async get(key) {
    const file = this.bucket.file(`${key}.json`);
    const [exists] = await file.exists();
    if (!exists) throw new Error(`Key not found: ${key}`);
    
    const [content] = await file.download();
    return JSON.parse(content.toString());
  }

  async put(key, value) {
    const file = this.bucket.file(`${key}.json`);
    await file.save(JSON.stringify(value), {
      metadata: {
        contentType: 'application/json',
      },
    });
  }

  async has(key) {
    const file = this.bucket.file(`${key}.json`);
    const [exists] = await file.exists();
    return exists;
  }

  async delete(key) {
    const file = this.bucket.file(`${key}.json`);
    await file.delete();
  }

  async *list(prefix) {
    const [files] = await this.bucket.getFiles({ prefix });
    for (const file of files) {
      // Remove .json extension
      yield file.name.replace(/\.json$/, '');
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
    // GCS supports batch operations via the batch API
    const batch = this.storage.batch();
    
    await Promise.all(
      entries.map(async ({ key, value }) => {
        const file = this.bucket.file(`${key}.json`);
        await file.save(JSON.stringify(value), {
          metadata: {
            contentType: 'application/json',
          },
        });
      })
    );
  }
}