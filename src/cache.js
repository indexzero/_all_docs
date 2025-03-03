/**
 * @typedef {Object} Partition
 * @property {string} startKey
 * @property {string} endKey
 * @property {string} id
 * @property {string} filename
 */

/**
 * @typedef {Object} Entry
 * @property {string} [id]
 * @property {string} key
 * @property {{ rev: string }} value
 */

const { writePartition } = require('./index');
const { access, readFile, unlink, readdir, writeFile } = require('node:fs/promises');
const fs = require('node:fs');
const { basename, join, matchesGlob } = require('node:path');
const { reduceAllDocsIndex } = require('../src/map-reduce');
const debug = require('debug')('_all_docs/cache');
const dryrun = require('./env').DRY_RUN;

/**
 * Converts a filename into a Partition object.
 * @param {string} filename
 * @returns {Partition}
 */
function partitionFromFilename(filename) {
  const id = basename(filename, '.json');
  const [startKey, endKey] = id.split('___');
  return { startKey, endKey, id, filename };
}

/**
 * Loads partitions from a cache directory.
 * @param {string} cacheDir
 * @returns {Promise<Partition[]>}
 */
async function loadPartitions(cacheDir) {
  const filenames = await readdir(cacheDir);
  return filenames
    .filter((filename) => matchesGlob(filename, '*.json'))
    .map(partitionFromFilename);
}

/**
 * Converts an entry object to a tuple.
 * @param {Entry} entry
 * @returns {[string, string]}
 */
function entryToTuple({ id, key, value }) {
  return [id || key, value.rev];
}

/**
 * Checks if a partition file is cached and contains valid JSON.
 * @param {Partition} partition
 * @returns {Promise<boolean>}
 */
async function isPartitionCached(partition) {
  const { filename } = partition;
  try {
    await access(filename, fs.constants.F_OK);
    debug(`${filename} cache | hit`);
  } catch (err) {
    debug(`${filename} exists | false`);
    return false;
  }
  try {
    const text = await readFile(filename, 'utf8');
    JSON.parse(text);
    return true;
  } catch (err) {
    debug(`${filename} cache | invalid JSON`);
    await unlink(filename);
    return false;
  }
}

/**
 * Refreshes a partition if it is not cached.
 * @param {{ partition: Partition }} params
 * @returns {Promise<{ partition: Partition, cached: boolean }>}
 */
async function refreshPartition({ partition }) {
  const cached = await isPartitionCached(partition);
  if (!cached && !dryrun) {
    await writePartition({ partition });
  }
  return { partition, cached };
}

/**
 * Writes the all docs index.
 * @param {{ partitions: Partition[], cacheDir: string, format?: string }} params
 * @returns {Promise<void>}
 */
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
      ? index.map(([_id, _rev]) => `${_id},${_rev}`).join('\n')
      : JSON.stringify(index, null, 2),
    'utf8'
  );
}

/**
 * Retrieves a partition.
 * @param {Partition} partition
 * @param {boolean} dryrun
 * @returns {Promise<void>}
 */
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
};
