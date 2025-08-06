import { RuntimeTypes } from '@_all_docs/types';

export { NodeStorageDriver } from './drivers/node.js';
export { CloudflareStorageDriver } from './drivers/cloudflare.js';
export { FastlyStorageDriver } from './drivers/fastly.js';
export { GCSStorageDriver } from './drivers/gcs.js';

export async function createStorageDriver(env) {
  switch (env.RUNTIME) {
    case RuntimeTypes.NODE:
      const { NodeStorageDriver } = await import('./drivers/node.js');
      return new NodeStorageDriver(env.CACHE_DIR);
    
    case RuntimeTypes.CLOUDFLARE:
      const { CloudflareStorageDriver } = await import('./drivers/cloudflare.js');
      return new CloudflareStorageDriver(env.CACHE_KV);
    
    case RuntimeTypes.FASTLY:
      const { FastlyStorageDriver } = await import('./drivers/fastly.js');
      return new FastlyStorageDriver(env.CACHE_DICT);
    
    case RuntimeTypes.CLOUDRUN:
      if (env.CACHE_BUCKET) {
        const { GCSStorageDriver } = await import('./drivers/gcs.js');
        return new GCSStorageDriver(env.CACHE_BUCKET);
      }
      const { NodeStorageDriver: NodeDriver } = await import('./drivers/node.js');
      return new NodeDriver(env.CACHE_DIR || '/tmp/cache');
    
    default:
      throw new Error(`Unsupported runtime: ${env.RUNTIME}`);
  }
}