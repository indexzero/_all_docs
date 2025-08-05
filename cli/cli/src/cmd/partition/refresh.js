import { resolve } from 'node:path';
import process from 'node:process';
import { PartitionClient, PartitionSet } from '@_all_docs/partition';

export const command = async cli => {
  const { pivots } = await import(resolve(process.cwd(), cli.values.pivots));
  const partitions = PartitionSet.fromPivots(cli.values.origin, pivots);

  const client = new PartitionClient({
    origin: cli.values.origin
  });

  await requestAll(partitions, {
    client,
    limit: cli.values.limit,
    start: cli.values.start,
    size: cli.values.size,
    cache: cli.values.cache,
    refresh: cli.values.refresh
  });
};

async function requestAll(partitions, options) {
  const {
    client,
    // Remark (0): setting this to 1000 caused odd disk cache behavior.
    // Sanitize it to be below 100.
    limit = 25,
    start = 0,
    size = 2000,
    cache,
    refresh
  } = options;

  const parts = [...partitions];

  // Start at the target partition index (if any)
  parts.splice(0, start);

  const ranges = Array.from(
    { length: Math.ceil(parts.length / size) },
    (_, i) => parts.slice(i * size, (i * size) + size)
  );

  for await (const range of ranges) {
    const first = range[0];
    const last = range.at(-1);
    console.dir({ size: range.length, first: first.key, last: last.key });
    await client.requestAll(range, { limit, cache, refresh });
  }
}
