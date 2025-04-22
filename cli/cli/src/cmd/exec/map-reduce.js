/*

const { mapPackuments } = require('../src/map-reduce.js');
const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const crypto = require('node:crypto');

function shortId(length) {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

const debug = require('debug')('_all_docs/run-packuments');

const cacheDir = join(__dirname, '..', 'cache');
const packumentsDir = join(cacheDir, 'packuments');

const argv = require('minimist')(process.argv.slice(2));
const { design, exec } = argv;

const designDoc = require(design);
const view = designDoc.views[exec];
const { map, reduce, group } = view;

(async function () {
  const sid = shortId(4);
  const results = await mapPackuments({
    cacheDir: packumentsDir,
    mapFn: map,
    concurrency: 100
  });

  debug('write map output |', sid, results.length);
  await writeFile(`map-${sid}.json`, JSON.stringify(results, null, 2), 'utf8');

  if (reduce) {
    const reduced = reduce(results);
    debug('write reduce output |', sid);
    await writeFile(`reduce-${sid}.json`, JSON.stringify(reduced, null, 2), 'utf8');
  }

  if (group) {
    const groups = group(results);
    debug('write group output |', sid);
    await writeFile(`groups-${sid}.json`, JSON.stringify(groups, null, 2), 'utf8');
  }
})();

*/

export const command = async cli => {
  console.log('-- Currently bankrupt in Chapter 11 reorganization --');
  console.log('Run map-reduce on packuments');
  console.log('-- Currently bankrupt in Chapter 11 reorganization --');
}
