const { join } = require('node:path');
const { listPartitionsSync } = require('../src/cache'); 

const partitions = require(process.env.PARTITIONS);
const cacheDir = join(__dirname, '..', 'cache');

const local = listPartitionsSync(cacheDir);

const missing = partitions.filter(partition => {
  return !local.find(p => p.id === partition.id);
});

console.dir(missing);
