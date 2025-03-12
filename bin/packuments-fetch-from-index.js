const { cachePackumentsSeries, getPackumentsLimit } = require('../src/packument.js');
const { readFileSync } = require('node:fs');
const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { execSync, exec } = require('node:child_process');

const debug = require('debug')('_all_docs/packuments-fetch-from-index');

const cacheDir = join(__dirname, '..', 'cache');
const indexFilename = join(cacheDir, '.index');
const packumentsDir = join(cacheDir, 'packuments');

// const indexEntries = execSync(`head -n 100 ${indexFilename}`, { stdio: [] })
  // .toString()
  // .split('\n')
  // .filter(Boolean)
  // .map(line => line.trim().split(','));

const indexEntries = readFileSync(indexFilename, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map(line => line.trim().split(','));

(async function () {
  const limit = 10;

  const packageNames = indexEntries.map(([name]) => name);

  let cached = 0;
  cachePackumentsSeries(packageNames, async function writePackument(packument) {
    const { _id, _rev } = packument;

    debug('cache packument | ', { _id, _rev, cached: ++cached });

    writeFile(join(packumentsDir, `${_id}.json`), JSON.stringify(packument));
  }, { cacheDir });
})();
