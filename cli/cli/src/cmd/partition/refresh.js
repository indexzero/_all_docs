import { resolve } from 'path';

import { AllDocsPartitionClient, Partition } from '@_all_docs/partition';


export const command = async cli => {
  const { pivots } = await import(resolve(process.cwd(), cli._[0]));
  const partitions = Partition.fromPivots(pivots);

  const client = new AllDocsPartitionClient({
    origin: cli.values.origin
  });

  await requestAll(partitions, {
    client,
    limit: cli.values.limit,
    start: cli.values.start,
    size: cli.values.size
  });
}


async function requestAll(partitions, options) {
  const {
    client,
    limit = 500,
    start = 0,
    size = 2000
  } = options;

  const parts = [...partitions];

  // Start at the target partition index (if any)
  parts.splice(0, start);

  const ranges = Array.from(
    { length: Math.ceil(parts.length / size) },
    (_, i) => parts.slice(i * size, i * size + size)
  );

  for await (const range of ranges) {
    const first = range[0];
    const last = range[range.length - 1];
    console.dir({ size: range.length, first: first.id, last: last.id });
    await client.requestAll(range, { limit });
  }
}
