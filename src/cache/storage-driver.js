import { LocalDirStorageDriver, isLocalPath } from './local-dir-driver.js';

export { LocalDirStorageDriver, isLocalPath };

/**
 * Creates a storage driver based on the runtime environment
 * @param {Object} env - Environment configuration
 * @param {string} [env.LOCAL_DIR] - Local directory path (read-only driver)
 * @param {string} [env.CACHE_DIR] - Cache directory path
 * @param {string} [env.RUNTIME] - Runtime environment (node, cloudflare, fastly, cloudrun)
 * @returns {Object} Storage driver instance
 */
export async function createStorageDriver(env) {
  // Local directory takes precedence - it's a read-only mount
  if (env?.LOCAL_DIR) {
    return new LocalDirStorageDriver(env.LOCAL_DIR);
  }

  const runtime = env?.RUNTIME || 'node';

  switch (runtime) {
    case 'node': {
      const { NodeStorageDriver } = await import('../../workers/node/storage.js');
      return new NodeStorageDriver(env.CACHE_DIR);
    }
    case 'cloudflare': {
      const { CloudflareStorageDriver } = await import('../../workers/cloudflare/storage.js');
      return new CloudflareStorageDriver(env.CACHE_KV);
    }
    case 'fastly': {
      const { FastlyStorageDriver } = await import('../../workers/fastly/storage.js');
      return new FastlyStorageDriver(env);
    }
    case 'cloudrun': {
      const { GCSStorageDriver } = await import('../../workers/cloudrun/storage.js');
      return new GCSStorageDriver(env.GCS_BUCKET);
    }
    default:
      throw new Error(`Unsupported runtime: ${runtime}`);
  }
}