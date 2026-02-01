/**
 * Origin adapters for view queries
 *
 * Provides a unified interface for iterating packuments from different sources:
 * - CacheAdapter: Reads from @_all_docs cache storage
 * - LocalDirAdapter: Reads JSON files from local directory
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Check if an origin string represents a local path
 * @param {string} origin - Origin string (URL, encoded origin, or path)
 * @returns {boolean} True if origin is a local path
 */
export function isLocalOrigin(origin) {
  if (!origin) return false;

  // file:// URL
  if (origin.startsWith('file://')) return true;

  // Absolute path (Unix)
  if (origin.startsWith('/')) return true;

  // Relative path starting with ./
  if (origin.startsWith('./') || origin.startsWith('../')) return true;

  // Windows absolute path (C:\, D:\, etc.)
  if (/^[A-Za-z]:[\\\/]/.test(origin)) return true;

  // Path that exists on disk
  if (existsSync(origin)) return true;

  return false;
}

/**
 * Normalize origin to a filesystem path
 * @param {string} origin - Origin string
 * @returns {string} Filesystem path
 */
function normalizePath(origin) {
  if (origin.startsWith('file://')) {
    return origin.replace('file://', '');
  }
  return origin;
}

/**
 * Cache adapter - reads from @_all_docs cache storage
 */
export class CacheAdapter {
  /**
   * @param {Cache} cache - Cache instance
   * @param {string} keyPrefix - Cache key prefix for this view
   */
  constructor(cache, keyPrefix) {
    this.cache = cache;
    this.keyPrefix = keyPrefix;
  }

  /**
   * Iterate keys matching the prefix
   * @yields {string} Cache keys
   */
  async *keys() {
    yield* this.cache.keys(this.keyPrefix);
  }

  /**
   * Fetch a packument by cache key
   * @param {string} key - Cache key
   * @returns {Promise<object|null>} Packument or null
   */
  async fetch(key) {
    try {
      const entry = await this.cache.fetch(key);
      if (!entry) return null;
      return entry.body || entry;
    } catch {
      return null;
    }
  }
}

/**
 * Local directory adapter - reads JSON files from a directory
 */
export class LocalDirAdapter {
  /**
   * @param {string} dirPath - Path to directory containing packument JSON files
   */
  constructor(dirPath) {
    this.dirPath = normalizePath(dirPath);
  }

  /**
   * Iterate JSON files in the directory
   * @yields {string} Filenames (used as keys)
   */
  async *keys() {
    const files = await readdir(this.dirPath);
    for (const file of files) {
      if (file.endsWith('.json')) {
        yield file;
      }
    }
  }

  /**
   * Fetch a packument by filename
   * @param {string} key - Filename
   * @returns {Promise<object|null>} Packument or null
   */
  async fetch(key) {
    try {
      const filePath = join(this.dirPath, key);
      const content = await readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}

/**
 * Create an appropriate origin adapter based on view configuration
 * @param {View} view - The view definition
 * @param {Cache} cache - Cache instance (used for cache-based origins)
 * @returns {CacheAdapter|LocalDirAdapter} Origin adapter
 */
export function createOriginAdapter(view, cache) {
  const origin = view.registry || view.origin;

  if (isLocalOrigin(origin)) {
    return new LocalDirAdapter(origin);
  }

  return new CacheAdapter(cache, view.getCacheKeyPrefix());
}
