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

/**
 * Reads and parses JSON from files for each partition.
 * @param {{ partitions: Partition[], cacheDir: string, concurrency?: number }} params
 * @returns {Promise<Partition[]>}
 */
async function mapAllDocsIndex({ partitions, cacheDir, concurrency = 10 }) {
  let loaded = 0;
  return await pMap(partitions, async function mapFn(partition) {
    const { filename } = partition;
    console.log('mapAllDocsIndex', { filename, loaded: ++loaded });
    // TODO (cjr): use join consistently to avoid API wonkiness
    // TODO (cjr): "wonkiness" is a technical term meaning: 
    //             "needing cacheDir feels wonky"
    const text = await readFile(join(cacheDir, filename), 'utf8');
    partition._all_docs = JSON.parse(text);
    return partition;
  }, { concurrency });
}

/**
 * Reduces all docs index by mapping partitions and applying an optional reduction function.
 * @param {{ partitions: Partition[], cacheDir: string, reduceFn?: (row: any) => any, concurrency?: number }} params
 * @returns {Promise<any[]>}
 */
async function reduceAllDocsIndex({ partitions, cacheDir, reduceFn, concurrency = 10 }) {
  partitions = await mapAllDocsIndex({ 
    partitions,
    cacheDir,
    concurrency
  });

  return partitions.reduce((acc, partition, i) => {
    const { _all_docs } = partition;
    console.log('reduceAllDocsIndex', { i });

    if (!_all_docs || !_all_docs.rows || !_all_docs.rows.length) {
      return acc;
    }

    const addToIndex = reduceFn
      ? _all_docs.rows.map(reduceFn)
      : _all_docs.rows;

    acc.push.apply(acc, addToIndex);
    return acc;
  }, []);
}

async function mapPackuments({ cacheDir, mapFn, concurrency = 10 }) {
  let loaded = 0;
  console.dir({ cacheDir });
  const packumentFiles = await readdir(cacheDir);

  console.dir({ packumentFiles });
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
  reduceAllDocsIndex,
  mapPackuments
};
