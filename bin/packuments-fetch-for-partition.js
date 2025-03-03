const { cachePackumentsSeries, getPackumentsLimit } = require('../src/packument.js');
const { readFileSync } = require('node:fs');
const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { execSync, exec } = require('node:child_process');

const debug = require('debug')('_all_docs/packuments-fetch-for-partition');

const cacheDir = join(__dirname, '..', 'cache');
const packumentsDir = join(cacheDir, 'packuments');

const PARTITION_ID = process.argv[2]
  || process.env.PARTITION_ID;

const partition = JSON.parse(
  readFileSync(join(cacheDir, `${PARTITION_ID}.json`), 'utf8')
);

(async function () {
  const limit = 10;

  const packageNames = partition.rows.map(({ id }) => id);

  debug('cache packuments |', {
    partition: PARTITION_ID,
    size: partition.rows.length
  });

  let cached = 0;
  cachePackumentsSeries(packageNames, async function writePackument(packument) {
    const { _id, _rev } = packument;

    debug('cache packument | ', { _id, _rev, cached: ++cached });

    writeFile(join(packumentsDir, `${_id}.json`), JSON.stringify(packument));
  });
})();
