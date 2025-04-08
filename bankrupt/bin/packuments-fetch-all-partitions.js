const { listPartitionsSync } = require('../src/cache.js');
const { join } = require('node:path');
const { execSync, spawn } = require('node:child_process');

const debug = require('debug')('_all_docs/packuments-fetch-for-partition');

const cacheDir = join(__dirname, '..', 'cache');
const partitions = listPartitionsSync(cacheDir);

function execFetchPackuments(partition) {
  const command = `node bin/packuments-fetch-for-partition.js ${partition.id}`;

  debug('exec fetch packuments |', {
    command,
    partition: partition.id
  });

  execSync(command, {
    cwd: join(__dirname, '..'),
    stdio: ['ignore', 'inherit', 'inherit'],
    env: {
      ...process.env,
      CONCURRENCY: 100,
      SIZE: 2000
    }
  });
}

partitions.forEach(execFetchPackuments);
