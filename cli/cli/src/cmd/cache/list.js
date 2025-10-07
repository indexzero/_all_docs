import { Cache, decodeCacheKey, createStorageDriver } from '@_all_docs/cache';

export const usage = `Usage: _all_docs cache list <entity>

List all cache entries for the specified entity type.

Arguments:
  entity    Type of entries to list: 'packument' or 'partition'

Examples:
  _all_docs cache list packument     List all cached packument keys
  _all_docs cache list partition     List all cached partition keys
`;

export const command = async cli => {
  const entity = cli._[0];

  if (!entity) {
    console.error('Error: Entity type required (packument or partition)');
    console.error(usage);
    process.exit(1);
  }

  if (!['packument', 'partition'].includes(entity)) {
    console.error(`Error: Invalid entity type '${entity}'. Must be 'packument' or 'partition'`);
    console.error(usage);
    process.exit(1);
  }

  // Create environment for storage driver
  const env = {
    CACHE_DIR: cli.dir(`${entity}s`)
  };

  // Create storage driver
  const driver = await createStorageDriver(env);
  const cache = new Cache({ path: cli.dir(`${entity}s`), driver });

  let count = 0;
  console.log(`Listing ${entity} cache entries from: ${cli.dir(`${entity}s`)}\n`);

  try {
    const entries = [];

    for await (const key of cache.keys('')) {
      try {
        const decoded = decodeCacheKey(key);

        if (entity === 'packument' && decoded.type === 'packument') {
          entries.push({
            name: decoded.packageName,
            origin: decoded.origin,
            key
          });
        } else if (entity === 'partition' && decoded.type === 'partition') {
          entries.push({
            range: `${decoded.startKey || '(start)'} → ${decoded.endKey || '(end)'}`,
            origin: decoded.origin,
            key
          });
        }
      } catch (decodeError) {
        // If we can't decode, show the raw key
        console.warn(`Warning: Could not decode key: ${key}`);
        entries.push({ key, name: '(decode error)' });
      }
      count++;
    }

    // Sort entries for better readability
    if (entity === 'packument') {
      entries.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      // Display packuments
      for (const entry of entries) {
        if (entry.origin && entry.origin !== 'https://registry.npmjs.com') {
          console.log(`${entry.name} (${entry.origin})`);
        } else {
          console.log(entry.name);
        }
      }
    } else {
      // Display partitions
      for (const entry of entries) {
        if (entry.range) {
          console.log(`[${entry.range}]`);
        } else {
          console.log(entry.key);
        }
      }
    }

    console.log(`\nTotal ${entity} entries: ${count}`);
  } catch (error) {
    console.error(`Error listing ${entity} cache:`, error.message);
    process.exit(1);
  }
};