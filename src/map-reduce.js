const { readFile } = require('node:fs/promises');
const { join } = require('node:path');

const pMap = require('p-map').default;
const PQueue = require('p-queue').default;

const debug = require('debug')('_all_docs/map-reduce');


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

  partitions.forEach(prt => {
    const id = prt.id || `${prt.startKey}___${prt.endKey}`;
    const priority = 0;

    debug(`queue.add | { id: ${id} }`);
    queue.add(async () => await mapFn(prt), { priority, id })
  });

  return queue;
}

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

async function reduceIndexCache(partitions, limit, mapFn) {

  return queue;
}

module.exports = {
  eachLimit,
  mapAllDocsIndex,
  reduceAllDocsIndex
};
