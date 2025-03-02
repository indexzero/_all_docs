const { join } = require('node:path');
const pDebounce = require('p-debounce').default;

const {
  START,
  SIZE,
  CONCURRENCY,
  DRY_RUN
} = require('../src/env');

const { isPartitionCached } = require('../src/cache');
const { queuedMapLimit } = require('../src/map-reduce');
const { writePartition } = require('../src/index');

const partitions = require(process.env.PARTITIONS);

async function getPartitionRange({ limit, range }) {
  console.log('getPartitionRange', { limit, range: range.length });

  const targets = range.map(partition => {
    return {
      startKey: partition.startKey,
      endKey: partition.endKey,
      id: `${partition.startKey}___${partition.endKey}`,
      // TODO (cjr): use a common system cache directory
      filename: join(__dirname, '..', 'cache', partition.filename)
    }
  });

  const queue = await eachLimit(targets, limit, async function eachFn(partition) {
    const cached = await isPartitionCached(partition);
    if (!cached && !DRY_RUN) {
      await writePartition({
        partition,
        onNoMoreRetries: (err) => {
          queue.add(async () => await eachFn(partition), { priority: 1, id: partition.id });
        }
      });
    }
  });
}

(async function () {
  const limit = CONCURRENCY;
  const parts = [...partitions]

  // Start at the target partition index (if any)
  parts.splice(0, START);

  const ranges = Array.from({ length: Math.ceil(parts.length / SIZE) }, (_, i) =>
    parts.slice(i * SIZE, i * SIZE + SIZE)
  );

  console.dir(ranges);

  const getPartitionRangeRateLimited = pDebounce(
    getPartitionRange, 
    120 * 1000,
    { before: true }
  );

  for await (const range of ranges) {
    await getPartitionRangeRateLimited({ limit, range });
  }
})();
