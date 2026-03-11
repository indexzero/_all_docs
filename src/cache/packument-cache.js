import { Cache } from './cache.js';
import { CacheEntry } from './entry.js';
import { createPackumentKey } from './cache-key.js';
import { defaultCacheDir } from './default-cache-dir.js';

/**
 * Minimal cacache storage driver for Node.js environments.
 * Used as the default when no external driver is injected.
 * @private
 */
class CacacheDriver {
  constructor(cachePath) {
    this.cachePath = cachePath;
    this.supportsBatch = false;
    this.supportsBloom = false;
    /** @type {import('cacache') | null} */
    this._cacache = null;
  }

  async _ensureCacache() {
    if (this._cacache) return this._cacache;
    try {
      this._cacache = (await import('cacache')).default;
    } catch {
      throw new Error(
        "PackumentCache requires 'cacache' for Node.js caching.\n" +
        '  Install it: npm install cacache\n' +
        '  Or provide a custom driver: new PackumentCache({ driver, origin })'
      );
    }
    return this._cacache;
  }

  async get(key) {
    const cacache = await this._ensureCacache();
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

  async put(key, value) {
    const cacache = await this._ensureCacache();
    const data = typeof value === 'string' ? value : JSON.stringify(value);
    await cacache.put(this.cachePath, key, data);
  }

  async has(key) {
    const cacache = await this._ensureCacache();
    const info = await cacache.get.info(this.cachePath, key);
    return info !== null;
  }

  async delete(key) {
    const cacache = await this._ensureCacache();
    await cacache.rm.entry(this.cachePath, key);
  }

  async *list(prefix) {
    const cacache = await this._ensureCacache();
    const stream = cacache.ls.stream(this.cachePath);
    for await (const entry of stream) {
      if (entry.key.startsWith(prefix)) {
        yield entry.key;
      }
    }
  }
}

/**
 * High-level packument cache API.
 *
 * Hides cache key construction, storage driver creation,
 * and CacheEntry encode/decode from consumers.
 *
 * @example
 * ```js
 * import { PackumentCache } from '@_all_docs/cache';
 *
 * const cache = new PackumentCache({
 *   origin: 'https://registry.npmjs.org'
 * });
 *
 * // Read
 * const entry = await cache.get('lodash');
 *
 * // Write (from HTTP response)
 * await cache.put('lodash', {
 *   statusCode: 200,
 *   headers: { etag: '"abc"', 'cache-control': 'max-age=300' },
 *   body: packumentJson
 * });
 *
 * // Conditional request headers
 * const headers = await cache.conditionalHeaders('lodash');
 * ```
 */
export class PackumentCache {
  /**
   * @param {Object} options
   * @param {string} options.origin - Registry origin URL (required)
   * @param {string} [options.cacheDir] - Cache directory override. Defaults to platform-specific location.
   * @param {Object} [options.driver] - Custom storage driver. When omitted, a cacache-based driver is created.
   */
  constructor({ origin, cacheDir, driver } = {}) {
    if (!origin) {
      throw new Error('PackumentCache requires an origin (registry URL)');
    }
    this.origin = origin;
    this._cacheDir = cacheDir || defaultCacheDir();
    this._externalDriver = driver || null;
    /** @type {Cache | null} */
    this._cache = null;
  }

  /** @private */
  async _ensureInitialized() {
    if (this._cache) return;
    const driver = this._externalDriver || new CacacheDriver(this._cacheDir);
    this._cache = new Cache({
      path: this._cacheDir,
      driver
    });
  }

  /**
   * Read a packument from the cache.
   * @param {string} name - Raw package name (e.g. '@babel/core')
   * @returns {Promise<CacheEntry | null>} Decoded cache entry, or null if not cached
   */
  async get(name) {
    await this._ensureInitialized();
    const key = createPackumentKey(name, this.origin);
    const raw = await this._cache.fetch(key);
    if (!raw) return null;
    return CacheEntry.decode(raw);
  }

  /**
   * Write a packument to the cache from an HTTP response.
   * @param {string} name - Raw package name (e.g. '@babel/core')
   * @param {Object} response - Response-shaped object
   * @param {number} response.statusCode - HTTP status code
   * @param {Object|Headers} response.headers - Response headers
   * @param {Object} response.body - Parsed packument JSON
   * @param {string} [response.bodyRaw] - Raw JSON string (skips re-serialization when provided)
   */
  async put(name, { statusCode, headers, body, bodyRaw }) {
    await this._ensureInitialized();
    const entry = new CacheEntry(statusCode, headers);
    if (bodyRaw) {
      entry.setBodyRaw(body, bodyRaw);
    } else {
      await entry.setBody(body);
    }
    const key = createPackumentKey(name, this.origin);
    await this._cache.set(key, entry.encode());
  }

  /**
   * Get conditional request headers for a cached packument.
   * Returns headers suitable for If-None-Match / If-Modified-Since.
   * @param {string} name - Raw package name
   * @returns {Promise<Object>} Header object (may be empty if not cached)
   */
  async conditionalHeaders(name) {
    const entry = await this.get(name);
    if (!entry) return {};
    const result = {};
    if (entry.etag) {
      result['if-none-match'] = entry.etag;
    }
    if (entry.lastModified) {
      result['if-modified-since'] = entry.lastModified;
    }
    return result;
  }

  /**
   * Check if a packument is in the cache.
   * @param {string} name - Raw package name
   * @returns {Promise<boolean>}
   */
  async has(name) {
    await this._ensureInitialized();
    const key = createPackumentKey(name, this.origin);
    return this._cache.has(key);
  }
}
