const { join } = require('node:path');
const pDebounce = require('p-debounce').default;
const delay = require('delay').default;

const {
  START,
  SIZE,
  CONCURRENCY,
  DRY_RUN
} = require('../src/env');

const { isJsonCached } = require('../src/cache');
const { eachLimit } = require('../src/map-reduce');
const { writePartition } = require('../src/index');
const { fromPivots } = require('../src/partitions');

const pivots = require(process.env.PIVOTS);
const partitions = fromPivots(pivots);
console.dir(partitions.length);

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

  let misses = 0;
  await eachLimit(targets, limit, async function eachFn(partition) {
    const cached = await isJsonCached(partition.filename);
    if (!cached && !DRY_RUN) {
      misses = misses + 1;
      await writePartition({ partition });
    }
  });

  if (misses === 0) {
    console.log("No misses, waiting 10ms");
    await delay(10);
  } else {
    const wait = 60 * misses;
    console.log(`${misses} Misses, waiting ${wait/1000}s`);
    await delay(wait);
  }
}

const argv = require('minimist')(process.argv.slice(2));

(async function () {
  const limit = CONCURRENCY;
  // if (argv.range) {
  //   const range = argv.range.split(',');
  //   await getPartitionRange({ 
  //     limit,
  //     range: [{
  //       startKey: range[0],
  //       endKey: range[1],
  //       id: `${range[0]}___${range[1]}`,
  //       filename: join(__dirname, '..', 'cache', `${range[0]}___${range[1]}.json`)
  //     }]
  //   });

  //   return;
  // }

  const parts = [...partitions]

  // Start at the target partition index (if any)
  parts.splice(0, START);

  const ranges = Array.from({ length: Math.ceil(parts.length / SIZE) }, (_, i) =>
    parts.slice(i * SIZE, i * SIZE + SIZE)
  );

  for await (const range of ranges) {
    const first = range[0];
    const last = range[range.length - 1];
    console.dir({ size: range.length, first: first.id, last: last.id });
    await getPartitionRange({ limit, range });
  }
})();
