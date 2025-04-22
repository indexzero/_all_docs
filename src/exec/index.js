const { readFile, readdir } = require('node:fs/promises');
const { join, basename, extname } = require('node:path');
const pMap = require('p-map').default;
const PQueue = require('p-queue').default;
const debug = require('debug')('_all_docs/map-reduce');

/**
 * @typedef {Object} Partition
 * @property {string} filename
 * @property {string} [id]
 * @property {string} [startKey]
 * @property {string} [endKey]
 * @property {any} [_all_docs]
 */

/**
 * @callback PartitionMapper
 * @param {Partition} partition
 * @returns {Promise<any>}
 */

/**
 * Processes each partition with a concurrency limit using a queue.
 * @param {Partition[]} partitions
 * @param {number} limit
 * @param {PartitionMapper} mapFn
 * @returns {import('p-queue').default} A PQueue instance.
 */
async function eachLimit(partitions, limit, mapFn) {
  const queue = new PQueue({ concurrency: limit });
  let count = 0;
  queue.on('active', () => {
    debug(`queuedMapLimit active |`, {
      count: ++count,
      size: queue.size,
      pending: queue.pending
    });
  });

  await queue.addAll(partitions.map(prt => async() => await mapFn(prt)));
}


async function mapPackuments({ cacheDir, mapFn, concurrency = 10 }) {
  let loaded = 0;
  console.dir({ cacheDir });
  const packumentFiles = await readdir(cacheDir);

  return await pMap(packumentFiles, async function runFile(pFile) {
    // TODO (cjr): use join consistently to avoid API wonkiness
    // TODO (cjr): "wonkiness" is a technical term meaning:
    //             "needing cacheDir feels wonky"

    const filename = join(cacheDir, pFile);
    const name = decodeURIComponent(basename(pFile, extname(pFile)));

    console.log('mapPackuments', { package: name, loaded: ++loaded });

    const text = await readFile(filename, 'utf8');
    const packument = JSON.parse(text);

    let results = [];
    mapFn(packument, function emit(key, value) {
      results.push({ id: name, key, value });
    }, { name });

    return results;
  }, { concurrency });
}

module.exports = {
  eachLimit,
  mapAllDocsIndex,
  mapPackuments
};
