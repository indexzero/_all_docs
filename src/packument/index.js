import { CacheEntry, createPackumentKey, decodeCacheKey } from '@_all_docs/cache';

class Packument {
  constructor({ name, contents, origin }) {
    this.name = name;
    this.contents = contents;
    this.origin = origin;
  }

  static cacheKey(name, origin = 'https://registry.npmjs.com') {
    return createPackumentKey(name, origin);
  }

  static fromCacheEntry([key, val]) {
    // Decode the cache key to get package name and origin
    const decoded = decodeCacheKey(key);
    if (decoded.type !== 'packument') {
      throw new Error(`Invalid cache key type: ${decoded.type}`);
    }
    
    const entry = CacheEntry.decode(val);
    const body = entry.json();

    // TODO (0): include all CacheEntry metadata (e.g. headers, etc)
    return new Packument({
      name: decoded.packageName,
      contents: body,
      origin: decoded.origin
    });
  }
}

export { Packument };
export { PackumentClient } from './client.js';
