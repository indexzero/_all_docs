import { PartitionFrame } from '@_all_docs/frame';


export const command = async cli => {
  const source = cli.dir('partitions');

  const frame = PartitionFrame.fromCache(source);
  for await (const partition of frame) {
    const { startKey, endKey, rows } = partition;

    // Remark (0): this currently lists out of order. Need to investigate why
    // Likely culprit is the hashing algorithm used by `@vltpkg/cache`
    console.log(`${startKey} -> ${endKey} | ${rows.length} rows`);
  }
}
