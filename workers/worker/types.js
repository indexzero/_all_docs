/**
 * @typedef {Object} WorkerEnv
 * @property {KVNamespace} [CACHE_KV] - Cloudflare KV namespace
 * @property {Dictionary} [CACHE_DICT] - Fastly edge dictionary
 * @property {string} [CACHE_DIR] - Node.js cache directory
 * @property {string} NPM_ORIGIN - npm registry origin
 * @property {'node' | 'cloudflare' | 'fastly'} RUNTIME
 */

/**
 * @typedef {Object} WorkItem
 * @property {'partition-set' | 'partition' | 'packument'} type
 * @property {string} id - Unique identifier for deduplication
 * @property {Object} payload - Type-specific payload
 * @property {number} priority - Higher priority items processed first
 * @property {number} attempts - Number of previous attempts
 */

/**
 * @typedef {Object} WorkResult
 * @property {string} workItemId
 * @property {boolean} success
 * @property {Object} [data] - Result data if successful
 * @property {Error} [error] - Error if failed
 * @property {number} duration - Processing time in ms
 * @property {Object} [metrics] - Optional performance metrics
 */

export const WorkItemTypes = {
  PARTITION_SET: 'partition-set',
  PARTITION: 'partition',
  PACKUMENT: 'packument'
};