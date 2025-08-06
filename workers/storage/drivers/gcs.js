import { Storage } from '@google-cloud/storage';

export class GCSStorageDriver {
  constructor(bucketName) {
    this.storage = new Storage();
    this.bucket = this.storage.bucket(bucketName);
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
}