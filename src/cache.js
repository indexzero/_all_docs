const { writePartition } = require('./index');
const { access, readFile, unlink, readdir, writeFile } = require('node:fs/promises');
const fs = require('node:fs');
const { basename, join, matchesGlob } = require('node:path');
const { reduceAllDocsIndex } = require('../src/map-reduce');

const debug = require('debug')('_all_docs/cache');
const dryrun = require('./env').DRY_RUN;

function partitionFromFilename(filename) {
  const id = basename(filename, '.json');
  const [startKey, endKey] = id.split('___');
  return { startKey, endKey, id, filename };
}

async function loadPartitions(cacheDir) {
  const filenames = await readdir(cacheDir);

  return filenames
    .filter((filename) => matchesGlob(filename, '*.json'))
    .map(partitionFromFilename);
}

function entryToTuple({ id, key, value }) {
  return [id || key, value.rev];
}


async function isPartitionCached(partition) {
  const { filename } = partition;

  try {
    await access(filename, fs.constants.F_OK);
    debug(`${filename} cache | hit`);
  } catch (err) {
    //
    // 1. If `access` throws with F_OK then the file does not exist
    //
    debug(`${filename} exists | false`)
    return false;
  }

  try {
    const text = await readFile(filename, 'utf8');
    const doc = JSON.parse(text);

    return true;
  } catch (err) {
    //
    // 2. If `JSON.parse` throws then valid JSON contents do not exist 
    //
    debug(`${filename} cache | invalid JSON`);
    await unlink(filename);
    return false;
  }
}

async function refreshPartition({ partition }) {
  const cached = await isPartitionCached(partition)

  if (!cached && !dryrun) {
    await writePartition({ partition });
  }

  return { partition, cached };
}

async function writeAllDocsIndex({ partitions, cacheDir, format = 'append-only' }) {
  const filename = join(cacheDir, '.index');
  const index = await reduceAllDocsIndex({ 
    partitions, 
    cacheDir, 
    reduceFn: format === 'append-only' ? entryToTuple : null
  });

  await writeFile(
    filename, 
    format === 'append-only' 
      // 🤔 (cjr): should the index be JSON? or `_id, rev` tuples?
      // 💡 (cjr): (probably) `_id, rev` tuples
      // ✅ (cjr): lets try `_id, rev` tuples as the default
      ? index.map(([_id, _rev]) => `${_id},${_rev}`).join('\n')
      : JSON.stringify(index, null, 2),
    'utf8'
  );
}

async function getPartition(partition, dryrun) {
  // TODO: Attempt to refresh the partition
  //       & read from cache if 304 returned
}

module.exports = {
  isPartitionCached,
  refreshPartition,
  getPartition,
  loadPartitions,
  writeAllDocsIndex
}
