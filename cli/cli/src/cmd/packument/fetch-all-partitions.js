import { resolve } from 'node:path';
import process from 'node:process';
import { Partition, PartitionSet } from '@_all_docs/partition';
import { PackumentClient } from '@_all_docs/packument';
import pMap from 'p-map';
import { Cache } from '@_all_docs/cache';

export const command = async cli => {
  const { pivots } = await import(resolve(process.cwd(), cli.values.pivots));
  const partitions = PartitionSet.fromPivots(cli.values.origin, pivots);

  const cache = new Cache({ path: cli.dir('partitions') });

  // Remark (0): there is no way to pMap read the cache itself so (for now)
  // we use pivots. This reinforces that our own custom `lru-cache` is probably
  // the right call here overall.
  const entries = await pMap(partitions, async partition => [partition.key, await cache.fetch(partition.key)], { concurrency: 50 });

  const packageNamesByPartition = await pMap(entries, async ([key, val]) => {
    const partition = Partition.fromCacheEntry([key, val]);

    const packageNames = partition.rows.map(({ id }) => id);
    if (packageNames.length === 0) {
      console.log(`No packument names in ${partition.key}`);
      return;
    }

    return [key, packageNames];
  }, { concurrency: 10 });

  const totalPackages = packageNamesByPartition.reduce((acc, res) => {
    if (!res) {
      return acc;
    }

    const [, packages] = res;
    return acc + packages.length;
  }, 0);

  console.log(`Fetching ${totalPackages} packuments from ${partitions.length} partitions`);

  const client = new PackumentClient({
    origin: cli.values.registry,
    limit: cli.values.limit,
    dryRun: cli.values.dryRun
  });

  let fetched = 0;
  await pMap(packageNamesByPartition, async res => {
    if (!res) {
      return;
    }

    const [key, packageNames] = res;

    console.log(`Fetch ${packageNames.length} packuments from ${key}`);
    await client.requestAll(packageNames);
    fetched += packageNames.length;
    console.log(`Fetched ${fetched} packuments from ${totalPackages}`);
  }, { concurrency: 10 });
};
