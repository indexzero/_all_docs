const { mapPackuments } = require('../src/map-reduce.js');
const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');

const debug = require('debug')('_all_docs/packuments-fetch-from-index');

const cacheDir = join(__dirname, '..', 'cache');
const packumentsDir = join(cacheDir, 'packuments');

const argv = require('minimist')(process.argv.slice(2));
const { design, exec } = argv;

const designDoc = require(design);
const view = designDoc.views[exec];
const { map, reduce } = view;

(async function () {
  const results = await mapPackuments({
    cacheDir: packumentsDir,
    mapFn: map,
    concurrency: 100
  });

  if (reduce) {
    const reduced = reduce(results);
    console.log('reduced', reduced);
  }
})();
