/**
 * Query execution for views
 *
 * The cache instance should be configured with the appropriate storage driver:
 * - For registry origins: Use createStorageDriver({ CACHE_DIR: ... })
 * - For local directories: Use createStorageDriver({ LOCAL_DIR: ... })
 */
import { createProjection, createFilter } from './projection.js';

/**
 * Query a view, yielding projected records
 * @param {View} view - The view to query
 * @param {Cache} cache - The cache instance configured with appropriate driver
 * @param {Object} options - Query options
 * @param {number} [options.limit] - Maximum records to return
 * @param {string} [options.where] - Additional filter expression
 * @param {boolean} [options.progress] - Show progress on stderr
 * @param {string} [options.keyPrefix] - Override key prefix (defaults to view.getCacheKeyPrefix())
 * @yields {Object} Projected records
 */
export async function* queryView(view, cache, options = {}) {
  const { limit, where, progress = false, keyPrefix } = options;

  // Compile projection from view's select
  const project = createProjection({ select: view.select });

  // Compile additional filter if provided
  const filter = createFilter({ where });

  // Get key prefix - for local dirs this will be ignored by the driver
  const prefix = keyPrefix ?? view.getCacheKeyPrefix();

  let count = 0;
  let yielded = 0;

  for await (const key of cache.keys(prefix)) {
    // Check limit
    if (limit && yielded >= limit) break;

    count++;

    // Progress reporting
    if (progress && count % 10000 === 0) {
      process.stderr.write(`\rProcessed ${count} records, yielded ${yielded}...`);
    }

    try {
      const entry = await cache.fetch(key);
      if (!entry) continue;

      // Extract the packument body from cache entry
      const value = entry.body || entry;

      // Apply view's projection
      const projected = project(value);

      // Apply additional filter
      if (!filter(projected)) continue;

      yielded++;
      yield projected;
    } catch (err) {
      // Log and continue on individual record errors
      if (progress) {
        process.stderr.write(`\nError processing ${key}: ${err.message}\n`);
      }
    }
  }

  // Clear progress line
  if (progress && count > 0) {
    process.stderr.write(`\rProcessed ${count} records, yielded ${yielded}    \n`);
  }
}

/**
 * Count records in a view (without yielding them)
 */
export async function countView(view, cache, options = {}) {
  let count = 0;
  for await (const _ of queryView(view, cache, options)) {
    count++;
  }
  return count;
}

/**
 * Collect all records from a view into an array
 * Use with caution for large views!
 */
export async function collectView(view, cache, options = {}) {
  const results = [];
  for await (const record of queryView(view, cache, options)) {
    results.push(record);
  }
  return results;
}
