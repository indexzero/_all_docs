/**
 * @fileoverview Shared interfaces for runtime-agnostic abstractions
 */

/**
 * @typedef {Object} Storage
 * @property {(key: string) => Promise<any>} get - Retrieve value by key
 * @property {(key: string, value: any) => Promise<void>} put - Store value by key
 * @property {(key: string) => Promise<void>} delete - Delete value by key
 * @property {(key: string) => Promise<boolean>} has - Check if key exists
 * @property {(prefix: string) => AsyncIterator<string>} list - List keys by prefix
 * @property {(keys: string[]) => Promise<Map<string, any>>} [getBatch] - Get multiple values
 * @property {(entries: Array<{key: string, value: any}>) => Promise<void>} [putBatch] - Put multiple values
 */

/**
 * @typedef {Object} WorkItem
 * @property {string} type - Work item type (partition, packument, partition-set)
 * @property {string} id - Unique identifier for deduplication
 * @property {Object} payload - Type-specific payload data
 * @property {number} priority - Higher number = higher priority
 * @property {number} attempts - Number of previous attempts
 */

/**
 * @typedef {Object} Queue
 * @property {(item: WorkItem) => Promise<void>} enqueue - Add work item to queue
 * @property {(processor: Function) => void} process - Register work processor
 * @property {() => Promise<number>} size - Get queue size
 */

/**
 * @typedef {Object} RuntimeConfig
 * @property {Storage} storage - Storage implementation
 * @property {Queue} queue - Queue implementation
 * @property {Object} env - Runtime environment variables
 */

/**
 * @typedef {Object} ProcessorResult
 * @property {boolean} success - Whether processing succeeded
 * @property {Object} [data] - Result data
 * @property {Object} [metrics] - Processing metrics
 * @property {Error} [error] - Error if processing failed
 */