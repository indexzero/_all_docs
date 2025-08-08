import { PackumentClient } from '@_all_docs/packument';

/**
 * Process a packument work item
 * @param {WorkItem} workItem
 * @param {WorkerEnv} env
 * @returns {Promise<WorkResult>}
 */
export async function processPackument(workItem, env) {
  const start = Date.now();
  const { packageName, fetchDependencies = false } = workItem.payload;
  
  try {
    // Create packument client with environment configuration
    const client = new PackumentClient({
      origin: env.NPM_ORIGIN || 'https://registry.npmjs.org',
      env,
      cache: env.CACHE_DIR || env.CACHE_KV || env.CACHE_DICT
    });
    
    // Fetch the packument data
    const entry = await client.request(packageName, {
      staleWhileRevalidate: true,
      cache: true
    });
    
    if (!entry) {
      throw new Error(`Package not found: ${packageName}`);
    }
    
    // Extract metrics
    const packument = entry.body;
    const metrics = {
      packageName,
      versions: Object.keys(packument.versions || {}).length,
      distTags: Object.keys(packument['dist-tags'] || {}).length,
      cacheHit: entry.hit || false,
      statusCode: entry.statusCode,
      hasReadme: !!packument.readme,
      dependencies: []
    };
    
    // Optionally fetch dependencies
    if (fetchDependencies && packument.versions) {
      const latest = packument['dist-tags']?.latest;
      if (latest && packument.versions[latest]) {
        const deps = packument.versions[latest].dependencies || {};
        metrics.dependencies = Object.keys(deps);
      }
    }
    
    return {
      workItemId: workItem.id,
      success: true,
      data: {
        packageName,
        metrics
      },
      duration: Date.now() - start,
      metrics
    };
  } catch (error) {
    return {
      workItemId: workItem.id,
      success: false,
      error: {
        message: error.message,
        statusCode: error.statusCode || 500,
        stack: env.DEBUG ? error.stack : undefined
      },
      duration: Date.now() - start,
    };
  }
}