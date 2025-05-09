const { join } = require('node:path');
const { listPartitions, writeAllDocsIndex } = require('../src/cache');




(async function () {
  const cacheDir = join(__dirname, '..', 'cache');
  const concurrency = 10;

  const partitions = await listPartitions(cacheDir);
  await writeAllDocsIndex({ partitions, cacheDir });
})();
