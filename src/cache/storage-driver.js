/**
 * Creates a storage driver based on the runtime environment
 * @param {Object} env - Environment configuration
 * @returns {Object} Storage driver instance
 */
export async function createStorageDriver(env) {
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