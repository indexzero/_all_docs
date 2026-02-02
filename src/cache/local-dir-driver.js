/**
 * Local directory storage driver - reads packument JSON files from a directory
 *
 * This is a read-only storage driver that allows mounting existing directories
 * of packument JSON files as a virtual cache. Useful for analyzing local datasets
 * without importing them into the cache.
 */
import { readdir, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Check if an origin string represents a local path
 * @param {string} origin - Origin string (URL, encoded origin, or path)
 * @returns {boolean} True if origin is a local path
 */
export function isLocalPath(origin) {
  if (!origin) return false;

  // file:// URL
  if (origin.startsWith('file://')) return true;

  // Absolute path (Unix)
  if (origin.startsWith('/')) return true;

  // Relative path starting with ./
  if (origin.startsWith('./') || origin.startsWith('../')) return true;

  // Windows absolute path (C:\, D:\, etc.)
  if (/^[A-Za-z]:[\\\/]/.test(origin)) return true;

  // Path that exists on disk (fallback check)
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
 * Read-only storage driver for local directories of JSON files
 */
export class LocalDirStorageDriver {
  /**
   * @param {string} dirPath - Path to directory containing packument JSON files
   */
  constructor(dirPath) {
    this.dirPath = normalizePath(dirPath);
    this.supportsBatch = false;
    this.supportsBloom = false;
  }

  /**
   * Get a packument by key (filename)
   * @param {string} key - Filename (with or without .json extension)
   * @returns {Promise<object>} Parsed JSON content
   * @throws {Error} If file not found or invalid JSON
   */
  async get(key) {
    const filename = key.endsWith('.json') ? key : `${key}.json`;
    const filePath = join(this.dirPath, filename);

    try {
      const content = await readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Key not found: ${key}`);
      }
      throw error;
    }
  }

  /**
   * Check if a key exists
   * @param {string} key - Filename
   * @returns {Promise<boolean>}
   */
  async has(key) {
    const filename = key.endsWith('.json') ? key : `${key}.json`;
    const filePath = join(this.dirPath, filename);

    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all JSON files in the directory
   * Note: prefix is ignored for local directories since the directory path
   * itself serves as the namespace isolation.
   * @param {string} [_prefix] - Ignored for local directories
   * @yields {string} Filenames
   */
  async *list(_prefix) {
    const files = await readdir(this.dirPath);
    for (const file of files) {
      if (file.endsWith('.json')) {
        yield file;
      }
    }
  }

  /**
   * Put is not supported - this is a read-only driver
   * @throws {Error} Always throws
   */
  async put(_key, _value) {
    throw new Error('LocalDirStorageDriver is read-only');
  }

  /**
   * Delete is not supported - this is a read-only driver
   * @throws {Error} Always throws
   */
  async delete(_key) {
    throw new Error('LocalDirStorageDriver is read-only');
  }

  /**
   * Clear is not supported - this is a read-only driver
   * @throws {Error} Always throws
   */
  async clear() {
    throw new Error('LocalDirStorageDriver is read-only');
  }

  /**
   * Batch put is not supported - this is a read-only driver
   * @throws {Error} Always throws
   */
  async putBatch(_entries) {
    throw new Error('LocalDirStorageDriver is read-only');
  }

  /**
   * Get metadata info for a file (basic implementation)
   * @param {string} key - Filename
   * @returns {Promise<object|null>} Basic info or null if not found
   */
  async info(key) {
    const exists = await this.has(key);
    if (!exists) return null;
    return { key, path: join(this.dirPath, key) };
  }
}
