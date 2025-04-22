import { Cache } from '@_all_docs/cache';
import { Partition } from '@_all_docs/partition';

export const command = async cli => {
  const cache = new Cache({ path: cli.dir('partitions') });

  const key = Partition.cacheKey(
    cli.values.start,
    cli.values.end,
    cli.values.origin
  );

  const val = await cache.fetch(key);
  if (!val) {
    console.error('Partition not found in cache');
    return;
  }

  const partition = Partition.fromCacheEntry([key, val]);

  console.dir(partition.rows);
}
