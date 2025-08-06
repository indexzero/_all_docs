/**
 * @typedef {Object} WorkerEnv
 * @property {KVNamespace} [CACHE_KV] - Cloudflare KV namespace
 * @property {Dictionary} [CACHE_DICT] - Fastly edge dictionary
 * @property {string} [CACHE_DIR] - Node.js cache directory
 * @property {string} [CACHE_BUCKET] - Google Cloud Storage bucket
 * @property {string} NPM_ORIGIN - npm registry origin
 * @property {'node' | 'cloudflare' | 'fastly' | 'cloudrun'} RUNTIME
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

/**
 * @typedef {Object} StorageDriver
 * @property {(key: string) => Promise<any>} get
 * @property {(key: string, value: any, options?: Object) => Promise<void>} put
 * @property {(key: string) => Promise<boolean>} has
 * @property {(key: string) => Promise<void>} delete
 * @property {(prefix: string) => AsyncIterator<string>} list
 */

export const WorkItemTypes = {
  PARTITION_SET: 'partition-set',
  PARTITION: 'partition',
  PACKUMENT: 'packument'
};

export const RuntimeTypes = {
  NODE: 'node',
  CLOUDFLARE: 'cloudflare',
  FASTLY: 'fastly',
  CLOUDRUN: 'cloudrun'
};