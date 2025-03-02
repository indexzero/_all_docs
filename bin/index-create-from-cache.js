const { join } = require('node:path');
const { loadPartitions, writeAllDocsIndex } = require('../src/cache');




(async function () {
  const cacheDir = join(__dirname, '..', 'cache');
  const concurrency = 10;

  const partitions = await loadPartitions(cacheDir);
  await writeAllDocsIndex({ partitions, cacheDir });
})();
