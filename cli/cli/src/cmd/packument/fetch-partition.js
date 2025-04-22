import { Partition } from '@_all_docs/partition';
import { Cache } from '@_all_docs/cache';
import { PackumentClient } from '@_all_docs/packument';

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

  const client = new PackumentClient({
    origin: cli.values.registry,
    limit: cli.values.limit,
    dryRun: cli.values.dryRun
  });

  const packageNames = partition.rows.map(({ id }) => id);

  const entries = await client.requestAll(packageNames);

  // Remark (0): do we really need this? If we do it should probably be
  // returned to outputCommand
  if (!cli.values.validate) {
    console.log({ entries });
    // // Validate the writes with a cache walk
    // const cacheDir = cli.dir('packuments');
    // const packuments = new Cache({ path: cacheDir });
    // for (const pku of packuments) {
    //   const [key, val] = pku;
    //   console.dir({
    //     key,
    //     val
    //   });
    // }
  }
}
