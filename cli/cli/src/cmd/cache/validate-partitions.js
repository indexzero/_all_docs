import { resolve } from 'node:path';
import process from 'node:process';
import { PartitionSet } from '@_all_docs/partition';
import pMap from 'p-map';
import { Cache } from '@_all_docs/cache';

export const command = async cli => {
  // TODO: this should be --pivots and not in the splat
  const { pivots } = await import(resolve(process.cwd(), cli.values.pivots));
  const partitions = PartitionSet.fromPivots(cli.values.origin, pivots);

  const cache = new Cache({ path: cli.dir('partitions') });

  const result = await pMap(partitions, async partition => {
    const entry = await cache.fetch(partition.key);
    return entry
      ? undefined
      : partition.key;
  }, { concurrency: 10 });

  const missing = result.filter(Boolean);

  // Remark (0): this output feels ugly right now
  return {
    action: 'inspect',
    inspect: missing
  };
};

// Remark (0): how do we make this as fast as the pMap version above?
//
// import { PartitionFrame } from '@_all_docs/frame';
//
// export const command = async cli => {
//   const { pivots } = await import(resolve(process.cwd(), cli.values.pivots));
//   const set = PartitionSet.fromPivots(cli.values.origin, pivots);
//
//   const missing = await Array.fromAsync(
//     PartitionFrame.fromCache(cli.dir('partitions'))
//       .filter(p => !set.has(p))
//   );
//
//   // Remark (0): this output feels ugly right now
//   return {
//     action: 'inspect',
//     inspect: missing
//   }
// }
