const { listPartitionsSync } = require('../src/cache.js');
const { cachePackumentsSeries, getPackumentsLimit } = require('../src/packument.js');
const { readFileSync } = require('node:fs');
const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { execSync, exec } = require('node:child_process');
const { DRY_RUN } = require('../src/env.js');

const debug = require('debug')('_all_docs/packuments-fetch-for-partition');

const cacheDir = join(__dirname, '..', 'cache');
const packumentsDir = join(cacheDir, 'packuments');

const partitions = listPartitionsSync(cacheDir);

function execFetchPackuments(partition) {
  const command = `node bin/packuments-fetch-for-partition.js ${partition.id}`;

  debug('fetch packuments |', {
    command,
    partition: partition.id
  });

  execSync(command, {
    cwd: join(__dirname, '..'),
    env: {
      CONCURRENCY: 100,
      SIZE: 2000,
      PARTITIONS: process.env.PARTITIONS,
      DEBUG: process.env.DEBUG,
      DRY_RUN: process.env.DRY_RUN
    }
  });
}

partitions.forEach(execFetchPackuments);
