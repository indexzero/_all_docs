const { cachePackumentsLimit } = require('../src/packument.js');
const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');

const delay = require('delay').default;
const debug = require('debug')('_all_docs/packuments-fetch-from-index');

const cacheDir = join(__dirname, '..', 'cache');
const packumentsDir = join(cacheDir, 'packuments');

const argv = require('minimist')(process.argv.slice(2));
const filename = argv._[0] || 'npm-high-impact.json';

const list = require(filename);

(async function () {
  const limit = 10;
  const SIZE = 2000;

  const packageNames = [...list];

  const ranges = Array.from({ length: Math.ceil(packageNames.length / SIZE) }, (_, i) =>
    packageNames.slice(i * SIZE, i * SIZE + SIZE)
  );

  for await (const range of ranges) {
    const first = range[0];
    const last = range[range.length - 1];
    console.dir({ size: range.length, first, last });

    const misses = await cachePackumentsLimit(range, async function writePackument(packument) {
      const { _id, _rev } = packument;

      debug('cache packument | ', { _id, _rev });

      writeFile(join(packumentsDir, `${encodeURIComponent(_id)}.json`), JSON.stringify(packument));
    }, { cacheDir: packumentsDir, limit });

    console.dir({ misses });

    if (misses === 0) {
      console.log("No misses, waiting 10ms");
      await delay(10);
    } else {
      const wait = 60 * misses;
      console.log(`${misses} Misses, waiting ${wait / 1000}s`);
      await delay(wait);
    }
  }
})();
